import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { LngLatBoundsLike, MapMouseEvent, ExpressionSpecification } from 'maplibre-gl';
import "maplibre-gl/dist/maplibre-gl.css";
import { getMetricDisplay, getMetricValue, computeQuantileBuckets } from "./map/utils";
import { ZipData } from "./map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";
import { trackError } from "@/lib/analytics";
import { LoadDataRequest, DataProcessedResponse } from "@/workers/worker-types";

const BASE_PATH = import.meta.env.BASE_URL;

interface MapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
  searchTrigger?: number;
  zipData: Record<string, ZipData>;
  colorScaleDomain: [number, number] | null;
  isLoading: boolean;
  processData: (message: { type: string; data?: LoadDataRequest }) => Promise<DataProcessedResponse>;
  customBuckets: number[] | null;
  onMapMove: (bounds: [[number, number], [number, number]]) => void;
}

const CHOROPLETH_COLORS = [
  "#FFF9B0", "#FFEB84", "#FFD166", "#FFBA49", "#FF9A56",
  "#F07857", "#E84C61", "#D43D6A", "#C13584", "#9C2A7E",
  "#7B2E8D", "#2E0B59"
];

export function MapLibreMap({
  selectedMetric,
  onZipSelect,
  searchZip,
  searchTrigger,
  zipData,
  isLoading,
  customBuckets,
  onMapMove,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionsSetup = useRef(false);
  const [pmtilesLoaded, setPmtilesLoaded] = useState(false);
  const mousemoveRafRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MapMouseEvent | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lastProcessedMetric = useRef<string>("");
  const lastProcessedDataKeys = useRef<string>("");
  const lastBucketsRef = useRef<string>("");
  const highlightedZipRef = useRef<string | null>(null);
  const containerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const batchIdRef = useRef(0);

  const getDynamicPadding = (container: HTMLDivElement) => {
    const minDim = Math.min(container.clientWidth, container.clientHeight);
    return Math.min(minDim * 0.12, 100);
  };

  // Refs for current data to avoid stale closures
  const propsRef = useRef({ zipData, selectedMetric, onZipSelect });
  useEffect(() => {
    propsRef.current = { zipData, selectedMetric, onZipSelect };
  }, [zipData, selectedMetric, onZipSelect]);
  const hasData = useMemo(() => Object.keys(zipData).length > 0, [zipData]);

  // 1. Initialize Map with PMTiles
  const createAndInitializeMap = useCallback((container: HTMLDivElement) => {
    addPMTilesProtocol();
    const bounds: LngLatBoundsLike = [[-124.7844079, 24.7433195], [-66.9513812, 49.3457868]];
    const dynamicPadding = getDynamicPadding(container);
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      minZoom: 3,
      maxZoom: 12,
      bounds: bounds,
      fitBoundsOptions: { padding: dynamicPadding },
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("error", (e) => {
      const mapError = e as { error?: { message?: string } };
      const errMsg = mapError?.error?.message ?? "Map internal error";
      console.error("[Map] Internal error:", mapError?.error ?? e);
      trackError("map_internal_error", errMsg);
      setError("Map internal error. Try refreshing.");
    });

    map.once("load", () => {
      console.log("[Map] Map initialized");
      setIsMapReady(true);
      onMapMove(map.getBounds().toArray() as [[number, number], [number, number]]);
    });

    return map;
  }, [onMapMove]);

  // 2. Setup Map Instance
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const container = mapContainer.current;
    let didUnmount = false;

    const tryInit = () => {
      if (didUnmount) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;

      try {
        const m = createAndInitializeMap(container);
        mapRef.current = m;
        containerSizeRef.current = { width: container.clientWidth, height: container.clientHeight };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Map initialization failed";
        console.error("Map init failed", err);
        trackError("map_init_failed", errMsg);
      }
    };

    const handleResize = () => {
      if (!mapRef.current || didUnmount) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      const widthDiff = Math.abs(newWidth - containerSizeRef.current.width);
      const heightDiff = Math.abs(newHeight - containerSizeRef.current.height);

      if (widthDiff > 5 || heightDiff > 5) {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }

        resizeTimeoutRef.current = setTimeout(() => {
          if (!didUnmount && mapRef.current) {
            containerSizeRef.current = { width: newWidth, height: newHeight };
            mapRef.current.resize();
          }
        }, 150);
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    tryInit();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mapRef.current) {
        console.log("[Map] Tab visible, refreshing...");
        mapRef.current.resize();
        mapRef.current.triggerRepaint();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      didUnmount = true;
      ro.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (mousemoveRafRef.current) {
        cancelAnimationFrame(mousemoveRafRef.current);
        mousemoveRafRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Map removal failed";
          console.warn("[MapLibreMap] error removing map", err);
          trackError("map_removal_failed", errMsg);
        }
        mapRef.current = null;
      }
      setIsMapReady(false);
      interactionsSetup.current = false;
    };
  }, [createAndInitializeMap]);

  const onMapMoveRef = useRef(onMapMove);
  useEffect(() => {
    onMapMoveRef.current = onMapMove;
  }, [onMapMove]);

  // 3. Setup Interactions
  const setupMapInteractions = useCallback(() => {
    const map = mapRef.current;
    if (!map || interactionsSetup.current) return;

    const layerId = "zips-fill";

    const mousemoveHandler = (e: MapMouseEvent) => {
      lastMouseEventRef.current = e;
      if (mousemoveRafRef.current) return;
      mousemoveRafRef.current = requestAnimationFrame(() => {
        const ev = lastMouseEventRef.current;
        mousemoveRafRef.current = null;
        if (!ev) return;

        try {
          const features = map.queryRenderedFeatures(ev.point, { layers: [layerId] });
          const isHovering = features.length > 0;
          map.getCanvas().style.cursor = isHovering ? "pointer" : "";

          if (!isHovering) {
            popupRef.current?.remove();
            return;
          }

          const props = features[0].properties ?? {};
          const zipCode = (props.ZCTA5CE20 || props.zipCode || props.id) as string;
          const { zipData: currentZipData, selectedMetric: currentMetric } = propsRef.current;

          if (!zipCode || !currentZipData[zipCode]) {
            popupRef.current?.remove();
            return;
          }

          if (!popupRef.current) {
            popupRef.current = new maplibregl.Popup({
              closeButton: false, offset: [0, -10], maxWidth: "320px"
            });
          }

          popupRef.current
            .setLngLat(ev.lngLat)
            .setHTML(getMetricDisplay(currentZipData[zipCode], currentMetric))
            .addTo(map);

        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Mousemove error";
          console.error("mousemove error", err);
          trackError("map_mousemove_error", errMsg);
        }
      });
    };

    const clickHandler = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });

      if (!features.length) return;

      const props = features[0].properties ?? {};
      const zipCode = (props.ZCTA5CE20 || props.zipCode || props.id) as string;
      const { zipData: currentZipData, onZipSelect: currentOnSelect } = propsRef.current;

      if (zipCode && currentZipData[zipCode]) {
        currentOnSelect(currentZipData[zipCode]);
      }
    };

    const mouseoutHandler = () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };

    const moveEndHandler = () => {
      onMapMoveRef.current(map.getBounds().toArray() as [[number, number], [number, number]]);
    };

    map.on("mousemove", mousemoveHandler);
    map.on("click", clickHandler);
    map.on("mouseout", mouseoutHandler);
    map.on("moveend", moveEndHandler);

    interactionsSetup.current = true;
  }, []);

  // 4. Add PMTiles Source & Layer
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;

    if (map.getSource("zips")) return;

    try {
      // Hide transportation layers for cleaner look
      const style = map.getStyle();
      if (!style || !style.layers) return;
      const styleLayers = style.layers;
      styleLayers.forEach((layer) => {
        if ('source-layer' in layer) {
          const sourceLayer = layer['source-layer'] as string;
          if (sourceLayer === "transportation" || sourceLayer === "transportation_name") {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }
      });

      const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;

      map.addSource("zips", {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        promoteId: "ZCTA5CE20"
      });

      const layers = map.getStyle().layers;
      const stateBoundaryLayer = layers.find((l) => l.id === "boundary_state");
      const labelLayer = layers.find((l) => l.id === "watername_ocean");
      const beforeId = stateBoundaryLayer?.id || labelLayer?.id;

      // Fill layer
      map.addLayer({
        id: "zips-fill",
        type: "fill",
        source: "zips",
        "source-layer": "us_zip_codes",
        paint: {
          "fill-color": "#cccccc",
          "fill-opacity": 0.75,
        }
      }, beforeId);

      // Border layer
      map.addLayer({
        id: "zips-border",
        type: "line",
        source: "zips",
        "source-layer": "us_zip_codes",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "highlighted"], false],
            "#ff6b35",
            "rgba(0,0,0,0.15)"
          ],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            3, ["case", ["boolean", ["feature-state", "highlighted"], false], 2, 0.3],
            6, ["case", ["boolean", ["feature-state", "highlighted"], false], 3, 0.6],
            10, ["case", ["boolean", ["feature-state", "highlighted"], false], 4, 1.5],
            12, ["case", ["boolean", ["feature-state", "highlighted"], false], 5, 2]
          ]
        }
      }, beforeId);

      // ZIP labels layer - visible at high zoom
      map.addLayer({
        id: "zips-labels",
        type: "symbol",
        source: "zips",
        "source-layer": "us_zip_codes",
        minzoom: 9.5,
        layout: {
          "visibility": "visible",
          "text-field": ["get", "ZCTA5CE20"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            9, 10,
            12, 14
          ],
          "text-allow-overlap": false,
          "text-padding": 8,
          "symbol-placement": "point",
          "symbol-sort-key": ["to-number", ["get", "ZCTA5CE20"]],
          "text-ignore-placement": false,
          "symbol-avoid-edges": true
        },
        paint: {
          "text-color": "#1E40AF",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 1.5
        }
      });


      map.once("idle", () => {
        console.log("[MapLibreMap] Map idle");
      });

      // Proactively set loaded when source is added
      setPmtilesLoaded(true);
      setupMapInteractions();

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to load PMTiles";
      console.error("Add PMTiles layer failed", err);
      trackError("pmtiles_layer_failed", errMsg);
      setError("Failed to load map data. Try refreshing.");
    }
  }, [isMapReady, setupMapInteractions]);

  // 5. Update Choropleth Colors
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !pmtilesLoaded || !hasData) return;
    const map = mapRef.current;

    // Ensure layer exists
    if (!map.getLayer("zips-fill")) return;

    const currentDataKeys = Object.keys(zipData).length.toString();
    const currentBucketsStr = JSON.stringify(customBuckets);
    const bucketsUpdated = currentBucketsStr !== lastBucketsRef.current;

    if (
      lastProcessedMetric.current === selectedMetric &&
      lastProcessedDataKeys.current === currentDataKeys &&
      !bucketsUpdated &&
      customBuckets === null
    ) {
      return;
    }

    lastProcessedMetric.current = selectedMetric;
    lastProcessedDataKeys.current = currentDataKeys;
    lastBucketsRef.current = currentBucketsStr;

    const currentBatchId = ++batchIdRef.current;

    let buckets: number[] = [];
    if (customBuckets && customBuckets.length > 0) {
      buckets = customBuckets;
    } else {
      const values = Object.values(zipData).map(d => getMetricValue(d, selectedMetric));
      buckets = computeQuantileBuckets(values, CHOROPLETH_COLORS.length);
    }

    if (buckets.length === 0) {
      return;
    }

    const stepExpression: ExpressionSpecification = [
      "step",
      ["coalesce", ["feature-state", "metricValue"], 0],
      "transparent",
      0.001,
      CHOROPLETH_COLORS[0],
      ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])
    ] as ExpressionSpecification;

    const entries = Object.entries(zipData);
    const BATCH_SIZE = 1000;
    let batchIndex = 0;

    const shouldUpdateStates = customBuckets === null || lastProcessedMetric.current !== selectedMetric || lastProcessedDataKeys.current !== currentDataKeys;

    if (shouldUpdateStates) {
      const processBatch = () => {
        if (currentBatchId !== batchIdRef.current) return;

        const batch = entries.slice(batchIndex, batchIndex + BATCH_SIZE);
        batch.forEach(([zipCode, data]) => {
          const metricValue = getMetricValue(data, selectedMetric);
          if (mapRef.current && mapRef.current.getStyle() && currentBatchId === batchIdRef.current) {
            map.setFeatureState(
              { source: "zips", sourceLayer: "us_zip_codes", id: zipCode },
              { metricValue }
            );
          }
        });

        batchIndex += BATCH_SIZE;
        if (batchIndex < entries.length && currentBatchId === batchIdRef.current) {
          requestAnimationFrame(processBatch);
        } else if (currentBatchId === batchIdRef.current) {
          if (mapRef.current) map.setPaintProperty("zips-fill", "fill-color", stepExpression);
        }
      };
      processBatch();
    } else {
      requestAnimationFrame(() => {
        if (currentBatchId === batchIdRef.current && mapRef.current && mapRef.current.getStyle()) {
          map.setPaintProperty("zips-fill", "fill-color", stepExpression);
        }
      });
    }
  }, [isMapReady, pmtilesLoaded, zipData, selectedMetric, hasData, customBuckets]);

  // 6. Fly to Search and Highlight ZIP
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !pmtilesLoaded) return;
    if (!searchZip || !zipData[searchZip]) return;

    const map = mapRef.current;
    const { longitude, latitude } = zipData[searchZip];

    // Clear previous highlight
    if (highlightedZipRef.current && highlightedZipRef.current !== searchZip) {
      map.setFeatureState(
        { source: "zips", sourceLayer: "us_zip_codes", id: highlightedZipRef.current },
        { highlighted: false }
      );
    }

    // Set new highlight
    map.setFeatureState(
      { source: "zips", sourceLayer: "us_zip_codes", id: searchZip },
      { highlighted: true }
    );
    highlightedZipRef.current = searchZip;

    if (longitude && latitude) {
      map.flyTo({ center: [longitude, latitude], zoom: 10, duration: 1500 });
    }
  }, [isMapReady, pmtilesLoaded, searchZip, searchTrigger, zipData]);


  return (
    <div className="absolute inset-0 w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: "400px" }} />
      {(isLoading || !isMapReady || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
          {error ? <div className="text-red-500 font-bold">{error}</div> : <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />}
        </div>
      )}
    </div>
  );
}
