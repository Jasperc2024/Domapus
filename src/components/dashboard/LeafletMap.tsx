
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleLinear } from 'd3-scale';
import * as topojson from 'topojson-client';
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

    // Create D3 color scale with specified colors
    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(['#497eaf', '#e97000']) // Blue to orange
      .interpolate(() => (t) => {
        const colors = ['#497eaf', '#5fa4ca', '#b4d4ec', '#ffecd4', '#fac790', '#e97000'];
        const index = Math.floor(t * (colors.length - 1));
        const nextIndex = Math.min(index + 1, colors.length - 1);
        const localT = (t * (colors.length - 1)) - index;
        
        // Simple linear interpolation between two colors
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

  // Load map layers and add interactivity
  useEffect(() => {
    if (!map || !colorScale || !isInteractive) return;

    const loadMapLayers = async () => {
      // Load and add US land layer first (bottom layer)
      try {
        const landResponse = await fetch('data/us_land.geojson');
        const landData = await landResponse.json();
        
        L.geoJSON(landData, {
          style: {
            color: '#cccccc',
            weight: 1,
            fillColor: '#f5f5f5',
            fillOpacity: 0.5,
            opacity: 0.8
          },
          pane: 'overlayPane',
          interactive: false
        }).addTo(map);
      } catch (error) {
        console.warn('Could not load US land data:', error);
      }

      // Load ZIP code boundaries (TopoJSON)
      try {
        const response = await fetch('data/us-zip-codes.topojson');
        const topojsonData = await response.json();
        
        // Convert TopoJSON to GeoJSON
        const geojsonData = topojson.feature(topojsonData, topojsonData.objects.zipcodes || Object.values(topojsonData.objects)[0]);

        // Remove existing layer
        if (geojsonLayer) {
          map.removeLayer(geojsonLayer);
        }

        const layer = L.geoJSON(geojsonData, {
          style: (feature) => getZipStyle(feature, map.getZoom(), colorScale, zipData, selectedMetric),
          pane: 'overlayPane',
          onEachFeature: (feature, layer) => {
            const zipCode = feature.properties?.ZCTA5CE10 || feature.properties?.GEOID10;
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
        console.error('Error loading ZIP code data:', error);
      }

      // Load and add state boundaries with labels (top layer)
      try {
        const stateResponse = await fetch('data/us-state.geojson');
        const stateData = await stateResponse.json();
        
        // Add state boundaries
        const stateLayer = L.geoJSON(stateData, {
          style: {
            color: '#666666',
            weight: 2,
            fillOpacity: 0,
            opacity: 0.8,
            dashArray: '5,5'
          },
        });
        
        // Add state labels
        stateData.features.forEach((feature: any) => {
          if (feature.properties?.NAME && feature.geometry) {
            // Calculate centroid for label placement
            const coords = feature.geometry.coordinates;
            let lat = 0, lng = 0, count = 0;
            
            const extractCoords = (coordArray: any) => {
              coordArray.forEach((item: any) => {
                if (Array.isArray(item[0])) {
                  extractCoords(item);
                } else {
                  lng += item[0];
                  lat += item[1];
                  count++;
                }
              });
            };
            
            extractCoords(coords);
            
            if (count > 0) {
              const avgLat = lat / count;
              const avgLng = lng / count;
              
              L.marker([avgLat, avgLng], {
                icon: L.divIcon({
                  className: 'state-label',
                  html: `<div style="
                    background: rgba(255, 255, 255, 0.9);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    color: #333;
                    text-align: center;
                    border: 1px solid #ccc;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    pointer-events: none;
                  ">${feature.properties.NAME}</div>`,
                  iconSize: [80, 20],
                  iconAnchor: [40, 10]
                }),
                interactive: false
              }).addTo(map);
            }
          }
        });
        
        stateLayer.addTo(map);
      } catch (error) {
        console.warn('Could not load state boundaries:', error);
      }
    };

    loadMapLayers();
  }, [map, zipData, citiesData, selectedMetric, onZipSelect, colorScale, isInteractive]);

  // Handle search with zoom functionality
  useEffect(() => {
    if (!map || !geojsonLayer || !searchZip || !isInteractive) return;

    let found = false;
    geojsonLayer.eachLayer((layer: any) => {
      const zipCode = layer.feature?.properties?.ZCTA5CE10 || layer.feature?.properties?.GEOID10;
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
              const pathLayer = layer as L.Path & { feature?: any };
              if (pathLayer.feature) {
                pathLayer.setStyle(getZipStyle(pathLayer.feature, map.getZoom(), colorScale, zipData, selectedMetric));
              }
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
