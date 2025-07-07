
export const getMetricValue = (data: any, metric: string): number => {
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

export const getMetricDisplay = (data: any, metric: string): string => {
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

export const getZipStyle = (feature: any, zoom: number, colorScale: any, zipData: Record<string, any>, selectedMetric: string) => {
  const zipCode = feature?.properties?.ZCTA5CE10;
  const value = zipCode && zipData[zipCode] ? getMetricValue(zipData[zipCode], selectedMetric) : 0;
  const fillColor = colorScale && value > 0 ? colorScale(value) : '#e5e7eb';
  
  // Dynamic outline thickness based on zoom level
  let weight = 0;
  let opacity = 0;
  
  if (zoom >= 10) {
    weight = 1.5;
    opacity = 0.9;
  } else if (zoom >= 8) {
    weight = 0.8;
    opacity = 0.6;
  } else if (zoom >= 6) {
    weight = 0.3;
    opacity = 0.3;
  } else {
    weight = 0.1;
    opacity = 0.1;
  }
  
  return {
    fillColor,
    weight,
    color: zoom > 6 ? '#ffffff' : 'transparent',
    fillOpacity: 0.8,
    opacity,
  };
};
