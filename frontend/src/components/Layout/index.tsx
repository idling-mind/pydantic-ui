import React from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { TreePanel } from '@/components/TreePanel';
import { DetailPanel } from '@/components/DetailPanel';
import { useData } from '@/context/DataContext';
import { useEvents } from '@/context/EventContext';

interface LayoutProps {
  children?: React.ReactNode;
}

export function Layout({}: LayoutProps) {
  const { config } = useData();
  const { progress } = useEvents();
  const [panelWidth, setPanelWidth] = React.useState(300);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      // Clamp between 200 and 500
      setPanelWidth(Math.max(200, Math.min(500, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-screen flex flex-col bg-background relative" data-pydantic-ui="app-container">
      {progress !== null && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-secondary z-50 overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-in-out relative"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          >
            <div className="absolute inset-0 animate-progress-shimmer" />
          </div>
        </div>
      )}
      <Header 
        title={config?.title} 
        logoText={config?.logo_text}
        logoUrl={config?.logo_url}
        logoUrlDark={config?.logo_url_dark}
      />
      
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Tree Panel */}
        <div
          style={{ width: panelWidth }}
          className="border-r bg-muted/30 flex-shrink-0 overflow-hidden"
          data-pydantic-ui="tree-panel-container"
        >
          <TreePanel />
        </div>

        {/* Resize Handle */}
        <div
          className={cn(
            'w-1 cursor-col-resize flex items-center justify-center hover:bg-primary/20 transition-colors',
            isDragging && 'bg-primary/30'
          )}
          onMouseDown={handleMouseDown}
          data-pydantic-ui="resize-handle"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 hover:opacity-100 transition-opacity" />
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-hidden" data-pydantic-ui="detail-panel-container">
          <DetailPanel />
        </div>
      </div>

      <Footer/>
    </div>
  );
}
