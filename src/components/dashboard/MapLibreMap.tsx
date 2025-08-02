import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear, ScaleLinear } from "d3-scale";
import { getMetricDisplay } from "./map/utils";
import { ZipData } from "./map/types";
import { createMap } from "./map/MapInitializer.ts";

interface MapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
  zipData: Record<string, ZipData>;
  colorScaleDomain: [number, number] | null;
  isLoading: boolean;
  progress: { phase: string };
  processData: (message: { type: string; data?: any }) => Promise<any>;
}

export function MapLibreMap({
  selectedMetric,
  onZipSelect,
  searchZip,
  zipData,
  colorScaleDomain,
  isLoading,
  progress,
  processData,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);
  const [baseGeoJSON, setBaseGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const BASE_PATH = import.meta.env.BASE_URL;

  /* Initialize map */
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = createMap(mapContainer.current);

    map.current.once("load", () => {
      setIsMapReady(true);
    });

    map.current.on("error", (e) => {
      console.error("MapLibre error:", e);
      setLoadingError("Map failed to initialize.");
    });

    const observer = new ResizeObserver(() => map.current?.resize());
    observer.observe(mapContainer.current);

    return () => {
      observer.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  /* Color scale */
  const colorScale = useMemo(() => {
    if (!colorScaleDomain || colorScaleDomain.length < 2) return null;
    return scaleLinear<string>().domain(colorScaleDomain).range(["#FFF9B0", "#E84C61", "#2E0B59"]);
  }, [colorScaleDomain]);

  /* Load base GeoJSON once */
  useEffect(() => {
    if (!baseGeoJSON && isMapReady) {
      const controller = new AbortController();

      (async () => {
        try {
          const url = new URL(`${BASE_PATH}data/us-zip-codes.geojson.gz`, window.location.origin).href;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Failed to fetch GeoJSON. Status: ${response.status}`);
          const geojson = await response.json();
          setBaseGeoJSON(geojson);
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error("Error loading base GeoJSON:", err);
            setLoadingError("Failed to load base GeoJSON");
          }
        }
      })();

      return () => controller.abort();
    }
  }, [isMapReady, baseGeoJSON]);

  /* Update ZIP data when metrics change */
  useEffect(() => {
    if (!isMapReady || !baseGeoJSON || !colorScale || Object.keys(zipData).length === 0) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoadingError(null);
        const processed = await processData({
          type: "PROCESS_GEOJSON",
          data: { geojson: baseGeoJSON, zipData, selectedMetric },
        });
        if (controller.signal.aborted || !map.current?.isStyleLoaded()) return;

        const source = map.current.getSource("zips") as maplibregl.GeoJSONSource;
        if (source) source.setData(processed);

        // Setup interactions once
        if (!interactionsSetup.current) {
          setupMapInteractions(map.current!);
          interactionsSetup.current = true;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to update map layers:", err);
          setLoadingError("Failed to update map layers");
        }
      }
    })();

    return () => controller.abort();
  }, [isMapReady, baseGeoJSON, colorScale, zipData, selectedMetric, processData]);

  /* Fly to searched ZIP */
  useEffect(() => {
    if (!isMapReady || !map.current || !searchZip || !zipData[searchZip]) return;
    const { longitude, latitude } = zipData[searchZip];
    if (longitude && latitude) {
      map.current.flyTo({ center: [longitude, latitude], zoom: 10 });
    }
  }, [isMapReady, searchZip, zipData]);

  /* Popup & click */
  const setupMapInteractions = (mapInstance: maplibregl.Map) => {
    let popup: maplibregl.Popup | null = null;
    const layers = ["zips-fill"];

    mapInstance.on("mousemove", layers, (e) => {
      mapInstance.getCanvas().style.cursor = e.features?.length ? "pointer" : "";
      if (e.features?.[0]?.properties?.zipCode) {
        const props = e.features[0].properties;
        const coords =
          e.features[0].geometry.type === "Point"
            ? (e.features[0].geometry.coordinates as LngLatLike)
            : e.lngLat;

        popup?.remove();
        popup = new maplibregl.Popup({ closeButton: false, offset: [0, -10] })
          .setLngLat(coords)
          .setHTML(getMetricDisplay(zipData[props.zipCode], selectedMetric))
          .addTo(mapInstance);
      }
    });

    mapInstance.on("mouseleave", layers, () => {
      mapInstance.getCanvas().style.cursor = "";
      popup?.remove();
    });

    mapInstance.on("click", layers, (e) => {
      const props = e.features?.[0]?.properties;
      if (props?.zipCode && zipData[props.zipCode]) {
        onZipSelect(zipData[props.zipCode]);
      }
    });
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} data-testid="map-container" role="application" className="w-full h-full" />
      {(isLoading || !isMapReady || loadingError) && (
        <div
          role="status"
          aria-label="Loading..."
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10"
        >
          {loadingError ? (
            <div className="text-red-500 font-bold">{loadingError}</div>
          ) : (
            <div className="text-center space-y-4">
              <div
                role="progressbar"
                aria-label="Loading map data"
                className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
              />
              <p className="text-sm font-medium text-gray-700">{progress.phase}...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
