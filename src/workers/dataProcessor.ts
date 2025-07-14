// Web Worker for processing zip data and reducing main thread blocking

export interface ProcessDataMessage {
  type: "PROCESS_ZIP_DATA";
  data: {
    zipData: Record<string, any>;
    selectedMetric: string;
    bounds?: [[number, number], [number, number]];
  };
}

export interface ProcessDataResponse {
  type: "PROCESSED_ZIP_DATA";
  data: {
    processedData: Record<string, any>;
    metricValues: number[];
    bounds: {
      min: number;
      max: number;
    };
  };
}

// Helper function to get metric value (copied from utils to avoid import issues)
function getMetricValue(data: any, metric: string): number {
  const metricMap: Record<string, string> = {
    "median-sale-price": "median_sale_price",
    "median-list-price": "median_list_price",
    "median-dom": "median_dom",
    inventory: "inventory",
    "new-listings": "new_listings",
    "homes-sold": "homes_sold",
    "sale-to-list-ratio": "sale_to_list_ratio",
    "homes-sold-above-list": "homes_sold_above_list",
    "off-market-2-weeks": "off_market_in_2_weeks",
  };

  const key = metricMap[metric] || metric;
  return data[key] || 0;
}

// Check if coordinates are within bounds
function isWithinBounds(
  lat: number,
  lng: number,
  bounds?: [[number, number], [number, number]],
): boolean {
  if (!bounds) return true;

  const [[south, west], [north, east]] = bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

self.onmessage = function (e: MessageEvent<ProcessDataMessage>) {
  const { type, data } = e.data;

  if (type === "PROCESS_ZIP_DATA") {
    try {
      const { zipData, selectedMetric, bounds } = data;

      // Process data efficiently
      const processedData: Record<string, any> = {};
      const metricValues: number[] = [];

      // Use Object.entries for better performance than separate keys/values
      for (const [zipCode, zipInfo] of Object.entries(zipData)) {
        // Skip processing if outside bounds (for regional views)
        if (bounds && zipInfo.latitude && zipInfo.longitude) {
          if (!isWithinBounds(zipInfo.latitude, zipInfo.longitude, bounds)) {
            continue;
          }
        }

        const value = getMetricValue(zipInfo, selectedMetric);
        if (value > 0) {
          processedData[zipCode] = {
            ...zipInfo,
            metricValue: value,
          };
          metricValues.push(value);
        }
      }

      // Calculate bounds efficiently
      const sortedValues = metricValues.sort((a, b) => a - b);
      const min = sortedValues[0] || 0;
      const max = sortedValues[sortedValues.length - 1] || 0;

      const response: ProcessDataResponse = {
        type: "PROCESSED_ZIP_DATA",
        data: {
          processedData,
          metricValues: sortedValues,
          bounds: { min, max },
        },
      };

      self.postMessage(response);
    } catch (error) {
      self.postMessage({
        type: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

export {}; // Make this a module