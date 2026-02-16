/*
 * OverrideDialog — Governance "Break Glass" override dialog
 * Used when a policy gate blocks an action and the gate is overridable
 */

import { useState } from "react";
import { AlertTriangle, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface OverrideDialogProps {
  open: boolean;
  gateName: string;
  details: string;
  onOverride: (reason: string) => void;
  onCancel: () => void;
}

export default function OverrideDialog({ open, gateName, details, onOverride, onCancel }: OverrideDialogProps) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-100">
            <Shield className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-900">Policy Gate Override Required</h3>
            <p className="text-xs text-amber-700 mt-0.5">{gateName}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-amber-100">
            <X className="w-4 h-4 text-amber-600" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-800">{details}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Override Reason <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(minimum 10 characters)</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this override is necessary..."
              className="text-sm min-h-[100px] resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              This reason will be permanently logged in the governance audit trail and cannot be deleted.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <p className="text-[10px] text-gray-500">
            Override logged under: <strong>Amin Al-Rashid</strong> (Director)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reason.trim().length < 10}
              onClick={() => { onOverride(reason); setReason(""); }}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Shield className="w-3 h-3 mr-1" /> Execute Override
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
