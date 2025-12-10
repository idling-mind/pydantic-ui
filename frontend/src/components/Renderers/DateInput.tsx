import React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function DateInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const [open, setOpen] = React.useState(false);
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
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
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className={cn('flex gap-2', includeTime ? 'flex-row' : 'flex-col')}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={path}
              variant="outline"
              disabled={isReadOnly}
              className={cn(
                'w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground',
                hasError && 'border-destructive focus-visible:ring-destructive',
                isReadOnly && 'bg-muted cursor-not-allowed'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, includeTime ? 'PPP' : 'PPP') : <span>Pick a date</span>}
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
      </div>
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {schema.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground">{schema.ui_config.help_text}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}
