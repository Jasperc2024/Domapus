
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleLinear } from 'd3-scale';
import { useMapData } from './map/useMapData';
import { createMap } from './map/MapInitializer';
import { getMetricValue, getMetricDisplay, getZipStyle } from './map/utils';
import { ZipData, LeafletMapProps } from './map/types';

export function LeafletMap({ selectedMetric, onZipSelect, searchZip }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [geojsonLayer, setGeojsonLayer] = useState<L.GeoJSON | null>(null);
  const [colorScale, setColorScale] = useState<any>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  const { zipData, citiesData, isLoading } = useMapData();

  // Create color scale when data changes
  useEffect(() => {
    if (Object.keys(zipData).length === 0) return;

    const values = Object.values(zipData).map((data: any) => getMetricValue(data, selectedMetric)).filter(v => v > 0);
    if (values.length === 0) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create D3 color scale with light green to dark blue
    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(['#d4edda', '#1e3a8a']); // Light green to dark blue

    setColorScale(() => scale);
  }, [zipData, selectedMetric]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const leafletMap = createMap(mapRef.current);
    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, [isInteractive]);

  // Load GeoJSON and add interactivity
  useEffect(() => {
    if (!map || !colorScale || !isInteractive) return;

    const loadGeoJSON = async () => {
      try {
        const response = await fetch('data/us-zip-codes.geojson');
        const geojsonData = await response.json();

        // Remove existing layer
        if (geojsonLayer) {
          map.removeLayer(geojsonLayer);
        }

        const layer = L.geoJSON(geojsonData, {
          style: (feature) => getZipStyle(feature, map.getZoom(), colorScale, zipData, selectedMetric),
          onEachFeature: (feature, layer) => {
            const zipCode = feature.properties?.ZCTA5CE10;
            if (zipCode && zipData[zipCode]) {
              const data = zipData[zipCode];
              const cityData = citiesData[zipCode] || {};
              
              // Add hover effect
              layer.on({
                mouseover: (e) => {
                  const target = e.target as L.Path;
                  const currentZoom = map.getZoom();
                  target.setStyle({
                    weight: Math.max(currentZoom > 8 ? 3 : 2, 1),
                    color: '#333',
                    fillOpacity: 0.9,
                  });
                  
                  // Show tooltip
                  const popup = L.popup({
                    closeButton: false,
                    autoClose: false,
                    className: 'zip-tooltip',
                  })
                    .setLatLng(e.latlng)
                    .setContent(`
                      <div class="p-2 bg-white rounded shadow-lg border">
                        <div class="font-semibold text-sm">${zipCode}</div>
                        <div class="text-xs text-gray-600">${cityData.city || 'Unknown'}</div>
                        <div class="text-xs mt-1">${getMetricDisplay(data, selectedMetric)}</div>
                      </div>
                    `)
                    .openOn(map);
                },
                mouseout: (e) => {
                  const target = e.target as L.Path;
                  target.setStyle(getZipStyle(feature, map.getZoom(), colorScale, zipData, selectedMetric));
                  map.closePopup();
                },
                click: () => {
                  if (zipData[zipCode]) {
                    const enhancedData = {
                      ...zipData[zipCode],
                      zipCode,
                      city: cityData.city || zipData[zipCode].city || 'Unknown',
                      county: cityData.county,
                      latitude: cityData.latitude,
                      longitude: cityData.longitude,
                      parent_metro: zipData[zipCode].parent_metro,
                      state: zipData[zipCode].state_name || 'Unknown',
                    };
                    onZipSelect(enhancedData);
                  }
                },
              });
            }
          },
        });

        // Add zoom event listener for dynamic styling
        map.on('zoomend', () => {
          const zoom = map.getZoom();
          layer.eachLayer((leafletLayer) => {
            if (leafletLayer instanceof L.Path) {
              const pathLayer = leafletLayer as L.Path & { feature?: any };
              if (pathLayer.feature) {
                pathLayer.setStyle(getZipStyle(pathLayer.feature, zoom, colorScale, zipData, selectedMetric));
              }
            }
          });
        });

        layer.addTo(map);
        setGeojsonLayer(layer);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    };

    loadGeoJSON();
  }, [map, zipData, citiesData, selectedMetric, onZipSelect, colorScale, isInteractive]);

  // Handle search with zoom functionality
  useEffect(() => {
    if (!map || !geojsonLayer || !searchZip || !isInteractive) return;

    let found = false;
    geojsonLayer.eachLayer((layer: any) => {
      const zipCode = layer.feature?.properties?.ZCTA5CE10;
      if (zipCode === searchZip) {
        found = true;
        const bounds = layer.getBounds();
        map.fitBounds(bounds, { maxZoom: 10, padding: [20, 20] });
        
        // Highlight the searched ZIP
        if (layer instanceof L.Path) {
          layer.setStyle({
            color: '#ef4444',
            weight: 3,
            fillOpacity: 0.8,
          });
          
          // Reset style after 3 seconds
          setTimeout(() => {
            if (layer instanceof L.Path && colorScale) {
              layer.setStyle(getZipStyle(layer.feature, map.getZoom(), colorScale, zipData, selectedMetric));
            }
          }, 3000);
        }

        // Show popup for searched ZIP
        if (zipData[zipCode]) {
          const data = zipData[zipCode];
          const cityData = citiesData[zipCode] || {};
          const enhancedData = {
            ...data,
            zipCode,
            city: cityData.city || data.city || 'Unknown',
            county: cityData.county,
            latitude: cityData.latitude,
            longitude: cityData.longitude,
            parent_metro: data.parent_metro,
            state: data.state_name || 'Unknown',
          };
          onZipSelect(enhancedData);
        }
      }
    });

    if (!found) {
      console.log(`ZIP code ${searchZip} not found in map data`);
    }
  }, [map, geojsonLayer, searchZip, zipData, citiesData, onZipSelect, isInteractive, colorScale, selectedMetric]);

  // Enable interactive mode after initial load
  useEffect(() => {
    if (!isLoading && Object.keys(zipData).length > 0) {
      const timer = setTimeout(() => {
        setIsInteractive(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, zipData]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
