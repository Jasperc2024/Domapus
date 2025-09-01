import { ZipData } from "../components/dashboard/map/types";
import { WorkerMessage, LoadDataRequest, ProcessGeoJSONRequest } from "./worker-types";
import { inflate } from 'pako';

export function getMetricValue(data: ZipData, metric: string): number {
  if (!data) return 0;
  const value = data[metric as keyof ZipData];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = e.data;
  try {
    switch (type) {
      case "LOAD_AND_PROCESS_DATA": {
        const { url, selectedMetric } = data as LoadDataRequest;
        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Fetching market data..." },
        });

        console.log(`🔍 [Worker] Fetching data from: ${url}`);
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Fetch failed with status: ${response.status}`);

        console.log(`📦 [Worker] Response headers:`, {
          contentType: response.headers.get('content-type'),
          contentEncoding: response.headers.get('content-encoding'),
          contentLength: response.headers.get('content-length')
        });

       let fullPayload;
       const contentEncoding = response.headers.get("content-encoding") || "";

        if (contentEncoding.includes("gzip")) {
          console.log("🗜️ [Worker] Content-Encoding is gzip, checking...");

          try {
    // Browser may have auto-decompressed already
            fullPayload = await response.json();
            console.log("📄 [Worker] Parsed as already-decoded JSON");
          } catch (err) {
            console.log("🗜️ [Worker] Failed JSON parse, trying manual inflate...");
            const buffer = await response.arrayBuffer();
            const jsonData = inflate(new Uint8Array(buffer), { to: "string" });
            fullPayload = JSON.parse(jsonData);
            console.log("🗜️ [Worker] Successfully inflated gzip file");
          }
        } else {
          console.log("📄 [Worker] No gzip encoding, parsing JSON...");
          fullPayload = await response.json();
        }

        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData) throw new Error("Data file is missing 'zip_codes' key.");

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Processing ZIP code data..." },
        });

        const zipData: Record<string, ZipData> = {};
        let processed = 0;
        const total = Object.keys(rawZipData).length;

        for (const [zipCode, rawValue] of Object.entries(rawZipData)) {
          (rawValue as ZipData).zipCode = zipCode;
          zipData[zipCode] = rawValue as ZipData;
          
          processed++;
          if (processed % 1000 === 0) {
            self.postMessage({
              type: "PROGRESS",
              data: { phase: "Processing ZIP code data...", processed, total },
            });
          }
        }

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Calculating metric bounds..." },
        });

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
        const { geojson, zipData, selectedMetric } = data as ProcessGeoJSONRequest;

        if (!geojson || !Array.isArray(geojson.features)) {
          throw new Error("Invalid GeoJSON data provided to worker.");
        }

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Processing map shapes..." },
        });

        const features: GeoJSON.Feature[] = [];
        let processed = 0;
        const total = geojson.features.length;

        for (const feature of geojson.features) {
          if (!feature.geometry) continue;

          const zipCode = feature.properties?.ZCTA5CE20;
          if (!zipCode || !zipData[zipCode]) continue;

          const metricValue = getMetricValue(zipData[zipCode], selectedMetric);
          feature.properties!.zipCode = zipCode;
          feature.properties!.metricValue = metricValue;

          features.push(feature);
          
          processed++;
          if (processed % 5000 === 0) {
            self.postMessage({
              type: "PROGRESS",
              data: { phase: "Processing map shapes...", processed, total },
            });
          }
        }

        self.postMessage({
          type: "GEOJSON_PROCESSED",
          id,
          data: { type: "FeatureCollection", features },
        });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error("❌ [Worker] Error:", error);
    self.postMessage({
      type: "ERROR",
      id,
      error: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
};
