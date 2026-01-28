import React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function DateInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const [open, setOpen] = React.useState(false);
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const placeholder = schema.ui_config?.placeholder || (props.placeholder as string) || 'Pick a date';
  const includeTime = (props.includeTime as boolean) || schema.format === 'date-time';
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string | null>(value, schema, null);

  // Parse date from value
  const parseDate = (val: unknown): Date | undefined => {
    if (!val) return undefined;
    const date = new Date(val as string);
    if (isNaN(date.getTime())) return undefined;
    return date;
  };

  const date = parseDate(effectiveValue);

  // Format time for time input
  const formatTime = (d: Date | undefined): string => {
    if (!d) return '';
    return format(d, 'HH:mm');
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange(null);
      setOpen(false);
      return;
    }
    
    if (includeTime) {
      // If including time, preserve existing time
      if (date) {
        selectedDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
      }
      onChange(selectedDate.toISOString());
    } else {
      // For date-only fields, format as YYYY-MM-DD to avoid time zone issues
      // and to comply with Pydantic's date type expectations
      onChange(format(selectedDate, 'yyyy-MM-dd'));
    }
    setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeVal = e.target.value;
    if (!timeVal) return;
    
    const [hours, minutes] = timeVal.split(':').map(Number);
    const newDate = date ? new Date(date) : new Date();
    newDate.setHours(hours, minutes, 0, 0);
    onChange(newDate.toISOString());
  };

  return (
    <div className="space-y-2" data-pydantic-ui="field" data-pydantic-ui-field-type="date" data-pydantic-ui-path={path}>
      <div className="space-y-0.5">
        <Label htmlFor={path} className={cn(hasError && 'text-destructive')} data-pydantic-ui="field-label">
          <span className="inline-flex items-center gap-2">
            <span className="truncate">{label}</span>
            {schema.required !== false && <span className="text-destructive ml-1">*</span>}
            <FieldHelp helpText={helpText} />
          </span>
        </Label>
        {subtitle && (
          <p className="text-xs text-muted-foreground" data-pydantic-ui="field-subtitle">{subtitle}</p>
        )}
      </div>
      <div className={cn('flex gap-2 items-center', includeTime ? 'flex-row' : 'flex-col')}>
        {/*
          When not including time we render in a column layout. In that case
          `flex-1` expands vertically but not horizontally, which prevents the
          date picker button from filling the available width. Use `w-full`
          for column mode and `flex-1` for row mode so the control is full
          width when time input is omitted.
        */}
        <div className={cn('flex gap-2 items-center', includeTime ? 'flex-1' : 'w-full')}>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id={path}
                variant="outline"
                disabled={isReadOnly}
                className={cn(
                  'flex-1 justify-start text-left font-normal',
                  !date && 'text-muted-foreground',
                  hasError && 'border-destructive focus-visible:ring-destructive',
                  isReadOnly && 'bg-muted cursor-not-allowed'
                )}
                data-pydantic-ui="field-control"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, includeTime ? 'PPP' : 'PPP') : <span>{placeholder}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                captionLayout="dropdown"
                disabled={isReadOnly}
              />
            </PopoverContent>
          </Popover>
          {includeTime && (
            <Input
              type="time"
              value={formatTime(date)}
              onChange={handleTimeChange}
              disabled={isReadOnly || !date}
              readOnly={isReadOnly}
              className={cn(
                'w-32',
                hasError && 'border-destructive focus-visible:ring-destructive',
                isReadOnly && 'bg-muted cursor-not-allowed'
              )}
            />
          )}
          <ClearResetButtons
            schema={schema}
            value={value}
            onChange={onChange}
            disabled={isReadOnly}
            variant="inline"
          />
        </div>
      </div>
      {/* description now shown as subtitle above, help_text shown via FieldHelp */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}
