import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useData } from '@/context/DataContext';
import { cn } from '@/lib/utils';
import type { ActionButton } from '@/types';

interface ActionButtonsProps {
  actions: ActionButton[];
}

interface PendingConfirmation {
  action: ActionButton;
  message: string;
}

// Helper to get icon component by name
function getIconComponent(iconName: string | undefined): React.ComponentType<{ className?: string }> | null {
  if (!iconName) return null;
  
  // Convert kebab-case to PascalCase (e.g., 'check-circle' -> 'CheckCircle')
  const pascalCase = iconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  // Use unknown first to satisfy TypeScript
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const IconComponent = icons[pascalCase];
  return IconComponent || null;
}

export function ActionButtons({ actions }: ActionButtonsProps) {
  const { data, apiBase } = useData();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileAction, setPendingFileAction] = useState<ActionButton | null>(null);

  // Determine the full API base URL
  const getFullApiBase = () => {
    if (apiBase.startsWith('http')) {
      return apiBase;
    }
    const { protocol, host, pathname } = window.location;
    let base = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    return `${protocol}//${host}${base}`;
  };

  const executeAction = async (action: ActionButton, fileData?: unknown) => {
    setLoadingAction(action.id);
    try {
      const fullBase = getFullApiBase();
      const body: Record<string, unknown> = { data };
      if (fileData) {
        body.file = fileData;
      }

      const response = await fetch(`${fullBase}/api/actions/${action.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) {
        console.error('Action failed:', result.error);
      }
    } catch (e) {
      console.error('Action error:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAction = async (action: ActionButton) => {
    // Handle confirmation if needed
    if (action.confirm) {
      setPendingConfirmation({ action, message: action.confirm });
      return;
    }

    if (action.upload_file) {
      setPendingFileAction(action);
      // Reset file input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
      return;
    }

    await executeAction(action);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileAction) return;

    const action = pendingFileAction;
    setPendingFileAction(null);

    // Read file
    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        data: reader.result,
      };
      await executeAction(action, fileData);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    if (pendingConfirmation) {
      const action = pendingConfirmation.action;
      setPendingConfirmation(null);
      
      if (action.upload_file) {
        setPendingFileAction(action);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
        }
      } else {
        await executeAction(action);
      }
    }
  };

  const handleCancel = () => {
    setPendingConfirmation(null);
  };

  if (!actions?.length) return null;

  const isDestructive = pendingConfirmation?.action.variant === 'destructive';

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const IconComponent = getIconComponent(action.icon);
          const isLoading = loadingAction === action.id;
          
          return (
            <Button
              key={action.id}
              variant={action.variant || 'default'}
              size="sm"
              onClick={() => handleAction(action)}
              disabled={action.disabled || isLoading}
              title={action.tooltip}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : IconComponent ? (
                <IconComponent className="h-4 w-4 mr-2" />
              ) : null}
              {action.label}
            </Button>
          );
        })}
      </div>

      <AlertDialog open={!!pendingConfirmation} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirmation?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                isDestructive &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
