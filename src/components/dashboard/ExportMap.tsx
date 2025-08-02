// src/components/dashboard/ExportMap.tsx
// FINAL, UNIFIED, AND CORRECTED VERSION

import { useEffect, useRef, useMemo } from "react";
import maplibregl, { LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { scaleLinear } from "d3-scale";
import { ZipData } from "./map/types";

// --- FIX: Define a clear interface for our map configurations ---
interface MapConfig {
  key: string;
  ref: React.RefObject<HTMLDivElement>;
  center: LngLatLike; // Use the official LngLatLike type, which is [number, number]
  zoom: number;
  data: GeoJSON.FeatureCollection | null;
}

interface ExportMapProps {
  filteredData: ZipData[];
  geoJSON: GeoJSON.FeatureCollection | null;
  selectedMetric: string;
  regionScope: "national" | "state" | "metro";
  onRenderComplete: () => void;
}

// --- RENAMED: The component is now cleaner ---
export function ExportMap({ filteredData, geoJSON, selectedMetric, regionScope, onRenderComplete }: ExportMapProps) {
  const mainMapRef = useRef<HTMLDivElement>(null);
  const alaskaMapRef = useRef<HTMLDivElement>(null);
  const hawaiiMapRef = useRef<HTMLDivElement>(null);
  const maps = useRef<{ [key: string]: maplibregl.Map | null }>({}).current;

  const colorScale = useMemo(() => {
    const values = filteredData.map(zip => zip[selectedMetric as keyof ZipData] as number).filter(v => typeof v === 'number' && v > 0).sort((a,b) => a-b);
    if (values.length < 2) return null;
    return scaleLinear<string>().domain([values[0], values[values.length - 1]]).range(["#FFF9B0", "#E84C61", "#2E0B59"]);
  }, [filteredData, selectedMetric]);

  const { continental, alaska, hawaii } = useMemo(() => {
    if (regionScope !== 'national' || !geoJSON) return { continental: geoJSON, alaska: null, hawaii: null };
    const continentalFeatures: GeoJSON.Feature[] = [], alaskaFeatures: GeoJSON.Feature[] = [], hawaiiFeatures: GeoJSON.Feature[] = [];
    const alaskaZips = new Set(filteredData.filter(z => z.state === 'Alaska').map(z => z.zipCode));
    const hawaiiZips = new Set(filteredData.filter(z => z.state === 'Hawaii').map(z => z.zipCode));
    geoJSON.features.forEach(f => {
      const zipCode = f.properties!.zipCode;
      if (alaskaZips.has(zipCode)) alaskaFeatures.push(f);
      else if (hawaiiZips.has(zipCode)) hawaiiFeatures.push(f);
      else continentalFeatures.push(f);
    });
    return {
      continental: { type: "FeatureCollection", features: continentalFeatures },
      alaska: { type: "FeatureCollection", features: alaskaFeatures },
      hawaii: { type: "FeatureCollection", features: hawaiiFeatures },
    };
  }, [geoJSON, regionScope, filteredData]);

  useEffect(() => {
    // --- FIX: Apply our new interface to the configs array ---
    const mapConfigs: MapConfig[] = [
      { key: 'main', ref: mainMapRef, center: [-98.5, 39.8] as [number, number], zoom: 3.5, data: continental as GeoJSON.FeatureCollection },
      ...(regionScope === 'national' ? [
        { key: 'alaska', ref: alaskaMapRef, center: [-152, 64] as [number, number], zoom: 2.5, data: alaska as GeoJSON.FeatureCollection },
        { key: 'hawaii', ref: hawaiiMapRef, center: [-157, 21] as [number, number], zoom: 5, data: hawaii as GeoJSON.FeatureCollection },
      ] : [])
    ];
    
    let mapsToLoad = mapConfigs.length;
    let loadedMaps = 0;

    const onMapIdle = () => {
        loadedMaps++;
        if (loadedMaps === mapsToLoad && onRenderComplete) {
            onRenderComplete();
        }
    };
    
    mapConfigs.forEach(({ key, ref, center, zoom, data }) => {
      if (!ref.current || maps[key]) return;
      const map = new maplibregl.Map({ container: ref.current, style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }] }, center, zoom, interactive: false, attributionControl: false });
      maps[key] = map;
      map.on('load', () => {
        if (!data || !colorScale || data.features.length === 0) { onMapIdle(); return; }
        const dataWithMetrics = {
            ...data,
            features: data.features.map(f => {
                const zip = filteredData.find(z => z.zipCode === f.properties!.zipCode);
                const metricValue = zip ? zip[selectedMetric as keyof ZipData] : 0;
                return {...f, properties: {...f.properties, metricValue }};
            })
        };
        map.addSource(key, { type: 'geojson', data: dataWithMetrics });
        map.addLayer({ id: `${key}-fill`, type: 'fill', source: key, paint: { "fill-color": ["case", ["!", ["has", "metricValue"]], "#ccc", ["interpolate", ["linear"], ["get", "metricValue"], ...colorScale.domain().flatMap(d => [d, colorScale(d)])]], "fill-opacity": 0.8 } });
        if (key === 'main' && (regionScope === 'state' || regionScope === 'metro')) {
          const bounds = new maplibregl.LngLatBounds();
          data.features.forEach(f => {
            if (f.geometry?.type === "Polygon") f.geometry.coordinates[0].forEach((c: any) => bounds.extend(c));
            if (f.geometry?.type === "MultiPolygon") f.geometry.coordinates.forEach(p => p[0].forEach((c: any) => bounds.extend(c)));
          });
          if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, duration: 0 });
        }
        map.once('idle', onMapIdle);
      });
    });
    return () => { Object.values(maps).forEach(map => map?.remove()); };
  }, [continental, alaska, hawaii, colorScale, onRenderComplete, regionScope, selectedMetric, filteredData]);

  return (
    <div className="relative w-full h-full">
      <div ref={mainMapRef} className="w-full h-full" />
      {regionScope === 'national' && (
        <>
          <div className="absolute bottom-4 left-4 w-40 h-32 border border-gray-300 rounded bg-white"><div ref={alaskaMapRef} className="w-full h-full" /></div>
          <div className="absolute bottom-4 left-48 w-32 h-24 border border-gray-300 rounded bg-white"><div ref={hawaiiMapRef} className="w-full h-full" /></div>
        </>
      )}
    </div>
  );
}
