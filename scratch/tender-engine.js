"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenderStageHistory = exports.tenderGovernanceOverrides = exports.tenders = exports.TENDER_SOFT_TRANSITIONS = exports.TENDER_TERMINAL = exports.TENDER_KANBAN_COLUMNS = exports.TENDER_MILESTONE_ORDER = void 0;
exports.getMilestoneIndex = getMilestoneIndex;
exports.getSuggestedNextMilestones = getSuggestedNextMilestones;
exports.getPrimaryNextMilestone = getPrimaryNextMilestone;
exports.getTenderStatusDisplayName = getTenderStatusDisplayName;
exports.getTenderMilestoneShortLabel = getTenderMilestoneShortLabel;
exports.getTenderStatusColor = getTenderStatusColor;
exports.getMarginSignal = getMarginSignal;
exports.getTimeRisk = getTimeRisk;
exports.getStateSignal = getStateSignal;
exports.moveTenderMilestone = moveTenderMilestone;
exports.advanceTenderStatus = advanceTenderStatus;
exports.preflightTenderValidation = preflightTenderValidation;
exports.checkTenderUndoEligibility = checkTenderUndoEligibility;
exports.revertTenderStatus = revertTenderStatus;
exports.hasTenderUndoRecord = hasTenderUndoRecord;
exports.getTenderStageHistory = getTenderStageHistory;
exports.getNextTenderStatus = getNextTenderStatus;
exports.getTenderStatusIndex = getTenderStatusIndex;
exports.registerTenderRule = registerTenderRule;
exports.getRegisteredTenderRules = getRegisteredTenderRules;
exports.getTenderMetrics = getTenderMetrics;
exports.createTender = createTender;
exports.getTenderById = getTenderById;
exports.getTendersByWorkspace = getTendersByWorkspace;
exports.getTendersByCustomer = getTendersByCustomer;
var auth_state_1 = require("./auth-state");
/*
 * Tender Engine — Commercial Lifecycle Engine
 *
 * Redesigned for decision-first, human-controlled stage management.
 * No blocking, no governance enforcement, no typing confirmations.
 * Movement is instant. System logs but never blocks.
 *
 * 10-Stage Lifecycle:
 *   Identified → Preparing Submission → Submitted → Clarification →
 *   Technical Review → Commercial Review → Negotiation → Awarded / Lost / Withdrawn
 */
var store_1 = require("./store");
var supabase_sync_1 = require("./supabase-sync");
exports.TENDER_MILESTONE_ORDER = [
    "identified",
    "preparing_submission",
    "submitted",
    "clarification",
    "technical_review",
    "commercial_review",
    "negotiation",
    "awarded",
];
// Active (non-terminal) milestones — shown in kanban and filters
exports.TENDER_KANBAN_COLUMNS = [
    "identified",
    "preparing_submission",
    "submitted",
    "clarification",
    "technical_review",
    "commercial_review",
    "negotiation",
    "awarded",
    "lost",
    "withdrawn",
];
// Terminal milestones
exports.TENDER_TERMINAL = ["awarded", "lost", "withdrawn"];
// Recommended (soft) transitions — guidance only, never enforced
exports.TENDER_SOFT_TRANSITIONS = {
    identified: ["preparing_submission"],
    preparing_submission: ["submitted"],
    submitted: ["clarification", "technical_review", "commercial_review"],
    clarification: ["technical_review", "commercial_review", "negotiation"],
    technical_review: ["commercial_review", "negotiation"],
    commercial_review: ["negotiation"],
    negotiation: ["awarded", "lost"],
    awarded: [],
    lost: [],
    withdrawn: [],
};
function getMilestoneIndex(milestone) {
    return exports.TENDER_MILESTONE_ORDER.indexOf(milestone);
}
function getSuggestedNextMilestones(current) {
    var _a;
    return (_a = exports.TENDER_SOFT_TRANSITIONS[current]) !== null && _a !== void 0 ? _a : [];
}
function getPrimaryNextMilestone(current) {
    var _a;
    var suggestions = getSuggestedNextMilestones(current);
    return (_a = suggestions[0]) !== null && _a !== void 0 ? _a : null;
}
function getTenderStatusDisplayName(status) {
    var _a;
    var labels = {
        identified: "Identified",
        preparing_submission: "Preparing Submission",
        submitted: "Submitted",
        clarification: "Clarification",
        technical_review: "Technical Review",
        commercial_review: "Commercial Review",
        negotiation: "Negotiation",
        awarded: "Awarded",
        lost: "Lost",
        withdrawn: "Withdrawn",
    };
    return (_a = labels[status]) !== null && _a !== void 0 ? _a : status;
}
// Short labels for the milestone strip
function getTenderMilestoneShortLabel(status) {
    var _a;
    var labels = {
        identified: "Identified",
        preparing_submission: "Preparing",
        submitted: "Submitted",
        clarification: "Clarification",
        technical_review: "Tech Review",
        commercial_review: "Commercial",
        negotiation: "Negotiation",
        awarded: "Awarded",
        lost: "Lost",
        withdrawn: "Withdrawn",
    };
    return (_a = labels[status]) !== null && _a !== void 0 ? _a : status;
}
function getTenderStatusColor(status) {
    var _a;
    var colors = {
        identified: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        preparing_submission: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        submitted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
        clarification: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        technical_review: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
        commercial_review: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
        negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        awarded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        withdrawn: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    };
    return (_a = colors[status]) !== null && _a !== void 0 ? _a : "";
}
// Margin signal interpretation
function getMarginSignal(gpPercent) {
    if (gpPercent >= 25)
        return { label: "Healthy", color: "green" };
    if (gpPercent >= 20)
        return { label: "Tight", color: "amber" };
    return { label: "Risk", color: "red" };
}
// Time risk interpretation
function getTimeRisk(deadlineStr) {
    var days = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0)
        return { label: "Overdue", color: "red" };
    if (days <= 7)
        return { label: "Due in ".concat(days, "d"), color: "red" };
    if (days <= 21)
        return { label: "Due in ".concat(days, "d"), color: "amber" };
    return { label: "On Track", color: "green" };
}
// State signal — what does the current milestone imply?
function getStateSignal(status, daysInStatus) {
    var _a;
    var signals = {
        identified: "Needs qualification",
        preparing_submission: "Submission in progress",
        submitted: "Awaiting customer response",
        clarification: "Clarification round active",
        technical_review: "Technical evaluation underway",
        commercial_review: "Commercial evaluation underway",
        negotiation: "In active negotiation",
        awarded: "Contract awarded",
        lost: "Tender not awarded",
        withdrawn: "Tender withdrawn",
    };
    var base = (_a = signals[status]) !== null && _a !== void 0 ? _a : status;
    if (daysInStatus > 21 && !exports.TENDER_TERMINAL.includes(status)) {
        return "".concat(base, " \u2014 stalled ").concat(daysInStatus, "d");
    }
    return base;
}
// ─── MOCK DATA ─────────────────────────────────────────────
var tenderIdCounter = 10;
exports.tenders = [
    {
        id: "tn-001",
        linkedWorkspaceId: "w1",
        customerId: "c2",
        customerName: "Ma'aden",
        title: "Ma'aden Jubail Expansion — Logistics RFP",
        submissionDeadline: "2026-05-20",
        estimatedValue: 3400000,
        targetGpPercent: 22,
        probabilityPercent: 60,
        assignedOwner: "Ra'ed",
        assignedTeamMembers: ["Ra'ed", "Yazan", "Finance"],
        status: "preparing_submission",
        source: "CRM",
        region: "East",
        createdAt: "2026-01-15",
        updatedAt: "2026-02-14",
        daysInStatus: 8,
        notes: "Linked to workspace w1. Technical draft in progress.",
        crmSynced: false,
    },
    {
        id: "tn-002",
        linkedWorkspaceId: null,
        customerId: "c1",
        customerName: "SABIC",
        title: "SABIC National Warehousing Services Tender",
        submissionDeadline: "2026-06-01",
        estimatedValue: 15000000,
        targetGpPercent: 25,
        probabilityPercent: 45,
        assignedOwner: "Ra'ed",
        assignedTeamMembers: ["Ra'ed", "Albert", "Yazan", "Finance", "Legal"],
        status: "identified",
        source: "Direct",
        region: "East",
        createdAt: "2026-02-01",
        updatedAt: "2026-02-15",
        daysInStatus: 14,
        notes: "Large strategic tender. Committee formation pending.",
        crmSynced: false,
    },
    {
        id: "tn-003",
        linkedWorkspaceId: "w6",
        customerId: "c1",
        customerName: "Aramco Services",
        title: "Aramco Dhahran VAS Expansion Tender",
        submissionDeadline: "2026-04-30",
        estimatedValue: 12000000,
        targetGpPercent: 28,
        probabilityPercent: 75,
        assignedOwner: "Ra'ed",
        assignedTeamMembers: ["Ra'ed", "Hano", "Finance"],
        status: "submitted",
        source: "CRM",
        region: "East",
        createdAt: "2025-12-20",
        updatedAt: "2026-02-10",
        daysInStatus: 5,
        notes: "Submitted on time. Awaiting evaluation committee review.",
        crmSynced: false,
    },
    {
        id: "tn-004",
        linkedWorkspaceId: "w5",
        customerId: "c3",
        customerName: "Almarai",
        title: "Almarai Riyadh Phase 2 — Cold Chain Tender",
        submissionDeadline: "2026-04-15",
        estimatedValue: 8500000,
        targetGpPercent: 30,
        probabilityPercent: 70,
        assignedOwner: "Hano",
        assignedTeamMembers: ["Hano", "Yazan", "Finance"],
        status: "commercial_review",
        source: "CRM",
        region: "Central",
        createdAt: "2026-01-20",
        updatedAt: "2026-02-16",
        daysInStatus: 5,
        notes: "High-value strategic account. Technical analysis complete.",
        crmSynced: false,
    },
    {
        id: "tn-005",
        linkedWorkspaceId: null,
        customerId: "c8",
        customerName: "Nestlé KSA",
        title: "Nestlé Jeddah Cold Chain Partnership",
        submissionDeadline: "2026-05-01",
        estimatedValue: 6200000,
        targetGpPercent: 26,
        probabilityPercent: 55,
        assignedOwner: "Hano",
        assignedTeamMembers: ["Hano", "Albert"],
        status: "technical_review",
        source: "Referral",
        region: "West",
        createdAt: "2025-11-15",
        updatedAt: "2026-02-12",
        daysInStatus: 12,
        notes: "Evaluation ongoing. Shortlisted with 2 competitors.",
        crmSynced: false,
    },
    {
        id: "tn-006",
        linkedWorkspaceId: "w2",
        customerId: "c4",
        customerName: "Sadara Chemical",
        title: "Sadara Contract Renewal Tender 2025",
        submissionDeadline: "2026-05-28",
        estimatedValue: 2800000,
        targetGpPercent: 24,
        probabilityPercent: 85,
        assignedOwner: "Albert",
        assignedTeamMembers: ["Albert", "Ra'ed"],
        status: "negotiation",
        source: "CRM",
        region: "East",
        createdAt: "2025-10-15",
        updatedAt: "2026-02-14",
        daysInStatus: 3,
        notes: "Renewal tender. Strong relationship. High probability.",
        crmSynced: false,
    },
    {
        id: "tn-007",
        linkedWorkspaceId: null,
        customerId: "c3",
        customerName: "Almarai",
        title: "Almarai Dammam Distribution Center",
        submissionDeadline: "2025-12-15",
        estimatedValue: 4500000,
        targetGpPercent: 27,
        probabilityPercent: 0,
        assignedOwner: "Hano",
        assignedTeamMembers: ["Hano", "Yazan"],
        status: "awarded",
        source: "Direct",
        region: "East",
        createdAt: "2025-08-01",
        updatedAt: "2025-12-20",
        daysInStatus: 58,
        notes: "Won. Contract signed. Handover initiated.",
        crmSynced: true,
    },
    {
        id: "tn-008",
        linkedWorkspaceId: null,
        customerId: "c6",
        customerName: "Unilever Arabia",
        title: "Unilever Riyadh Expansion RFP",
        submissionDeadline: "2025-11-30",
        estimatedValue: 3200000,
        targetGpPercent: 20,
        probabilityPercent: 0,
        assignedOwner: "Albert",
        assignedTeamMembers: ["Albert"],
        status: "lost",
        source: "CRM",
        region: "Central",
        createdAt: "2025-07-15",
        updatedAt: "2025-12-05",
        daysInStatus: 73,
        notes: "Lost to competitor. Price was 12% higher.",
        crmSynced: true,
    },
    // TND-010: Linde SIGAS — registered here for Pipeline/Board/Dashboard visibility
    {
        id: "tn-linde-001",
        linkedWorkspaceId: null,
        customerId: "c-linde",
        customerName: "Linde SIGAS",
        title: "Linde SIGAS Transportation Tender",
        submissionDeadline: "2026-05-07",
        estimatedValue: 55600000,
        targetGpPercent: 21,
        probabilityPercent: 55,
        assignedOwner: "Amin Al-Halabi",
        assignedTeamMembers: ["Amin Al-Halabi", "Ra'ed", "Finance", "Legal", "Operations"],
        status: "preparing_submission",
        source: "Direct",
        region: "East",
        createdAt: "2026-03-15",
        updatedAt: "2026-04-28",
        daysInStatus: 12,
        notes: "Multi-pack transport tender. Internal master + Bulk + PGP external child packs.",
        crmSynced: false,
    },
];
exports.tenderGovernanceOverrides = [];
exports.tenderStageHistory = [];
var tenderUndoRecords = new Map();
var UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
// ─── ENGINE — FRICTIONLESS MOVEMENT ───────────────────────
/**
 * Move tender milestone instantly. No blocking, no required approvals.
 * Logs the transition. Optionally stores a user note.
 */
function moveTenderMilestone(tenderId, targetMilestone, note) {
    var tender = exports.tenders.find(function (t) { return t.id === tenderId; });
    if (!tender) {
        return {
            success: false,
            message: "Tender not found.",
            nextStatus: null,
            fromStatus: "identified",
            validationErrors: ["Tender ID does not exist."],
        };
    }
    var fromStatus = tender.status;
    if (fromStatus === targetMilestone) {
        return {
            success: false,
            message: "Tender is already at this milestone.",
            nextStatus: null,
            fromStatus: fromStatus,
            validationErrors: [],
        };
    }
    var now = new Date();
    tender.status = targetMilestone;
    tender.daysInStatus = 0;
    tender.updatedAt = now.toISOString().slice(0, 10);
    // Persist to Supabase (best-effort, non-blocking)
    void (0, supabase_sync_1.syncTenderUpdate)(tenderId, { status: targetMilestone, daysInStatus: 0 });
    var successMsg = "Milestone updated to ".concat(getTenderStatusDisplayName(targetMilestone), ".");
    // Audit log
    var entry = {
        id: "al-tn-".concat(crypto.randomUUID()),
        entityType: "tender",
        entityId: tender.id,
        action: "tender_status_advanced",
        userId: (0, auth_state_1.getCurrentUser)().id,
        userName: (0, auth_state_1.getCurrentUser)().name,
        timestamp: now.toISOString(),
        details: "".concat(successMsg, " (from ").concat(getTenderStatusDisplayName(fromStatus), ")").concat(note ? " \u2014 Note: \"".concat(note, "\"") : ""),
    };
    void (0, supabase_sync_1.syncAuditEntry)(entry);
    exports.tenderStageHistory.unshift({
        id: "tsh-".concat(crypto.randomUUID()),
        tenderId: tenderId,
        fromStatus: fromStatus,
        toStatus: targetMilestone,
        action: "advanced",
        userId: (0, auth_state_1.getCurrentUser)().id,
        userName: (0, auth_state_1.getCurrentUser)().name,
        timestamp: now.toISOString(),
        reason: successMsg,
        note: note,
    });
    tenderUndoRecords.set(tenderId, {
        tenderId: tenderId,
        fromStatus: fromStatus,
        toStatus: targetMilestone,
        timestamp: now.getTime(),
        userId: (0, auth_state_1.getCurrentUser)().id,
        userName: (0, auth_state_1.getCurrentUser)().name,
    });
    var suggestion = generateWorkspaceSuggestion(tender, targetMilestone);
    return {
        success: true,
        message: successMsg,
        nextStatus: targetMilestone,
        fromStatus: fromStatus,
        validationErrors: [],
        transitionTimestamp: now.toISOString(),
        workspaceSuggestion: suggestion,
    };
}
// Backward-compat alias
function advanceTenderStatus(tenderId, targetStatus, _options) {
    return moveTenderMilestone(tenderId, targetStatus, _options === null || _options === void 0 ? void 0 : _options.overrideReason);
}
function preflightTenderValidation(_tenderId, _targetStatus) {
    // No blocking validations in this phase
    return [];
}
function generateWorkspaceSuggestion(tender, newStatus) {
    if (!tender.linkedWorkspaceId)
        return null;
    var workspace = store_1.workspaces.find(function (w) { return w.id === tender.linkedWorkspaceId; });
    if (!workspace)
        return null;
    if (newStatus === "awarded") {
        return {
            type: "advance_to_commercial_approved",
            workspaceId: workspace.id,
            workspaceName: workspace.title,
            message: "Tender awarded. Consider advancing workspace \"".concat(workspace.title, "\" to Commercial Approved."),
        };
    }
    if (newStatus === "lost") {
        return {
            type: "mark_closed_lost",
            workspaceId: workspace.id,
            workspaceName: workspace.title,
            message: "Tender lost. Consider marking workspace \"".concat(workspace.title, "\" as Closed \u2013 Lost."),
        };
    }
    return null;
}
function checkTenderUndoEligibility(tenderId) {
    var record = tenderUndoRecords.get(tenderId);
    if (!record) {
        return { eligible: false, reasons: ["No recent transition to undo."], remainingMs: 0, requiresReason: false };
    }
    var elapsed = Date.now() - record.timestamp;
    var remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);
    if (elapsed <= UNDO_WINDOW_MS) {
        return { eligible: true, reasons: [], remainingMs: remaining, requiresReason: false };
    }
    return { eligible: true, reasons: [], remainingMs: 0, requiresReason: false };
}
function revertTenderStatus(tenderId) {
    var record = tenderUndoRecords.get(tenderId);
    if (!record) {
        return { success: false, message: "No transition to undo.", revertedFrom: "identified", revertedTo: "identified" };
    }
    var tender = exports.tenders.find(function (t) { return t.id === tenderId; });
    if (!tender) {
        return { success: false, message: "Tender not found.", revertedFrom: record.toStatus, revertedTo: record.fromStatus };
    }
    var revertedFrom = tender.status;
    tender.status = record.fromStatus;
    tender.daysInStatus = 0;
    tender.updatedAt = new Date().toISOString().slice(0, 10);
    void (0, supabase_sync_1.syncTenderUpdate)(tenderId, { status: record.fromStatus, daysInStatus: 0 });
    var now = new Date();
    var msg = "Milestone reverted from ".concat(getTenderStatusDisplayName(revertedFrom), " to ").concat(getTenderStatusDisplayName(record.fromStatus), ".");
    var entry = {
        id: "al-tn-rv-".concat(crypto.randomUUID()),
        entityType: "tender",
        entityId: tenderId,
        action: "tender_status_reverted",
        userId: (0, auth_state_1.getCurrentUser)().id,
        userName: (0, auth_state_1.getCurrentUser)().name,
        timestamp: now.toISOString(),
        details: msg,
    };
    void (0, supabase_sync_1.syncAuditEntry)(entry);
    exports.tenderStageHistory.unshift({
        id: "tsh-rv-".concat(crypto.randomUUID()),
        tenderId: tenderId,
        fromStatus: revertedFrom,
        toStatus: record.fromStatus,
        action: "reverted",
        userId: (0, auth_state_1.getCurrentUser)().id,
        userName: (0, auth_state_1.getCurrentUser)().name,
        timestamp: now.toISOString(),
        reason: msg,
    });
    tenderUndoRecords.delete(tenderId);
    return { success: true, message: msg, revertedFrom: revertedFrom, revertedTo: record.fromStatus };
}
function hasTenderUndoRecord(tenderId) {
    return tenderUndoRecords.has(tenderId);
}
function getTenderStageHistory(tenderId) {
    return exports.tenderStageHistory.filter(function (h) { return h.tenderId === tenderId; });
}
// Backward-compat shims
function getNextTenderStatus(current) {
    return getPrimaryNextMilestone(current);
}
function getTenderStatusIndex(status) {
    return getMilestoneIndex(status);
}
function registerTenderRule(_rule) {
    // No-op in human-first mode
}
function getRegisteredTenderRules() {
    return [];
}
// ─── METRICS ───────────────────────────────────────────────
function getTenderMetrics(liveTenders) {
    var src = liveTenders !== null && liveTenders !== void 0 ? liveTenders : exports.tenders;
    var open = src.filter(function (t) { return !exports.TENDER_TERMINAL.includes(t.status); });
    var awarded = src.filter(function (t) { return t.status === "awarded"; });
    var lost = src.filter(function (t) { return t.status === "lost"; });
    var decided = awarded.length + lost.length;
    var winRate = decided > 0 ? (awarded.length / decided) * 100 : 0;
    var submitted = src.filter(function (t) {
        return ["submitted", "clarification", "technical_review", "commercial_review", "negotiation", "awarded", "lost"].includes(t.status);
    });
    var avgCycleDays = submitted.length > 0
        ? submitted.reduce(function (sum, t) {
            var created = new Date(t.createdAt);
            var updated = new Date(t.updatedAt);
            return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / submitted.length
        : 0;
    var activePipelineValue = open.reduce(function (sum, t) { return sum + t.estimatedValue; }, 0);
    var weightedPipeline = open.reduce(function (sum, t) { return sum + t.estimatedValue * (t.probabilityPercent / 100); }, 0);
    // Stalled: open tenders with daysInStatus > 14
    var stalled = open.filter(function (t) { return t.daysInStatus > 14; });
    // Risk signals
    var lowMargin = open.filter(function (t) { return t.targetGpPercent < 22; });
    var overdue = open.filter(function (t) {
        if (!t.submissionDeadline)
            return false;
        var days = Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days < 0;
    });
    return {
        totalOpen: open.length,
        totalAwarded: awarded.length,
        totalLost: lost.length,
        winRate: winRate,
        totalWon: awarded.length,
        avgSubmissionCycleDays: Math.round(avgCycleDays),
        activePipelineValue: activePipelineValue,
        weightedPipeline: weightedPipeline,
        stalled: stalled,
        lowMargin: lowMargin,
        overdue: overdue,
        byStatus: exports.TENDER_KANBAN_COLUMNS.map(function (s) { return ({
            status: s,
            count: src.filter(function (t) { return t.status === s; }).length,
            value: src.filter(function (t) { return t.status === s; }).reduce(function (sum, t) { return sum + t.estimatedValue; }, 0),
        }); }),
    };
}
// ─── CRUD ──────────────────────────────────────────────────
function createTender(data) {
    var now = new Date().toISOString().slice(0, 10);
    var tender = __assign(__assign({}, data), { id: "tn-".concat(String(++tenderIdCounter).padStart(3, "0")), createdAt: now, updatedAt: now, daysInStatus: 0 });
    exports.tenders.unshift(tender);
    void (0, supabase_sync_1.syncTenderCreate)(tender);
    var entry = {
        id: "al-tn-cr-".concat(crypto.randomUUID()),
        entityType: "tender",
        entityId: tender.id,
        action: "tender_created",
        userId: (0, auth_state_1.getCurrentUser)().id,
        userName: (0, auth_state_1.getCurrentUser)().name,
        timestamp: new Date().toISOString(),
        details: "Tender \"".concat(tender.title, "\" created for ").concat(tender.customerName, ". Estimated value: ").concat((0, store_1.formatSAR)(tender.estimatedValue), "."),
    };
    void (0, supabase_sync_1.syncAuditEntry)(entry);
    return tender;
}
function getTenderById(id) {
    return exports.tenders.find(function (t) { return t.id === id; });
}
function getTendersByWorkspace(workspaceId) {
    return exports.tenders.filter(function (t) { return t.linkedWorkspaceId === workspaceId; });
}
function getTendersByCustomer(customerId) {
    return exports.tenders.filter(function (t) { return t.customerId === customerId; });
}
