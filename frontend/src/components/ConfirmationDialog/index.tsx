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
import { useEvents } from '@/context/EventContext';
import { cn } from '@/lib/utils';

export function ConfirmationDialog() {
  const { confirmationRequest, respondToConfirmation } = useEvents();

  if (!confirmationRequest) return null;

  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && respondToConfirmation(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmationRequest.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmationRequest.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => respondToConfirmation(false)}>
            {confirmationRequest.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => respondToConfirmation(true)}
            className={cn(
              confirmationRequest.variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {confirmationRequest.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
