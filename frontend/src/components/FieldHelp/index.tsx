import { HelpCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { useState, useRef } from 'react';

interface FieldHelpProps {
  helpText?: string | null;
  className?: string;
}

export function FieldHelp({ helpText, className }: FieldHelpProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const clickLockRef = useRef(false);

  // Close popover when mouse leaves both trigger and content
  const handleMouseLeave = () => {
    setOpen(false);
  };

  if (!helpText) return null;

  return (
    <Popover open={open} onOpenChange={(v) => setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={"inline-flex items-center justify-center text-muted-foreground hover:text-foreground p-0.5 rounded " + (className ?? '')}
          aria-label="Field help"
          ref={triggerRef}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={(e) => {
            // Defer close to avoid racing with click events (relatedTarget can be null during click)
            const relatedTarget = e.relatedTarget as Node | null;
            setTimeout(() => {
              if (clickLockRef.current) return;
              if (contentRef.current?.contains(relatedTarget)) return;
              // Also avoid closing if focus moved into the content
              if (contentRef.current && contentRef.current.contains(document.activeElement as Node)) return;
              handleMouseLeave();
            }, 0);
          }}
          onClick={() => {
            // Ensure clicks open the popover and avoid immediate mouseleave races
            setOpen(true);
            clickLockRef.current = true;
            setTimeout(() => (clickLockRef.current = false), 100);
          }}
          // onFocus={() => setOpen(true)}
          // onBlur={() => setOpen(false)}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        sideOffset={6}
        className="w-auto max-w-[36rem] max-h-[60vh] overflow-auto scrollbar-thin"
        ref={contentRef}
        onMouseLeave={(e) => {
          // Defer close to avoid racing with click events
          const relatedTarget = e.relatedTarget as Node | null;
          setTimeout(() => {
            if (clickLockRef.current) return;
            if (triggerRef.current?.contains(relatedTarget)) return;
            if (triggerRef.current && triggerRef.current.contains(document.activeElement as Node)) return;
            handleMouseLeave();
          }, 0);
        }}
        // Prevent events inside the popover from bubbling to document handlers
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-muted-foreground">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                img: ({ node, ...props }) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <img className="max-w-full h-auto rounded" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <table className="min-w-full border-collapse text-sm" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="border px-2 py-1 bg-muted text-left" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border px-2 py-1" {...props} />
                ),
                pre: ({ node, ...props }) => (
                  // Constrain code blocks to a max height and allow scrolling
                  <pre className="bg-muted p-2 rounded overflow-auto text-sm max-h-[30rem]" {...props} />
                ),
                code: ({ node, inline, className, children, ...props }: any) => {
                  if (inline) {
                    return (
                      <code className="bg-muted px-1 rounded text-sm" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    // Ensure long lines can scroll horizontally and block won't exceed parent max height
                    <code className={"block p-2 rounded bg-muted text-sm whitespace-pre overflow-auto max-h-[28rem] " + (className ?? '')} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {helpText}
            </ReactMarkdown>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default FieldHelp;
