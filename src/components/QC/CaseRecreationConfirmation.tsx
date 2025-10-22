import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface CaseRecreationConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
  caseId: string;
  caseNumber: string;
  isProcessing?: boolean;
}

export default function CaseRecreationConfirmation({
  isOpen,
  onClose,
  onConfirm,
  onReject,
  caseId,
  caseNumber,
  isProcessing = false
}: CaseRecreationConfirmationProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Case Rejected - Recreation Option
          </DialogTitle>
          <DialogDescription className="text-base">
            Case <span className="font-mono font-semibold">{caseNumber}</span> has been rejected.
            <br />
            <br />
            Would you like to recreate the same case for a new attempt?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Original Case ID:</span>
              <span className="font-mono text-sm bg-background px-2 py-1 rounded border">
                {caseNumber}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">New Case ID (if recreated):</span>
              <span className="font-mono text-sm bg-background px-2 py-1 rounded border">
                {caseNumber}(1)
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Note: Both case number and client case ID will be modified with "(1)" suffix
            </div>
          </div>
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p>• <strong>Yes:</strong> Creates a new case with ID "{caseNumber}(1)" for retry</p>
            <p>• <strong>No:</strong> Case remains rejected and moves to rejected tab</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isProcessing}
            className="flex-1"
          >
            No, Keep Rejected
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Yes, Recreate Case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
