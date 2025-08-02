import { ZipData } from "../components/dashboard/map/types";

type WorkerMessage = {
  id: string;
  type: "LOAD_AND_PROCESS_DATA" | "PROCESS_GEOJSON";
  data: any;
};

function getMetricValue(data: ZipData, metric: string): number {
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
  if (!key || !data) return 0;
  const value = data[key];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = e.data;
  try {
    switch (type) {
      case "LOAD_AND_PROCESS_DATA": {
        const { url, selectedMetric } = data;
        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Fetching market data..." },
        });

        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Fetch failed with status: ${response.status}`);

        const fullPayload = await response.json();
        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData)
          throw new Error("Data file is missing 'zip_codes' key.");

        const zipData: Record<string, ZipData> = {};
        for (const [zipCode, rawValue] of Object.entries(rawZipData)) {
          (rawValue as ZipData).zipCode = zipCode;
          zipData[zipCode] = rawValue as ZipData;
        }

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

        self.postMessage({
          type: "DATA_PROCESSED",
          id,
          data: { zip_codes: zipData, last_updated_utc, bounds },
        });
        break;
      }

      case "PROCESS_GEOJSON": {
        const { geojson, zipData, selectedMetric } = data;

        if (!geojson || !Array.isArray(geojson.features)) {
          console.error(
            "[Worker] Invalid or missing GeoJSON data received.",
            geojson
          );
          self.postMessage({
            type: "ERROR",
            id,
            error: "Invalid GeoJSON data provided to worker.",
          });
          return;
        }

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Processing map shapes" },
        });
        const features: GeoJSON.Feature[] = [];

        for (const feature of geojson.features) {
          if (!feature.geometry) continue;

          const zipCode = feature.properties?.ZCTA5CE20;
          if (!zipCode || !zipData[zipCode]) continue;

          const metricValue = getMetricValue(zipData[zipCode], selectedMetric);
          feature.properties!.zipCode = zipCode;
          feature.properties!.metricValue = metricValue;

          // Keep every feature (Polygon or Point) as-is
          features.push(feature);
        }

        self.postMessage({
          type: "GEOJSON_PROCESSED",
          id,
          data: { type: "FeatureCollection", features },
        });
        break;
      }

      default:
        console.warn(`[Worker] Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error("❌ [Worker] A critical error occurred:", error);
    self.postMessage({
      type: "ERROR",
      id,
      error: error instanceof Error ? error.message : "An unknown worker error.",
    });
  }
};
