export interface ZipData {
  zipCode: string;
  state: string;
  city?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  parent_metro?: string;
  medianSalePrice: number;
  medianListPrice: number;
  medianDOM: number;
  inventory: number;
  newListings: number;
  homesSold: number;
  saleToListRatio: number;
  homesSoldAboveList: number;
  offMarket2Weeks: number;
  // YoY fields
  medianSalePriceYoY?: number;
  medianListPriceYoY?: number;
  medianDOMYoY?: number;
  inventoryYoY?: number;
  newListingsYoY?: number;
  homesSoldYoY?: number;
}

export interface MapProps {
  selectedMetric: string;
  onZipSelect: (zipData: ZipData) => void;
  searchZip?: string;
}

// Legacy alias for backward compatibility
export interface LeafletMapProps extends MapProps {}

export interface CityData {
  city?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
}