import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopBar } from '../../components/dashboard/TopBar';
import { MetricType } from '../../components/dashboard/HousingDashboard';

// Mock child components to test TopBar in isolation
vi.mock('../../components/dashboard/MetricSelector', () => ({ MetricSelector: () => <div data-testid="metric-selector" /> }));
vi.mock('../../components/dashboard/SearchBox', () => ({ SearchBox: () => <div data-testid="search-box" /> }));
vi.mock('../../components/dashboard/LastUpdated', () => ({ LastUpdated: () => <div data-testid="last-updated" /> }));

describe('TopBar Component', () => {
  const defaultProps = {
    selectedMetric: 'median_sale_price' as MetricType,
    onMetricChange: vi.fn(),
    onSearch: vi.fn(),
    lastUpdated: '2025-07-25T12:00:00Z',
  };

  it('should render the main title and subtitle', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('Domapus')).toBeInTheDocument();
    expect(screen.getByText('U.S. Housing Market Dashboard')).toBeInTheDocument();
  });

  it('should render child components on desktop', () => {
    // Note: use-mobile hook defaults to desktop in jsdom, which is what we want to test
    const { getByTestId } = render(<TopBar {...defaultProps} />);
    expect(getByTestId('metric-selector')).toBeInTheDocument();
    expect(getByTestId('search-box')).toBeInTheDocument();
    expect(getByTestId('last-updated')).toBeInTheDocument();
  });

  it('should render the Export button passed as children', () => {
    render(
      <TopBar {...defaultProps}>
        <button>Export Button</button>
      </TopBar>
    );
    expect(screen.getByText('Export Button')).toBeInTheDocument();
  });
});