import { useState, useEffect, useRef, useCallback } from "react";
import DataProcessorWorker from '@/workers/data-processor.ts?worker';
import { trackError } from "@/lib/analytics";

interface ProgressState {
  phase: string;
  processed?: number;
  total?: number;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export function useDataWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressState>({ phase: '' });
  const requestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const isInitializedRef = useRef(false);

  console.log('[useDataWorker] Worker initialized');

  useEffect(() => {
    if (isInitializedRef.current) return;
    const worker = new DataProcessorWorker();
    workerRef.current = worker;
    isInitializedRef.current = true;

    worker.onmessage = (event: MessageEvent) => {
      const { id, type, data, error } = event.data;

      switch (type) {
        case 'PROGRESS':
          setProgress(data);
          break;

        case 'ERROR': {
          console.error('[useDataWorker] Worker error:', error);
          trackError("worker_error", error || "Unknown worker error");
          setIsLoading(false);
          const pending = requestsRef.current.get(id);
          if (pending) {
            pending.reject(new Error(error));
            requestsRef.current.delete(id);
          }
          break;
        }

        default: {
          console.log(`[useDataWorker] ${type} completed for request ${id}`);
          setIsLoading(false);
          const pending = requestsRef.current.get(id);
          if (pending) {
            pending.resolve(data); 
            requestsRef.current.delete(id);
          }
          break;
        }
      }
    };

    worker.onerror = (err) => {
      console.error("[useDataWorker] Unhandled worker error:", err);
      trackError("worker_unhandled_error", err?.message || "Unhandled worker error");
      setIsLoading(false);
      requestsRef.current.forEach(request => request.reject(err));
      requestsRef.current.clear();
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  const processData = useCallback((message: { type: string; data?: any }) => {
    const worker = workerRef.current;
    if (!worker || !isInitializedRef.current) {
      console.error("[useDataWorker] Worker not available");
      trackError("worker_not_available", "Worker is not initialized");
      return Promise.reject(new Error("Worker is not initialized"));
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`;
      requestsRef.current.set(id, { resolve, reject });
      setIsLoading(true);
      worker.postMessage({ id, ...message });
    });
  }, []);

  return { processData, isLoading, progress };
}
