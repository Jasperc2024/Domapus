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
  selectedMetric, onZipSelect, searchZip, zipData, colorScaleDomain, isLoading, progress, processData
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false); // A single state for map readiness
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);

  // This is the definitive fix for all initialization and rendering crashes.
  useEffect(() => {
    if (map.current || !mapContainer.current) return; // Prevent re-initialization

    const currentMapContainer = mapContainer.current;
    let isMounted = true;

    const observer = new ResizeObserver(() => {
      if (map.current) map.current.resize();
    });
    observer.observe(currentMapContainer);

    // We use a small timeout to push the map creation to the end of the event loop.
    // This guarantees that React has finished rendering and the div has its final dimensions.
    const timerId = setTimeout(() => {
      if (isMounted && currentMapContainer.clientWidth > 0) {
        map.current = createMap(currentMapContainer);
        map.current.on("load", () => {
          if (isMounted) setIsMapReady(true);
        });
        map.current.on("error", (e) => {
          console.error("MapLibre initialization error:", e);
          if (isMounted) setLoadingError("Map failed to initialize.");
        });
      }
    }, 100); // A small delay is sufficient to ensure the DOM is stable.

    return () => {
      isMounted = false;
      clearTimeout(timerId);
      observer.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only ONCE.

  const colorScale = useMemo(() => {
    if (!colorScaleDomain || colorScaleDomain.length < 2) return null;
    return scaleLinear<string>().domain(colorScaleDomain).range(["#FFF9B0", "#E84C61", "#2E0B59"]);
  }, [colorScaleDomain]);

  useEffect(() => {
    const mapInstance = map.current;
    if (!isMapReady || !mapInstance || !colorScale || Object.keys(zipData).length === 0) return;
    
    const controller = new AbortController();
    const setupOrUpdateLayers = async () => {
      try {
        setLoadingError(null);
        const geojsonResponse = await fetch("/data/us-zip-codes.geojson.gz", { signal: controller.signal });
        if (!geojsonResponse.ok) throw new Error("Failed to fetch GeoJSON");
        const geojsonArrayBuffer = await geojsonResponse.arrayBuffer();
        if (controller.signal.aborted) return;

        const processedGeoJSON = await processData({ type: "PROCESS_GEOJSON", data: { geojsonArrayBuffer, zipData, selectedMetric } });
        if (controller.signal.aborted || !mapInstance.isStyleLoaded()) return;

        const source = mapInstance.getSource("zips") as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(processedGeoJSON);
        } else {
          mapInstance.addSource("zips", { type: "geojson", data: processedGeoJSON });
          mapInstance.addLayer({ id: "zips-fill", type: "fill", source: "zips", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ["case", ["has", "metricValue"], ["interpolate", ["linear"], ["get", "metricValue"], ...createColorStops(colorScale)], "#ccc"], "fill-opacity": 0.75 } });
          mapInstance.addLayer({ id: "zips-border", type: "line", source: "zips", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": "#fff", "line-width": 0.5 } });
          mapInstance.addLayer({ id: "zips-points", type: "circle", source: "zips", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": ["case", ["has", "metricValue"], ["interpolate", ["linear"], ["get", "metricValue"], ...createColorStops(colorScale)], "#ccc"], "circle-radius": 5, "circle-stroke-width": 1, "circle-stroke-color": "#fff" } });
        }
        
        if (!interactionsSetup.current) {
          setupMapInteractions(mapInstance);
          interactionsSetup.current = true;
        }
      } catch (error) { if (!controller.signal.aborted) { console.error("Layer setup failed:", error); setLoadingError("Failed to load map layers"); } }
    };
    setupOrUpdateLayers();
    return () => controller.abort();
  }, [isMapReady, colorScale, zipData, selectedMetric, processData]);

  useEffect(() => {
    if (!isMapReady || !map.current || !searchZip || !zipData[searchZip]) return;
    const { longitude, latitude } = zipData[searchZip];
    if (longitude && latitude) { map.current.flyTo({ center: [longitude, latitude], zoom: 10 }); }
  }, [isMapReady, searchZip, zipData]);

  const setupMapInteractions = (mapInstance: maplibregl.Map) => {
    let currentPopup: maplibregl.Popup | null = null;
    const interactiveLayers = ["zips-fill", "zips-points"];
    mapInstance.on("mousemove", interactiveLayers, (e) => {
      if (e.features?.length) {
        mapInstance.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties;
        if (props?.zipCode && zipData[props.zipCode]) {
          currentPopup?.remove();
          const coords = e.features[0].geometry.type === 'Point' ? (e.features[0].geometry.coordinates as LngLatLike) : e.lngLat;
          currentPopup = new maplibregl.Popup({ closeButton: false, offset: [0, -10] }).setLngLat(coords).setHTML(getMetricDisplay(zipData[props.zipCode], selectedMetric)).addTo(mapInstance);
        }
      }
    });
    mapInstance.on("mouseleave", interactiveLayers, () => { mapInstance.getCanvas().style.cursor = ""; currentPopup?.remove(); });
    mapInstance.on("click", interactiveLayers, (e) => {
      if (e.features?.length) {
        const props = e.features[0].properties;
        if (props?.zipCode && zipData[props.zipCode]) { onZipSelect(zipData[props.zipCode]); }
      }
    });
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} data-testid="map-container" role="application" className="w-full h-full" />
      {(isLoading || !isMapReady || loadingError) && (
        <div role="status" aria-label="Loading..." className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          {loadingError ? <div className="text-red-500 font-bold">{loadingError}</div> : <div role="progressbar" aria-label="Loading map data" className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />}
        </div>
      )}
    </div>
  );
}

function createColorStops(colorScale: ScaleLinear<string, string> | null): (number | string)[] {
    if (!colorScale) return [];
    const domain = colorScale.domain();
    if (domain.length < 2) return [];
    const [min, max] = domain;
    const stops: (number | string)[] = [];
    for (let i = 0; i <= 8; i++) {
      const value = min + (max - min) * (i / 8);
      stops.push(value, colorScale(value));
    }
    return stops;
}