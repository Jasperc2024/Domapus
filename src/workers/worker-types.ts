import { ZipData } from "../components/dashboard/map/types";

export interface WorkerMessage {
  id: string;
  type: "LOAD_AND_PROCESS_DATA" | "PROCESS_GEOJSON";
  data: any;
}

export interface WorkerResponse {
  id?: string;
  type: "PROGRESS" | "ERROR" | "DATA_PROCESSED" | "GEOJSON_PROCESSED";
  data?: any;
  error?: string;
}

export interface LoadDataRequest {
  url: string;
  selectedMetric: string;
}

export interface Viewport {
  minX: number; // west
  minY: number; // south
  maxX: number; // east
  maxY: number; // north
}

export interface ProcessGeoJSONRequest {
  geojson: GeoJSON.FeatureCollection;
  zipData: Record<string, ZipData>;
  selectedMetric: string;
  viewport: Viewport | null;
}

export interface DataProcessedResponse {
  zip_codes: Record<string, ZipData>;
  last_updated_utc: string;
  bounds: { min: number; max: number };
}

export interface ProgressData {
  phase: string;
  processed?: number;
  total?: number;
}