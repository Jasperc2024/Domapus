import { useSearchParams } from 'react-router-dom';
import { useCallback, useRef } from 'react';

export interface UrlState {
  zip?: string;
  metric?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}

export function useUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceTimerRef = useRef<number | null>(null);

  // Read current state from URL
  const getUrlState = useCallback((): UrlState => {
    return {
      zip: searchParams.get('zip') || undefined,
      metric: searchParams.get('metric') || undefined,
      lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
      lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
      zoom: searchParams.get('zoom') ? parseFloat(searchParams.get('zoom')!) : undefined,
    };
  }, [searchParams]);

  // Update URL state (replaceState to avoid polluting browser history)
  const setUrlState = useCallback((updates: Partial<UrlState>, debounce = false) => {
    const updateParams = () => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        
        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            newParams.set(key, String(value));
          } else {
            newParams.delete(key);
          }
        });
        
        return newParams;
      }, { replace: true });
    };

    if (debounce) {
      // Debounce map position updates
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        updateParams();
        debounceTimerRef.current = null;
      }, 500);
    } else {
      updateParams();
    }
  }, [setSearchParams]);

  return {
    urlState: getUrlState(),
    setUrlState,
  };
}
