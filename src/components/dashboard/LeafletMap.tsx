import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  const [citiesData, setCitiesData] = useState<Record<string, string>>({});

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load ZIP data
        const zipResponse = await fetch('data/zip_data.json');
        const zipJson = await zipResponse.json();
        setZipData(zipJson);

        // Load cities mapping
        const citiesResponse = await fetch('data/zip-city-mapping.csv');
        const citiesText = await citiesResponse.text();
        const citiesMap: Record<string, string> = {};
        
        citiesText.split('\n').slice(1).forEach(line => {
          const [zip, city] = line.split(',');
          if (zip && city) {
            citiesMap[zip.trim()] = city.trim();
          }
        });
        setCitiesData(citiesMap);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const leafletMap = L.map(mapRef.current, {
      center: [39.0, -96.0], // Center of continental USA
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      scrollWheelZoom: true,
      dragging: true,
      zoomControl: true,
      maxBounds: [[-85, -180], [85, 180]], // Limit map bounds
      maxBoundsViscosity: 1.0, // Prevent dragging outside bounds
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(leafletMap);

    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, []);

  // Load GeoJSON and add interactivity
  useEffect(() => {
    if (!map) return;

    const loadGeoJSON = async () => {
      try {
        const response = await fetch('data/us-zip-codes.geojson');
        const geojsonData = await response.json();

        // Remove existing layer
        if (geojsonLayer) {
          map.removeLayer(geojsonLayer);
        }

        const layer = L.geoJSON(geojsonData, {
          style: (feature) => {
            const zipCode = feature?.properties?.ZCTA5CE10;
            const intensity = getZipIntensity(zipCode);
            
            return {
              fillColor: getColorForIntensity(intensity),
              weight: 1,
              opacity: 0.8,
              color: 'white',
              fillOpacity: 0.6,
            };
          },
          onEachFeature: (feature, layer) => {
            const zipCode = feature.properties?.ZCTA5CE10;
            if (zipCode && zipData[zipCode]) {
              const data = zipData[zipCode];
              const city = citiesData[zipCode] || data.city || 'Unknown';
              
              // Add hover effect
              layer.on({
                mouseover: (e) => {
                  const target = e.target;
                  target.setStyle({
                    weight: 3,
                    color: '#666',
                    fillOpacity: 0.8,
                  });
                  
                  // Show tooltip
                  const popup = L.popup({
                    closeButton: false,
                    autoClose: false,
                  })
                    .setLatLng(e.latlng)
                    .setContent(`
                      <div class="p-2">
                        <div class="font-semibold">${zipCode}, ${data.state}</div>
                        <div class="text-sm text-muted-foreground">${city}</div>
                        <div class="text-sm">${getMetricDisplay(data, selectedMetric)}</div>
                      </div>
                    `)
                    .openOn(map);
                },
                mouseout: (e) => {
                  const target = e.target as L.Path;
                  geojsonLayer.resetStyle(target);
                  map.closePopup();
                },
                click: () => {
                  if (zipData[zipCode]) {
                    const enhancedData = {
                      ...zipData[zipCode],
                      zipCode,
                      city: citiesData[zipCode] || zipData[zipCode].city || 'Unknown',
                    };
                    onZipSelect(enhancedData);
                  }
                },
              });
            }
          },
        });

        layer.addTo(map);
        setGeojsonLayer(layer);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    };

    loadGeoJSON();
  }, [map, zipData, citiesData, selectedMetric, onZipSelect]);

  // Handle search
  useEffect(() => {
    if (!map || !geojsonLayer || !searchZip) return;

    geojsonLayer.eachLayer((layer: any) => {
      const zipCode = layer.feature?.properties?.ZCTA5CE10;
      if (zipCode === searchZip) {
        const bounds = layer.getBounds();
        map.fitBounds(bounds);
        layer.setStyle({
          color: '#ff0000',
          weight: 3,
          fillOpacity: 0.8,
        });
        
        setTimeout(() => {
          layer.setStyle({
            color: 'white',
            weight: 1,
            fillOpacity: 0.6,
          });
        }, 3000);
      }
    });
  }, [map, geojsonLayer, searchZip]);

  const getZipIntensity = (zipCode: string): number => {
    if (!zipCode || !zipData[zipCode]) return 0;
    
    const data = zipData[zipCode];
    const value = getMetricValue(data, selectedMetric);
    
    // Normalize intensity based on metric (simplified)
    switch (selectedMetric) {
      case 'median-sale-price':
      case 'median-list-price':
        return Math.min(value / 1000000, 1); // Cap at $1M
      case 'median-dom':
        return Math.min(value / 120, 1); // Cap at 120 days
      default:
        return Math.min(value / 1000, 1); // Generic normalization
    }
  };

  const getColorForIntensity = (intensity: number): string => {
    // HSL color scale from blue to red
    const hue = (1 - intensity) * 240; // 240 = blue, 0 = red
    return `hsl(${hue}, 70%, 50%)`;
  };

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
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {/* Map Attribution */}
      <div className="absolute bottom-2 right-2 bg-dashboard-panel/90 px-2 py-1 rounded text-xs text-dashboard-text-secondary">
        Map data © OpenStreetMap
      </div>
    </div>
  );
}