import { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
import { ZipData } from "./map/types";

// Define the new props this component accepts
interface ExportPreviewMapProps {
  filteredZipData: ZipData[]; // Receives ALREADY filtered data
  filteredGeoJSON: GeoJSON.FeatureCollection | null; // Receives ALREADY filtered GeoJSON
  selectedMetric: string;
  isLoading: boolean; // Is the parent component loading the GeoJSON?
  onMapReady?: (map: maplibregl.Map) => void;
}

export function ExportPreviewMap({
  filteredZipData,
  filteredGeoJSON,
  selectedMetric,
  isLoading,
  onMapReady,
}: ExportPreviewMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // Create the color scale based on the metric values from the PRE-FILTERED data
  const colorScale = useMemo(() => {
    if (filteredZipData.length === 0) return null;

    const values = filteredZipData
      .map(zip => zip[selectedMetric as keyof ZipData] as number)
      .filter(v => typeof v === 'number' && v > 0)
      .sort((a, b) => a-b);
      
    if (values.length === 0) return null;

    return scaleLinear<string>().domain([values[0], values[values.length - 1]]).range(["#FFF9B0", "#E84C61", "#2E0B59"]);
  }, [filteredZipData, selectedMetric]);

  // Initialize the map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }] },
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      interactive: false,
    });
    map.current.on("load", () => {
      if (onMapReady && map.current) onMapReady(map.current);
    });
    return () => { map.current?.remove(); };
  }, [onMapReady]);

  // Add/update layers when the map is ready and data changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !filteredGeoJSON || !colorScale) return;

    const mapInstance = map.current;
    const source = mapInstance.getSource("zip-codes") as maplibregl.GeoJSONSource;

    // Add metric values to GeoJSON features for data-driven styling
    const geojsonDataWithMetrics = {
      ...filteredGeoJSON,
      features: filteredGeoJSON.features.map(feature => {
        const zipCode = feature.properties?.zipCode;
        const zip = filteredZipData.find(z => z.zipCode === zipCode);
        const metricValue = zip ? zip[selectedMetric as keyof ZipData] as number : 0;
        return {
          ...feature,
          properties: { ...feature.properties, metricValue }
        };
      })
    };

    if (source) {
      source.setData(geojsonDataWithMetrics);
    } else {
      mapInstance.addSource("zip-codes", { type: "geojson", data: geojsonDataWithMetrics });
      mapInstance.addLayer({
        id: "zip-codes-fill",
        type: "fill",
        source: "zip-codes",
        paint: {
          "fill-color": ["case",
            ["==", ["get", "metricValue"], 0], "rgba(200, 200, 200, 0.5)",
            ["interpolate", ["linear"], ["get", "metricValue"],
              ...colorScale.domain().flatMap(d => [d, colorScale(d)])
            ]
          ],
          "fill-opacity": 0.8
        }
      });
      mapInstance.addLayer({
        id: "zip-codes-border",
        type: "line",
        source: "zip-codes",
        paint: { "line-color": "#FFFFFF", "line-width": 0.2 }
      });
    }

    // Fit map to the bounds of the filtered features
    if (filteredGeoJSON.features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      filteredGeoJSON.features.forEach(feature => {
        // Simple bounding box for points, more complex for polygons if needed
        if (feature.geometry.type === "Polygon") {
          feature.geometry.coordinates[0].forEach((coord: [number, number]) => bounds.extend(coord));
        } else if (feature.geometry.type === "MultiPolygon") {
          feature.geometry.coordinates.forEach(poly => poly[0].forEach((coord: [number, number]) => bounds.extend(coord)));
        }
      });
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, { padding: 40, duration: 0 });
      }
    }

  }, [filteredGeoJSON, colorScale, selectedMetric]);


  return (
    <div className="relative w-full h-full bg-white">
      <div ref={mapContainer} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-sm text-gray-600">Loading Map Data...</p>
          </div>
        </div>
      )}
    </div>
  );
}