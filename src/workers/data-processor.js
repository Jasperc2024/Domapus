import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
import { getMetricValue, getMetricDisplay } from "./map/utils";
import { MapProps } from "./map/types";
import { createMap } from "./map/MapInitializer.ts";

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
      const workerUrl = "/workers/data-processor.js";
      console.log("Attempting to create worker from:", workerUrl);
      
      // Check if the worker file exists before creating
      fetch(workerUrl, { method: "HEAD" })
        .then((response) => {
          if (response.ok) {
            console.log("Worker file found, creating worker");
            try {
              workerRef.current = new Worker(workerUrl);

              workerRef.current.onmessage = (e) => {
                const { type, data, error } = e.data;
                console.log("Worker message:", type, data);

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
                console.warn("Web worker failed, falling back to main thread:", error);
                workerRef.current = null;
              };
              
              console.log("Worker created successfully");
            } catch (workerError) {
              console.warn("Failed to create worker:", workerError);
              workerRef.current = null;
            }
          } else {
            console.warn("Worker file not found, using main thread");
            workerRef.current = null;
          }
        })
        .catch((error) => {
          console.warn("Cannot check worker file:", error, "using main thread");
          workerRef.current = null;
        });
    } catch (error) {
      console.warn("Web worker not supported, using main thread:", error);
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        console.log("Terminating worker");
        workerRef.current.terminate();
      }
    };
  }, []);

  const processData = useCallback(async (message: any) => {
    return new Promise(async (resolve, reject) => {
      if (workerRef.current) {
        // Use web worker
        console.log("Processing data with web worker");
        const id = Math.random().toString(36);
        setIsLoading(true);

        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === id) {
            console.log("Worker response:", e.data.type);
            
            if (e.data.type.includes("SUCCESS")) {
              workerRef.current?.removeEventListener("message", handleMessage);
              setIsLoading(false);
              resolve(e.data.data);
            } else if (e.data.type.includes("ERROR")) {
              workerRef.current?.removeEventListener("message", handleMessage);
              setIsLoading(false);
              reject(new Error(e.data.error));
            }
            // Progress messages don't remove the listener
          }
        };

        workerRef.current.addEventListener("message", handleMessage);
        workerRef.current.postMessage({ ...message, id });
      } else {
        // Fallback to main thread
        console.log("Processing data on main thread (fallback)");
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
      console.log("Main thread: Loading ZIP data from:", urls.zipData);
      const zipResponse = await fetch(urls.zipData);
      if (!zipResponse.ok) {
        throw new Error(`Failed to fetch ZIP data: ${zipResponse.status}`);
      }
      
      const zipArrayBuffer = await zipResponse.arrayBuffer();
      console.log("Main thread: ZIP data loaded, size:", zipArrayBuffer.byteLength);
      
      const pako = await import("pako");
      const zipDecompressed = pako.ungzip(new Uint8Array(zipArrayBuffer), {
        to: "string",
      });
      const zipData = JSON.parse(zipDecompressed);
      console.log("Main thread: ZIP data parsed, entries:", Object.keys(zipData).length);

      // Load cities data
      console.log("Main thread: Loading cities data from:", urls.citiesData);
      const citiesResponse = await fetch(urls.citiesData);
      if (!citiesResponse.ok) {
        throw new Error(`Failed to fetch cities data: ${citiesResponse.status}`);
      }
      
      const citiesArrayBuffer = await citiesResponse.arrayBuffer();
      const citiesDecompressed = pako.ungzip(
        new Uint8Array(citiesArrayBuffer),
        { to: "string" },
      );

      // Parse cities CSV
      const citiesMap: Record<string, any> = {};
      const lines = citiesDecompressed.split("\n");
      console.log("Main thread: Processing cities CSV, lines:", lines.length);
      
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
    } else if (type === "PROCESS_GEOJSON") {
      const { geojsonArrayBuffer, zipData, selectedMetric } = data;
      
      const pako = await import("pako");
      const decompressed = pako.ungzip(new Uint8Array(geojsonArrayBuffer), { to: "string" });
      const geojsonData = JSON.parse(decompressed);

      if (geojsonData.features) {
        geojsonData.features = geojsonData.features
          .map((feature: any) => {
            const zipCode = feature.properties?.ZCTA5CE10 || feature.properties?.zipCode;
            if (zipCode && zipData[zipCode]) {
              const zipInfo = zipData[zipCode];
              const value = getMetricValue(zipInfo, selectedMetric);
              
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  zipCode,
                  metricValue: value,
                },
              };
            }
            return null;
          })
          .filter(Boolean);
      }

      return geojsonData;
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
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const zipLayerAddedRef = useRef(false);
  const { processData, isLoading, progress } = useDataWorker();

  // Initialize map container detection
  useEffect(() => {
    if (!mapContainer.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          if (rect.width > 0 && rect.height > 0) {
            console.log("Container ready, dimensions:", rect.width, "x", rect.height);
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !containerReady) return;

    console.log("Initializing map...");
    try {
      map.current = createMap(mapContainer.current);

      map.current.on("load", () => {
        console.log("Map loaded successfully");
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
        setLoadingError("Map initialization error");
      });
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setLoadingError("Failed to initialize map");
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
        console.log("Starting data loading process...");
        setLoadingError(null);

        const result = (await processData({
          type: "LOAD_AND_PROCESS_DATA",
          data: {
            urls: {
              zipData: "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz",
              citiesData: "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-city-mapping.csv.gz",
            },
            selectedMetric,
          },
        })) as any;

        if (!result || !result.zipData) {
          throw new Error("No data received from processing");
        }

        console.log("Data processing completed successfully");
        setZipData(result.zipData);
        setCitiesData(result.citiesData);

        // Create color scale
        if (result.metricValues.length > 0) {
          const scale = scaleLinear<string>()
            .domain([result.bounds.min, result.bounds.max])
            .range(["#FFF9B0", "#2E0B59"])
            .interpolate(() => (t) => {
              const colors = [
                "#FFF9B0",
                "#FFA873",
                "#E84C61",
                "#922C7E",
                "#2E0B59",
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
          console.log("Color scale created");
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        setLoadingError(error instanceof Error ? error.message : "Failed to load data");
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
      Object.keys(zipData).length === 0 ||
      zipLayerAddedRef.current
    )
      return;

    const loadGeoJSON = async () => {
      try {
        console.log("Loading GeoJSON data...");
        
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.geojson.gz",
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log("GeoJSON loaded, size:", arrayBuffer.byteLength);

        // Process GeoJSON with worker or main thread
        const processedGeoJSON = (await processData({
          type: "PROCESS_GEOJSON",
          data: {
            geojsonArrayBuffer: arrayBuffer,
            zipData,
            selectedMetric,
          },
        })) as any;

        console.log("GeoJSON processed, features:", processedGeoJSON.features?.length);

        // Add source and layers
        if (!map.current?.getSource("zip-codes")) {
          map.current?.addSource("zip-codes", {
            type: "geojson",
            data: processedGeoJSON,
            lineMetrics: true,
          });

          // Add fill layer
          map.current?.addLayer({
            id: "zip-codes-fill",
            type: "fill",
            source: "zip-codes",
            paint: {
              "fill-color": [
                "case",
                ["has", "metricValue"],
                [
                  "interpolate",
                  ["linear"],
                  ["get", "metricValue"],
                  ...createColorStops(colorScale, zipData, selectedMetric),
                ],
                "rgba(200, 200, 200, 0.1)",
              ],
              "fill-opacity": 0.7,
            },
          });

          // Add border layer
          map.current?.addLayer({
            id: "zip-codes-border",
            type: "line",
            source: "zip-codes",
            paint: {
              "line-color": "rgba(255, 255, 255, 0.8)",
              "line-width": 2,
            },
          });

          zipLayerAddedRef.current = true;
          console.log("ZIP code layers added successfully");

          // Add interactions
          setupMapInteractions();
        }
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
        setLoadingError("Failed to load map layers");
      }
    };

    const setupMapInteractions = () => {
      if (!map.current) return;

      let currentPopup: maplibregl.Popup | null = null;

      map.current.on("mouseenter", "zip-codes-fill", (e) => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";

          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const zipCode = feature.properties?.zipCode;

            if (zipCode && zipData[zipCode]) {
              setHoveredZip(zipCode);

              if (currentPopup) {
                currentPopup.remove();
              }

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
        }
      });

      map.current.on("mouseleave", "zip-codes-fill", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
          setHoveredZip(null);

          if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
          }
        }
      });

      map.current.on("click", "zip-codes-fill", (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const zipCode = feature.properties?.zipCode;

          if (zipCode && zipData[zipCode]) {
            const zipInfo = zipData[zipCode];
            const cityInfo = citiesData[zipCode];

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

            onZipSelect(enhancedData);
          }
        }
      });
    };

    loadGeoJSON();
  }, [mapLoaded, colorScale, zipData, citiesData, selectedMetric, onZipSelect, processData]);

  // Handle search
  useEffect(() => {
    if (!map.current || !searchZip || !citiesData[searchZip]) return;

    const cityData = citiesData[searchZip];
    if (cityData.latitude && cityData.longitude) {
      map.current.flyTo({
        center: [cityData.longitude, cityData.latitude],
        zoom: 10,
        duration: 1000,
      });

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

  return (
    <div className="absolute inset-0 w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      ></div>

      {(isLoading || !mapLoaded) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {progress.phase === "idle" && "Initializing..."}
                {progress.phase === "loading_zip_data" && "Loading ZIP data..."}
                {progress.phase === "processing_zip_data" && "Processing ZIP data..."}
                {progress.phase === "loading_cities_data" && "Loading cities data..."}
                {progress.phase === "processing_data" && "Processing data..."}
                {progress.phase === "geojson" && "Processing map layers..."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );