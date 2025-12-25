import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useState } from "react";
import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZipData } from "../map/types";
import { addPMTilesProtocol } from "@/lib/pmtiles-protocol";
import bbox from "@turf/bbox";
import { featureCollection, point } from "@turf/helpers";

const BASE_PATH = import.meta.env.BASE_URL;
const CHOROPLETH_COLORS = ["#FFF9B0", "#FFEB84", "#FFD166", "#FF9A56", "#E84C61", "#C13584", "#7B2E8D", "#2E0B59"];
const BASE_WIDTH = 1200;
const BASE_HEIGHT = 900;

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
      if (containerRef.current) {
        setScale(containerRef.current.offsetWidth / BASE_WIDTH);
        Object.values(mapsRef.current).forEach(map => map?.resize());
      }
    };
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();
    return () => observer.disconnect();
  }, []);

  const zipDataMap = useMemo(() => {
    const map: Record<string, ZipData> = {};
    filteredData.forEach(zip => { map[zip.zipCode] = zip; });
    return map;
  }, [filteredData]);

  const { alaskaZips, hawaiiZips, mainlandZips, alaskaBounds, hawaiiBounds, mainlandBounds } = useMemo(() => {
    const ak = new Set<string>(), hi = new Set<string>(), ml = new Set<string>();
    const akPts: any[] = [], hiPts: any[] = [], mlPts: any[] = [];
    
    filteredData.forEach(zip => {
      const st = (zip.state ?? '').toString().toLowerCase();
      const isAk = st === 'ak' || st === 'alaska';
      const isHi = st === 'hi' || st === 'hawaii';
      const lat = zip.latitude || (zip as any).lat;
      const lng = zip.longitude || (zip as any).lng;

      if (!lat || !lng) return;

      if (isAk) { 
        ak.add(zip.zipCode); 
        const normLng = lng > 0 ? lng - 360 : lng;
        akPts.push(point([normLng, lat])); 
      }
      else if (isHi) { hi.add(zip.zipCode); hiPts.push(point([lng, lat])); }
      else { ml.add(zip.zipCode); mlPts.push(point([lng, lat])); }
    });

    const getBbox = (pts: any[]) => {
      if (pts.length === 0) return null;
      const b = bbox(featureCollection(pts));
      return [[b[0], b[1]], [b[2], b[3]]] as [[number, number], [number, number]];
    };

    return { 
      alaskaZips: ak, hawaiiZips: hi, mainlandZips: ml, 
      alaskaBounds: getBbox(akPts), hawaiiBounds: getBbox(hiPts), mainlandBounds: getBbox(mlPts) 
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

  // EFFECT: Handle city visibility toggle instantly
  useEffect(() => {
    const maps = Object.values(mapsRef.current).filter(Boolean) as maplibregl.Map[];
    if (maps.length === 0) return;

    let loadedCount = 0;
    const totalMaps = maps.length;

    maps.forEach(map => {
      if (map.getLayer('place_city_r5')) {
        map.setLayoutProperty('place_city_r5', 'visibility', showCities ? 'visible' : 'none');
      }

      const checkIdle = () => {
        loadedCount++;
        if (loadedCount >= totalMaps) {
          onReady?.();
        }
      };

      map.once('idle', checkIdle);
    });
  }, [showCities, onReady]);

  useEffect(() => {
    addPMTilesProtocol();
    setMapsLoaded(false);
    Object.keys(mapsRef.current).forEach(key => { mapsRef.current[key]?.remove(); mapsRef.current[key] = null; });
    if (filteredData.length === 0) { onReady?.(); return; }

    const pmtilesUrl = new URL(`${BASE_PATH}data/us_zip_codes.pmtiles`, window.location.origin).href;
    const stepExpression: ExpressionSpecification = ["step", ["coalesce", ["feature-state", "metricValue"], 0], "#efefef", 0.000001, CHOROPLETH_COLORS[0], ...buckets.flatMap((threshold, i) => [threshold, CHOROPLETH_COLORS[Math.min(i + 1, CHOROPLETH_COLORS.length - 1)]])] as ExpressionSpecification;

    let loadedCount = 0;
    const requiredMaps = regionScope === 'national' ? 1 + (alaskaZips.size > 0 ? 1 : 0) + (hawaiiZips.size > 0 ? 1 : 0) : 1;

    const createMap = (container: HTMLDivElement | null, key: string, bounds?: [[number, number], [number, number]], validZips?: Set<string>) => {
      if (!container) return;
      
      const map = new maplibregl.Map({ 
        container, 
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", 
        pixelRatio: 2, 
        interactive: false, 
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      mapsRef.current[key] = map;
      
      map.on('load', () => {
        if (bounds) {
          map.fitBounds(bounds, { padding: 25, animate: false, maxZoom: key === 'main' ? 10 : 6 });
        }
        
        // 1. Set EVERYTHING to visibility: none from the style JSON
        const layers = map.getStyle().layers;
        layers.forEach((layer) => {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        });

        // 2. Prepare the ZIP data source
        map.addSource("zips", { type: "vector", url: `pmtiles://${pmtilesUrl}`, promoteId: "ZCTA5CE20" });
        const filterExpression = validZips ? ["in", ["get", "ZCTA5CE20"], ["literal", Array.from(validZips)]] : ["has", "ZCTA5CE20"];

        // 3. Add ZIP layers on top of the hidden style, but BELOW place_city_r5 
        // So that when place_city_r5 is made visible, it is on top.
        map.addLayer({ 
          id: "zips-fill", type: "fill", source: "zips", "source-layer": "us_zip_codes", 
          filter: filterExpression as any, 
          paint: { "fill-color": stepExpression, "fill-opacity": 0.9 } 
        }, 'place_city_r5');

        map.addLayer({ 
          id: "zips-border", type: "line", source: "zips", "source-layer": "us_zip_codes", 
          filter: filterExpression as any, 
          paint: { "line-color": "rgba(0,0,0,0.1)", "line-width": 0.5 } 
        }, 'place_city_r5');

        // 4. If showCities is true initially, turn that one specific layer back on
        if (showCities) {
          map.setLayoutProperty('place_city_r5', 'visibility', 'visible');
        }

        map.once('idle', () => {
          (validZips || new Set(filteredData.map(z => z.zipCode))).forEach(zipCode => {
            const data = zipDataMap[zipCode];
            if (data) map.setFeatureState({ source: "zips", sourceLayer: "us_zip_codes", id: zipCode }, { metricValue: getMetricValue(data, selectedMetric) });
          });
          map.triggerRepaint();
          map.once('idle', () => { loadedCount++; if (loadedCount >= requiredMaps) { setMapsLoaded(true); onReady?.(); } });
        });
      });
    };

    if (regionScope === 'national') {
      createMap(mainMapRef.current, 'main', mainlandBounds || undefined, mainlandZips);
      if (alaskaZips.size > 0) createMap(alaskaMapRef.current, 'alaska', alaskaBounds || undefined, alaskaZips);
      if (hawaiiZips.size > 0) createMap(hawaiiMapRef.current, 'hawaii', hawaiiBounds || undefined, hawaiiZips);
    } else {
      const allBounds = mainlandBounds || alaskaBounds || hawaiiBounds;
      createMap(mainMapRef.current, 'main', allBounds || undefined);
    }
    return () => Object.keys(mapsRef.current).forEach(key => { mapsRef.current[key]?.remove(); mapsRef.current[key] = null; });
  }, [regionScope, regionName, selectedMetric, filteredData.length, alaskaZips, hawaiiZips, mainlandZips, alaskaBounds, hawaiiBounds, mainlandBounds]);

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden bg-white rounded-lg shadow-lg border border-border" style={{ aspectRatio: '4/3', maxHeight: 'calc(100vh - 4rem)' }}>
      <div style={{ width: `${BASE_WIDTH}px`, height: `${BASE_HEIGHT}px`, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, backgroundColor: '#ffffff' }} className="flex flex-col">
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          {includeTitle && (
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: '#111827' }}>{getMetricDisplayName(selectedMetric)} by ZIP Code</h1>
              <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>{regionName} • {getDate()}</p>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] whitespace-nowrap flex-shrink-0">
            <span>Built by <a href="https://jasperc2024.github.io/Domapus/" target="_blank" rel="noopener noreferrer" className="text-[13px] hover:underline" style={{ color: '#0c82a5' }}>Domapus</a></span>
            <span className="opacity-60">•</span>
            <span>Data: <a href="https://www.redfin.com/news/data-center/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#0c82a5' }}>Redfin</a> & <a href="https://www.zillow.com/research/data/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#0c82a5' }}>Zillow</a></span>
          </div>
        </div>

        <div className="flex-1 mx-6 mb-4 relative overflow-hidden">
          <div ref={mainMapRef} className="absolute inset-0" />
          {regionScope === 'national' && (
            <div className="absolute bottom-4 left-4 flex gap-3 z-10">
              {alaskaZips.size > 0 && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium mb-1 text-gray-500">Alaska</span>
                  <div className="w-40 h-28 border bg-white overflow-hidden border-gray-300">
                    <div ref={alaskaMapRef} className="w-full h-full" />
                  </div>
                </div>
              )}
              {hawaiiZips.size > 0 && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium mb-1 text-gray-500">Hawaii</span>
                  <div className="w-48 h-32 border bg-white overflow-hidden border-gray-300"><div ref={hawaiiMapRef} className="w-full h-full" /></div>
                </div>
              )}
            </div>
          )}
          {includeLegend && (
            <div className="absolute bottom-4 right-4 z-10 p-3 bg-white">
              <div className="h-3 w-48" style={{ background: `linear-gradient(to right, ${CHOROPLETH_COLORS.join(', ')})`, borderRadius: '2px' }} />
              <div className="mt-1 flex justify-between text-[10px] font-medium w-48 text-gray-500">
                <span>{legendDisplay.min}</span><span>{legendDisplay.mid}</span><span>{legendDisplay.max}</span>
              </div>
            </div>
          )}
          {!mapsLoaded && <div className="absolute inset-0 flex items-center justify-center bg-white/80"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}
        </div>
      </div>
    </div>
  );
});

PrintStage.displayName = "PrintStage";