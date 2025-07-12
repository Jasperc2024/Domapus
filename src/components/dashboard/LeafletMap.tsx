import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scaleLinear } from "d3-scale";
import { useMapData } from "./map/useMapData";
import { createMap } from "./map/MapInitializer";
import { getMetricValue, getMetricDisplay, getZipStyle } from "./map/utils";
import { ZipData, LeafletMapProps } from "./map/types";
import { styleCache } from "./map/styleCache";
import pako from "pako";

// Throttle function for hover effects
const throttle = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  return (...args: any[]) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime),
      );
    }
  };
};

export function LeafletMap({
  selectedMetric,
  onZipSelect,
  searchZip,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [geojsonLayer, setGeojsonLayer] = useState<L.GeoJSON | null>(null);
  const [colorScale, setColorScale] = useState<any>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  const { zipData, citiesData, isLoading } = useMapData();

  // Create color scale when data changes
  useEffect(() => {
    if (Object.keys(zipData).length === 0) return;

    const values = Object.values(zipData)
      .map((data: any) => getMetricValue(data, selectedMetric))
      .filter((v) => v > 0);
    if (values.length === 0) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create D3 color scale with specified colors
    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(["#497eaf", "#e97000"]) // Blue to orange
      .interpolate(() => (t) => {
        const colors = [
          "#497eaf",
          "#5fa4ca",
          "#b4d4ec",
          "#ffecd4",
          "#fac790",
          "#e97000",
        ];
        const index = Math.floor(t * (colors.length - 1));
        const nextIndex = Math.min(index + 1, colors.length - 1);
        const localT = t * (colors.length - 1) - index;

        // Simple linear interpolation between two colors
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
  }, [zipData, selectedMetric]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const leafletMap = createMap(mapRef.current);
    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, []); // Remove dependency on isInteractive to prevent recreation

  // Update styles without full reload
  const updateLayerStyles = useCallback(() => {
    if (!geojsonLayer || !colorScale) return;

    geojsonLayer.eachLayer((leafletLayer) => {
      if (leafletLayer instanceof L.Path) {
        const pathLayer = leafletLayer as L.Path & { feature?: any };
        if (pathLayer.feature) {
          pathLayer.setStyle(
            getZipStyle(
              pathLayer.feature,
              map?.getZoom() || 5,
              colorScale,
              zipData,
              selectedMetric,
            ),
          );
        }
      }
    });
  }, [geojsonLayer, colorScale, zipData, selectedMetric, map]);

  // Update styles when metric changes instead of full reload
  useEffect(() => {
    if (geojsonLayer && colorScale) {
      updateLayerStyles();
    }
  }, [selectedMetric, updateLayerStyles]);

  // Load map layers and add interactivity
  useEffect(() => {
    if (!map || !colorScale || !isInteractive || geojsonLayer) return;

    const loadMapLayers = async () => {
      // Load ZIP code boundaries (GeoJSON from CDN)
      try {
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.geojson.gz",
        );
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const geojsonData = JSON.parse(decompressed);
        console.log(
          "GeoJSON feature count:",
          geojsonData.features?.length || 0,
        );

        const layer = L.geoJSON(geojsonData, {
          style: (feature) =>
            getZipStyle(
              feature,
              map.getZoom(),
              colorScale,
              zipData,
              selectedMetric,
            ),
          pane: "overlayPane",
          onEachFeature: (feature, layer) => {
            const zipCode =
              feature.properties?.ZCTA5CE20 ||
              feature.properties?.GEOID20 ||
              feature.properties?.ZCTA5CE20;
            if (zipCode && zipData[zipCode]) {
              const data = zipData[zipCode];
              const cityData = citiesData[zipCode] || {};

              // Add hover effect with throttling
              const throttledMouseOver = throttle((e: L.LeafletMouseEvent) => {
                const target = e.target as L.Path;
                const currentZoom = map.getZoom();
                target.setStyle({
                  weight: Math.max(currentZoom > 8 ? 3 : 2, 1),
                  color: "#333",
                  fillOpacity: 0.9,
                });

                // Show tooltip
                const popup = L.popup({
                  closeButton: false,
                  autoClose: false,
                  className: "zip-tooltip",
                })
                  .setLatLng(e.latlng)
                  .setContent(
                    `
                    <div class="p-2 bg-white rounded shadow-lg border">
                      <div class="font-semibold text-sm">${zipCode}</div>
                      <div class="text-xs text-gray-600">${cityData.city || "Unknown"}</div>
                      <div class="text-xs mt-1">${getMetricDisplay(data, selectedMetric)}</div>
                    </div>
                  `,
                  )
                  .openOn(map);
              }, 150); // Throttle hover effects to 150ms

              layer.on({
                mouseover: throttledMouseOver,
                mouseout: (e) => {
                  const target = e.target as L.Path;
                  target.setStyle(
                    getZipStyle(
                      feature,
                      map.getZoom(),
                      colorScale,
                      zipData,
                      selectedMetric,
                    ),
                  );
                  map.closePopup();
                },
                click: () => {
                  if (zipData[zipCode]) {
                    const enhancedData = {
                      ...zipData[zipCode],
                      zipCode,
                      city: cityData.city || zipData[zipCode].city || "Unknown",
                      county: cityData.county,
                      latitude: cityData.latitude,
                      longitude: cityData.longitude,
                      parent_metro: zipData[zipCode].parent_metro,
                      state: zipData[zipCode].state_name || "Unknown",
                    };
                    onZipSelect(enhancedData);
                  }
                },
              });
            }
          },
        });

        // Add zoom event listener for dynamic styling
        map.on("zoomend", () => {
          updateLayerStyles();
        });

        try {
          layer.addTo(map);
          setGeojsonLayer(layer);
        } catch (error) {
          console.error("Error adding GeoJSON layer to map:", error);
          // Retry after a short delay if the map isn't ready
          setTimeout(() => {
            try {
              layer.addTo(map);
              setGeojsonLayer(layer);
            } catch (retryError) {
              console.error(
                "Retry failed for adding GeoJSON layer:",
                retryError,
              );
            }
          }, 100);
        }

        // Add labels layer on top of ZIP codes
        if ((map as any)._labelsLayer) {
          (map as any)._labelsLayer.addTo(map);
        }
      } catch (error) {
        console.error("Error loading ZIP code data:", error);
      }

      // Load and add state boundaries (top layer)
      try {
        const stateResponse = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-state.geojson.gz",
        );
        const stateArrayBuffer = await stateResponse.arrayBuffer();
        const stateDecompressed = pako.ungzip(
          new Uint8Array(stateArrayBuffer),
          { to: "string" },
        );
        const stateData = JSON.parse(stateDecompressed);
        console.log("GeoJSON feature count:", stateData.features?.length || 0);

        // Add state boundaries
        const stateLayer = L.geoJSON(stateData, {
          style: {
            color: "#666666",
            weight: 2,
            fillOpacity: 0,
            opacity: 0.8,
            dashArray: "5,5",
          },
        });

        try {
          stateLayer.addTo(map);
        } catch (error) {
          console.error("Error adding state layer to map:", error);
        }
      } catch (error) {
        console.warn("Could not load state boundaries:", error);
      }
    };

    loadMapLayers();
  }, [
    map,
    zipData,
    citiesData,
    onZipSelect,
    colorScale,
    isInteractive,
    geojsonLayer,
    updateLayerStyles,
  ]);

  // Handle search with coordinate-based zoom
  useEffect(() => {
    if (!map || !searchZip || !isInteractive) return;

    // First try to find coordinates in citiesData
    const cityData = citiesData[searchZip];
    if (cityData && cityData.latitude && cityData.longitude) {
      // Zoom to the coordinate with centering
      map.setView([cityData.latitude, cityData.longitude], 12, {
        animate: true,
      });

      // Highlight the searched ZIP if it exists in the layer
      if (geojsonLayer) {
        let found = false;
        geojsonLayer.eachLayer((layer: any) => {
          const zipCode =
            layer.feature?.properties?.ZCTA5CE20 ||
            layer.feature?.properties?.GEOID20 ||
            layer.feature?.properties?.ZCTA5CE20;
          if (zipCode === searchZip) {
            found = true;

            // Highlight the searched ZIP
            if (layer instanceof L.Path) {
              layer.setStyle({
                color: "#ef4444",
                weight: 3,
                fillOpacity: 0.8,
              });

              // Reset style after 3 seconds
              setTimeout(() => {
                if (layer instanceof L.Path && colorScale) {
                  const pathLayer = layer as L.Path & { feature?: any };
                  if (pathLayer.feature) {
                    pathLayer.setStyle(
                      getZipStyle(
                        pathLayer.feature,
                        map.getZoom(),
                        colorScale,
                        zipData,
                        selectedMetric,
                      ),
                    );
                  }
                }
              }, 3000);
            }
          }
        });
      }

      // Show popup for searched ZIP
      if (zipData[searchZip]) {
        const data = zipData[searchZip];
        const enhancedData = {
          ...data,
          zipCode: searchZip,
          city: cityData.city || data.city || "Unknown",
          county: cityData.county,
          latitude: cityData.latitude,
          longitude: cityData.longitude,
          parent_metro: data.parent_metro,
          state: data.state_name || "Unknown",
        };
        onZipSelect(enhancedData);
      }
    } else {
      console.log(`Coordinates not found for ZIP code ${searchZip}`);
    }
  }, [
    map,
    searchZip,
    zipData,
    citiesData,
    onZipSelect,
    isInteractive,
    colorScale,
    selectedMetric,
    geojsonLayer,
  ]);

  // Enable interactive mode after initial load
  useEffect(() => {
    if (!isLoading && Object.keys(zipData).length > 0) {
      const timer = setTimeout(() => {
        setIsInteractive(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, zipData]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      />
    </div>
  );
}
