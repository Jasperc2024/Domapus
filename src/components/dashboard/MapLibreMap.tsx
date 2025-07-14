import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
import { getMetricValue, getMetricDisplay } from "./map/utils";
import { MapProps } from "./map/types";

// Custom hook for web worker
function useDataWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({
    phase: "idle",
    processed: 0,
    total: 0,
  });

  useEffect(() => {
    // Try to create worker, fallback to main thread if it fails
    try {
      const workerUrl = "/Domapus/workers/data-processor.js";
      // Check if the worker file exists before creating
      fetch(workerUrl, { method: "HEAD" })
        .then((response) => {
          if (response.ok) {
            try {
              workerRef.current = new Worker(workerUrl);

              workerRef.current.onmessage = (e) => {
                const { type, data, error } = e.data;

                switch (type) {
                  case "PROGRESS":
                    setProgress(data);
                    break;
                  case "ERROR":
                    console.error("Worker error:", error);
                    setIsLoading(false);
                    break;
                }
              };

              workerRef.current.onerror = (error) => {
                console.warn(
                  "Web worker failed, falling back to main thread:",
                  error,
                );
                workerRef.current = null;
              };
            } catch (workerError) {
              console.warn("Failed to create worker:", workerError);
              workerRef.current = null;
            }
          } else {
            console.warn("Worker file not found, using main thread");
            workerRef.current = null;
          }
        })
        .catch(() => {
          console.warn("Cannot check worker file, using main thread");
          workerRef.current = null;
        });
    } catch (error) {
      console.warn("Web worker not supported, using main thread:", error);
      workerRef.current = null;
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const processData = useCallback(async (message: any) => {
    return new Promise(async (resolve, reject) => {
      if (workerRef.current) {
        // Use web worker
        const id = Math.random().toString(36);
        setIsLoading(true);

        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === id) {
            workerRef.current?.removeEventListener("message", handleMessage);
            setIsLoading(false);

            if (e.data.type.includes("ERROR")) {
              reject(new Error(e.data.error));
            } else {
              resolve(e.data.data);
            }
          }
        };

        workerRef.current.addEventListener("message", handleMessage);
        workerRef.current.postMessage({ ...message, id });
      } else {
        // Fallback to main thread
        try {
          setIsLoading(true);
          const result = await processDataMainThread(message);
          setIsLoading(false);
          resolve(result);
        } catch (error) {
          setIsLoading(false);
          reject(error);
        }
      }
    });
  }, []);

  // Fallback data processing on main thread
  const processDataMainThread = async (message: any) => {
    const { type, data } = message;

    if (type === "LOAD_AND_PROCESS_DATA") {
      const { urls, selectedMetric } = data;

      // Load ZIP data
      const zipResponse = await fetch(urls.zipData);
      const zipArrayBuffer = await zipResponse.arrayBuffer();
      const pako = await import("pako");
      const zipDecompressed = pako.ungzip(new Uint8Array(zipArrayBuffer), {
        to: "string",
      });
      const zipData = JSON.parse(zipDecompressed);

      // Load cities data
      const citiesResponse = await fetch(urls.citiesData);
      const citiesArrayBuffer = await citiesResponse.arrayBuffer();
      const citiesDecompressed = pako.ungzip(
        new Uint8Array(citiesArrayBuffer),
        { to: "string" },
      );

      // Parse cities CSV
      const citiesMap: Record<string, any> = {};
      const lines = citiesDecompressed.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length >= 10) {
          const zip = parts[0]?.trim();
          const city = parts[6]?.trim();
          const lat = parts[8] ? parseFloat(parts[8].trim()) : undefined;
          const lng = parts[9] ? parseFloat(parts[9].trim()) : undefined;

          if (zip && city) {
            citiesMap[zip] = { city, latitude: lat, longitude: lng };
          }
        }
      }

      // Process the data
      const values = Object.values(zipData)
        .map((zipInfo: any) => {
          const metricMap: Record<string, string> = {
            "median-sale-price": "median_sale_price",
            "median-list-price": "median_list_price",
            "median-dom": "median_dom",
            inventory: "inventory",
            "new-listings": "new_listings",
            "homes-sold": "homes_sold",
            "sale-to-list-ratio": "sale_to_list_ratio",
            "homes-sold-above-list": "homes_sold_above_list",
            "off-market-2-weeks": "off_market_in_2_weeks",
          };
          const key = metricMap[selectedMetric] || selectedMetric;
          return zipInfo[key] || 0;
        })
        .filter((v) => v > 0)
        .sort((a, b) => a - b);

      return {
        zipData,
        citiesData: citiesMap,
        metricValues: values,
        bounds: {
          min: values[0] || 0,
          max: values[values.length - 1] || 0,
        },
      };
    }

    throw new Error(`Unsupported message type: ${type}`);
  };

  return { processData, isLoading, progress };
}

export function MapLibreMap({
  selectedMetric,
  onZipSelect,
  searchZip,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zipData, setZipData] = useState<Record<string, any>>({});
  const [citiesData, setCitiesData] = useState<Record<string, any>>({});
  const [colorScale, setColorScale] = useState<any>(null);
  const [hoveredZip, setHoveredZip] = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);

  const { processData, isLoading, progress } = useDataWorker();

  // Ensure container is visible and has dimensions before initializing map
  useEffect(() => {
    if (!mapContainer.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          if (rect.width > 0 && rect.height > 0) {
            setContainerReady(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(mapContainer.current);

    return () => observer.disconnect();
  }, []);

  // Initialize map with extra validation
  useEffect(() => {
    if (!mapContainer.current || map.current || !containerReady) return;

    const container = mapContainer.current;

    // Ensure container is properly attached and visible
    if (!document.body.contains(container)) {
      console.warn("Container not in DOM");
      return;
    }

    // Ensure container has dimensions before initializing map
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      console.warn("Map container has no dimensions, delaying initialization");
      return;
    }

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "carto-positron-nolabels": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
                "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
                "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
                "https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
              ],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://carto.com/attributions">CARTO</a>',
            },
            "carto-positron-labels": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
                "https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
                "https://c.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
                "https://d.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
              ],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://carto.com/attributions">CARTO</a>',
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: {
                "background-color": "#f8f9fa",
              },
            },
            {
              id: "carto-positron-base",
              type: "raster",
              source: "carto-positron-nolabels",
              minzoom: 0,
              maxzoom: 18,
            },
          ],
        },
        center: [-98.5795, 39.8283],
        zoom: 4,
        minZoom: 3,
        maxZoom: 12,
        maxBounds: [
          [-180, -85],
          [180, 85],
        ],
        attributionControl: false,
        trackResize: false, // Disable automatic resize to prevent matrix errors
        preserveDrawingBuffer: true,
      });

      // Add navigation control
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        // Validate container and manually trigger resize safely
        if (mapContainer.current && map.current) {
          const rect = mapContainer.current.getBoundingClientRect();
          if (rect.width && rect.height) {
            // Manual resize after load to ensure proper matrix calculation
            try {
              map.current.resize();
              setMapLoaded(true);
            } catch (resizeError) {
              console.warn("Error during manual resize:", resizeError);
              // Retry after a delay
              setTimeout(() => {
                if (map.current) {
                  try {
                    map.current.resize();
                    setMapLoaded(true);
                  } catch (retryError) {
                    console.error(
                      "Failed to resize map after retry:",
                      retryError,
                    );
                    setMapLoaded(true); // Proceed anyway
                  }
                }
              }, 200);
            }
          } else {
            console.warn("Map loaded but container has no dimensions");
            setMapLoaded(true); // Proceed anyway to avoid infinite blocking
          }
        }
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setMapLoaded(false);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [containerReady]);

  // Load and process data
  useEffect(() => {
    if (!mapLoaded) return;

    const loadData = async () => {
      try {
        const result = (await processData({
          type: "LOAD_AND_PROCESS_DATA",
          data: {
            urls: {
              zipData:
                "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz",
              citiesData:
                "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-city-mapping.csv.gz",
            },
            selectedMetric,
          },
        })) as any;

        if (!result || !result.zipData) {
          console.error("No data received from worker");
          return;
        }

        setZipData(result.zipData);
        setCitiesData(result.citiesData);

        // Create color scale
        if (result.metricValues.length > 0) {
          const scale = scaleLinear<string>()
            .domain([result.bounds.min, result.bounds.max])
            .range(["#497eaf", "#e97000"])
            .interpolate(() => (t) => {
              const colors = [
                "#497eaf",
                "#5fa4ca",
                "#ffffff",
                "#fac790",
                "#e97000",
              ];
              const index = Math.floor(t * (colors.length - 1));
              const nextIndex = Math.min(index + 1, colors.length - 1);
              const localT = t * (colors.length - 1) - index;

              const hex1 = colors[index];
              const hex2 = colors[nextIndex];

              const r1 = parseInt(hex1.slice(1, 3), 16);
              const g1 = parseInt(hex1.slice(3, 5), 16);
              const b1 = parseInt(hex1.slice(5, 7), 16);

              const r2 = parseInt(hex2.slice(1, 3), 16);
              const g2 = parseInt(hex2.slice(3, 5), 16);
              const b2 = parseInt(hex2.slice(5, 7), 16);

              const r = Math.round(r1 + (r2 - r1) * localT);
              const g = Math.round(g1 + (g2 - g1) * localT);
              const b = Math.round(b1 + (b2 - b1) * localT);

              return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            });

          setColorScale(() => scale);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        // Set fallback data to prevent crashes
        setZipData({});
        setCitiesData({});
      }
    };

    loadData();
  }, [mapLoaded, selectedMetric, processData]);

  // Add ZIP code layer when data is ready
  useEffect(() => {
    if (
      !map.current ||
      !mapLoaded ||
      !colorScale ||
      Object.keys(zipData).length === 0
    )
      return;

    const loadMBTiles = async () => {
      try {
        // Use mbtiles format instead of compressed geojson
        const mbtileUrl =
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.mbtiles";

        console.log("Loading zip codes from mbtiles:", mbtileUrl);

        // Add mbtiles source if it doesn't exist
        if (!map.current?.getSource("zip-codes")) {
          map.current?.addSource("zip-codes", {
            type: "vector",
            url: mbtileUrl,
          });

          // Add fill layer (choropleth)
          map.current?.addLayer({
            id: "zip-codes-fill",
            type: "fill",
            source: "zip-codes",
            "source-layer": "zip_codes", // Specify the layer name in the mbtiles
            paint: {
              "fill-color": [
                "case",
                ["!=", ["get", ["get", "zipCode"], ["literal", zipData]], null],
                [
                  "interpolate",
                  ["linear"],
                  [
                    "to-number",
                    ["get", ["get", "zipCode"], ["literal", zipData]],
                    0,
                  ],
                  ...createColorStops(colorScale, zipData, selectedMetric),
                ],
                "rgba(200, 200, 200, 0.1)",
              ],
              "fill-opacity": 0.7,
            },
          });

          // Add border layer with thicker outline
          map.current?.addLayer({
            id: "zip-codes-border",
            type: "line",
            source: "zip-codes",
            "source-layer": "zip_codes",
            paint: {
              "line-color": [
                "case",
                ["==", ["get", "zipCode"], hoveredZip || ""],
                "#333333",
                "rgba(255, 255, 255, 0.8)",
              ],
              "line-width": [
                "case",
                ["==", ["get", "zipCode"], hoveredZip || ""],
                4,
                2,
              ],
            },
          });

          // Add labels layer on top
          map.current?.addLayer({
            id: "carto-positron-labels",
            type: "raster",
            source: "carto-positron-labels",
            minzoom: 0,
            maxzoom: 18,
          });

          // Add hover interactions with throttling
          let hoverTimeout: NodeJS.Timeout | null = null;
          let currentPopup: maplibregl.Popup | null = null;

          map.current?.on("mouseenter", "zip-codes-fill", (e) => {
            if (map.current) {
              map.current.getCanvas().style.cursor = "pointer";

              // Clear any existing timeout
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
              }

              // Reduced throttle for better responsiveness
              hoverTimeout = setTimeout(() => {
                if (e.features && e.features[0]) {
                  const feature = e.features[0];
                  const zipCode = feature.properties?.zipCode;

                  if (zipCode && zipData[zipCode]) {
                    setHoveredZip(zipCode);

                    // Remove existing popup
                    if (currentPopup) {
                      currentPopup.remove();
                    }

                    // Show new popup
                    const coordinates = e.lngLat;
                    const zipInfo = zipData[zipCode];
                    const cityInfo = citiesData[zipCode];

                    currentPopup = new maplibregl.Popup({
                      closeButton: false,
                      closeOnClick: false,
                      className: "zip-tooltip",
                      offset: [0, -10],
                    })
                      .setLngLat(coordinates)
                      .setHTML(
                        `
                        <div class="p-2 bg-white rounded shadow-lg border">
                          <div class="font-semibold text-sm">${zipCode}</div>
                          <div class="text-xs text-gray-600">${cityInfo?.city || "Unknown"}</div>
                          <div class="text-xs mt-1">${getMetricDisplay(zipInfo, selectedMetric)}</div>
                        </div>
                      `,
                      )
                      .addTo(map.current!);
                  }
                }
              }, 25); // Reduced to 25ms for better INP
            }
          });

          map.current?.on("mouseleave", "zip-codes-fill", () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = "";
              setHoveredZip(null);

              // Clear hover timeout
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }

              // Remove popup
              if (currentPopup) {
                currentPopup.remove();
                currentPopup = null;
              }
            }
          });

          // Add click interaction with immediate response
          map.current?.on("click", "zip-codes-fill", (e) => {
            e.preventDefault();

            if (e.features && e.features[0]) {
              const feature = e.features[0];
              const zipCode = feature.properties?.zipCode;

              if (zipCode && zipData[zipCode]) {
                const zipInfo = zipData[zipCode];
                const cityInfo = citiesData[zipCode];

                // Provide immediate visual feedback
                if (currentPopup) {
                  currentPopup.remove();
                }

                const enhancedData = {
                  ...zipInfo,
                  zipCode,
                  city: cityInfo?.city || zipInfo.city || "Unknown",
                  county: cityInfo?.county,
                  latitude: cityInfo?.latitude,
                  longitude: cityInfo?.longitude,
                  parent_metro: zipInfo.parent_metro,
                  state: zipInfo.state_name || "Unknown",
                };

                // Use requestAnimationFrame for smooth interaction
                requestAnimationFrame(() => {
                  onZipSelect(enhancedData);
                });
              }
            }
          });
        }
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
      }
    };

    loadMBTiles();
  }, [
    mapLoaded,
    colorScale,
    zipData,
    citiesData,
    selectedMetric,
    hoveredZip,
    onZipSelect,
    processData,
  ]);

  // Handle search with smart zoom behavior
  useEffect(() => {
    if (!map.current || !searchZip || !citiesData[searchZip]) return;

    const cityData = citiesData[searchZip];
    if (cityData.latitude && cityData.longitude) {
      const currentZoom = map.current.getZoom();
      // Use current zoom if it's already close enough, otherwise zoom to 10
      const targetZoom = currentZoom >= 8 ? Math.max(currentZoom, 9) : 10;

      map.current.flyTo({
        center: [cityData.longitude, cityData.latitude],
        zoom: targetZoom,
        duration: 1000,
      });

      // Trigger selection
      if (zipData[searchZip]) {
        const enhancedData = {
          ...zipData[searchZip],
          zipCode: searchZip,
          city: cityData.city || "Unknown",
          county: cityData.county,
          latitude: cityData.latitude,
          longitude: cityData.longitude,
          parent_metro: zipData[searchZip].parent_metro,
          state: zipData[searchZip].state_name || "Unknown",
        };
        onZipSelect(enhancedData);
      }
    }
  }, [searchZip, citiesData, zipData, onZipSelect]);

  // Update border colors when hovered ZIP changes
  useEffect(() => {
    if (map.current?.getLayer("zip-codes-border")) {
      map.current.setPaintProperty("zip-codes-border", "line-color", [
        "case",
        ["==", ["get", "zipCode"], hoveredZip || ""],
        "#333333",
        "rgba(255, 255, 255, 0.8)",
      ]);

      map.current.setPaintProperty("zip-codes-border", "line-width", [
        "case",
        ["==", ["get", "zipCode"], hoveredZip || ""],
        4,
        2,
      ]);
    }
  }, [hoveredZip]);

  // Handle container resize to fix matrix calculation issues
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        if (map.current && mapContainer.current) {
          const rect = mapContainer.current.getBoundingClientRect();
          if (rect.width && rect.height) {
            try {
              // Only resize if container has meaningful dimensions
              if (rect.width > 100 && rect.height > 100) {
                map.current.resize();
              }
            } catch (error) {
              console.warn("Map resize error:", error);
            }
          }
        }
      }, 100); // Debounce resize events
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [mapLoaded]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: "400px", minWidth: "300px" }}
      />

      {(isLoading || !mapLoaded) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Loading map data...</p>
              {progress.phase !== "idle" && (
                <p className="text-xs text-muted-foreground">
                  {progress.phase === "loading_zip_data" &&
                    "Loading ZIP data..."}
                  {progress.phase === "loading_cities_data" &&
                    "Loading cities data..."}
                  {progress.phase === "processing_data" && "Processing data..."}
                  {progress.phase === "geojson" &&
                    `Processing map layers... ${progress.processed}/${progress.total}`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to create color stops for MapLibre
function createColorStops(
  colorScale: any,
  zipData: Record<string, any>,
  selectedMetric: string,
) {
  const values = Object.values(zipData)
    .map((data: any) => getMetricValue(data, selectedMetric))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  if (values.length === 0) return [0, "#cccccc"];

  const stops: (number | string)[] = [];
  const colors = ["#497eaf", "#5fa4ca", "#ffffff", "#fac790", "#e97000"];

  for (let i = 0; i < colors.length; i++) {
    const value =
      values[Math.floor((values.length - 1) * (i / (colors.length - 1)))];
    stops.push(value, colors[i]);
  }

  return stops;
}
