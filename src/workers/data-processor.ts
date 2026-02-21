import { ZipData } from "../components/dashboard/map/types";
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
        const { url, selectedMetric, prefetchedBuffer } = data as LoadDataRequest;

        let buffer: ArrayBuffer;

        if (prefetchedBuffer && prefetchedBuffer.byteLength > 100) {
          buffer = prefetchedBuffer;
          self.postMessage({ type: "PROGRESS", data: { phase: "Processing cached data..." } });
        } else {
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

          buffer = await response.arrayBuffer();

          // Validate we received actual data
          if (buffer.byteLength < 100) {
            throw new Error("Received incomplete data. Please check your connection and try again.");
          }
        }

        let fullPayload: unknown;

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

        const last_updated_utc = (fullPayload as { last_updated_utc?: string }).last_updated_utc;
        const zipData: Record<string, ZipData> = {};
        const metricValues: number[] = [];
        const BATCH_SIZE = 5000;

        // Detect format: columnar (new) or keyed (old)
        if (typeof fullPayload === 'object' && fullPayload !== null && 
            'f' in fullPayload && 'z' in fullPayload && 'd' in fullPayload) {
          // New columnar format
          const { f: fields, z: zipCodes, d: rows } = fullPayload as {
            last_updated_utc?: string;
            f: string[];
            z: string[];
            d: (string | number | null)[][];
          };

          self.postMessage({ type: "PROGRESS", data: { phase: "Reconstructing ZIP data..." } });

          for (let i = 0; i < zipCodes.length; i++) {
            if (signal.aborted) return;

            const zipCode = zipCodes[i];
            const row = rows[i];
            const entry: Record<string, unknown> = { zipCode };

            for (let j = 0; j < fields.length; j++) {
              entry[fields[j]] = row[j];
            }

            // Handle lat/lng aliases
            const data = entry as unknown as ZipData;
            const entryWithCoords = entry as { lat?: number | null; lng?: number | null };
            if (data.latitude === undefined) data.latitude = entryWithCoords.lat ?? null;
            if (data.longitude === undefined) data.longitude = entryWithCoords.lng ?? null;

            zipData[zipCode] = data;

            const metric = getMetricValue(data, selectedMetric);
            if (metric > 0) metricValues.push(metric);

            if (i % BATCH_SIZE === 0) {
              self.postMessage({
                type: "PROGRESS",
                data: { phase: "Reconstructing ZIP data...", processed: i, total: zipCodes.length },
              });
            }
          }
        } else if (typeof fullPayload === 'object' && fullPayload !== null && 'zip_codes' in fullPayload) {
          // Old keyed format (backward compatibility)
          const rawZipData = fullPayload.zip_codes as Record<string, RawZipData>;
          if (!rawZipData) throw new Error("Missing zip_codes data");
          
          self.postMessage({ type: "PROGRESS", data: { phase: "Indexing ZIP codes..." } });

          const entries = Object.entries(rawZipData);

          for (let i = 0; i < entries.length; i++) {
            if (signal.aborted) return;
            const [zipCode, raw] = entries[i];

            const data = raw as unknown as ZipData;
            const r = raw as RawZipData;
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
        } else {
          throw new Error("Invalid data format: expected either columnar format (f, z, d) or keyed format (zip_codes)");
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
        console.log(`[Worker] Data processed: ${Object.keys(zipData).length} ZIPs, bounds:`, bounds);

        self.postMessage({ type: "DATA_PROCESSED", id, data: { zip_codes: zipData, last_updated_utc, bounds } });
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
