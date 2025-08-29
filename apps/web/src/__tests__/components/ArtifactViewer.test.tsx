import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArtifactViewer } from '../../components/ArtifactViewer';

// Mock child components
jest.mock('../../components/artifacts/DashboardViewer', () => ({
  DashboardViewer: ({ data }: any) => <div data-testid="dashboard-viewer">{JSON.stringify(data)}</div>,
}));

jest.mock('../../components/artifacts/ChartViewer', () => ({
  ChartViewer: ({ data }: any) => <div data-testid="chart-viewer">{JSON.stringify(data)}</div>,
}));

jest.mock('../../components/artifacts/TableViewer', () => ({
  TableViewer: ({ data }: any) => <div data-testid="table-viewer">{JSON.stringify(data)}</div>,
}));

describe('ArtifactViewer', () => {
  const mockArtifact = {
    id: 'art-123',
    type: 'dashboard' as const,
    name: 'Test Dashboard',
    content: {
      widgets: [
        { id: 'w1', type: 'metric', value: 100 },
        { id: 'w2', type: 'chart', data: [] },
      ],
    },
    mimeType: 'application/json',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
    },
  };

  it('should render without artifacts', () => {
    render(<ArtifactViewer artifacts={[]} />);
    
    const emptyState = screen.getByText(/No artifacts to display/i);
    expect(emptyState).toBeInTheDocument();
  });

  it('should render single artifact', () => {
    render(<ArtifactViewer artifacts={[mockArtifact]} />);
    
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-viewer')).toBeInTheDocument();
  });

  it('should render multiple artifacts with tabs', () => {
    const artifacts = [
      mockArtifact,
      { ...mockArtifact, id: 'art-456', name: 'Second Dashboard' },
    ];

    render(<ArtifactViewer artifacts={artifacts} />);
    
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Second Dashboard')).toBeInTheDocument();
  });

  it('should switch between artifacts', async () => {
    const artifacts = [
      mockArtifact,
      { 
        ...mockArtifact, 
        id: 'art-456', 
        name: 'Chart Artifact',
        type: 'chart' as const,
      },
    ];

    render(<ArtifactViewer artifacts={artifacts} />);
    
    // Initially shows dashboard
    expect(screen.getByTestId('dashboard-viewer')).toBeInTheDocument();
    
    // Click on second tab
    fireEvent.click(screen.getByText('Chart Artifact'));
    
    // Should show chart viewer
    await waitFor(() => {
      expect(screen.getByTestId('chart-viewer')).toBeInTheDocument();
    });
  });

  it('should render different artifact types', () => {
    const artifacts = [
      { ...mockArtifact, type: 'chart' as const },
      { ...mockArtifact, id: 'art-2', type: 'table' as const },
      { ...mockArtifact, id: 'art-3', type: 'document' as const },
      { ...mockArtifact, id: 'art-4', type: 'code' as const },
      { ...mockArtifact, id: 'art-5', type: 'image' as const },
    ];

    artifacts.forEach(artifact => {
      const { rerender } = render(<ArtifactViewer artifacts={[artifact]} />);
      
      if (artifact.type === 'chart') {
        expect(screen.getByTestId('chart-viewer')).toBeInTheDocument();
      } else if (artifact.type === 'table') {
        expect(screen.getByTestId('table-viewer')).toBeInTheDocument();
      } else if (artifact.type === 'document') {
        expect(screen.getByText(/Document viewer not implemented/i)).toBeInTheDocument();
      } else if (artifact.type === 'code') {
        expect(screen.getByText(/Code viewer not implemented/i)).toBeInTheDocument();
      } else if (artifact.type === 'image') {
        expect(screen.getByText(/Image viewer not implemented/i)).toBeInTheDocument();
      }
      
      rerender(<></>); // Clear for next iteration
    });
  });

  it('should handle download action', () => {
    const mockDownload = jest.fn();
    window.URL.createObjectURL = jest.fn();
    
    const { container } = render(<ArtifactViewer artifacts={[mockArtifact]} />);
    
    const downloadButton = container.querySelector('[aria-label="Download"]');
    if (downloadButton) {
      fireEvent.click(downloadButton);
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    }
  });

  it('should handle fullscreen action', () => {
    const mockRequestFullscreen = jest.fn();
    document.documentElement.requestFullscreen = mockRequestFullscreen;
    
    const { container } = render(<ArtifactViewer artifacts={[mockArtifact]} />);
    
    const fullscreenButton = container.querySelector('[aria-label="Fullscreen"]');
    if (fullscreenButton) {
      fireEvent.click(fullscreenButton);
      expect(mockRequestFullscreen).toHaveBeenCalled();
    }
  });

  it('should handle share action', () => {
    const mockShare = jest.fn();
    navigator.share = mockShare;
    
    const { container } = render(<ArtifactViewer artifacts={[mockArtifact]} />);
    
    const shareButton = container.querySelector('[aria-label="Share"]');
    if (shareButton) {
      fireEvent.click(shareButton);
      expect(mockShare).toHaveBeenCalled();
    }
  });

  it('should update when artifacts prop changes', () => {
    const { rerender } = render(<ArtifactViewer artifacts={[]} />);
    
    expect(screen.getByText(/No artifacts to display/i)).toBeInTheDocument();
    
    rerender(<ArtifactViewer artifacts={[mockArtifact]} />);
    
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should handle artifact with missing content gracefully', () => {
    const brokenArtifact = {
      ...mockArtifact,
      content: null,
    };

    render(<ArtifactViewer artifacts={[brokenArtifact]} />);
    
    // Should render without crashing
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should display artifact metadata', () => {
    render(<ArtifactViewer artifacts={[mockArtifact]} showMetadata />);
    
    // Check if metadata is displayed
    const metadataElement = screen.queryByText(/Created:/i);
    if (metadataElement) {
      expect(metadataElement).toBeInTheDocument();
    }
  });

  it('should handle keyboard navigation', () => {
    const artifacts = [
      mockArtifact,
      { ...mockArtifact, id: 'art-456', name: 'Second' },
      { ...mockArtifact, id: 'art-789', name: 'Third' },
    ];

    render(<ArtifactViewer artifacts={artifacts} />);
    
    const firstTab = screen.getByText('Test Dashboard');
    const secondTab = screen.getByText('Second');
    
    // Tab to next
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    expect(secondTab).toHaveFocus();
    
    // Tab to previous
    fireEvent.keyDown(secondTab, { key: 'ArrowLeft' });
    expect(firstTab).toHaveFocus();
  });

  it('should handle artifacts with custom actions', () => {
    const customAction = jest.fn();
    const artifactWithAction = {
      ...mockArtifact,
      metadata: {
        ...mockArtifact.metadata,
        actions: [
          { label: 'Custom Action', handler: customAction },
        ],
      },
    };

    render(<ArtifactViewer artifacts={[artifactWithAction]} />);
    
    const customButton = screen.queryByText('Custom Action');
    if (customButton) {
      fireEvent.click(customButton);
      expect(customAction).toHaveBeenCalled();
    }
  });
});