import { describe, it, expect } from 'vitest';
import { getMetricDisplay } from '../../components/dashboard/map/utils';
import { createMockZipData } from '../__mocks__/mock-data'; // <-- IMPORT THE NEW FACTORY

describe('getMetricDisplay', () => {
  it('should create a correct HTML string for a currency metric', () => {
    // Create a valid mock object with a specific price
    const mockData = createMockZipData({ median_sale_price: 3500000 });
    const html = getMetricDisplay(mockData, 'median-sale-price');
    
    expect(html).toContain('3,500,000');
  });

  it('should display "N/A" for a metric with a null value', () => {
    // Create a valid mock object where inventory is explicitly null
    const mockData = createMockZipData({ inventory: null });
    const html = getMetricDisplay(mockData, 'inventory');

    expect(html).toContain('N/A');
  });
});