import { ChevronRight, Folder, List, Plus, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import FieldHelp from '@/components/FieldHelp';
import type { SchemaField, FieldError } from '@/types';

interface NestedFieldCardProps {
  name: string;
  schema: SchemaField;
  value: unknown;
  path: string;
  onNavigate: (path: string) => void;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  errors?: FieldError[];
}

export function NestedFieldCard({
  name,
  schema,
  value,
  path,
  onNavigate,
  onChange,
  disabled = false,
  errors,
}: NestedFieldCardProps) {
  const label = schema.ui_config?.label || schema.title || name;
  const isOptional = schema.required === false;
  const isEnabled = value !== null && value !== undefined;
  const hasError = errors && errors.length > 0;
  
  const getCardInfo = () => {
    if (schema.type === 'object') {
      const fieldCount = schema.fields ? Object.keys(schema.fields).length : 0;
      const filledCount = value && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value).filter(k => (value as Record<string, unknown>)[k] !== undefined).length
        : 0;
      return {
        icon: <Folder className={cn('h-5 w-5', isEnabled ? 'text-blue-500' : 'text-muted-foreground')} />,
        description: `Object with ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`,
        badge: schema.python_type || 'object',
        badgeVariant: 'secondary' as const,
        subtitle: isEnabled && filledCount > 0 ? `${filledCount} populated` : undefined,
      };
    }
    if (schema.type === 'array') {
      const items = Array.isArray(value) ? value : [];
      const itemCount = items.length;
      const itemType = schema.items?.python_type || schema.items?.type || 'item';
      return {
        icon: <List className={cn('h-5 w-5', isEnabled ? 'text-green-500' : 'text-muted-foreground')} />,
        description: isEnabled ? `${itemCount} ${itemType}${itemCount !== 1 ? 's' : ''}` : 'Not set',
        badge: schema.python_type || 'array',
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
    // For required fields that are null/undefined, auto-initialize before navigating
    if (!isEnabled && !isOptional && onChange && !disabled) {
      if (schema.type === 'object') {
        onChange({});
      } else if (schema.type === 'array') {
        onChange([]);
      }
    }
    // Navigate regardless of enabled state (except for optional disabled fields which show a different UI)
    onNavigate(path);
  };

  const handleEnable = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange && !disabled) {
      // Create default value based on type
      if (schema.type === 'object') {
        onChange({});
      } else if (schema.type === 'array') {
        onChange([]);
      }
    }
  };

  const handleDisable = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange && !disabled) {
      onChange(null);
    }
  };

  // If optional and disabled, show a different card style
  if (isOptional && !isEnabled) {
    return (
      <Card
        className={cn(
          'transition-all border-dashed',
          'hover:border-primary/50',
          'group'
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex-shrink-0 opacity-50">{info.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate text-sm text-muted-foreground flex items-center gap-2">
              <span className="truncate">{label}</span>
              {schema.ui_config?.help_text && <FieldHelp helpText={schema.ui_config.help_text} />}
            </h3>
            <p className="text-xs text-muted-foreground/70">
              Not configured (optional)
            </p>
                {schema.description && (
                  <p className="text-xs text-muted-foreground/50 truncate mt-0.5">
                    {schema.description}
                  </p>
                )}
          </div>
          <Badge 
            variant="outline" 
            className="shrink-0 text-muted-foreground max-w-[150px] truncate"
            title={info.badge}
          >
            {info.badge}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnable}
            disabled={disabled}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Enable
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <Card
        className={cn(
          'cursor-pointer transition-all',
          'hover:border-primary hover:shadow-md',
          'group',
          hasError && 'border-destructive'
        )}
        onClick={handleClick}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex-shrink-0">{info.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-medium truncate text-sm', hasError && 'text-destructive')}>
              <span className="inline-flex items-center gap-2">
                <span className="truncate">{label}</span>
                {schema.ui_config?.help_text && <FieldHelp helpText={schema.ui_config.help_text} />}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              {info.description}
              {info.subtitle && (
                <span className="ml-1 text-muted-foreground/70">{info.subtitle}</span>
              )}
            </p>
            {(schema.ui_config?.help_text || schema.description) && (
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                  {schema.description}
                </p>
              )}
          </div>
          {hasError && (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <Badge 
            variant={info.badgeVariant} 
            className="shrink-0 max-w-[150px] truncate"
            title={info.badge}
          >
            {info.badge}
          </Badge>
          {isOptional && onChange && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDisable}
              disabled={disabled}
              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Disable this optional field"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </CardContent>
      </Card>
      {hasError && (
        <p className="text-xs text-destructive px-1">{errors[0].message}</p>
      )}
    </div>
  );
}
