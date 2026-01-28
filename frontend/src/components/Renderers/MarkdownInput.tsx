import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import type { RendererProps } from './types';

export function MarkdownInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const placeholder = schema.ui_config?.placeholder || (props.placeholder as string) || `Enter ${label.toLowerCase()}...`;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string | null>(value, schema, '');
  const stringValue = effectiveValue !== null && effectiveValue !== undefined ? String(effectiveValue) : '';

  return (
    <div className="space-y-2" data-pydantic-ui="field" data-pydantic-ui-field-type="markdown" data-pydantic-ui-path={path}>
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
      
      <Tabs defaultValue="write" className="w-full" data-pydantic-ui="field-control">
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

      {/* description now shown as subtitle above, help_text shown via FieldHelp */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}
