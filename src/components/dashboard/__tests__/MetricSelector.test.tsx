import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricSelector, METRICS } from '../MetricSelector';

describe('MetricSelector', () => {
  it('should display the currently selected metric', () => {
    const mockOnChange = vi.fn();
    render(
      <MetricSelector selectedMetric="median_ppsf" onMetricChange={mockOnChange} />
    );

    // The selected value should be displayed
    expect(screen.getByText('Median Price per Sq Ft')).toBeInTheDocument();
  });

  it('should render all 12 metrics in METRICS constant', () => {
    // Verify that METRICS contains all 12 expected metrics
    const metricEntries = Object.entries(METRICS);
    expect(metricEntries.length).toBe(12);
    
    const expectedMetrics = [
      'Zillow Home Value Index',
      'Median Sale Price',
      'Median List Price',
      'Median Price per Sq Ft',
      'Homes Sold',
      'Pending Sales',
      'New Listings',
      'Inventory',
      'Sale-to-List Ratio',
      'Median Days on Market',
      '% Sold Above List',
      '% Off Market in 2 Weeks',
    ];

    const actualMetrics = metricEntries.map(([, label]) => label);
    for (const metric of expectedMetrics) {
      expect(actualMetrics).toContain(metric);
    }
  });

  it('should have correct metric keys', () => {
    const metricKeys = Object.keys(METRICS);
    const expectedKeys = [
      'zhvi',
      'median_sale_price',
      'median_list_price',
      'median_ppsf',
      'homes_sold',
      'pending_sales',
      'new_listings',
      'inventory',
      'avg_sale_to_list_ratio',
      'median_dom',
      'sold_above_list',
      'off_market_in_two_weeks',
    ];

    expect(metricKeys.length).toBe(12);
    for (const key of expectedKeys) {
      expect(metricKeys).toContain(key);
    }
  });
});
