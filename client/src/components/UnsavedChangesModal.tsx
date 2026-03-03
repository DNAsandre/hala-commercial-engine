/**
 * UnsavedChangesModal — P0 Hotfix
 * 
 * Shows a modal when the user tries to navigate away with unsaved changes.
 * Three options: Save & Leave (default), Leave Without Saving, Cancel.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save, LogOut, X } from "lucide-react";

interface UnsavedChangesModalProps {
  open: boolean;
  saving?: boolean;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onCancel: () => void;
}

export default function UnsavedChangesModal({
  open, saving = false, onSaveAndLeave, onLeaveWithoutSaving, onCancel,
}: UnsavedChangesModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle size={20} />
            Unsaved Changes
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 pt-2">
            You have unsaved changes in this document. What would you like to do?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={onSaveAndLeave}
            disabled={saving}
            className="w-full bg-[#1B2A4A] hover:bg-[#2A3F6A] text-white"
          >
            <Save size={14} className="mr-2" />
            {saving ? "Saving…" : "Save & Leave"}
          </Button>
          <Button
            variant="outline"
            onClick={onLeaveWithoutSaving}
            disabled={saving}
            className="w-full text-red-600 border-red-200 hover:bg-red-50"
          >
            <LogOut size={14} className="mr-2" />
            Leave Without Saving
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            className="w-full"
          >
            <X size={14} className="mr-2" />
            Cancel
          </Button>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
