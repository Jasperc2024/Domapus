import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Sidebar } from '../../components/dashboard/Sidebar';
import { createMockZipData } from '../__mocks__/mock-data';
import React from 'react';

describe('Sidebar Component', () => {
  it('should render the ZIP code and city correctly in the header', () => {
    const mockData = createMockZipData({ zipCode: '90210', city: 'Beverly Hills' });
    render(<Sidebar isOpen={true} isCollapsed={false} zipData={mockData} allZipData={{}} onClose={() => {}} onToggleCollapse={() => {}} />);
    

    const header = screen.getByRole('banner'); // Assuming the header div is a <header> or has a role
    
    expect(within(header).getByText('90210')).toBeInTheDocument();
    expect(within(header).getByText('Beverly Hills')).toBeInTheDocument();
  });

  it('should not render if isOpen is false', () => {
    const { container } = render(<Sidebar isOpen={false} isCollapsed={false} zipData={null} allZipData={{}} onClose={() => {}} onToggleCollapse={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});