// Style cache for memoizing ZIP code styles
export class StyleCache {
  private cache = new Map<string, any>();
  private maxSize = 50000; // Limit cache size to prevent memory issues
  private cacheExpiry = new Map<string, number>();
  private maxAge = 30 * 60 * 1000;

  getCacheKey(zipCode: string, zoom: number, metric: string, value: number): string {
    return `${zipCode}-${Math.floor(zoom)}-${metric}-${value}`;
  }

  get(key: string): any {
       const now = Date.now();
    const expiry = this.cacheExpiry.get(key);
    
    if (expiry && now > expiry) {
      // Cache entry expired
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return undefined;
    }
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