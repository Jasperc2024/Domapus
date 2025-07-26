import { describe, it, expect } from 'vitest';
import { getMetricValue } from '../../workers/data-processor';
import { createMockZipData } from '../__mocks__/mock-data'; // <-- IMPORT THE NEW FACTORY

describe('Data Worker Helper: getMetricValue', () => {
  it('should return the correct numeric value for a valid metric key', () => {
    // Create a valid mock object with the value we want to test
    const mockData = createMockZipData({ median_sale_price: 500000 });
    expect(getMetricValue(mockData, 'median-sale-price')).toBe(500000);
  });

  it('should return 0 for a metric that has a null value', () => {
    const mockData = createMockZipData({ inventory: null });
    expect(getMetricValue(mockData, 'inventory')).toBe(0);
  });

  it('should return 0 if the data object itself is null', () => {
    expect(getMetricValue(null as any, 'median-sale-price')).toBe(0);
  });
});