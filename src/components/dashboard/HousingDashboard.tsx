import { useState, useCallback, useEffect, useRef } from "react";
import { useDataWorker } from "@/hooks/useDataWorker";
import { ZipData } from "./map/types";
import { MapExport } from "@/components/MapExport";
import { buildSpatialIndex, queryZipsInBounds } from "@/lib/spatial-index";
import { computeQuantileBuckets, getMetricValue } from "./map/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { TopBar } from "./TopBar";
import { MapLibreMap } from "./MapLibreMap";
import { Legend } from "./Legend";
import { SponsorBanner } from "./SponsorBanner";
import { Sidebar } from "./Sidebar";
import { MetricType } from "./MetricSelector";


interface DataPayload {
  last_updated_utc: string;
  zip_codes: Record<string, ZipData>;
  bounds: { min: number; max: number; };
  buckets?: number[];
}

const BASE_PATH = import.meta.env.BASE_URL;

export function HousingDashboard() {
  const isMobile = useIsMobile();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("zhvi");
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [searchZip, setSearchZip] = useState<string>("");
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const [zipData, setZipData] = useState<Record<string, ZipData>>({});
  const [dataBounds, setDataBounds] = useState<{ min: number; max: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSponsorBanner, setShowSponsorBanner] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleZipCodes, setVisibleZipCodes] = useState<string[] | null>(null);
  const [customBuckets, setCustomBuckets] = useState<number[] | null>(null);
  const [autoScale, setAutoScale] = useState(false);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [globalBuckets, setGlobalBuckets] = useState<number[] | null>(null);
  const lastBoundsRef = useRef<[[number, number], [number, number]] | null>(null);

  const { processData, isLoading } = useDataWorker();

  useEffect(() => {
    let isMounted = true;
    let hasRun = false;

    const loadInitialData = async () => {
      if (hasRun) return;
      hasRun = true;
      const dataUrl = new URL(`${BASE_PATH}data/zip-data.json`, window.location.origin).href;

      try {
        setLoadError(null);
        const result = await processData({
          type: 'LOAD_AND_PROCESS_DATA',
          data: { url: dataUrl, selectedMetric: 'zhvi' }
        }) as DataPayload;

        if (!isMounted) return;

        if (result) {
          setZipData(result.zip_codes);
          setDataBounds(result.bounds);
          if (result.buckets) setGlobalBuckets(result.buckets);
          setTimeout(() => {
            buildSpatialIndex(result.zip_codes);
            setIsIndexReady(true);
          }, 100);
        }
      } catch (error: unknown) {
        console.error("[HousingDashboard] Failed to load initial data:", error);
      }
    };
    loadInitialData();
    ///const timer = setTimeout(() => setShowSponsorBanner(true), 30000);

    return () => {
      isMounted = false;
      ///clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search handler
  const handleSearch = useCallback((zip: string, trigger: number) => {
    setSearchZip(zip);
    setSearchTrigger(trigger);
  }, []);

  const handleZipSelect = useCallback((zip: ZipData) => {
    setSelectedZip(zip);
    setSidebarOpen(true);
  }, []);

  // Use ref to always access latest autoScale state in callbacks
  const autoScaleRef = useRef(autoScale);
  useEffect(() => {
    autoScaleRef.current = autoScale;
  }, [autoScale]);

  const updateColors = useCallback((bounds: [[number, number], [number, number]] | null) => {
    if (!autoScaleRef.current) {
      setCustomBuckets(null);
      setVisibleZipCodes(null);
      return;
    }

    if (!bounds) return;

    const west = bounds[0][0];
    const south = bounds[0][1];
    const east = bounds[1][0];
    const north = bounds[1][1];

    const visibleZips = queryZipsInBounds({ west, south, east, north });
    setVisibleZipCodes(visibleZips);

    const values = visibleZips
      .map(zip => zipData[zip])
      .filter(Boolean)
      .map(d => getMetricValue(d, selectedMetric))
      .filter(v => v > 0);

    const buckets = computeQuantileBuckets(values, 12);
    setCustomBuckets(buckets.length > 0 ? buckets : null);
  }, [zipData, selectedMetric]);

  const handleMapMove = useCallback((bounds: [[number, number], [number, number]]) => {
    lastBoundsRef.current = bounds;
    if (autoScaleRef.current) {
      updateColors(bounds);
    }
  }, [updateColors]);

  useEffect(() => {
    if (autoScale && lastBoundsRef.current && isIndexReady) {
      updateColors(lastBoundsRef.current);
    } else if (!autoScale) {
      setCustomBuckets(null);
      setVisibleZipCodes(null);
    }
  }, [autoScale, isIndexReady, updateColors]);

  useEffect(() => {
    setCustomBuckets(null);
    setVisibleZipCodes(null);

    if (autoScale && lastBoundsRef.current) {
      const timer = setTimeout(() => {
        updateColors(lastBoundsRef.current);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedMetric, searchZip, autoScale, updateColors]);

  useEffect(() => {
    if (isIndexReady && autoScale && lastBoundsRef.current) {
      updateColors(lastBoundsRef.current);
    }
  }, [isIndexReady, autoScale, updateColors]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && autoScale && lastBoundsRef.current) {
        updateColors(lastBoundsRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [autoScale, updateColors]);

  const legendValues = (visibleZipCodes && visibleZipCodes.length > 0)
    ? visibleZipCodes.map(zip => zipData[zip]).filter(Boolean).map(d => getMetricValue(d, selectedMetric)).filter(v => v > 0)
    : Object.values(zipData).map(d => getMetricValue(d, selectedMetric)).filter(v => v > 0);

  // Show error state if data failed to load
  if (loadError) {
    return (
      <div className="w-full h-screen bg-dashboard-bg flex items-center justify-center">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Unable to Load Data</h2>
          <p className="text-muted-foreground mb-4">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-dashboard-bg overflow-hidden flex flex-col">
      {showSponsorBanner && <SponsorBanner onClose={() => setShowSponsorBanner(false)} />}
      <TopBar
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        onSearch={handleSearch}
        hideMobileControls={isMobile && sidebarOpen}
      >
        <MapExport
          allZipData={zipData}
          selectedMetric={selectedMetric}
          onExportModeChange={setIsExportMode}
        />
      </TopBar>
      <div className="flex flex-1 relative min-h-[400px] overflow-hidden">
        {isMobile && sidebarOpen && (
          <div className="absolute inset-0 z-50">
            <Sidebar
              isOpen={sidebarOpen}
              zipData={selectedZip}
              allZipData={zipData}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        )}
        <div className="hidden md:flex absolute top-0 bottom-0 left-0 z-20 flex-col">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            zipData={selectedZip}
            allZipData={zipData}
          />
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 min-h-[400px]">
            <MapLibreMap
              selectedMetric={selectedMetric}
              onZipSelect={handleZipSelect}
              searchZip={searchZip}
              searchTrigger={searchTrigger}
              zipData={zipData}
              colorScaleDomain={dataBounds ? [dataBounds.min, dataBounds.max] : null}
              isLoading={isLoading}
              processData={processData}
              customBuckets={customBuckets}
              globalBuckets={globalBuckets}
              onMapMove={handleMapMove}
            />
          </div>
          {!isExportMode && !(isMobile && sidebarOpen) && (
            <div className={`absolute ${isMobile ? 'top-4 left-4' : 'bottom-4 right-4'} ${isMobile ? 'w-auto' : 'w-64'} z-[10] pointer-events-auto`}>
              <Legend
                selectedMetric={selectedMetric}
                metricValues={legendValues}
                autoScale={autoScale}
                onAutoScaleChange={setAutoScale}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
