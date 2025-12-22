import { ZipData } from "../components/dashboard/map/types";
import { WorkerMessage, LoadDataRequest } from "./worker-types";

let currentAbortController: AbortController | null = null;

// --- Helper ---
export function getMetricValue(data: ZipData, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = e.data;
  console.log(`[Worker] Received message: ${type}`, { id, data });

  // Cancel previous operation
  if (currentAbortController) {
    currentAbortController.abort();
    console.log('[Worker] Aborted previous operation');
  }
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    switch (type) {
      case "LOAD_AND_PROCESS_DATA": {
        const { url, selectedMetric } = data as LoadDataRequest;
        console.log(`[Worker] Loading data from: ${url}, metric: ${selectedMetric}`);
        self.postMessage({ type: "PROGRESS", data: { phase: "Fetching market data..." } });

        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        console.log(`[Worker] Fetch successful, status: ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        console.log(`[Worker] Received buffer size: ${buffer.byteLength} bytes`);

        let fullPayload;

        try {
          const jsonText = new TextDecoder().decode(buffer);
          fullPayload = JSON.parse(jsonText);
          console.log('[Worker] JSON parsed successfully');
        } catch (err) {
          console.error('[Worker] JSON parse failed:', err);
          throw new Error("Failed to parse JSON: " + (err as Error).message);
        }

        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData) throw new Error("Missing zip_codes data");
        console.log(`[Worker] Found ${Object.keys(rawZipData).length} ZIP codes, last updated: ${last_updated_utc}`);

        self.postMessage({ type: "PROGRESS", data: { phase: "Indexing ZIP codes..." } });

        const zipData: Record<string, ZipData> = {};
        const metricValues: number[] = [];
        const entries = Object.entries(rawZipData);

        for (let i = 0; i < entries.length; i++) {
          if (signal.aborted) return;
          const [zipCode, rawValue] = entries[i];

          const raw: any = rawValue ?? {};
          const normalized: ZipData = {
            ...(raw as ZipData),
            zipCode,
            // Support both old (latitude/longitude) and new (lat/lng) field names
            latitude: (raw.latitude ?? raw.lat ?? null) as any,
            longitude: (raw.longitude ?? raw.lng ?? null) as any,
          };

          // Avoid leaking non-typed fields downstream
          delete (normalized as any).lat;
          delete (normalized as any).lng;

          zipData[zipCode] = normalized;

          const metric = getMetricValue(normalized, selectedMetric);
          if (metric > 0) metricValues.push(metric);

          if (i % 2000 === 0) {
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
        console.log(`[Worker] Data processed: ${Object.keys(zipData).length} ZIPs, bounds:`, bounds);

        self.postMessage({ type: "DATA_PROCESSED", id, data: { zip_codes: zipData, last_updated_utc, bounds } });
        break;
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      console.error("[Worker] Error:", err);
      self.postMessage({ type: "ERROR", id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
};


