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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<ProgressState>({ phase: 'Initializing...' });

  const requests = useRef<Map<string, PendingRequest>>(new Map());

  useEffect(() => {

    const worker = new DataProcessorWorker();
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { id, type, data, error } = event.data;

      switch (type) {
        case 'PROGRESS':
          setProgress(data);
          break;

        case 'ERROR': {
          setIsLoading(false);
          const pending = requests.current.get(id);
          if (pending) {
            pending.reject(new Error(error));
            requests.current.delete(id);
          }
          break;
        }

        default: {
          setIsLoading(false);
          const pending = requests.current.get(id);
          if (pending) {
            pending.resolve(data); 
            requests.current.delete(id);
          }
          break;
        }
      }
    };

    worker.onerror = (err) => {
      console.error("An unhandled error occurred in the data worker:", err);
      setIsLoading(false);
      requests.current.forEach(request => request.reject(err));
      requests.current.clear();
    };

    return () => {
      worker.terminate();
    };
  }, []);

  const processData = useCallback((message: { type: string; data?: any }) => {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Worker is not available."));
    }

    return new Promise((resolve, reject) => {
      setIsLoading(true);
      setProgress({ phase: 'Starting...' });

      const id = `${Date.now()}-${Math.random()}`;

      requests.current.set(id, { resolve, reject });

      worker.postMessage({ id, ...message });
    });
  }, []);

  return { processData, isLoading, progress };
}
