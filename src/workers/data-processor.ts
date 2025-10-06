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

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status}`);
        }

        const contentEncoding = response.headers.get("content-encoding") || "";
        const buffer = await response.arrayBuffer();
        let fullPayload;

        try {
          if (contentEncoding.includes("gzip")) {
            try {
              fullPayload = JSON.parse(new TextDecoder().decode(buffer));
            } catch {
              const jsonData = inflate(new Uint8Array(buffer), { to: "string" });
              fullPayload = JSON.parse(jsonData);
            }
          } else {
            try {
              const jsonData = inflate(new Uint8Array(buffer), { to: "string" });
              fullPayload = JSON.parse(jsonData);
            } catch {
              fullPayload = JSON.parse(new TextDecoder().decode(buffer));
            }
          }
        } catch (parseError) {
          throw new Error(`Failed to parse data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData) throw new Error("Missing zip_codes data");

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Processing ZIP codes..." },
        });

        const zipData: Record<string, ZipData> = {};
        const entries = Object.entries(rawZipData);
        const total = entries.length;

        for (let i = 0; i < total; i++) {
          const [zipCode, rawValue] = entries[i];
          (rawValue as ZipData).zipCode = zipCode;
          zipData[zipCode] = rawValue as ZipData;
          
          if (i % 2000 === 0 && i > 0) {
            self.postMessage({
              type: "PROGRESS",
              data: { phase: "Processing ZIP codes...", processed: i, total },
            });
          }
        }

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Calculating bounds..." },
        });

        const metricValues = Object.values(zipData)
          .map(z => getMetricValue(z, selectedMetric))
          .filter(v => v > 0)
          .sort((a, b) => a - b);
        
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

        if (!geojson?.features || !Array.isArray(geojson.features)) {
          throw new Error("Invalid GeoJSON data");
        }

        self.postMessage({
          type: "PROGRESS",
          data: { phase: "Processing shapes..." },
        });

        const features: GeoJSON.Feature[] = [];
        const total = geojson.features.length;

        for (let i = 0; i < total; i++) {
          const feature = geojson.features[i];
          if (!feature.geometry) continue;

          const zipCode = feature.properties?.ZCTA5CE20;
          if (!zipCode || !zipData[zipCode]) continue;

          const metricValue = getMetricValue(zipData[zipCode], selectedMetric);
          feature.properties!.zipCode = zipCode;
          feature.properties!.metricValue = metricValue;
          features.push(feature);
          
          if (i % 5000 === 0 && i > 0) {
            self.postMessage({
              type: "PROGRESS",
              data: { phase: "Processing shapes...", processed: i, total },
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
        throw new Error(`Unknown type: ${type}`);
    }
  } catch (error) {
    console.error("[Worker] Error:", error);
    self.postMessage({
      type: "ERROR",
      id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
