import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type DuplicatePlacement = 'after-each' | 'at-end';

interface DuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onDuplicate: (count: number, placement: DuplicatePlacement) => void;
}

export function DuplicateDialog({
  open,
  onOpenChange,
  itemCount,
  onDuplicate,
}: DuplicateDialogProps) {
  const [count, setCount] = useState(1);
  const [placement, setPlacement] = useState<DuplicatePlacement>('at-end');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (count >= 1) {
      onDuplicate(count, placement);
      onOpenChange(false);
      setCount(1);
      setPlacement('at-end');
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCount(1);
      setPlacement('at-end');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px]" data-pydantic-ui="duplicate-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Duplicate {itemCount > 1 ? `${itemCount} Items` : 'Item'}</DialogTitle>
            <DialogDescription>
              {itemCount > 1
                ? `Create copies of the ${itemCount} selected items.`
                : 'Create copies of the selected item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duplicate-count">Number of copies</Label>
              <Input
                id="duplicate-count"
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                data-pydantic-ui="duplicate-count-input"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {itemCount > 1
                  ? `This will create ${count} cop${count === 1 ? 'y' : 'ies'} of each of the ${itemCount} selected items (${count * itemCount} new items total).`
                  : `This will create ${count} cop${count === 1 ? 'y' : 'ies'} of the selected item.`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Placement</Label>
              <RadioGroup
                value={placement}
                onValueChange={(v) => setPlacement(v as DuplicatePlacement)}
                data-pydantic-ui="duplicate-placement"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="at-end" id="placement-end" data-pydantic-ui="duplicate-placement-end" />
                  <Label htmlFor="placement-end" className="font-normal cursor-pointer">
                    At end of list
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="after-each" id="placement-after" data-pydantic-ui="duplicate-placement-after" />
                  <Label htmlFor="placement-after" className="font-normal cursor-pointer">
                    After each original item
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" data-pydantic-ui="duplicate-confirm">
              Duplicate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
