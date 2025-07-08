
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
  const zipCode = feature?.properties?.ZCTA5CE20 || feature?.properties?.GEOID20;
  const value = zipCode && zipData[zipCode] ? getMetricValue(zipData[zipCode], selectedMetric) : 0;
  
  let fillColor;
  if (!zipCode || !zipData[zipCode] || value === 0) {
    fillColor = '#9ca3af'; // Gray for no data
  } else {
    fillColor = colorScale(value);
  }
  
  // Reduced outline thickness - dynamic based on zoom level
  let weight;
  let opacity = 0.8; // Visible outlines
  
  if (zoom >= 10) {
    weight = 1.5;
  } else if (zoom >= 8) {
    weight = 1.2;
  } else if (zoom >= 6) {
    weight = 0.8;
  } else if (zoom >= 5) {
    weight = 0.5; // Reduced for default zoom
  } else if (zoom >= 4) {
    weight = 0.3;
  } else {
    weight = 0.2;
  }
  
  return {
    fillColor,
    weight,
    color: '#ffffff', // White outline
    fillOpacity: (!zipCode || !zipData[zipCode] || value === 0) ? 0.3 : 0.8,
    opacity,
  };
};
