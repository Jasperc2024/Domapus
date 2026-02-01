import { ZipData } from "../components/dashboard/map/types";
import { computeQuantileBuckets } from "../components/dashboard/map/utils";
import { WorkerMessage, LoadDataRequest } from "./worker-types";

let currentAbortController: AbortController | null = null;

// Raw data from JSON before normalization
interface RawZipData {
  city?: string | null;
  county?: string | null;
  state?: string | null;
  metro?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  period_end?: string | null;
  zhvi?: number | null;
  zhvi_mom?: number | null;
  zhvi_yoy?: number | null;
  median_sale_price?: number | null;
  median_sale_price_mom?: number | null;
  median_sale_price_yoy?: number | null;
  median_list_price?: number | null;
  median_list_price_mom?: number | null;
  median_list_price_yoy?: number | null;
  median_ppsf?: number | null;
  median_ppsf_mom?: number | null;
  median_ppsf_yoy?: number | null;
  homes_sold?: number | null;
  homes_sold_mom?: number | null;
  homes_sold_yoy?: number | null;
  pending_sales?: number | null;
  pending_sales_mom?: number | null;
  pending_sales_yoy?: number | null;
  new_listings?: number | null;
  new_listings_mom?: number | null;
  new_listings_yoy?: number | null;
  inventory?: number | null;
  inventory_mom?: number | null;
  inventory_yoy?: number | null;
  median_dom?: number | null;
  median_dom_mom?: number | null;
  median_dom_yoy?: number | null;
  avg_sale_to_list_ratio?: number | null;
  avg_sale_to_list_mom?: number | null;
  avg_sale_to_list_ratio_yoy?: number | null;
  sold_above_list?: number | null;
  sold_above_list_mom?: number | null;
  sold_above_list_yoy?: number | null;
  off_market_in_two_weeks?: number | null;
  off_market_in_two_weeks_mom?: number | null;
  off_market_in_two_weeks_yoy?: number | null;
}

// --- Helper ---
export function getMetricValue(data: ZipData, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = e.data;

  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    switch (type) {
      case "LOAD_AND_PROCESS_DATA": {
        const { url, selectedMetric } = data as LoadDataRequest;
        self.postMessage({ type: "PROGRESS", data: { phase: "Fetching market data..." } });
        const response = await fetch(url, { signal });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Data file not found. Please try refreshing the page.");
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again later.");
          }
          throw new Error(`Failed to load data (${response.status}). Please try refreshing.`);
        }

        // Validate response size - empty or too small responses are likely errors
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) < 100) {
          throw new Error("Data file appears to be empty or incomplete. Please try refreshing.");
        }

        const buffer = await response.arrayBuffer();

        // Validate we received actual data
        if (buffer.byteLength < 100) {
          throw new Error("Received incomplete data. Please check your connection and try again.");
        }

        let fullPayload: { last_updated_utc?: string; zip_codes: Record<string, RawZipData> };

        try {
          const jsonText = new TextDecoder().decode(buffer);

          // Check if this looks like a Git LFS pointer file instead of actual JSON
          if (jsonText.startsWith('version https://git-lfs.github.com')) {
            console.error('[Worker] Received Git LFS pointer instead of actual data file');
            throw new Error("Data file not available. The server returned a placeholder instead of actual data. Please try refreshing or contact support.");
          }

          fullPayload = JSON.parse(jsonText);

          // Validate the payload structure
          if (!fullPayload || typeof fullPayload !== 'object') {
            throw new Error("Invalid data format: expected object");
          }
        } catch (err) {
          console.error('[Worker] JSON parse failed:', err);
          const errMessage = err instanceof Error ? err.message : "Unknown error";
          const detailedError = errMessage.includes('Unexpected token') || errMessage.includes('JSON')
            ? `JSON parse error: Data file appears corrupted or incomplete (${errMessage})`
            : `JSON parse error: ${errMessage}`;
          throw new Error(detailedError);
        }

        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData) throw new Error("Missing zip_codes data");
        self.postMessage({ type: "PROGRESS", data: { phase: "Indexing ZIP codes..." } });

        const zipData: Record<string, ZipData> = {};
        const metricValues: number[] = [];
        const entries = Object.entries(rawZipData);

        const BATCH_SIZE = 5000;

        for (let i = 0; i < entries.length; i++) {
          if (signal.aborted) return;
          const [zipCode, raw] = entries[i];

          const data = raw as unknown as ZipData;
          const r = raw as any;
          if (data.latitude === undefined) data.latitude = r.lat ?? null;
          if (data.longitude === undefined) data.longitude = r.lng ?? null;

          data.zipCode = zipCode;
          zipData[zipCode] = data;

          const metric = getMetricValue(data, selectedMetric);
          if (metric > 0) metricValues.push(metric);

          if (i % BATCH_SIZE === 0) {
            self.postMessage({
              type: "PROGRESS",
              data: { phase: "Indexing ZIP codes...", processed: i, total: entries.length },
            });
          }
        }

        function computeQuantileBounds(values: number[]) {
          const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
          if (sorted.length === 0) return { min: 0, max: 1 };

          const q = (p: number) => {
            const idx = Math.floor(p * (sorted.length - 1));
            return sorted[idx];
          };

          return {
            min: q(0.05),
            max: q(0.95)
          };
        }

        const bounds = computeQuantileBounds(metricValues);
        const buckets = computeQuantileBuckets(metricValues, 12);
        console.log(`[Worker] Data processed: ${Object.keys(zipData).length} ZIPs, bounds:`, bounds);

        self.postMessage({ type: "DATA_PROCESSED", id, data: { zip_codes: zipData, last_updated_utc, bounds, buckets } });
        break;
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      const errMessage = err instanceof Error ? err.message : "Unknown error";
      const errorType = type || "UNKNOWN";
      console.error("[Worker] Error:", err);
      // Send detailed error to main thread for tracking
      self.postMessage({
        type: "ERROR",
        id,
        error: `Worker ${errorType} error: ${errMessage}`
      });
    }
  }
};
