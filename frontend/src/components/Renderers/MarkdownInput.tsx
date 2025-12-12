import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function MarkdownInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const placeholder = (props.placeholder as string) || `Enter ${label.toLowerCase()}...`;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string | null>(value, schema, '');
  const stringValue = effectiveValue !== null && effectiveValue !== undefined ? String(effectiveValue) : '';

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <Tabs defaultValue="write" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-2">
          <Textarea
            id={path}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={isReadOnly}
            className={cn(
              'min-h-[150px] font-mono',
              hasError && 'border-destructive focus-visible:ring-destructive',
              isReadOnly && 'bg-muted cursor-not-allowed'
            )}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className={cn(
            "min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
          )}>
            {stringValue ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {stringValue}
              </ReactMarkdown>
            ) : (
              <span className="text-muted-foreground italic">Nothing to preview</span>
            )}
          </div>
        </TabsContent>
      </Tabs>

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
