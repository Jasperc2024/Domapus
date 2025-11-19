import { ZipData } from "../components/dashboard/map/types";
import { WorkerMessage, LoadDataRequest, ProcessGeoJSONRequest } from "./worker-types";
// import { inflate } from "pako"; // No longer needed
import RBush from "rbush"; // R-Tree library

let currentAbortController: AbortController | null = null;

// --- Helper ---
export function getMetricValue(data: ZipData, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

// --- Worker state ---
let zipRTree: RBush<any> | null = null;
let geoJSONIndex: Record<string, GeoJSON.Feature> = {};

// --- Bucketed expression ---
function getMetricBuckets(values: number[], numBuckets = 7) {
  const sorted = [...values].sort((a, b) => a - b);
  const step = Math.ceil(sorted.length / numBuckets);
  const thresholds: number[] = [];
  for (let i = 1; i < numBuckets; i++) {
    thresholds.push(sorted[i * step] ?? sorted[sorted.length - 1]);
  }
  return thresholds;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = e.data;

  // Cancel previous operation
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
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const buffer = await response.arrayBuffer();

        let fullPayload;

        // --- MODIFICATION ---
        // Since we know the data is plain JSON, we can decode and parse directly.
        // Removed the old logic that checked for content-encoding and used pako.
        try {
          const jsonText = new TextDecoder().decode(buffer);
          fullPayload = JSON.parse(jsonText);
        } catch (err) {
          throw new Error("Failed to parse JSON: " + (err as Error).message);
        }
        // --- END MODIFICATION ---

        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData) throw new Error("Missing zip_codes data");

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

        const bounds = { min: Math.min(...metricValues), max: Math.max(...metricValues) };

        self.postMessage({ type: "DATA_PROCESSED", id, data: { zip_codes: zipData, last_updated_utc, bounds } });
        break;
      }

      case "PROCESS_GEOJSON": {
        const { geojson, zipData, selectedMetric, viewport } = data as ProcessGeoJSONRequest;
        if (!geojson?.features) throw new Error("Invalid GeoJSON");

        self.postMessage({ type: "PROGRESS", data: { phase: "Building spatial index..." } });

        // Build R-Tree
        const tree = new RBush();
        const indexedFeatures: any[] = [];

        for (let f of geojson.features) {
          if (signal.aborted) return;
          const zipCode = f.properties?.ZCTA5CE20;
          if (!zipCode || !zipData[zipCode]) continue;
          const [minX, minY, maxX, maxY] = bbox(f);
          tree.insert({ minX, minY, maxX, maxY, feature: f });
          geoJSONIndex[zipCode] = f;
          indexedFeatures.push(f);
        }
        zipRTree = tree;

        self.postMessage({ type: "PROGRESS", data: { phase: "Filtering viewport..." } });

        // Lazy load features in viewport
        const visibleFeatures = viewport ? tree.search(viewport).map((d) => d.feature) : indexedFeatures;

        // Bucket coloring
        const values = visibleFeatures.map(f => getMetricValue(zipData[f.properties!.ZCTA5CE20], selectedMetric));
        const buckets = getMetricBuckets(values);
        const expression: any[] = ["step", ["get", "metricValue"], "#FFF9B0", ...buckets.flatMap((v, i) => [v, bucketColor(i)])];

        self.postMessage({ type: "GEOJSON_PROCESSED", id, data: { type: "FeatureCollection", features: visibleFeatures, bucketExpression: expression } });
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

// --- Helper: bounding box of a feature ---
function bbox(f: GeoJSON.Feature): [number, number, number, number] {
  if (f.geometry.type === "Polygon") {
    const coords = f.geometry.coordinates.flat(2);
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 !== 0); // Corrected this line
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } else if (f.geometry.type === "MultiPolygon") {
    const coords = f.geometry.coordinates.flat(3);
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 !== 0); // Corrected this line
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return [0, 0, 0, 0];
}

// --- Helper: bucket colors ---
function bucketColor(i: number) {
  const palette = ["#FFF9B0", "#FFE066", "#FFB347", "#FF7F50", "#E84C61", "#AD1457", "#2E0B59"];
  return palette[i] || palette[palette.length - 1];
}