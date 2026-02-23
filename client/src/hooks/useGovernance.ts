/*
 * useGovernance — React hooks for governance enforcement across all pages
 * Provides gate checking, override dialogs, audit logging, and AI restriction checks
 */

import { useState, useCallback } from "react";
import {
  evaluateGate,
  createOverride,
  isAIActionAllowed,
  validateStageTransition,
  logWriteAction,
  logApprovalDecision,
  policyGateConfigs,
  governanceAuditLog,
  type GateEvaluation,
  type PolicyGateConfig,
} from "@/lib/governance";
import type { UserRole, WorkspaceStage } from "@/lib/store";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth-state";

// Dynamic current user from auth state
function getAuthUser() {
  const u = getCurrentUser();
  return { id: u.id, name: u.name, role: u.role as UserRole };
}
// Legacy export for backward compatibility
export const currentUser = new Proxy({} as { id: string; name: string; role: UserRole }, {
  get: (_target, prop) => {
    const u = getAuthUser();
    return (u as any)[prop];
  },
});

// ============================================================
// useGateCheck — Check a policy gate before an action
// ============================================================
export function useGateCheck() {
  const [lastEvaluation, setLastEvaluation] = useState<GateEvaluation | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const checkGate = useCallback((
    gateId: string,
    context: {
      entityType: string;
      entityId: string;
      workspaceId: string;
      details: string;
      contextData?: Record<string, unknown>;
    },
    onPass: () => void,
    onBlock?: () => void,
  ) => {
    const gate = policyGateConfigs.find(g => g.id === gateId);
    if (!gate) {
      toast.error("Policy gate not found");
      return;
    }

    const evaluation = evaluateGate(gate, {
      ...context,
      userId: getAuthUser().id,
      userName: getAuthUser().name,
      contextData: context.contextData || {},
    });

    setLastEvaluation(evaluation);

    switch (evaluation.result) {
      case "passed":
      case "skipped_off":
        onPass();
        break;
      case "warned":
        toast.warning(`⚠️ ${gate.name}: ${context.details}`, {
          description: "Action allowed but logged. Review recommended.",
          duration: 5000,
        });
        onPass(); // Warn allows the action
        break;
      case "blocked":
        if (gate.overridable) {
          toast.error(`🚫 ${gate.name}: Action blocked`, {
            description: "You can request an override with a reason.",
            duration: 5000,
          });
          setPendingAction(() => onPass);
          setShowOverrideDialog(true);
        } else {
          toast.error(`🔒 ${gate.name}: Action permanently blocked`, {
            description: "This gate cannot be overridden. Contact admin.",
            duration: 5000,
          });
          onBlock?.();
        }
        break;
    }
  }, []);

  const executeOverride = useCallback((reason: string) => {
    if (!lastEvaluation) return;

    const gate = policyGateConfigs.find(g => g.id === lastEvaluation.gateId);
    if (!gate) return;

    const result = createOverride(
      lastEvaluation,
      gate,
      getAuthUser(),
      reason
    );

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Override approved — action proceeding", {
      description: `Reason logged: "${reason}"`,
      duration: 4000,
    });

    setShowOverrideDialog(false);
    pendingAction?.();
    setPendingAction(null);
  }, [lastEvaluation, pendingAction]);

  const cancelOverride = useCallback(() => {
    setShowOverrideDialog(false);
    setPendingAction(null);
  }, []);

  return {
    checkGate,
    lastEvaluation,
    showOverrideDialog,
    executeOverride,
    cancelOverride,
  };
}

// ============================================================
// useAuditLog — Log actions to the governance audit stream
// ============================================================
export function useAuditLog() {
  const logAction = useCallback((
    entityType: string,
    entityId: string,
    action: string,
    details: string,
    metadata: Record<string, unknown> = {}
  ) => {
    logWriteAction(entityType, entityId, action, getAuthUser().id, getAuthUser().name, details, metadata);
  }, []);

  const logApproval = useCallback((
    entityType: string,
    entityId: string,
    decision: string,
    details: string,
    metadata: Record<string, unknown> = {}
  ) => {
    logApprovalDecision(entityType, entityId, decision, getAuthUser().id, getAuthUser().name, details, metadata);
  }, []);

  return { logAction, logApproval, auditLog: governanceAuditLog };
}

// ============================================================
// useAIRestriction — Check if AI action is allowed
// ============================================================
export function useAIRestriction() {
  const checkAI = useCallback((action: string): boolean => {
    const result = isAIActionAllowed(action);
    if (!result.allowed) {
      toast.error("AI Action Blocked", {
        description: result.reason,
        duration: 4000,
      });
    }
    return result.allowed;
  }, []);

  return { checkAI };
}

// ============================================================
// useStageControl — Validate workspace stage transitions
// ============================================================
export function useStageControl() {
  const validateTransition = useCallback((
    currentStage: WorkspaceStage,
    targetStage: WorkspaceStage,
    workspaceId: string
  ): boolean => {
    const result = validateStageTransition({
      workspaceId,
      fromStage: currentStage,
      toStage: targetStage,
      requestedBy: getAuthUser().name,
      requestedByRole: getAuthUser().role,
      reason: `Stage transition requested: ${currentStage} → ${targetStage}`,
    });
    if (!result.allowed) {
      toast.error("Stage Transition Blocked", {
        description: result.reason,
        duration: 4000,
      });
    }
    return result.allowed;
  }, []);

  return { validateTransition };
}
