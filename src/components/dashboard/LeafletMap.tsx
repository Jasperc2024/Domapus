import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleLinear } from 'd3-scale';
import { validateZipData } from '@/utils/dataValidation';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ZipData {
  zipCode: string;
  state: string;
  city?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  parent_metro?: string;
  medianSalePrice: number;
  medianListPrice: number;
  medianDOM: number;
  inventory: number;
  newListings: number;
  homesSold: number;
  saleToListRatio: number;
  homesSoldAboveList: number;
  offMarket2Weeks: number;
  // YoY fields
  medianSalePriceYoY?: number;
  medianListPriceYoY?: number;
  medianDOMYoY?: number;
  inventoryYoY?: number;
  newListingsYoY?: number;
  homesSoldYoY?: number;
}

interface LeafletMapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
}

export function LeafletMap({ selectedMetric, onZipSelect, searchZip }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [geojsonLayer, setGeojsonLayer] = useState<L.GeoJSON | null>(null);
  const [zipData, setZipData] = useState<Record<string, any>>({});
  const [citiesData, setCitiesData] = useState<Record<string, any>>({});
  const [colorScale, setColorScale] = useState<any>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load ZIP data
        const zipResponse = await fetch('data/zip_data.json');
        const zipJson = await zipResponse.json();
        setZipData(zipJson);

        // Load enhanced cities mapping with coordinates and county
        const citiesResponse = await fetch('data/zip-city-mapping.csv');
        const citiesText = await citiesResponse.text();
        const citiesMap: Record<string, any> = {};
        
        citiesText.split('\n').slice(1).forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const zip = parts[0]?.trim();
            const city = parts[1]?.trim();
            const county = parts[2]?.trim();
            const lat = parts[3] ? parseFloat(parts[3].trim()) : undefined;
            const lng = parts[4] ? parseFloat(parts[4].trim()) : undefined;
            
            if (zip && city) {
              citiesMap[zip] = {
                city,
                county: county || undefined,
                latitude: lat,
                longitude: lng
              };
            }
          }
        });
        setCitiesData(citiesMap);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // Create color scale when data changes
  useEffect(() => {
    if (Object.keys(zipData).length === 0) return;

    const values = Object.values(zipData).map((data: any) => getMetricValue(data, selectedMetric)).filter(v => v > 0);
    if (values.length === 0) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create D3 color scale with better color scheme
    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(['#fee5d9', '#de2d26']); // Light orange to dark red

    setColorScale(() => scale);
  }, [zipData, selectedMetric]);

  // Initialize map with static background first
  useEffect(() => {
    if (!mapRef.current) return;

    // Show static map image initially
    if (!isInteractive) {
      mapRef.current.innerHTML = `
        <div style="
          width: 100%; 
          height: 100%; 
          background: url('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/4/7/5.png') center/cover;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
        ">
          <div style="
            background: rgba(255,255,255,0.9);
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          ">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Interactive Map</div>
            <div style="color: #666;">Click to activate</div>
          </div>
        </div>
      `;
      
      const clickHandler = () => {
        setIsInteractive(true);
      };
      
      mapRef.current.addEventListener('click', clickHandler);
      
      return () => {
        if (mapRef.current) {
          mapRef.current.removeEventListener('click', clickHandler);
        }
      };
    }

    // Initialize interactive map
    const leafletMap = L.map(mapRef.current, {
      center: [39.0, -96.0], // Center of continental USA
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      scrollWheelZoom: true,
      dragging: true,
      zoomControl: true,
      maxBounds: [[-85, -180], [85, 180]], // Limit map bounds
      maxBoundsViscosity: 1.0,
      preferCanvas: true, // Better performance with Canvas renderer
      worldCopyJump: false,
      renderer: L.canvas({ // Use Canvas renderer for better performance
        padding: 0.5,
        pane: 'overlayPane'
      })
    });

    // Add tile layer with aggressive caching
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
      keepBuffer: 4, // Increased buffer for smoother panning
      updateWhenZooming: false,
      updateWhenIdle: true,
      crossOrigin: true,
      // Enable browser caching
      detectRetina: true,
    }).addTo(leafletMap);

    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, [isInteractive]);

  // Dynamic styling based on zoom level
  const getZipStyle = (feature: any, zoom: number) => {
    const zipCode = feature?.properties?.ZCTA5CE10;
    const value = zipCode && zipData[zipCode] ? getMetricValue(zipData[zipCode], selectedMetric) : 0;
    const fillColor = colorScale && value > 0 ? colorScale(value) : '#e5e7eb';
    
    return {
      fillColor,
      weight: zoom > 10 ? 1 : zoom > 8 ? 0.5 : 0.1,
      color: zoom > 10 ? '#ffffff' : zoom > 8 ? '#ffffff' : 'transparent',
      fillOpacity: 0.8,
      opacity: zoom > 8 ? 0.8 : 0.2,
    };
  };

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
          style: (feature) => getZipStyle(feature, map.getZoom()),
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
                    weight: currentZoom > 8 ? 3 : 2,
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
                  target.setStyle(getZipStyle(feature, map.getZoom()));
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
            // Type guard to check if layer is a Path with setStyle method
            if (leafletLayer instanceof L.Path) {
              const pathLayer = leafletLayer as L.Path & { feature?: any };
              if (pathLayer.feature) {
                pathLayer.setStyle(getZipStyle(pathLayer.feature, zoom));
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
            if (layer instanceof L.Path) {
              layer.setStyle(getZipStyle(layer.feature, map.getZoom()));
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
          };
          onZipSelect(enhancedData);
        }
      }
    });

    if (!found) {
      console.log(`ZIP code ${searchZip} not found in map data`);
    }
  }, [map, geojsonLayer, searchZip, zipData, citiesData, onZipSelect, isInteractive]);

  const getMetricValue = (data: any, metric: string): number => {
    switch (metric) {
      case 'median-sale-price': return data.median_sale_price || 0;
      case 'median-list-price': return data.median_list_price || 0;
      case 'median-dom': return data.median_dom || 0;
      case 'inventory': return data.inventory || 0;
      case 'new-listings': return data.new_listings || 0;
      case 'homes-sold': return data.homes_sold || 0;
      case 'sale-to-list-ratio': return data.avg_sale_to_list_ratio || 0;
      case 'homes-sold-above-list': return data.sold_above_list || 0;
      case 'off-market-2-weeks': return data.off_market_in_two_weeks || 0;
      default: return 0;
    }
  };

  const getMetricDisplay = (data: any, metric: string): string => {
    const value = getMetricValue(data, metric);
    switch (metric) {
      case 'median-sale-price':
      case 'median-list-price':
        return `$${value.toLocaleString()}`;
      case 'median-dom':
        return `${value} days`;
      case 'sale-to-list-ratio':
        return `${(value * 100).toFixed(1)}%`;
      case 'homes-sold-above-list':
      case 'off-market-2-weeks':
        return `${value}%`;
      default:
        return value.toString();
    }
  };

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
