import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
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
  processData
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const interactionsSetup = useRef<boolean>(false);

  
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // maplibre is stupid

    map.current = createMap(mapContainer.current);
    const currentMap = map.current;

    currentMap.on("load", () => setMapLoaded(true));
    currentMap.on("error", (e) => {
      console.error("MapLibre error:", e);
      setLoadingError("Map failed to initialize");
    });

    // Create a ResizeObserver to watch the map container
    const resizeObserver = new ResizeObserver(() => {
      // This function will be called whenever the container's size changes.
      // The `resize` method tells MapLibre to re-calculate its dimensions,
      // which is the correct way to handle layout shifts and prevent crashes.
      currentMap.resize();
    });

    // Start observing the map container
    resizeObserver.observe(mapContainer.current);

    // This is the cleanup function. It's critical for preventing memory leaks.
    return () => { 
      resizeObserver.disconnect();
      currentMap.remove();
      map.current = null;
    };
  }, []); // Empty dependency array ensures this runs only once.


  const colorScale = useMemo(() => {
    if (!colorScaleDomain) return null;
    return scaleLinear<string>().domain(colorScaleDomain).range(["#FFF9B0", "#E84C61", "#2E0B59"]);
  }, [colorScaleDomain]);

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded || !colorScale || Object.keys(zipData).length === 0) return;
    
    const controller = new AbortController();
    const setupOrUpdateLayers = async () => {
      try {
        setLoadingError(null);
        const geojsonResponse = await fetch("https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/us-zip-codes.geojson.gz", { signal: controller.signal });
        if (!geojsonResponse.ok) throw new Error("Failed to fetch GeoJSON");
        const geojsonArrayBuffer = await geojsonResponse.arrayBuffer();
        if (controller.signal.aborted) return;

        const processedGeoJSON = await processData({
            type: "PROCESS_GEOJSON",
            data: { geojsonArrayBuffer, zipData, selectedMetric },
        });

        if (controller.signal.aborted || !mapInstance.isStyleLoaded()) return;

        const source = mapInstance.getSource("zip-codes") as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(processedGeoJSON);
        } else {
          mapInstance.addSource("zip-codes", { type: "geojson", data: processedGeoJSON });
          mapInstance.addLayer({ id: "zip-codes-fill", type: "fill", source: "zip-codes", paint: { "fill-color": ["case", ["has", "metricValue"], ["interpolate", ["linear"], ["get", "metricValue"], ...createColorStops(colorScale)], "rgba(200, 200, 200, 0.1)"], "fill-opacity": 0.75 } });
          mapInstance.addLayer({ id: "zip-codes-border", type: "line", source: "zip-codes", paint: { "line-color": "#FFFFFF", "line-width": 0.5, "line-opacity": 0.5 } });
        }
        
        if (!interactionsSetup.current) {
          setupMapInteractions(mapInstance);
          interactionsSetup.current = true;
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to set up map layers:", error);
          setLoadingError("Failed to load map layers");
        }
      }
    };
    setupOrUpdateLayers();
    return () => controller.abort();
  }, [mapLoaded, colorScale, zipData, selectedMetric, processData]);

  useEffect(() => {
    if (!map.current || !searchZip || !zipData[searchZip]) return;
    const locationData = zipData[searchZip];
    if (locationData.longitude && locationData.latitude) {
      map.current.flyTo({ center: [locationData.longitude, locationData.latitude], zoom: 10 });
    }
  }, [searchZip, zipData]);

  const setupMapInteractions = (mapInstance: maplibregl.Map) => {
    let currentPopup: maplibregl.Popup | null = null;
    mapInstance.on("mousemove", "zip-codes-fill", (e) => {
      if (e.features?.length) {
        mapInstance.getCanvas().style.cursor = "pointer";
        const { zipCode } = e.features[0].properties;
        if (zipCode && zipData[zipCode]) {
            currentPopup?.remove();
            const { lng, lat } = e.lngLat;
            const zipInfo = zipData[zipCode];
            currentPopup = new maplibregl.Popup({ closeButton: false, offset: [0, -10], className: "map-tooltip" }).setLngLat([lng, lat]).setHTML(getMetricDisplay(zipInfo, selectedMetric)).addTo(mapInstance);
        }
      }
    });
    mapInstance.on("mouseleave", "zip-codes-fill", () => {
      mapInstance.getCanvas().style.cursor = "";
      currentPopup?.remove();
      currentPopup = null;
    });
    mapInstance.on("click", "zip-codes-fill", (e) => {
      if (e.features?.length) {
        const { zipCode } = e.features[0].properties;
        if (zipCode && zipData[zipCode]) {
          onZipSelect(zipData[zipCode]);
        }
      }
    });
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: "400px" }} />
      {(isLoading || !mapLoaded || loadingError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
          {loadingError ? <div className="text-red-600 font-bold text-lg">{loadingError}</div> : <div className="text-center space-y-4"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="text-sm font-medium">{progress.phase}...</p></div>}
        </div>
      )}
    </div>
  );
}

function createColorStops(colorScale: ScaleLinear<string, string>): (number | string)[] {
    if (!colorScale) return [];
    const [min, max] = colorScale.domain();
    const stops: (number | string)[] = [];
    for (let i = 0; i <= 8; i++) {
        const value = min + (max - min) * (i / 8);
        stops.push(value, colorScale(value));
    }
    return stops;
}