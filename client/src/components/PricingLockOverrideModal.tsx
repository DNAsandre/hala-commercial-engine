/**
 * PricingLockOverrideModal — Admin-only override for pricing lock.
 * Requires a reason (min 10 chars) and logs to audit trail.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { isValidOverrideReason } from "@/lib/sla-integrity";

interface PricingLockOverrideModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  fieldLabel?: string;
  workspaceStage?: string;
  isLoading?: boolean;
}

export function PricingLockOverrideModal({
  open,
  onClose,
  onConfirm,
  fieldLabel,
  workspaceStage,
  isLoading = false,
}: PricingLockOverrideModalProps) {
  const [reason, setReason] = useState("");
  const isValid = isValidOverrideReason(reason);

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
            Pricing Lock Override
          </DialogTitle>
          <DialogDescription className="text-left">
            Pricing is locked at the current stage. This action requires Admin authorization and will be recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Context info */}
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                {fieldLabel && (
                  <p className="text-amber-800">
                    <span className="font-medium">Field:</span> {fieldLabel}
                  </p>
                )}
                {workspaceStage && (
                  <p className="text-amber-800">
                    <span className="font-medium">Current Stage:</span> {workspaceStage}
                  </p>
                )}
                <p className="text-amber-700 text-xs">
                  This override will be logged with your identity, timestamp, and reason.
                </p>
              </div>
            </div>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Override Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this override is necessary (min 10 characters)..."
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={reason.trim().length < 10 && reason.length > 0 ? "text-red-500" : ""}>
                {reason.trim().length < 10 && reason.length > 0
                  ? `${10 - reason.trim().length} more characters required`
                  : "Minimum 10 characters"}
              </span>
              <span>{reason.length}/500</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? "Processing..." : "Override & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
