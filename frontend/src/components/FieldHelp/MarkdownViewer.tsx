import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { common } from 'lowlight';
import 'highlight.js/styles/github.css';
import 'highlight.js/styles/github-dark.css';
import { cn } from '@/lib/utils';

export interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none field-help-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { languages: common }]]}
        components={{
          img: ({ node: _node, alt, ...props }) => (
            <img 
              className="max-w-full h-auto rounded" 
              alt={alt ?? 'Help image'} 
              {...props} 
            />
          ),
          table: ({ node: _node, ...props }) => (
            <table className="min-w-full border-collapse text-sm" {...props} />
          ),
          th: ({ node: _node, ...props }) => (
            <th className="border border-border px-2 py-1 bg-muted text-left" {...props} />
          ),
          td: ({ node: _node, ...props }) => (
            <td className="border border-border px-2 py-1" {...props} />
          ),
          pre: ({ node: _node, children, ...props }) => (
            <pre 
              className="!bg-muted/50 p-3 rounded overflow-auto text-sm max-h-[30rem]" 
              {...props}
            >
              {children}
            </pre>
          ),
          code: ({ node: _node, inline, className: codeClassName, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean; node?: unknown }) => {
            if (inline) {
              return (
                <code 
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" 
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code 
                className={cn(
                  'block p-3 rounded text-sm font-mono whitespace-pre overflow-auto',
                  codeClassName
                )} 
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownViewer;
