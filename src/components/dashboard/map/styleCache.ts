// Style cache for memoizing ZIP code styles
export class StyleCache {
  private cache = new Map<string, any>();
  private maxSize = 10000; // Limit cache size to prevent memory issues

  getCacheKey(zipCode: string, zoom: number, metric: string, value: number): string {
    return `${zipCode}-${Math.floor(zoom)}-${metric}-${value}`;
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  set(key: string, style: any): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries when cache gets too large
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, style);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const styleCache = new StyleCache();