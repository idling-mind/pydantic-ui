import React from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/Header';
import { TreePanel } from '@/components/TreePanel';
import { DetailPanel } from '@/components/DetailPanel';
import { useData } from '@/context/DataContext';

interface LayoutProps {
  children?: React.ReactNode;
}

export function Layout({}: LayoutProps) {
  const { config } = useData();
  const [panelWidth, setPanelWidth] = React.useState(280);
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
    <div className="h-screen flex flex-col bg-background">
      <Header 
        title={config?.title} 
        logoText={config?.logo_text}
        logoUrl={config?.logo_url}
      />
      
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Tree Panel */}
        <div
          style={{ width: panelWidth }}
          className="border-r bg-muted/30 flex-shrink-0 overflow-hidden"
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
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 hover:opacity-100 transition-opacity" />
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-hidden">
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}
