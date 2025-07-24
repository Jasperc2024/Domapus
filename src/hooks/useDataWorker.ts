import { useState, useEffect, useRef, useCallback } from "react";
// Import the worker using Vite's special query syntax
import DataProcessorWorker from '@/workers/data-processor.ts?worker';

// Define the shape of the progress state
interface ProgressState {
  phase: string;
  processed?: number;
  total?: number;
}

// Define the structure of a pending request
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export function useDataWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<ProgressState>({ phase: 'Initializing...' });

  // This ref is a lookup table to match worker responses to the promises we returned
  const requests = useRef<Map<string, PendingRequest>>(new Map());

  // Initialize the worker and its message listeners once on mount
  useEffect(() => {
    const worker = new DataProcessorWorker();
    workerRef.current = worker;

    // This is the central handler for all messages coming FROM the worker
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
        
        // Any other type is considered a successful data response
        default: {
          setIsLoading(false);
          const pending = requests.current.get(id);
          if (pending) {
            pending.resolve(data); // Resolve the promise with the data payload
            requests.current.delete(id);
          }
          break;
        }
      }
    };

    worker.onerror = (err) => {
      console.error("An unhandled error occurred in the data worker:", err);
      setIsLoading(false);
      // Reject all pending requests
      requests.current.forEach(request => request.reject(err));
      requests.current.clear();
    };

    // Cleanup function to terminate the worker when the component unmounts
    return () => {
      worker.terminate();
    };
  }, []);

  // This is the function our components will call to send a job to the worker
  const processData = useCallback((message: { type: string; data?: any }) => {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Worker is not available."));
    }

    // Return a Promise that will resolve or reject when the worker responds
    return new Promise((resolve, reject) => {
      setIsLoading(true);
      setProgress({ phase: 'Starting...' });
      
      // Generate a unique ID for this request
      const id = `${Date.now()}-${Math.random()}`;
      
      // Store the promise's resolve/reject functions in our lookup table
      requests.current.set(id, { resolve, reject });
      
      // Send the job to the worker with the unique ID
      worker.postMessage({ id, ...message });
    });
  }, []);

  // Expose the process function and the loading/progress states
  return { processData, isLoading, progress };
}