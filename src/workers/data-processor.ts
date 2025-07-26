import pako from "pako";
import { ZipData } from "../components/dashboard/map/types";

// Type definition for messages sent TO this worker
type WorkerMessage = {
  id: string; // Unique ID to track requests
  type: "LOAD_AND_PROCESS_DATA" | "PROCESS_GEOJSON";
  data: any;
};

// --- FIX 2: This helper is now much simpler ---
// It finds the correct data value based on the UI's kebab-case metric name.
export function getMetricValue(data: ZipData, metric: string): number {
  if (!data) return 0;
  
  const metricMap: Record<string, keyof ZipData> = {
    "median-sale-price": "median_sale_price",
    "median-list-price": "median_list_price",
    "median-dom": "median_dom",
    "inventory": "inventory",
    "new-listings": "new_listings",
    "homes-sold": "homes_sold",
    "sale-to-list-ratio": "avg_sale_to_list_ratio",
    "homes-sold-above-list": "sold_above_list",
    "off-market-2-weeks": "off_market_in_two_weeks",
  };

  const key = metricMap[metric];
  if (!key) return 0;

  const value = data[key];
  return typeof value === 'number' && isFinite(value) ? value : 0;
}


self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, data, id } = e.data;

  try {
    switch (type) {
      // This case now handles loading our SINGLE, UNIFIED data file.
      case "LOAD_AND_PROCESS_DATA": {
        const { url, selectedMetric } = data;

        self.postMessage({ type: "PROGRESS", data: { phase: "Loading market data" } });
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data from ${url}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
        const rawZipData: Record<string, ZipData> = JSON.parse(decompressed);

        
        const zipData: Record<string, ZipData> = {};
        for (const [zipCode, rawValue] of Object.entries(rawZipData)) {
            rawValue.zipCode = zipCode;
            zipData[zipCode] = rawValue;
        }

        self.postMessage({ type: "PROGRESS", data: { phase: "Calculating bounds" } });
        const metricValues: number[] = [];
        for (const zipInfo of Object.values(zipData)) {
            const value = getMetricValue(zipInfo, selectedMetric);
            if (value > 0) metricValues.push(value);
        }
        metricValues.sort((a, b) => a - b);
        
        const bounds = {
            min: metricValues[0] || 0,
            max: metricValues[metricValues.length - 1] || 0,
        };

        // Send the final, complete data back to the main thread.
        self.postMessage({
            type: "DATA_PROCESSED",
            id,
            data: { zipData, bounds }, // No more citiesData!
        });
        break;
      }

      // This case processes the map's shapefile. Its logic is largely unchanged.
      case "PROCESS_GEOJSON": {
        const { geojsonArrayBuffer, zipData, selectedMetric } = data;
        self.postMessage({ type: "PROGRESS", data: { phase: "Processing map shapes" } });
        const geojsonData = JSON.parse(pako.ungzip(new Uint8Array(geojsonArrayBuffer), { to: 'string' }));
        const features: GeoJSON.Feature[] = [];

        for (const feature of geojsonData.features) {
          if (feature.geometry) {
            // --- THIS IS THE FIX ---
            // We now know that the ZIP code is always in the ZCTA5CE20 property.
            const zipCode = feature.properties?.ZCTA5CE20;

            if (zipCode && zipData[zipCode]) {
              const metricValue = getMetricValue(zipData[zipCode], selectedMetric);
              if (metricValue > 0) {
                feature.properties!.zipCode = zipCode;
                feature.properties!.metricValue = metricValue;
                features.push(feature);
              }
            }
          }
        }
        self.postMessage({ type: "GEOJSON_PROCESSED", id, data: { type: "FeatureCollection", features } });
        break;
      }

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      id,
      error: error instanceof Error ? error.message : "An unknown error occurred in the worker.",
    });
  }
};