import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function FileSelectInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const placeholder = schema.ui_config?.placeholder || props.placeholder as string || 'Enter file path...';
  const accept = props.accept as string || '*';
  const isDirectory = props.directory as boolean || false;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string>(value, schema, '');

  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value || null);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Get the file path - note: browsers restrict access to full path for security
      // In a real desktop app (like Electron), you'd have full path access
      // For web, we can only get the filename
      const file = files[0];
      // Use webkitRelativePath for directory selection if available
      const filePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      onChange(filePath);
    }
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={path}
          type="text"
          value={(effectiveValue as string) || ''}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={isReadOnly}
          readOnly={isReadOnly}
          className={cn(
            'flex-1',
            hasError && 'border-destructive focus-visible:ring-destructive',
            isReadOnly && 'bg-muted cursor-not-allowed'
          )}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - webkitdirectory is a non-standard attribute for directory selection
          webkitdirectory={isDirectory || undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleBrowseClick}
          disabled={isReadOnly}
          title={isDirectory ? 'Browse for folder' : 'Browse for file'}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
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
