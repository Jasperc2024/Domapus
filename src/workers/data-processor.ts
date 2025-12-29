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
        const { url, selectedMetric } = data as LoadDataRequest;
        self.postMessage({ type: "PROGRESS", data: { phase: "Fetching market data..." } });
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const buffer = await response.arrayBuffer();

        let fullPayload: { last_updated_utc: string; zip_codes: Record<string, RawZipData> };

        try {
          const jsonText = new TextDecoder().decode(buffer);
          fullPayload = JSON.parse(jsonText);
        } catch (err) {
          console.error('[Worker] JSON parse failed:', err);
          throw new Error("Failed to parse JSON: " + (err instanceof Error ? err.message : "Unknown error"));
        }

        const { last_updated_utc, zip_codes: rawZipData } = fullPayload;
        if (!rawZipData) throw new Error("Missing zip_codes data");
        self.postMessage({ type: "PROGRESS", data: { phase: "Indexing ZIP codes..." } });

        const zipData: Record<string, ZipData> = {};
        const metricValues: number[] = [];
        const entries = Object.entries(rawZipData);

        for (let i = 0; i < entries.length; i++) {
          if (signal.aborted) return;
          const [zipCode, raw] = entries[i];

          const rawData: RawZipData = raw ?? {};
          const normalized: ZipData = {
            zipCode,
            city: rawData.city ?? null,
            county: rawData.county ?? null,
            state: rawData.state ?? null,
            metro: rawData.metro ?? null,
            latitude: rawData.latitude ?? rawData.lat ?? null,
            longitude: rawData.longitude ?? rawData.lng ?? null,
            period_end: rawData.period_end ?? null,
            zhvi: rawData.zhvi ?? null,
            zhvi_mom: rawData.zhvi_mom ?? null,
            zhvi_yoy: rawData.zhvi_yoy ?? null,
            median_sale_price: rawData.median_sale_price ?? null,
            median_sale_price_mom: rawData.median_sale_price_mom ?? null,
            median_sale_price_yoy: rawData.median_sale_price_yoy ?? null,
            median_list_price: rawData.median_list_price ?? null,
            median_list_price_mom: rawData.median_list_price_mom ?? null,
            median_list_price_yoy: rawData.median_list_price_yoy ?? null,
            median_ppsf: rawData.median_ppsf ?? null,
            median_ppsf_mom: rawData.median_ppsf_mom ?? null,
            median_ppsf_yoy: rawData.median_ppsf_yoy ?? null,
            homes_sold: rawData.homes_sold ?? null,
            homes_sold_mom: rawData.homes_sold_mom ?? null,
            homes_sold_yoy: rawData.homes_sold_yoy ?? null,
            pending_sales: rawData.pending_sales ?? null,
            pending_sales_mom: rawData.pending_sales_mom ?? null,
            pending_sales_yoy: rawData.pending_sales_yoy ?? null,
            new_listings: rawData.new_listings ?? null,
            new_listings_mom: rawData.new_listings_mom ?? null,
            new_listings_yoy: rawData.new_listings_yoy ?? null,
            inventory: rawData.inventory ?? null,
            inventory_mom: rawData.inventory_mom ?? null,
            inventory_yoy: rawData.inventory_yoy ?? null,
            median_dom: rawData.median_dom ?? null,
            median_dom_mom: rawData.median_dom_mom ?? null,
            median_dom_yoy: rawData.median_dom_yoy ?? null,
            avg_sale_to_list_ratio: rawData.avg_sale_to_list_ratio ?? null,
            avg_sale_to_list_mom: rawData.avg_sale_to_list_mom ?? null,
            avg_sale_to_list_ratio_yoy: rawData.avg_sale_to_list_ratio_yoy ?? null,
            sold_above_list: rawData.sold_above_list ?? null,
            sold_above_list_mom: rawData.sold_above_list_mom ?? null,
            sold_above_list_yoy: rawData.sold_above_list_yoy ?? null,
            off_market_in_two_weeks: rawData.off_market_in_two_weeks ?? null,
            off_market_in_two_weeks_mom: rawData.off_market_in_two_weeks_mom ?? null,
            off_market_in_two_weeks_yoy: rawData.off_market_in_two_weeks_yoy ?? null,
          };

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
