import { useState, useEffect, useRef, useCallback } from "react";
import { useMapData } from "../components/dashboard/map/useMapData";

interface ProcessedMapData {
  processedData: Record<string, any>;
  metricValues: number[];
  bounds: { min: number; max: number };
  isProcessing: boolean;
}

export function useOptimizedMapData(selectedMetric: string) {
  const { zipData, citiesData, isLoading } = useMapData();
  const [processedMapData, setProcessedMapData] = useState<ProcessedMapData>({
    processedData: {},
    metricValues: [],
    bounds: { min: 0, max: 0 },
    isProcessing: false,
  });

  const workerRef = useRef<Worker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize worker
  useEffect(() => {
    // Create worker from blob to avoid external file dependencies
    const workerCode = `
      function getMetricValue(data, metric) {
        const metricMap = {
          'median-sale-price': 'median_sale_price',
          'median-list-price': 'median_list_price',
          'median-dom': 'median_dom',
          'inventory': 'inventory',
          'new-listings': 'new_listings',
          'homes-sold': 'homes_sold',
          'sale-to-list-ratio': 'sale_to_list_ratio',
          'homes-sold-above-list': 'homes_sold_above_list',
          'off-market-2-weeks': 'off_market_in_2_weeks'
        };
        const key = metricMap[metric] || metric;
        return data[key] || 0;
      }

      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        if (type === 'PROCESS_ZIP_DATA') {
          try {
            const { zipData, selectedMetric } = data;
            
            const processedData = {};
            const metricValues = [];
            
            for (const [zipCode, zipInfo] of Object.entries(zipData)) {
              const value = getMetricValue(zipInfo, selectedMetric);
              if (value > 0) {
                processedData[zipCode] = {
                  ...zipInfo,
                  metricValue: value
                };
                metricValues.push(value);
              }
            }
            
            const sortedValues = metricValues.sort((a, b) => a - b);
            const min = sortedValues[0] || 0;
            const max = sortedValues[sortedValues.length - 1] || 0;
            
            self.postMessage({
              type: 'PROCESSED_ZIP_DATA',
              data: {
                processedData,
                metricValues: sortedValues,
                bounds: { min, max }
              }
            });
            
          } catch (error) {
            self.postMessage({
              type: 'ERROR',
              error: error.message || 'Unknown error'
            });
          }
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    try {
      workerRef.current = new Worker(workerUrl);

      workerRef.current.onmessage = (e) => {
        const { type, data, error } = e.data;

        if (type === "PROCESSED_ZIP_DATA") {
          setProcessedMapData((prev) => ({
            ...prev,
            ...data,
            isProcessing: false,
          }));
        } else if (type === "ERROR") {
          console.error("Worker error:", error);
          setProcessedMapData((prev) => ({ ...prev, isProcessing: false }));
        }
      };

      workerRef.current.onerror = (error) => {
        console.error("Worker error:", error);
        setProcessedMapData((prev) => ({ ...prev, isProcessing: false }));
      };
    } catch (error) {
      console.warn(
        "Web Worker not supported, falling back to main thread processing",
      );
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        URL.revokeObjectURL(workerUrl);
      }
    };
  }, []);

  // Throttled processing function
  const processDataThrottled = useCallback(
    (zipData: Record<string, any>, metric: string) => {
      // Abort previous processing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      if (workerRef.current) {
        // Use web worker
        setProcessedMapData((prev) => ({ ...prev, isProcessing: true }));
        workerRef.current.postMessage({
          type: "PROCESS_ZIP_DATA",
          data: { zipData, selectedMetric: metric },
        });
      } else {
        // Fallback to main thread with requestIdleCallback
        setProcessedMapData((prev) => ({ ...prev, isProcessing: true }));

        const processInMainThread = () => {
          try {
            // Use setTimeout to yield control and improve responsiveness
            setTimeout(() => {
              if (abortControllerRef.current?.signal.aborted) return;

              // Process in chunks to avoid blocking the main thread
              const entries = Object.entries(zipData);
              const chunkSize = 1000;
              const processedData: Record<string, any> = {};
              const metricValues: number[] = [];

              const processChunk = (startIndex: number) => {
                const endIndex = Math.min(
                  startIndex + chunkSize,
                  entries.length,
                );

                for (let i = startIndex; i < endIndex; i++) {
                  if (abortControllerRef.current?.signal.aborted) return;

                  const [zipCode, zipInfo] = entries[i];
                  const metricMap: Record<string, string> = {
                    "median-sale-price": "median_sale_price",
                    "median-list-price": "median_list_price",
                    "median-dom": "median_dom",
                    inventory: "inventory",
                    "new-listings": "new_listings",
                    "homes-sold": "homes_sold",
                    "sale-to-list-ratio": "sale_to_list_ratio",
                    "homes-sold-above-list": "homes_sold_above_list",
                    "off-market-2-weeks": "off_market_in_2_weeks",
                  };

                  const key = metricMap[metric] || metric;
                  const value = zipInfo[key] || 0;

                  if (value > 0) {
                    processedData[zipCode] = {
                      ...zipInfo,
                      metricValue: value,
                    };
                    metricValues.push(value);
                  }
                }

                if (endIndex < entries.length) {
                  // Process next chunk
                  setTimeout(() => processChunk(endIndex), 0);
                } else {
                  // Finished processing
                  if (!abortControllerRef.current?.signal.aborted) {
                    const sortedValues = metricValues.sort((a, b) => a - b);
                    const min = sortedValues[0] || 0;
                    const max = sortedValues[sortedValues.length - 1] || 0;

                    setProcessedMapData({
                      processedData,
                      metricValues: sortedValues,
                      bounds: { min, max },
                      isProcessing: false,
                    });
                  }
                }
              };

              processChunk(0);
            }, 0);
          } catch (error) {
            console.error("Main thread processing error:", error);
            setProcessedMapData((prev) => ({ ...prev, isProcessing: false }));
          }
        };

        processInMainThread();
      }
    },
    [],
  );

  // Process data when zipData or selectedMetric changes
  useEffect(() => {
    if (!isLoading && Object.keys(zipData).length > 0) {
      processDataThrottled(zipData, selectedMetric);
    }
  }, [zipData, selectedMetric, isLoading, processDataThrottled]);

  return {
    ...processedMapData,
    citiesData,
    isLoading: isLoading || processedMapData.isProcessing,
  };
}
