import { ZipData } from "../components/dashboard/map/types";
import { WorkerMessage, LoadDataRequest, ProcessGeoJSONRequest } from "./worker-types";

let currentAbortController: AbortController | null = null;

// --- Helper ---
export function getMetricValue(data: ZipData, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

// --- Worker state ---
let geoJSONIndex: Record<string, GeoJSON.Feature> = {};

// --- Bucketed expression for choropleth coloring ---
function getMetricBuckets(values: number[], numBuckets = 8) {
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];

  // If all values are the same, return a single threshold
  if (minVal === maxVal) return [minVal];

  const thresholds: number[] = [];
  const epsilon = (maxVal - minVal) * 1e-6 || 1e-6; // small step relative to range

  const q = (p: number) => {
    const idx = Math.floor(p * (sorted.length - 1));
    return sorted[idx];
  };

  for (let i = 1; i < numBuckets; i++) {
    let val = q(i / numBuckets);

    // enforce strictly increasing
    if (thresholds.length && val <= thresholds[thresholds.length - 1]) {
      val = thresholds[thresholds.length - 1] + epsilon;
    }

    thresholds.push(val);
  }

  console.log('[Worker] Computed thresholds:', thresholds);
  return thresholds;
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

        // --- MODIFICATION ---
        // Since we know the data is plain JSON, we can decode and parse directly.
        // Removed the old logic that checked for content-encoding and used pako.
        try {
          const jsonText = new TextDecoder().decode(buffer);
          fullPayload = JSON.parse(jsonText);
          console.log('[Worker] JSON parsed successfully');
        } catch (err) {
          console.error('[Worker] JSON parse failed:', err);
          throw new Error("Failed to parse JSON: " + (err as Error).message);
        }
        // --- END MODIFICATION ---

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
          (rawValue as ZipData).zipCode = zipCode;
          zipData[zipCode] = rawValue as ZipData;
          const metric = getMetricValue(rawValue as ZipData, selectedMetric);
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

      case "PROCESS_GEOJSON": {
        const { geojson, zipData, selectedMetric } = data as ProcessGeoJSONRequest;
        if (!geojson?.features) throw new Error("Invalid GeoJSON");
        console.log(`[Worker] Processing GeoJSON: ${geojson.features.length} features, metric: ${selectedMetric}`);

        self.postMessage({ type: "PROGRESS", data: { phase: "Processing features..." } });

        const indexedFeatures: GeoJSON.Feature[] = [];

        for (let f of geojson.features) {
          if (signal.aborted) return;
          const zipCode = f.properties?.ZCTA5CE20;
          if (!zipCode || !zipData[zipCode]) continue;
          geoJSONIndex[zipCode] = f;
          indexedFeatures.push(f);
        }
        
        const visibleFeatures = indexedFeatures;

        // Bucket coloring with more granular steps for smoother choropleth
        const values = Object.values(zipData).map(d => getMetricValue(d, selectedMetric));
        const buckets = getMetricBuckets(values);
        
        // Attach metric value to each feature for color expression
        const enrichedFeatures = visibleFeatures.map((f: GeoJSON.Feature) => ({
          ...f,
          properties: {
            ...f.properties,
            metricValue: getMetricValue(zipData[f.properties!.ZCTA5CE20], selectedMetric)
          }
        }));
        
        const expression: any[] = ["step", ["get", "metricValue"], bucketColor(0), ...buckets.flatMap((v, i) => [v, bucketColor(i + 1)])];
        console.log(`[Worker] GeoJSON processed: ${enrichedFeatures.length} features, ${buckets.length} buckets, color steps applied`);

        self.postMessage({ type: "GEOJSON_PROCESSED", id, data: { type: "FeatureCollection", features: enrichedFeatures, bucketExpression: expression } });
        break;
      }

      default:
        throw new Error(`Unknown type: ${type}`);
    }
  } catch (err) {
    if (!signal.aborted) {
      console.error("[Worker] Error:", err);
      self.postMessage({ type: "ERROR", id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
};

// --- Helper: choropleth color palette (light yellow to deep purple) ---
function bucketColor(i: number) {
  const palette = ["#FFF9B0", "#FFEB84", "#FFD166", "#FF9A56", "#E84C61", "#C13584", "#7B2E8D", "#2E0B59"];
  return palette[Math.min(i, palette.length - 1)];
}
