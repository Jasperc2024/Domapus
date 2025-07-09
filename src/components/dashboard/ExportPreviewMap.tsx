import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleLinear } from 'd3-scale';
import { useMapData } from './map/useMapData';
import { getMetricValue, getZipStyle } from './map/utils';
import { ExportOptions } from './ExportSidebar';
import pako from 'pako';

interface ExportPreviewMapProps {
  selectedMetric: string;
  exportOptions: ExportOptions;
  mapRef?: React.RefObject<HTMLDivElement>;
}

export function ExportPreviewMap({ selectedMetric, exportOptions, mapRef }: ExportPreviewMapProps) {
  const internalMapRef = useRef<HTMLDivElement>(null);
  const currentMapRef = mapRef || internalMapRef;
  
  const [map, setMap] = useState<L.Map | null>(null);
  const [geojsonLayer, setGeojsonLayer] = useState<L.GeoJSON | null>(null);
  const [colorScale, setColorScale] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const { zipData, citiesData } = useMapData();

  // Create color scale
  useEffect(() => {
    if (Object.keys(zipData).length === 0) return;

    let filteredData = zipData;
    
    // Filter data based on export options
    if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
      filteredData = Object.fromEntries(
        Object.entries(zipData).filter(([, data]: [string, any]) => 
          data.state_code === exportOptions.selectedState
        )
      );
    } else if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
      filteredData = Object.fromEntries(
        Object.entries(zipData).filter(([, data]: [string, any]) => 
          data.parent_metro === exportOptions.selectedMetro
        )
      );
    }

    const values = Object.values(filteredData)
      .map((data: any) => getMetricValue(data, selectedMetric))
      .filter(v => v > 0);
    
    if (values.length === 0) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(['#497eaf', '#e97000'])
      .interpolate(() => (t) => {
        const colors = ['#497eaf', '#5fa4ca', '#b4d4ec', '#ffecd4', '#fac790', '#e97000'];
        const index = Math.floor(t * (colors.length - 1));
        const nextIndex = Math.min(index + 1, colors.length - 1);
        const localT = (t * (colors.length - 1)) - index;
        
        const hex1 = colors[index];
        const hex2 = colors[nextIndex];
        
        const r1 = parseInt(hex1.slice(1, 3), 16);
        const g1 = parseInt(hex1.slice(3, 5), 16);
        const b1 = parseInt(hex1.slice(5, 7), 16);
        
        const r2 = parseInt(hex2.slice(1, 3), 16);
        const g2 = parseInt(hex2.slice(3, 5), 16);
        const b2 = parseInt(hex2.slice(5, 7), 16);
        
        const r = Math.round(r1 + (r2 - r1) * localT);
        const g = Math.round(g1 + (g2 - g1) * localT);
        const b = Math.round(b1 + (b2 - b1) * localT);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });

    setColorScale(() => scale);
  }, [zipData, selectedMetric, exportOptions]);

  // Initialize map
  useEffect(() => {
    if (!currentMapRef.current) return;

    const leafletMap = L.map(currentMapRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      scrollWheelZoom: false,
      dragging: false,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 2, tolerance: 5 })
    });

    // No basemap - clean white background
    const whiteLayer = L.tileLayer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', {
      maxZoom: 18,
      opacity: 0
    });
    whiteLayer.addTo(leafletMap);

    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, []);

  // Load and display ZIP codes
  useEffect(() => {
    if (!map || !colorScale || geojsonLayer) return;

    const loadZipCodes = async () => {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/gh/jaspermayone/Domapus@main/public/data/us-zip-codes.geojson.gz');
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
        const geojsonData = JSON.parse(decompressed);

        const layer = L.geoJSON(geojsonData, {
          style: (feature) => {
            const zipCode = feature?.properties?.ZCTA5CE20 || feature?.properties?.GEOID20 || feature?.properties?.ZCTA5CE10;
            
            // Filter based on export options
            if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
              const data = zipData[zipCode];
              if (!data || data.state_code !== exportOptions.selectedState) {
                return { fillOpacity: 0, stroke: false };
              }
            } else if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
              const data = zipData[zipCode];
              if (!data || data.parent_metro !== exportOptions.selectedMetro) {
                return { fillOpacity: 0, stroke: false };
              }
            }

            return getZipStyle(feature, map.getZoom(), colorScale, zipData, selectedMetric);
          },
          pane: 'overlayPane',
          interactive: false
        });

        layer.addTo(map);
        setGeojsonLayer(layer);

        // Auto-zoom based on region scope
        if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
          // Find state bounds and fit map
          const stateBounds = layer.getBounds();
          if (stateBounds.isValid()) {
            map.fitBounds(stateBounds, { padding: [20, 20] });
          }
        } else if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
          // Find metro bounds and fit map
          const metroBounds = layer.getBounds();
          if (metroBounds.isValid()) {
            map.fitBounds(metroBounds, { padding: [20, 20] });
          }
        } else {
          // National view
          map.setView([39.8283, -98.5795], 4);
        }

        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading ZIP code data for export:', error);
      }
    };

    loadZipCodes();
  }, [map, colorScale, zipData, exportOptions, selectedMetric]);

  // Update styles when options change
  useEffect(() => {
    if (!geojsonLayer || !colorScale) return;

    geojsonLayer.eachLayer((leafletLayer) => {
      if (leafletLayer instanceof L.Path) {
        const pathLayer = leafletLayer as L.Path & { feature?: any };
        if (pathLayer.feature) {
          const zipCode = pathLayer.feature.properties?.ZCTA5CE20 || 
                         pathLayer.feature.properties?.GEOID20 || 
                         pathLayer.feature.properties?.ZCTA5CE10;
          
          // Filter based on export options
          if (exportOptions.regionScope === 'state' && exportOptions.selectedState) {
            const data = zipData[zipCode];
            if (!data || data.state_code !== exportOptions.selectedState) {
              pathLayer.setStyle({ fillOpacity: 0, stroke: false });
              return;
            }
          } else if (exportOptions.regionScope === 'metro' && exportOptions.selectedMetro) {
            const data = zipData[zipCode];
            if (!data || data.parent_metro !== exportOptions.selectedMetro) {
              pathLayer.setStyle({ fillOpacity: 0, stroke: false });
              return;
            }
          }

          pathLayer.setStyle(getZipStyle(pathLayer.feature, map?.getZoom() || 4, colorScale, zipData, selectedMetric));
        }
      }
    });
  }, [geojsonLayer, colorScale, zipData, selectedMetric, exportOptions, map]);

  return (
    <div className="relative w-full h-full bg-white">
      <div 
        ref={currentMapRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      )}
    </div>
  );
}