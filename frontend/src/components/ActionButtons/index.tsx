import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/DataContext';
import type { ActionButton } from '@/types';

interface ActionButtonsProps {
  actions: ActionButton[];
}

// Helper to get icon component by name
function getIconComponent(iconName: string | undefined): React.ComponentType<{ className?: string }> | null {
  if (!iconName) return null;
  
  // Convert kebab-case to PascalCase (e.g., 'check-circle' -> 'CheckCircle')
  const pascalCase = iconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  // Use unknown first to satisfy TypeScript
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const IconComponent = icons[pascalCase];
  return IconComponent || null;
}

export function ActionButtons({ actions }: ActionButtonsProps) {
  const { data, apiBase } = useData();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Determine the full API base URL
  const getFullApiBase = () => {
    if (apiBase.startsWith('http')) {
      return apiBase;
    }
    const { protocol, host, pathname } = window.location;
    let base = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    return `${protocol}//${host}${base}`;
  };

  const handleAction = async (action: ActionButton) => {
    // Handle confirmation if needed
    if (action.confirm) {
      if (!window.confirm(action.confirm)) return;
    }

    setLoadingAction(action.id);
    try {
      const fullBase = getFullApiBase();
      const response = await fetch(`${fullBase}/api/actions/${action.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const result = await response.json();
      if (!result.success) {
        console.error('Action failed:', result.error);
      }
    } catch (e) {
      console.error('Action error:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  if (!actions?.length) return null;

  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => {
        const IconComponent = getIconComponent(action.icon);
        const isLoading = loadingAction === action.id;
        
        return (
          <Button
            key={action.id}
            variant={action.variant || 'default'}
            size="sm"
            onClick={() => handleAction(action)}
            disabled={action.disabled || isLoading}
            title={action.tooltip}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : IconComponent ? (
              <IconComponent className="h-4 w-4 mr-2" />
            ) : null}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
