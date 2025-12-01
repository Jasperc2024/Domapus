import { useEffect, useRef, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZipData } from "./map/types";

interface ExportPreviewMapProps {
  filteredZipData: ZipData[];
  filteredGeoJSON: GeoJSON.FeatureCollection | null;
  selectedMetric: string;
  isLoading: boolean;
  onMapReady?: (map: maplibregl.Map) => void;
  regionScope: "national" | "state" | "metro";
  includeTitle: boolean;
  includeLegend: boolean;
}

export function ExportPreviewMap({
  filteredZipData,
  filteredGeoJSON,
  selectedMetric,
  isLoading,
  onMapReady,
  regionScope,
  includeTitle,
  includeLegend,
}: ExportPreviewMapProps) {
  const mainMapRef = useRef<HTMLDivElement>(null);
  const alaskaMapRef = useRef<HTMLDivElement>(null);
  const hawaiiMapRef = useRef<HTMLDivElement>(null);
  const maps = useRef<{ [key: string]: maplibregl.Map | null }>({}).current;

  const colorScale = useMemo(() => {
    const values = filteredZipData
      .map(zip => zip[selectedMetric as keyof ZipData] as number)
      .filter(v => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);
    if (values.length < 2) return null;
    
    const min = values[0];
    const max = values[values.length - 1];
    const buckets = 8;
    const domain: number[] = [];
    const range: string[] = [];
    
    for (let i = 0; i <= buckets; i++) {
      const t = i / buckets;
      domain.push(min + (max - min) * t);
      
      if (t < 0.25) {
        const localT = t / 0.25;
        range.push(interpolateColor("#FFF9B0", "#FFA873", localT));
      } else if (t < 0.5) {
        const localT = (t - 0.25) / 0.25;
        range.push(interpolateColor("#FFA873", "#E84C61", localT));
      } else if (t < 0.75) {
        const localT = (t - 0.5) / 0.25;
        range.push(interpolateColor("#E84C61", "#922C7E", localT));
      } else {
        const localT = (t - 0.75) / 0.25;
        range.push(interpolateColor("#922C7E", "#2E0B59", localT));
      }
    }
    
    return { domain, range };
  }, [filteredZipData, selectedMetric]);

  const { continental, alaska, hawaii } = useMemo(() => {
    if (regionScope !== 'national' || !filteredGeoJSON) {
      return { continental: filteredGeoJSON, alaska: null, hawaii: null };
    }
    const continentalFeatures: GeoJSON.Feature[] = [];
    const alaskaFeatures: GeoJSON.Feature[] = [];
    const hawaiiFeatures: GeoJSON.Feature[] = [];
    const alaskaZips = new Set(filteredZipData.filter(z => z.state === 'Alaska').map(z => z.zipCode));
    const hawaiiZips = new Set(filteredZipData.filter(z => z.state === 'Hawaii').map(z => z.zipCode));
    
    filteredGeoJSON.features.forEach(f => {
      const zipCode = f.properties?.zipCode;
      if (alaskaZips.has(zipCode)) alaskaFeatures.push(f);
      else if (hawaiiZips.has(zipCode)) hawaiiFeatures.push(f);
      else continentalFeatures.push(f);
    });
    
    return {
      continental: { type: "FeatureCollection", features: continentalFeatures } as GeoJSON.FeatureCollection,
      alaska: alaskaFeatures.length > 0 ? { type: "FeatureCollection", features: alaskaFeatures } as GeoJSON.FeatureCollection : null,
      hawaii: hawaiiFeatures.length > 0 ? { type: "FeatureCollection", features: hawaiiFeatures } as GeoJSON.FeatureCollection : null,
    };
  }, [filteredGeoJSON, regionScope, filteredZipData]);

  useEffect(() => {
    interface MapConfig {
      key: string;
      ref: React.RefObject<HTMLDivElement>;
      center: [number, number];
      zoom: number;
      data: GeoJSON.FeatureCollection | null;
    }

    const mapConfigs: MapConfig[] = [
      { key: 'main', ref: mainMapRef, center: [-98.5, 39.8], zoom: 3.5, data: continental },
      ...(regionScope === 'national' && alaska && hawaii ? [
        { key: 'alaska', ref: alaskaMapRef, center: [-152, 64] as [number, number], zoom: 2.5, data: alaska },
        { key: 'hawaii', ref: hawaiiMapRef, center: [-157, 21] as [number, number], zoom: 5, data: hawaii },
      ] : [])
    ];

    mapConfigs.forEach(({ key, ref, center, zoom, data }) => {
      if (!ref.current || maps[key]) return;
      
      const mapInstance = new maplibregl.Map({
        container: ref.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }]
        },
        center,
        zoom,
        interactive: false,
        attributionControl: false
      });
      
      maps[key] = mapInstance;
      
      mapInstance.on('load', () => {
        if (!data || !colorScale || data.features.length === 0) return;
        
        const dataWithMetrics = {
          ...data,
          features: data.features.map(f => {
            const zip = filteredZipData.find(z => z.zipCode === f.properties?.zipCode);
            const metricValue = zip ? zip[selectedMetric as keyof ZipData] as number : 0;
            return { ...f, properties: { ...f.properties, metricValue } };
          })
        };
        
        mapInstance.addSource(key, { type: 'geojson', data: dataWithMetrics });
        
        const fillColorExpression: any = [
          "case",
          ["!", ["has", "metricValue"]], "#ccc",
          ["==", ["get", "metricValue"], 0], "#ccc",
          ["interpolate", ["linear"], ["get", "metricValue"],
            ...colorScale.domain.flatMap((d, i) => [d, colorScale.range[i]])
          ]
        ];
        
        mapInstance.addLayer({
          id: `${key}-fill`,
          type: 'fill',
          source: key,
          paint: {
            "fill-color": fillColorExpression,
            "fill-opacity": 0.8
          }
        });
        
        mapInstance.addLayer({
          id: `${key}-border`,
          type: 'line',
          source: key,
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 0.2
          }
        });
        
        if (key === 'main' && (regionScope === 'state' || regionScope === 'metro') && data.features.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          data.features.forEach(f => {
            if (f.geometry?.type === "Polygon") {
              f.geometry.coordinates[0].forEach((c: any) => bounds.extend(c as [number, number]));
            } else if (f.geometry?.type === "MultiPolygon") {
              f.geometry.coordinates.forEach(p => p[0].forEach((c: any) => bounds.extend(c as [number, number])));
            }
          });
          if (!bounds.isEmpty()) {
            mapInstance.fitBounds(bounds, { padding: 40, duration: 0 });
          }
        }
        
        mapInstance.once("idle", () => {
          if (onMapReady) onMapReady(mapInstance);
        });
      });
    });
    
    return () => {
      Object.values(maps).forEach(m => m?.remove());
      Object.keys(maps).forEach(k => delete maps[k]);
    };
  }, [continental, alaska, hawaii, colorScale, regionScope, selectedMetric, filteredZipData, onMapReady]);


  const getMetricDisplayName = () => {
    const metricNames: Record<string, string> = {
      "median-sale-price": "Median Sale Price",
      "median-list-price": "Median List Price",
      "median-dom": "Median Days on Market",
      "inventory": "Inventory",
      "new-listings": "New Listings",
      "homes-sold": "Homes Sold",
      "sale-to-list-ratio": "Sale to List Ratio",
      "homes-sold-above-list": "Homes Sold Above List",
      "off-market-2-weeks": "Off Market in 2 Weeks",
    };
    return metricNames[selectedMetric] || selectedMetric;
  };

  const getRegionDisplayName = () => {
    if (regionScope === 'national') return 'United States';
    if (regionScope === 'state') return filteredZipData[0]?.state || 'State';
    if (regionScope === 'metro') return filteredZipData[0]?.parent_metro || 'Metro Area';
    return '';
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="relative w-full h-full bg-white p-6 flex flex-col">
      {includeTitle && (
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{getMetricDisplayName()}</h1>
          <p className="text-sm text-gray-600">{getRegionDisplayName()} • {getCurrentDate()}</p>
        </div>
      )}
      
      <div className="flex-1 relative">
        <div ref={mainMapRef} className="w-full h-full" />
        {regionScope === 'national' && alaska && hawaii && (
          <>
            <div className="absolute bottom-4 left-4 w-40 h-32 border border-gray-300 rounded bg-white shadow-sm">
              <div ref={alaskaMapRef} className="w-full h-full" />
            </div>
            <div className="absolute bottom-4 left-48 w-32 h-24 border border-gray-300 rounded bg-white shadow-sm">
              <div ref={hawaiiMapRef} className="w-full h-full" />
            </div>
          </>
        )}
        
        {includeLegend && colorScale && (
          <div className="absolute bottom-4 right-4 bg-white border border-gray-300 rounded p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-3 text-gray-900">Legend</h3>
            <div className="mb-3">
              <div className="h-4 w-48 rounded-lg" style={{ background: "linear-gradient(to right, #FFF9B0, #FFA873, #E84C61, #922C7E, #2E0B59)" }} />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{formatMetricValue(colorScale.domain[0])}</span>
                <span>{formatMetricValue(colorScale.domain[colorScale.domain.length - 1])}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
              {filteredZipData.length.toLocaleString()} ZIP codes
            </div>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-gray-600">Loading Map Data...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function interpolateColor(color1: string, color2: string, t: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function formatMetricValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
