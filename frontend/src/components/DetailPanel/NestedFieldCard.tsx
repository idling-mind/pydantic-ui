import { ChevronRight, Folder, List } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SchemaField } from '@/types';

interface NestedFieldCardProps {
  name: string;
  schema: SchemaField;
  value: unknown;
  path: string;
  onNavigate: (path: string) => void;
}

export function NestedFieldCard({
  name,
  schema,
  value,
  path,
  onNavigate,
}: NestedFieldCardProps) {
  const label = schema.ui_config?.label || schema.title || name;
  
  const getCardInfo = () => {
    if (schema.type === 'object') {
      const fieldCount = schema.fields ? Object.keys(schema.fields).length : 0;
      const filledCount = value && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value).filter(k => (value as Record<string, unknown>)[k] !== undefined).length
        : 0;
      return {
        icon: <Folder className="h-5 w-5 text-blue-500" />,
        description: `Object with ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`,
        badge: 'object',
        badgeVariant: 'secondary' as const,
        subtitle: filledCount > 0 ? `${filledCount} populated` : undefined,
      };
    }
    if (schema.type === 'array') {
      const items = Array.isArray(value) ? value : [];
      const itemCount = items.length;
      const itemType = schema.items?.type || 'item';
      return {
        icon: <List className="h-5 w-5 text-green-500" />,
        description: `${itemCount} ${itemType}${itemCount !== 1 ? 's' : ''}`,
        badge: 'array',
        badgeVariant: 'secondary' as const,
        subtitle: schema.min_items !== undefined || schema.max_items !== undefined
          ? `(${schema.min_items ?? 0}-${schema.max_items ?? '∞'})`
          : undefined,
      };
    }
    return null;
  };

  const info = getCardInfo();
  if (!info) return null;

  const handleClick = () => {
    onNavigate(path);
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all',
        'hover:border-primary hover:shadow-md',
        'group'
      )}
      onClick={handleClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex-shrink-0">{info.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate text-sm">{label}</h3>
          <p className="text-xs text-muted-foreground">
            {info.description}
            {info.subtitle && (
              <span className="ml-1 text-muted-foreground/70">{info.subtitle}</span>
            )}
          </p>
          {schema.description && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {schema.description}
            </p>
          )}
        </div>
        <Badge variant={info.badgeVariant} className="shrink-0">
          {info.badge}
        </Badge>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </CardContent>
    </Card>
  );
}
