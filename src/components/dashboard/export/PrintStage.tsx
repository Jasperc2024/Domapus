import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useState } from "react";
import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZipData } from "../map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";
import { trackError } from "@/lib/analytics";
import bbox from "@turf/bbox";
import { featureCollection, point } from "@turf/helpers";

const BASE_PATH = import.meta.env.BASE_URL;
const CHOROPLETH_COLORS = ["#FFF9B0", "#FFEB84", "#FFD166", "#FF9A56", "#E84C61", "#C13584", "#7B2E8D", "#2E0B59"];
const BASE_WIDTH = 1200;
const BASE_HEIGHT = 900;
const BOUNDS_BUFFER = 0.15;

export interface PrintStageProps {
  filteredData: ZipData[];
  selectedMetric: string;
  regionScope: "national" | "state" | "metro";
  regionName: string;
  includeLegend: boolean;
  includeTitle: boolean;
  showCities?: boolean;
  onReady?: () => void;
}

export interface PrintStageRef { getElement: () => HTMLDivElement | null; }

function getMetricValue(data: ZipData | undefined, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

function computeQuantileBuckets(values: number[], numBuckets = 8): number[] {
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  const thresholds: number[] = [];
  const epsilon = (maxVal - minVal) * 1e-6 || 1e-6;
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  for (let i = 1; i < numBuckets; i++) {
    let val = q(i / numBuckets);
    if (thresholds.length && val <= thresholds[thresholds.length - 1]) val = thresholds[thresholds.length - 1] + epsilon;
    thresholds.push(val);
  }
  return thresholds;
}

const getMetricDisplayName = (metric: string): string => {
  const metricNames: Record<string, string> = { "zhvi": "Zillow Home Value Index", "median_sale_price": "Median Sale Price", "median_ppsf": "Median Price per Sq Ft", "avg_sale_to_list_ratio": "Sale-to-List Ratio", "median_dom": "Median Days on Market" };
  return metricNames[metric] || metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const getDate = (): string => new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString("en-US", { month: "long", year: "numeric" });

function formatLegendValue(value: number, metric: string): string {
  const m = metric.toLowerCase();
  if (m.includes("price") || m.includes("zhvi")) return `$${(value / 1000).toFixed(0)}k`;
  if (m.includes("ratio")) return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

function computeQuantiles(values: number[], percentiles: number[]) {
  if (!values || values.length === 0) return percentiles.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return percentiles.map((p) => {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  });
}

export const PrintStage = forwardRef<PrintStageRef, PrintStageProps>(({
  filteredData, selectedMetric, regionScope, regionName, includeLegend, includeTitle, showCities = false, onReady
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainMapRef = useRef<HTMLDivElement>(null);
  const alaskaMapRef = useRef<HTMLDivElement>(null);
  const hawaiiMapRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<{ [key: string]: maplibregl.Map | null }>({});
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && containerRef.current.parentElement) {
        const parent = containerRef.current.parentElement;
        const availWidth = parent.clientWidth;
        const availHeight = parent.clientHeight;
        const scaleW = availWidth / BASE_WIDTH;
        const scaleH = availHeight / BASE_HEIGHT;
        const newScale = Math.min(scaleW, scaleH);
        setScale(newScale);
        Object.values(mapsRef.current).forEach(map => map?.resize());
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current?.parentElement) observer.observe(containerRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  const zipDataMap = useMemo(() => {
    const map: Record<string, ZipData> = {};
    filteredData.forEach(zip => { map[zip.zipCode] = zip; });
    return map;
  }, [filteredData]);

  const { alaskaZips, hawaiiZips, mainlandZips, alaskaBounds, hawaiiBounds, mainlandBounds } = useMemo(() => {
    const ak = new Set<string>(), hi = new Set<string>(), ml = new Set<string>();
    const akPts: ReturnType<typeof point>[] = [], hiPts: ReturnType<typeof point>[] = [], mlPts: ReturnType<typeof point>[] = [];

    filteredData.forEach(zip => {
      const st = (zip.state ?? '').toString().toLowerCase();
      const isAk = st === 'ak' || st === 'alaska';
      const isHi = st === 'hi' || st === 'hawaii';
      const lat = zip.latitude || (zip as any).lat;
      const lng = zip.longitude || (zip as any).lng;

      if (!lat || !lng) return;

      if (isAk) {
        ak.add(zip.zipCode);
        if (lng < 0) akPts.push(point([lng, lat]));
      }
      else if (isHi) {
        hi.add(zip.zipCode);
        hiPts.push(point([lng, lat]));
      }
      else {
        ml.add(zip.zipCode);
        mlPts.push(point([lng, lat]));
      }
    });

    const getSmartBbox = (pts: ReturnType<typeof point>[]) => {
      if (pts.length === 0) return null;
      const b = bbox(featureCollection(pts));
      let [minX, minY, maxX, maxY] = b;
      minX -= BOUNDS_BUFFER; minY -= BOUNDS_BUFFER;
      maxX += BOUNDS_BUFFER; maxY += BOUNDS_BUFFER;
      return [[minX, minY], [maxX, maxY]] as [[number, number], [number, number]];
    };

    return {
      alaskaZips: ak, hawaiiZips: hi, mainlandZips: ml,
      alaskaBounds: getSmartBbox(akPts),
      hawaiiBounds: getSmartBbox(hiPts),
      mainlandBounds: getSmartBbox(mlPts)
    };
  }, [filteredData]);

  const buckets = useMemo(() => computeQuantileBuckets(filteredData.map(d => getMetricValue(d, selectedMetric))), [filteredData, selectedMetric]);
  const metricValues = useMemo(() => filteredData.map(d => d[selectedMetric as keyof ZipData] as number).filter(v => typeof v === "number" && v > 0), [filteredData, selectedMetric]);
  const legendDisplay = useMemo(() => {
    if (metricValues.length === 0) return { min: "N/A", mid: "N/A", max: "N/A" };
    const [min, mid, max] = computeQuantiles(metricValues, [0.05, 0.5, 0.95]);
    return { min: formatLegendValue(min, selectedMetric), mid: formatLegendValue(mid, selectedMetric), max: formatLegendValue(max, selectedMetric) };
  }, [metricValues, selectedMetric]);

  useImperativeHandle(ref, () => ({ getElement: () => containerRef.current }));

  useEffect(() => {
    addPMTilesProtocol();
    setMapsLoaded(false);

    Object.keys(mapsRef.current).forEach(key => { mapsRef.current[key]?.remove(); mapsRef.current[key] = null; });
    if (filteredData.length === 0) { onReady?.(); return; }

    const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
    const stepExpression: ExpressionSpecification = ["step", ["coalesce", ["feature-state", "metricValue"], 0], "#efefef", 0.000001, CHOROPLETH_COLORS[0], ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])] as ExpressionSpecification;
    let loadedCount = 0;
    const requiredMaps = regionScope === 'national' ? 1 + (alaskaZips.size > 0 ? 1 : 0) + (hawaiiZips.size > 0 ? 1 : 0) : 1;
    let isReadyTriggered = false;
    const markReady = () => {
      if (loadedCount >= requiredMaps && !isReadyTriggered) {
        isReadyTriggered = true;
        setMapsLoaded(true);
        onReady?.();
      }
    };

    const createMap = (container: HTMLDivElement | null, key: string, bounds?: [[number, number], [number, number]], validZips?: Set<string>) => {
      if (!container) return;

      const map = new maplibregl.Map({
        container,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        pixelRatio: 2,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        renderWorldCopies: true,
      });
      mapsRef.current[key] = map;

      map.on('load', () => {
        try {
          map.resize();

          if (bounds) {
            const padding = (key === 'alaska' || key === 'hawaii') ? 20 : 40;
            const isValid = bounds.flat().every(n => Number.isFinite(n));
            if (isValid) {
              map.fitBounds(bounds, { padding, animate: false, maxZoom: key === 'main' ? 12 : 6 });
            }
          }

          const style = map.getStyle();
          let firstCityLayerId: string | undefined;
          if (style && style.layers) {
            style.layers.forEach((layer: any) => {
              const id = layer.id;
              const sourceLayer = layer['source-layer'];
              const isCity = id.includes('place_city');
              const isWater = sourceLayer === 'water';
              const isBoundary = id.includes('boundary_country') || id.includes('boundary_state');

              if (isCity) {
                if (!firstCityLayerId) firstCityLayerId = id;
                map.setLayoutProperty(id, 'visibility', showCities ? 'visible' : 'none');
              } else if (isWater || isBoundary) {
                map.setLayoutProperty(id, 'visibility', 'visible');
              } else {
                map.setLayoutProperty(id, 'visibility', 'none');
              }
            });
          }

          map.addSource("zips", { type: "vector", url: `pmtiles://${pmtilesUrl}`, promoteId: "ZCTA5CE20" });
          const filterExpression = validZips ? ["in", ["get", "ZCTA5CE20"], ["literal", Array.from(validZips)]] : ["has", "ZCTA5CE20"];

          map.addLayer({
            id: "zips-fill", type: "fill", source: "zips", "source-layer": "us_zip_codes",
            filter: filterExpression as any,
            paint: { "fill-color": stepExpression, "fill-opacity": 0.9 }
          }, firstCityLayerId);

          map.addLayer({
            id: "zips-border", type: "line", source: "zips", "source-layer": "us_zip_codes",
            filter: filterExpression as any,
            paint: { "line-color": "rgba(0,0,0,0.1)", "line-width": 0.5 }
          }, firstCityLayerId);

          (validZips || new Set(filteredData.map(z => z.zipCode))).forEach(zipCode => {
            const data = zipDataMap[zipCode];
            if (data) map.setFeatureState({ source: "zips", sourceLayer: "us_zip_codes", id: zipCode }, { metricValue: getMetricValue(data, selectedMetric) });
          });

          map.triggerRepaint();

          const checkInterval = setInterval(() => {
            if (map.loaded() && map.isStyleLoaded()) {
              clearInterval(checkInterval);
              loadedCount++;
              markReady();
            }
          }, 250);

          setTimeout(() => {
            if (!isReadyTriggered) {
              clearInterval(checkInterval);
              loadedCount++;
              markReady();
            }
          }, 5000);

        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : "Unknown export map error";
          console.error(`[Export] Error initializing map ${key}:`, error);
          trackError("export_map_init_error", errMsg);
          loadedCount++;
          markReady();
        }
      });
    };

    if (regionScope === 'national') {
      createMap(mainMapRef.current, 'main', mainlandBounds || undefined, mainlandZips);
      if (alaskaZips.size > 0) createMap(alaskaMapRef.current, 'alaska', alaskaBounds || undefined, alaskaZips);
      if (hawaiiZips.size > 0) createMap(hawaiiMapRef.current, 'hawaii', hawaiiBounds || undefined, hawaiiZips);
    } else {
      const allBounds = mainlandBounds || alaskaBounds || hawaiiBounds;
      const allZips = new Set(filteredData.map(z => z.zipCode));
      createMap(mainMapRef.current, 'main', allBounds || undefined, allZips);
    }

    return () => {
      Object.keys(mapsRef.current).forEach(key => {
        mapsRef.current[key]?.remove();
        mapsRef.current[key] = null;
      });
    };
  }, [regionScope, regionName, selectedMetric, filteredData, alaskaZips, hawaiiZips, mainlandZips, alaskaBounds, hawaiiBounds, mainlandBounds, showCities]);

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden bg-muted/10 select-none"
    >
      <div
        ref={containerRef}
        style={{
          width: `${BASE_WIDTH}px`,
          height: `${BASE_HEIGHT}px`,
          transform: `scale(${scale})`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          backgroundColor: '#ffffff'
        }}
        className="flex flex-col flex-shrink-0 origin-center rounded-md"
        onContextMenu={(e) => { e.preventDefault(); return false; }}
      >
        <div className="flex items-start justify-between px-8 pt-6 pb-4">
          {includeTitle && (
            <div>
              <h1 className="text-3xl font-bold leading-tight text-gray-900">{getMetricDisplayName(selectedMetric)} by ZIP Code</h1>
              <p className="text-base mt-1 text-gray-500">{regionName} • {getDate()}</p>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400 whitespace-nowrap flex-shrink-0 ml-auto mt-1">
            <span>Built by <a href="https://jasperc2024.github.io/Domapus/" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">Domapus</a></span>
            <span className="opacity-60">•</span>
            <span>Data: <a href="https://www.redfin.com/news/data-center/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#0c82a5' }}>Redfin</a> & <a href="https://www.zillow.com/research/data/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#0c82a5' }}>Zillow</a></span>
          </div>
        </div>

        <div className="flex-1 mx-8 mb-6 relative bg-slate-50">
          <div ref={mainMapRef} className="absolute inset-0" />

          {regionScope === 'national' && (
            <div className="absolute bottom-4 left-4 flex gap-4 z-10">
              {alaskaZips.size > 0 && (
                <div className="flex flex-col bg-white border border-gray-200">
                  <span className="text-[10px] uppercase tracking-wider font-semibold py-0.5 px-2 bg-slate-50 text-slate-500 border-b">Alaska</span>
                  <div className="w-48 h-32 relative">
                    <div ref={alaskaMapRef} className="absolute inset-0" />
                  </div>
                </div>
              )}
              {hawaiiZips.size > 0 && (
                <div className="flex flex-col bg-white border border-gray-200">
                  <span className="text-[10px] uppercase tracking-wider font-semibold py-0.5 px-2 bg-slate-50 text-slate-500 border-b">Hawaii</span>
                  <div className="w-48 h-32 relative">
                    <div ref={hawaiiMapRef} className="absolute inset-0" />
                  </div>
                </div>
              )}
            </div>
          )}

          {includeLegend && (
            <div className="absolute bottom-4 right-4 z-10 p-4 bg-white/95 backdrop-blur rounded-md">
              <div className="h-4 w-56" style={{ background: `linear-gradient(to right, ${CHOROPLETH_COLORS.join(', ')})`, borderRadius: '4px' }} />
              <div className="mt-2 flex justify-between text-xs font-semibold w-56 text-gray-600">
                <span>{legendDisplay.min}</span><span>{legendDisplay.mid}</span><span>{legendDisplay.max}</span>
              </div>
            </div>
          )}

          {!mapsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-cyan-600" />
                <span className="text-sm font-medium text-slate-500">Rendering map...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

PrintStage.displayName = "PrintStage";