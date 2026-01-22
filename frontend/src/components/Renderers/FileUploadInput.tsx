import React from 'react';
import { Upload, X, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

interface FileData {
  name: string;
  size: number;
  type: string;
  data?: string; // Base64 encoded data
}

export function FileUploadInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const accept = props.accept as string || '*';
  const multiple = props.multiple as boolean || false;
  const maxSize = props.maxSize as number || 10 * 1024 * 1024; // 10MB default
  const isReadOnly = disabled || schema.ui_config?.read_only === true;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Parse existing value
  const files: FileData[] = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value as FileData[];
    if (typeof value === 'object') return [value as FileData];
    return [];
  }, [value]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const processFile = async (file: File): Promise<FileData | null> => {
    if (file.size > maxSize) {
      console.warn(`File ${file.name} exceeds maximum size of ${formatFileSize(maxSize)}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data: reader.result as string,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: FileData[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const fileData = await processFile(fileList[i]);
      if (fileData) newFiles.push(fileData);
    }

    if (newFiles.length === 0) return;

    if (multiple) {
      onChange([...files, ...newFiles]);
    } else {
      onChange(newFiles[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isReadOnly) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isReadOnly) handleFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (index: number) => {
    if (multiple) {
      const newFiles = files.filter((_, i) => i !== index);
      onChange(newFiles.length > 0 ? newFiles : null);
    } else {
      onChange(null);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        <span className="inline-flex items-center gap-2">
          <span className="truncate">{label}</span>
          {schema.required !== false && <span className="text-destructive ml-1">*</span>}
          <FieldHelp helpText={schema.ui_config?.help_text} />
        </span>
      </Label>
      
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isReadOnly && 'opacity-50 cursor-not-allowed',
          hasError && 'border-destructive'
        )}
      >
        <Upload className={cn('h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {accept === '*' ? 'Any file type' : accept} (max {formatFileSize(maxSize)})
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={path}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={isReadOnly}
        className="hidden"
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border bg-muted/50 p-2"
            >
              <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
                disabled={isReadOnly}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {/* help_text now shown via FieldHelp next to title */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}
