import * as React from "react"
import { cn } from "@/lib/utils"

// ============================================================================
// Tabs Context
// ============================================================================

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: "horizontal" | "vertical";
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

// ============================================================================
// Tabs Root
// ============================================================================

interface TabsProps {
  /** The default active tab (uncontrolled mode) */
  defaultValue?: string;
  /** The active tab value (controlled mode) */
  value?: string;
  /** Callback when tab changes */
  onValueChange?: (value: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** TabsList and TabsContents components */
  children: React.ReactNode;
  /** Layout orientation */
  orientation?: "horizontal" | "vertical";
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      defaultValue,
      value: controlledValue,
      onValueChange,
      className,
      children,
      orientation = "horizontal",
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
    
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;
    
    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [isControlled, onValueChange]
    );

    return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange, orientation }}>
        <div
          ref={ref}
          className={cn(
            "w-full",
            orientation === "vertical" && "flex gap-4",
            className
          )}
          data-orientation={orientation}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

// ============================================================================
// Tabs List (Container for triggers)
// ============================================================================

interface TabsListProps {
  /** Additional CSS classes */
  className?: string;
  /** TabsTrigger components */
  children: React.ReactNode;
}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { orientation } = useTabsContext();

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          "relative inline-flex items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground",
          orientation === "vertical" && "flex-col items-stretch",
          className
        )}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = "TabsList";

// ============================================================================
// Tabs Trigger (Individual tab button)
// ============================================================================

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Unique identifier for the tab (required) */
  value: string;
  /** Additional CSS classes */
  className?: string;
  /** Tab label content */
  children: React.ReactNode;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, disabled, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = useTabsContext();
    const isActive = selectedValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${value}`}
        data-state={isActive ? "active" : "inactive"}
        data-value={value}
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
          "ring-offset-background transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          isActive 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          className
        )}
        onClick={() => onValueChange(value)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

// ============================================================================
// Tabs Contents (Container for content panels)
// ============================================================================

interface TabsContentsProps {
  /** Content slide transition config (for future Motion integration) */
  transition?: {
    type?: string;
    stiffness?: number;
    damping?: number;
  };
  /** Additional CSS classes */
  className?: string;
  /** TabsContent components */
  children: React.ReactNode;
}

const TabsContents = React.forwardRef<HTMLDivElement, TabsContentsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div 
        ref={ref} 
        className={cn("relative mt-2 overflow-hidden", className)} 
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContents.displayName = "TabsContents";

// ============================================================================
// Tabs Content (Individual content panel)
// ============================================================================

interface TabsContentProps {
  /** Matches TabsTrigger value (required) */
  value: string;
  /** Additional CSS classes */
  className?: string;
  /** Tab panel content */
  children: React.ReactNode;
  /** Force mount (keep in DOM even when inactive) */
  forceMount?: boolean;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, forceMount, ...props }, ref) => {
    const { value: selectedValue } = useTabsContext();
    const isActive = selectedValue === value;
    const [shouldRender, setShouldRender] = React.useState(isActive);
    const [isAnimating, setIsAnimating] = React.useState(false);

    React.useEffect(() => {
      if (isActive) {
        setShouldRender(true);
        // Small delay to trigger enter animation
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      } else {
        setIsAnimating(false);
        // Keep mounted briefly for exit animation
        const timer = setTimeout(() => {
          if (!forceMount) {
            setShouldRender(false);
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }, [isActive, forceMount]);

    if (!shouldRender && !forceMount) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${value}`}
        aria-labelledby={`tab-${value}`}
        data-state={isActive ? "active" : "inactive"}
        hidden={!isActive}
        tabIndex={0}
        className={cn(
          "ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Animation classes
          "transition-all duration-200 ease-out",
          isActive && isAnimating
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

// ============================================================================
// Exports
// ============================================================================

export { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentsProps, TabsContentProps };
