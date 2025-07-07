
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
  const [colorScale, setColorScale] = useState<any>(null);

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

  // Create color scale when data changes
  useEffect(() => {
    if (Object.keys(zipData).length === 0) return;

    const values = Object.values(zipData).map((data: any) => getMetricValue(data, selectedMetric)).filter(v => v > 0);
    if (values.length === 0) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create D3 color scale
    const scale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(['#eff6ff', '#1e40af']); // Light blue to dark blue

    setColorScale(() => scale);
  }, [zipData, selectedMetric]);

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
      maxBoundsViscosity: 1.0,
      preferCanvas: true, // Better performance
      worldCopyJump: false,
    });

    // Add tile layer with better performance settings
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
      keepBuffer: 2,
      updateWhenZooming: false,
      updateWhenIdle: true,
    }).addTo(leafletMap);

    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, []);

  // Dynamic styling based on zoom level
  const getZipStyle = (feature: any, zoom: number) => {
    const zipCode = feature?.properties?.ZCTA5CE10;
    const value = zipCode && zipData[zipCode] ? getMetricValue(zipData[zipCode], selectedMetric) : 0;
    const fillColor = colorScale && value > 0 ? colorScale(value) : '#e5e7eb';
    
    return {
      fillColor,
      weight: zoom > 10 ? 1 : zoom > 8 ? 0.5 : 0.2,
      color: zoom > 10 ? '#ffffff' : zoom > 8 ? '#ffffff' : 'transparent',
      fillOpacity: 0.7,
      opacity: zoom > 8 ? 0.8 : 0.3,
    };
  };

  // Load GeoJSON and add interactivity
  useEffect(() => {
    if (!map || !colorScale) return;

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
              const city = citiesData[zipCode] || data.city || 'Unknown';
              
              // Add hover effect
              layer.on({
                mouseover: (e) => {
                  const target = e.target;
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
                        <div class="text-xs text-gray-600">${city}</div>
                        <div class="text-xs mt-1">${getMetricDisplay(data, selectedMetric)}</div>
                      </div>
                    `)
                    .openOn(map);
                },
                mouseout: (e) => {
                  const target = e.target as L.Path;
                  layer.setStyle(getZipStyle(feature, map.getZoom()));
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

        // Add zoom event listener for dynamic styling
        map.on('zoomend', () => {
          const zoom = map.getZoom();
          layer.setStyle((feature) => getZipStyle(feature, zoom));
        });

        layer.addTo(map);
        setGeojsonLayer(layer);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    };

    loadGeoJSON();
  }, [map, zipData, citiesData, selectedMetric, onZipSelect, colorScale]);

  // Handle search with zoom functionality
  useEffect(() => {
    if (!map || !geojsonLayer || !searchZip) return;

    let found = false;
    geojsonLayer.eachLayer((layer: any) => {
      const zipCode = layer.feature?.properties?.ZCTA5CE10;
      if (zipCode === searchZip) {
        found = true;
        const bounds = layer.getBounds();
        map.fitBounds(bounds, { maxZoom: 10 });
        
        // Highlight the searched ZIP
        layer.setStyle({
          color: '#ef4444',
          weight: 3,
          fillOpacity: 0.8,
        });
        
        // Reset style after 3 seconds
        setTimeout(() => {
          layer.setStyle(getZipStyle(layer.feature, map.getZoom()));
        }, 3000);

        // Show popup for searched ZIP
        if (zipData[zipCode]) {
          const data = zipData[zipCode];
          const city = citiesData[zipCode] || data.city || 'Unknown';
          const enhancedData = {
            ...data,
            zipCode,
            city,
          };
          onZipSelect(enhancedData);
        }
      }
    });

    if (!found) {
      console.log(`ZIP code ${searchZip} not found in map data`);
    }
  }, [map, geojsonLayer, searchZip, zipData, citiesData, onZipSelect]);

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
