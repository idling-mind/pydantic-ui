import { useState, useRef, Suspense, lazy } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const MarkdownViewer = lazy(() => import('./MarkdownViewer'));

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
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        sideOffset={6}
        className="w-auto max-w-[40rem] max-h-[60vh] overflow-auto scrollbar-thin"
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
          {open && (
            <Suspense fallback={
              <div className="py-2 text-xs text-muted-foreground animate-pulse">
                Loading...
              </div>
            }>
              <MarkdownViewer content={helpText} />
            </Suspense>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default FieldHelp;