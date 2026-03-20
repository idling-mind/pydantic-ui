import { useState } from 'react';
import { Folder, List, Plus, X, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { resolveDisplay } from '@/lib/displayUtils';
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
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  // Use the unified display resolver for card view
  const display = resolveDisplay({ schema, view: 'card', name, data: value });
  const label = display.title;
  const helpText = display.helpText;
  const subtitle = display.subtitle;
  
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
      setDisableDialogOpen(true);
    }
  };

  const handleConfirmDisable = () => {
    setDisableDialogOpen(false);
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
        data-pydantic-ui="nested-card"
        data-pydantic-ui-path={path}
        data-pydantic-ui-type={schema.type}
        data-pydantic-ui-enabled="false"
      >
        <CardContent className="nested-card-content p-4">
          <div className="nested-card-header-row">
            <div className="nested-card-icon opacity-50">{info.icon}</div>
            <div className="nested-card-main">
              <div className="nested-card-text min-w-0 flex-1">
                <div className="nested-card-title-row">
                  <h3 className="nested-card-title font-medium truncate text-sm text-muted-foreground">
                    <span className="truncate">{label}</span>
                    {helpText && <FieldHelp helpText={helpText} />}
                  </h3>
                  <Badge
                    variant="outline"
                    className="nested-card-badge text-muted-foreground max-w-[150px] truncate"
                    title={info.badge}
                  >
                    {info.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Not configured (optional)
                </p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground/50 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="nested-card-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnable}
              disabled={disabled}
              className="nested-card-action-button nested-card-enable"
            >
              <Plus className="h-4 w-4 mr-1" />
              Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-1">
        <Card
          className={cn(
            'cursor-pointer transition-all',
            'hover:border-primary hover:shadow-md',
            'group',
            hasError && 'border-destructive'
          )}
          onClick={handleClick}
          data-pydantic-ui="nested-card"
          data-pydantic-ui-path={path}
          data-pydantic-ui-type={schema.type}
          data-pydantic-ui-enabled="true"
        >
          <CardContent className="nested-card-content p-4">
            <div className="nested-card-header-row">
              <div className="nested-card-icon">{info.icon}</div>
              <div className="nested-card-main">
                <div className="nested-card-text min-w-0 flex-1">
                  <div className="nested-card-title-row">
                    <h3 className={cn('nested-card-title font-medium truncate text-sm', hasError && 'text-destructive')}>
                      <span className="truncate">{label}</span>
                      {helpText && <FieldHelp helpText={helpText} />}
                    </h3>
                    <div className="nested-card-title-meta">
                      {hasError && (
                        <AlertCircle className="nested-card-alert h-4 w-4 text-destructive" />
                      )}
                      <Badge
                        variant={info.badgeVariant}
                        className="nested-card-badge max-w-[150px] truncate"
                        title={info.badge}
                      >
                        {info.badge}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {info.description}
                    {info.subtitle && (
                      <span className="ml-1 text-muted-foreground/70">{info.subtitle}</span>
                    )}
                  </p>
                  {subtitle && (
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {isOptional && onChange && (
              <div className="nested-card-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisable}
                  disabled={disabled}
                  className="nested-card-action-button nested-card-disable text-muted-foreground hover:text-destructive"
                  title="Disable this optional field"
                >
                  <X className="h-4 w-4 mr-1" />
                  Disable
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        {hasError && (
          <p className="text-xs text-destructive px-1">{errors[0].message}</p>
        )}
      </div>

      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable optional field?</AlertDialogTitle>
            <AlertDialogDescription>
              Disabling {label} will clear all configured values for this section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
