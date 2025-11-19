import { useState, useEffect, useRef, useCallback } from "react";
import DataProcessorWorker from '@/workers/data-processor.ts?worker';

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

  console.log('[useDataWorker] Hook initialized');

  useEffect(() => {
    if (isInitializedRef.current) return;
    
    console.log('[useDataWorker] Creating worker instance');
    const worker = new DataProcessorWorker();
    workerRef.current = worker;
    isInitializedRef.current = true;

    worker.onmessage = (event: MessageEvent) => {
      const { id, type, data, error } = event.data;
      console.log('[useDataWorker] Received message from worker:', type, { id });

      switch (type) {
        case 'PROGRESS':
          console.log('[useDataWorker] Progress update:', data.phase);
          setProgress(data);
          break;

        case 'ERROR': {
          console.error('[useDataWorker] Worker error:', error);
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
      setIsLoading(false);
      requestsRef.current.forEach(request => request.reject(err));
      requestsRef.current.clear();
    };

    return () => {
      console.log('[useDataWorker] Terminating worker');
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
      return Promise.reject(new Error("Worker is not initialized"));
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`;
      console.log(`[useDataWorker] Sending message to worker: ${message.type}, request ID: ${id}`);
      
      requestsRef.current.set(id, { resolve, reject });
      setIsLoading(true);

      worker.postMessage({ id, ...message });
    });
  }, []);

  return { processData, isLoading, progress };
}
