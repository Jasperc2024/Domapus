import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
import { getMetricValue, getZipStyle } from "./map/utils";
import { ExportOptions } from "./ExportSidebar";

interface MapLibreExportMapProps {
  selectedMetric: string;
  exportOptions: ExportOptions;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function MapLibreExportMap({
  selectedMetric,
  exportOptions,
  onMapReady,
}: MapLibreExportMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [colorScale, setColorScale] = useState<any>(null);
  const [zipData, setZipData] = useState<Record<string, any>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load ZIP data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz",
        );
        const arrayBuffer = await response.arrayBuffer();
        const pako = await import("pako");
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const data = JSON.parse(decompressed);
        setZipData(data);
        setDataLoaded(true);
      } catch (error) {
        console.error("Failed to load data for export:", error);
      }
    };

    loadData();
  }, []);

  // Create color scale based on filtered data
  useEffect(() => {
    if (!dataLoaded || Object.keys(zipData).length === 0) return;

    let filteredData = zipData;

    // Filter data based on export options
    if (exportOptions.regionScope === "state" && exportOptions.selectedState) {
      filteredData = Object.fromEntries(
        Object.entries(zipData).filter(
          ([, data]: [string, unknown]) =>
            (data as Record<string, unknown>).state ===
            exportOptions.selectedState,
        ),
      );
    } else if (
      exportOptions.regionScope === "metro" &&
      exportOptions.selectedMetro
    ) {
      filteredData = Object.fromEntries(
        Object.entries(zipData).filter(
          ([, data]: [string, unknown]) =>
            (data as Record<string, unknown>).parent_metro ===
            exportOptions.selectedMetro,
        ),
      );
    }

    const values = Object.values(filteredData)
      .map((data: unknown) =>
        getMetricValue(data as Record<string, unknown>, selectedMetric),
      )
      .filter((v) => v > 0);

    if (values.length === 0) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(["#497eaf", "#e97000"])
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
  }, [zipData, selectedMetric, exportOptions]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
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

    map.current.on("load", () => {
      setIsLoaded(true);
      if (onMapReady) {
        onMapReady(map.current!);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [onMapReady]);

  // Load ZIP code data
  useEffect(() => {
    if (!map.current || !isLoaded || !colorScale) return;

    const loadZipCodes = async () => {
      try {
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.geojson.gz",
        );
        const arrayBuffer = await response.arrayBuffer();

        // Import pako dynamically
        const pako = await import("pako");
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const geojsonData = JSON.parse(decompressed);

        // Filter features based on export options
        const filteredFeatures = geojsonData.features.filter((feature: any) => {
          const zipCode =
            feature.properties?.ZCTA5CE20 || feature.properties?.GEOID20;

          if (!zipCode || !zipData[zipCode]) return false;

          const data = zipData[zipCode];

          if (
            exportOptions.regionScope === "state" &&
            exportOptions.selectedState
          ) {
            return data.state === exportOptions.selectedState;
          } else if (
            exportOptions.regionScope === "metro" &&
            exportOptions.selectedMetro
          ) {
            return data.parent_metro === exportOptions.selectedMetro;
          }

          return true;
        });

        // Create color stops for the current data
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

        const processedGeoJSON = {
          type: "FeatureCollection",
          features: filteredFeatures.map((feature: any) => {
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

        // Add source
        map.current?.addSource("zip-codes", {
          type: "geojson",
          data: processedGeoJSON,
        });

        // Add fill layer
        map.current?.addLayer({
          id: "zip-codes-fill",
          type: "fill",
          source: "zip-codes",
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

        // Add border layer with thicker outline
        map.current?.addLayer({
          id: "zip-codes-border",
          type: "line",
          source: "zip-codes",
          paint: {
            "line-color": "rgba(255, 255, 255, 0.8)",
            "line-width": 1.5,
          },
        });

        // Fit bounds based on region scope
        if (
          exportOptions.regionScope !== "national" &&
          filteredFeatures.length > 0
        ) {
          const bounds = new maplibregl.LngLatBounds();
          filteredFeatures.forEach((feature: any) => {
            if (feature.geometry.type === "Polygon") {
              feature.geometry.coordinates[0].forEach(
                (coord: [number, number]) => {
                  bounds.extend(coord);
                },
              );
            }
          });

          if (!bounds.isEmpty()) {
            map.current?.fitBounds(bounds, { padding: 50 });
          }
        }
      } catch (error) {
        console.error("Error loading ZIP code data for export:", error);
      }
    };

    loadZipCodes();
  }, [isLoaded, colorScale, zipData, exportOptions, selectedMetric]);

  return (
    <div className="relative w-full h-full bg-white">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-sm text-gray-600">Loading export preview...</p>
          </div>
        </div>
      )}
    </div>
  );
}