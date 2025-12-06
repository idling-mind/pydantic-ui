import React, { useState, useMemo } from 'react';
import { ListPlus, ListMinus, Replace } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type PasteArrayMode = 'append' | 'prepend' | 'overwrite';

interface PasteArrayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceItemCount: number;
  targetItemCount: number;
  targetName: string;
  onPaste: (mode: PasteArrayMode) => void;
}

export function PasteArrayDialog({
  open,
  onOpenChange,
  sourceItemCount,
  targetItemCount,
  targetName,
  onPaste,
}: PasteArrayDialogProps) {
  const [mode, setMode] = useState<PasteArrayMode>('append');

  // Calculate preview of result
  const resultPreview = useMemo(() => {
    switch (mode) {
      case 'append':
        return targetItemCount + sourceItemCount;
      case 'prepend':
        return targetItemCount + sourceItemCount;
      case 'overwrite':
        return sourceItemCount;
      default:
        return sourceItemCount;
    }
  }, [mode, sourceItemCount, targetItemCount]);

  const handlePaste = () => {
    onPaste(mode);
    onOpenChange(false);
  };

  // Reset mode when dialog opens
  React.useEffect(() => {
    if (open) {
      setMode('append');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paste Array Items</DialogTitle>
          <DialogDescription>
            Choose how to paste {sourceItemCount} item{sourceItemCount !== 1 ? 's' : ''} into "{targetName}".
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as PasteArrayMode)}
            className="space-y-3"
          >
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                mode === 'append' ? 'border-primary bg-accent' : 'border-border hover:border-muted-foreground'
              )}
              onClick={() => setMode('append')}
            >
              <RadioGroupItem value="append" id="append" />
              <ListPlus className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label htmlFor="append" className="cursor-pointer font-medium">
                  Append
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add items to the end of the existing list
                </p>
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                mode === 'prepend' ? 'border-primary bg-accent' : 'border-border hover:border-muted-foreground'
              )}
              onClick={() => setMode('prepend')}
            >
              <RadioGroupItem value="prepend" id="prepend" />
              <ListMinus className="h-5 w-5 text-muted-foreground rotate-180" />
              <div className="flex-1">
                <Label htmlFor="prepend" className="cursor-pointer font-medium">
                  Prepend
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add items to the beginning of the existing list
                </p>
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                mode === 'overwrite' ? 'border-primary bg-accent' : 'border-border hover:border-muted-foreground'
              )}
              onClick={() => setMode('overwrite')}
            >
              <RadioGroupItem value="overwrite" id="overwrite" />
              <Replace className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label htmlFor="overwrite" className="cursor-pointer font-medium">
                  Overwrite
                </Label>
                <p className="text-sm text-muted-foreground">
                  Replace all existing items with clipboard items
                </p>
              </div>
            </div>
          </RadioGroup>

          {/* Preview */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <span className="text-muted-foreground">Current items: </span>
              <span className="font-medium">{targetItemCount}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Clipboard items: </span>
              <span className="font-medium">{sourceItemCount}</span>
            </div>
            <div className="text-sm mt-1 pt-1 border-t border-border">
              <span className="text-muted-foreground">Result: </span>
              <span className="font-medium text-primary">{resultPreview} items</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePaste}>
            Paste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
