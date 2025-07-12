import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scaleLinear } from "d3-scale";
import { getMetricValue, getZipStyle } from "./map/utils";
import pako from "pako";

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

  const [mainMap, setMainMap] = useState<L.Map | null>(null);
  const [alaskaMap, setAlaskaMap] = useState<L.Map | null>(null);
  const [hawaiiMap, setHawaiiMap] = useState<L.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize main map (continental US)
  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      scrollWheelZoom: false,
      dragging: false,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 2, tolerance: 5 }),
    });

    setMainMap(map);

    return () => map.remove();
  }, []);

  // Initialize Alaska inset map
  useEffect(() => {
    if (!alaskaMapRef.current) return;

    const map = L.map(alaskaMapRef.current, {
      center: [64.0685, -152.2782], // Alaska center
      zoom: 3,
      scrollWheelZoom: false,
      dragging: false,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 2, tolerance: 5 }),
    });

    setAlaskaMap(map);

    return () => map.remove();
  }, []);

  // Initialize Hawaii inset map
  useEffect(() => {
    if (!hawaiiMapRef.current) return;

    const map = L.map(hawaiiMapRef.current, {
      center: [19.8968, -155.5828], // Hawaii center
      zoom: 6,
      scrollWheelZoom: false,
      dragging: false,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 2, tolerance: 5 }),
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
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const geojsonData = JSON.parse(decompressed);

        // Filter features by region
        const continentalFeatures = [];
        const alaskaFeatures = [];
        const hawaiiFeatures = [];

        geojsonData.features.forEach((feature: unknown) => {
          const featureTyped = feature as {
            properties?: { ZCTA5CE20?: string; GEOID20?: string };
          };
          const zipCode =
            featureTyped.properties?.ZCTA5CE20 ||
            featureTyped.properties?.GEOID20;
          if (zipCode && zipData[zipCode]) {
            const state = (zipData[zipCode] as { state_name?: string })
              .state_name;
            if (state === "Alaska") {
              alaskaFeatures.push(feature);
            } else if (state === "Hawaii") {
              hawaiiFeatures.push(feature);
            } else {
              continentalFeatures.push(feature);
            }
          }
        });

        // Add continental US layer
        if (continentalFeatures.length > 0) {
          const continentalLayer = L.geoJSON(
            {
              type: "FeatureCollection",
              features: continentalFeatures,
            },
            {
              style: (feature) =>
                getZipStyle(feature, 4, colorScale, zipData, selectedMetric),
              interactive: false,
            },
          );
          continentalLayer.addTo(mainMap);
        }

        // Add Alaska layer
        if (alaskaFeatures.length > 0) {
          const alaskaLayer = L.geoJSON(
            {
              type: "FeatureCollection",
              features: alaskaFeatures,
            },
            {
              style: (feature) =>
                getZipStyle(feature, 3, colorScale, zipData, selectedMetric),
              interactive: false,
            },
          );
          alaskaLayer.addTo(alaskaMap);
        }

        // Add Hawaii layer
        if (hawaiiFeatures.length > 0) {
          const hawaiiLayer = L.geoJSON(
            {
              type: "FeatureCollection",
              features: hawaiiFeatures,
            },
            {
              style: (feature) =>
                getZipStyle(feature, 6, colorScale, zipData, selectedMetric),
              interactive: false,
            },
          );
          hawaiiLayer.addTo(hawaiiMap);
        }

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
