import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMetricValue } from "./map/utils";

interface NationalExportMapProps {
  selectedMetric: string;
  zipData: Record<string, any>;
  colorScale: any;
  className?: string;
}

export function NationalExportMap({
  selectedMetric,
  zipData,
  colorScale,
  className = "",
}: NationalExportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const alaskaMapRef = useRef<HTMLDivElement>(null);
  const hawaiiMapRef = useRef<HTMLDivElement>(null);

  const [mainMap, setMainMap] = useState<maplibregl.Map | null>(null);
  const [alaskaMap, setAlaskaMap] = useState<maplibregl.Map | null>(null);
  const [hawaiiMap, setHawaiiMap] = useState<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize main map (continental US)
  useEffect(() => {
    if (!mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#ffffff",
            },
          },
        ],
      },
      center: [-98.5795, 39.8283],
      zoom: 4,
      interactive: false,
      attributionControl: false,
    });

    setMainMap(map);

    return () => map.remove();
  }, []);

  // Initialize Alaska inset map
  useEffect(() => {
    if (!alaskaMapRef.current) return;

    const map = new maplibregl.Map({
      container: alaskaMapRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#ffffff",
            },
          },
        ],
      },
      center: [-152.2782, 64.0685], // Alaska center
      zoom: 3,
      interactive: false,
      attributionControl: false,
    });

    setAlaskaMap(map);

    return () => map.remove();
  }, []);

  // Initialize Hawaii inset map
  useEffect(() => {
    if (!hawaiiMapRef.current) return;

    const map = new maplibregl.Map({
      container: hawaiiMapRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#ffffff",
            },
          },
        ],
      },
      center: [-155.5828, 19.8968], // Hawaii center
      zoom: 6,
      interactive: false,
      attributionControl: false,
    });

    setHawaiiMap(map);

    return () => map.remove();
  }, []);

  // Load data for all maps
  useEffect(() => {
    if (!mainMap || !alaskaMap || !hawaiiMap || !colorScale) return;

    const loadMapData = async () => {
      try {
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.geojson.gz",
        );
        const arrayBuffer = await response.arrayBuffer();

        // Import pako dynamically to avoid issues
        const pako = await import("pako");
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const geojsonData = JSON.parse(decompressed);

        // Filter features by region
        const continentalFeatures = [];
        const alaskaFeatures = [];
        const hawaiiFeatures = [];

        geojsonData.features.forEach((feature: any) => {
          const zipCode =
            feature.properties?.ZCTA5CE20 || feature.properties?.GEOID20;
          if (zipCode && zipData[zipCode]) {
            const state = zipData[zipCode].state_name;
            if (state === "Alaska") {
              alaskaFeatures.push(feature);
            } else if (state === "Hawaii") {
              hawaiiFeatures.push(feature);
            } else {
              continentalFeatures.push(feature);
            }
          }
        });

        // Create color stops
        const values = Object.values(zipData)
          .map((data: any) => getMetricValue(data, selectedMetric))
          .filter((v) => v > 0)
          .sort((a, b) => a - b);

        const stops: (number | string)[] = [];
        const colors = [
          "#497eaf",
          "#5fa4ca",
          "#b4d4ec",
          "#ffecd4",
          "#fac790",
          "#e97000",
        ];

        for (let i = 0; i < colors.length; i++) {
          const value =
            values[Math.floor((values.length - 1) * (i / (colors.length - 1)))];
          stops.push(value, colors[i]);
        }

        // Helper function to add data to map
        const addDataToMap = (
          map: maplibregl.Map,
          features: any[],
          sourceId: string,
        ) => {
          if (features.length === 0) return;

          const processedGeoJSON = {
            type: "FeatureCollection",
            features: features.map((feature: any) => {
              const zipCode =
                feature.properties?.ZCTA5CE20 || feature.properties?.GEOID20;
              const value = zipCode
                ? getMetricValue(zipData[zipCode], selectedMetric)
                : 0;

              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  zipCode,
                  metricValue: value,
                },
              };
            }),
          };

          map.addSource(sourceId, {
            type: "geojson",
            data: processedGeoJSON,
          });

          map.addLayer({
            id: `${sourceId}-fill`,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": [
                "interpolate",
                ["linear"],
                ["get", "metricValue"],
                ...stops,
              ],
              "fill-opacity": 0.8,
            },
          });

          map.addLayer({
            id: `${sourceId}-border`,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": "rgba(255, 255, 255, 0.8)",
              "line-width": 1.5,
            },
          });
        };

        // Add data to each map
        mainMap.on("load", () =>
          addDataToMap(mainMap, continentalFeatures, "continental"),
        );
        alaskaMap.on("load", () =>
          addDataToMap(alaskaMap, alaskaFeatures, "alaska"),
        );
        hawaiiMap.on("load", () =>
          addDataToMap(hawaiiMap, hawaiiFeatures, "hawaii"),
        );

        setIsLoaded(true);
      } catch (error) {
        console.error("Error loading national export map data:", error);
      }
    };

    loadMapData();
  }, [mainMap, alaskaMap, hawaiiMap, colorScale, zipData, selectedMetric]);

  return (
    <div className={`relative w-full h-full bg-white ${className}`}>
      {/* Main continental US map */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Alaska inset */}
      <div className="absolute bottom-4 left-4 w-32 h-24 border-2 border-gray-400 rounded bg-white shadow-lg">
        <div ref={alaskaMapRef} className="w-full h-full rounded" />
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-center">
          <span className="text-xs font-medium text-gray-700">Alaska</span>
        </div>
      </div>

      {/* Hawaii inset */}
      <div className="absolute bottom-4 left-40 w-24 h-20 border-2 border-gray-400 rounded bg-white shadow-lg">
        <div ref={hawaiiMapRef} className="w-full h-full rounded" />
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-center">
          <span className="text-xs font-medium text-gray-700">Hawaii</span>
        </div>
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-sm text-gray-600">Loading national view...</p>
          </div>
        </div>
      )}
    </div>
  );
}