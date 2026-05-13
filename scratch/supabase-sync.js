"use strict";
/**
 * Supabase Sync Layer
 *
 * Fires after in-memory mutations succeed in the engine files
 * (stage-transition.ts, tender-engine.ts, etc.) to persist changes
 * to Supabase. This keeps the existing business logic intact while
 * ensuring all data is durably stored.
 *
 * Pattern: engine mutates in-memory → sync layer persists to DB
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWorkspaceStage = syncWorkspaceStage;
exports.syncWorkspaceUpdate = syncWorkspaceUpdate;
exports.syncCustomerUpdate = syncCustomerUpdate;
exports.syncCustomerCreate = syncCustomerCreate;
exports.syncTenderCreate = syncTenderCreate;
exports.syncTenderUpdate = syncTenderUpdate;
exports.syncAuditEntry = syncAuditEntry;
exports.syncApprovalCreate = syncApprovalCreate;
exports.syncQuoteCreate = syncQuoteCreate;
exports.syncQuoteUpdate = syncQuoteUpdate;
exports.syncProposalCreate = syncProposalCreate;
exports.syncProposalUpdate = syncProposalUpdate;
exports.syncSignalCreate = syncSignalCreate;
exports.syncHandoverTaskCreate = syncHandoverTaskCreate;
exports.syncHandoverTaskUpdate = syncHandoverTaskUpdate;
exports.syncPolicyGateUpdate = syncPolicyGateUpdate;
exports.syncCRMSyncEvent = syncCRMSyncEvent;
exports.syncDocInstanceCreate = syncDocInstanceCreate;
exports.syncDocInstanceUpdate = syncDocInstanceUpdate;
exports.syncDocInstanceVersionCreate = syncDocInstanceVersionCreate;
exports.syncCompiledDocCreate = syncCompiledDocCreate;
exports.syncVaultAssetCreate = syncVaultAssetCreate;
exports.syncDocInstanceDelete = syncDocInstanceDelete;
var auth_state_1 = require("./auth-state");
var supabase_1 = require("./supabase");
var supabase_error_1 = require("./supabase-error");
var optimistic_lock_1 = require("./optimistic-lock");
// ============================================================
// WORKSPACE SYNC
// ============================================================
function syncWorkspaceStage(workspaceId_1, stage_1) {
    return __awaiter(this, arguments, void 0, function (workspaceId, stage, daysInStage) {
        var error;
        if (daysInStage === void 0) { daysInStage = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase_1.supabase
                        .from("workspaces")
                        .update({ stage: stage, days_in_stage: daysInStage, updated_at: new Date().toISOString() })
                        .eq("id", workspaceId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncWorkspaceStage', error, { entityId: workspaceId });
                    return [2 /*return*/];
            }
        });
    });
}
function syncWorkspaceUpdate(workspaceId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row, mapping, _i, _a, _b, key, val, dbKey;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    row = { updated_at: new Date().toISOString() };
                    mapping = {
                        stage: "stage",
                        daysInStage: "days_in_stage",
                        ragStatus: "rag_status",
                        approvalState: "approval_state",
                        notes: "notes",
                        estimatedValue: "estimated_value",
                        palletVolume: "pallet_volume",
                        gpPercent: "gp_percent",
                        owner: "owner",
                        region: "region",
                        title: "title",
                        tenderStage: "tender_stage",
                        probabilityPercent: "probability_percent",
                        wonLostReason: "won_lost_reason",
                        convertedToWorkspaceId: "converted_to_workspace_id",
                    };
                    for (_i = 0, _a = Object.entries(updates); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], val = _b[1];
                        dbKey = mapping[key] || key;
                        row[dbKey] = val;
                    }
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("workspaces", workspaceId, row, 'syncWorkspaceUpdate')];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// CUSTOMER SYNC
// ============================================================
function syncCustomerUpdate(customerId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row, mapping, _i, _a, _b, key, val, dbKey;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    row = { updated_at: new Date().toISOString() };
                    mapping = {
                        name: "name",
                        code: "code",
                        group: "group",
                        status: "status",
                        city: "city",
                        region: "region",
                        industry: "industry",
                        accountOwner: "account_owner",
                        serviceType: "service_type",
                        grade: "grade",
                        facility: "facility",
                        contractExpiry: "contract_expiry",
                        contractValue2025: "contract_value_2025",
                        expectedMonthlyRevenue: "expected_monthly_revenue",
                        dso: "dso",
                        paymentStatus: "payment_status",
                        contactName: "contact_name",
                        contactEmail: "contact_email",
                        contactPhone: "contact_phone",
                    };
                    for (_i = 0, _a = Object.entries(updates); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], val = _b[1];
                        dbKey = mapping[key] || key;
                        row[dbKey] = val;
                    }
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("customers", customerId, row, 'syncCustomerUpdate')];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function syncCustomerCreate(customer) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: customer.id,
                        code: customer.code || "",
                        name: customer.name,
                        group: customer.group || "",
                        status: customer.status || "Active",
                        city: customer.city || "",
                        region: customer.region || "East",
                        industry: customer.industry || "",
                        account_owner: customer.accountOwner || "",
                        service_type: customer.serviceType || "Warehousing",
                        grade: customer.grade || "TBA",
                        facility: customer.facility || "",
                        contract_expiry: customer.contractExpiry || "",
                        contract_value_2025: customer.contractValue2025 || 0,
                        expected_monthly_revenue: customer.expectedMonthlyRevenue || 0,
                        dso: customer.dso || 0,
                        payment_status: customer.paymentStatus || "Current",
                        contact_name: customer.contactName || "",
                        contact_email: customer.contactEmail || "",
                        contact_phone: customer.contactPhone || "",
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("customers").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncCustomerCreate', error, { entityId: customer.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// TENDER SYNC
// ============================================================
function syncTenderCreate(tender) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: tender.id,
                        reference: tender.id.toString().toUpperCase(),
                        title: tender.title || "",
                        customer_id: tender.customerId || "",
                        customer_name: tender.customerName || "",
                        region: tender.region || "East",
                        phase: tender.status || "identified",
                        submission_deadline: tender.submissionDeadline || null,
                        estimated_value: tender.estimatedValue || 0,
                        owner: tender.assignedOwner || "",
                        notes: tender.notes || "",
                        workspace_id: tender.linkedWorkspaceId || null,
                        target_gp_percent: tender.targetGpPercent || 0,
                        probability_percent: tender.probabilityPercent || 0,
                        assigned_team_members: JSON.stringify(tender.assignedTeamMembers || []),
                        source: tender.source || "Direct",
                        days_in_status: tender.daysInStatus || 0,
                        crm_synced: tender.crmSynced || false,
                        created_at: tender.createdAt || new Date().toISOString().slice(0, 10),
                        updated_at: new Date().toISOString().slice(0, 10),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("tenders").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncTenderCreate', error, { entityId: tender.id });
                    return [2 /*return*/];
            }
        });
    });
}
function syncTenderUpdate(tenderId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row, mapping, _i, _a, _b, key, val, dbKey;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    row = { updated_at: new Date().toISOString().slice(0, 10) };
                    mapping = {
                        status: "phase",
                        daysInStatus: "days_in_status",
                        notes: "notes",
                        probabilityPercent: "probability_percent",
                        wonLostReason: "notes",
                        assignedOwner: "owner",
                        estimatedValue: "estimated_value",
                        targetGpPercent: "target_gp_percent",
                        submissionDeadline: "submission_deadline",
                        linkedWorkspaceId: "workspace_id",
                        source: "source",
                        region: "region",
                    };
                    for (_i = 0, _a = Object.entries(updates); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], val = _b[1];
                        dbKey = mapping[key] || key;
                        row[dbKey] = val;
                    }
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("tenders", tenderId, row, 'syncTenderUpdate')];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// AUDIT LOG SYNC
// ============================================================
function syncAuditEntry(entry) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: entry.id,
                        entity_type: entry.entityType,
                        entity_id: entry.entityId,
                        action: entry.action,
                        user_id: entry.userId || (0, auth_state_1.getCurrentUser)().id,
                        user_name: entry.userName || (0, auth_state_1.getCurrentUser)().name,
                        timestamp: entry.timestamp || new Date().toISOString(),
                        details: entry.details || "",
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("audit_log").upsert(row, { onConflict: 'id', ignoreDuplicates: true })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncAuditEntry', error, { entityId: entry.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// APPROVAL RECORD SYNC
// ============================================================
function syncApprovalCreate(record) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: record.id,
                        entity_type: record.entityType,
                        entity_id: record.entityId,
                        workspace_id: record.workspaceId,
                        approver_role: record.approverRole,
                        approver_name: record.approverName,
                        decision: record.decision,
                        reason: record.reason || "",
                        timestamp: record.timestamp || new Date().toISOString(),
                        is_override: record.isOverride || false,
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("approval_records").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncApprovalCreate', error, { entityId: record.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// QUOTE SYNC
// ============================================================
function syncQuoteCreate(quote) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: quote.id,
                        workspace_id: quote.workspaceId,
                        version: quote.version,
                        state: quote.state,
                        storage_rate: quote.storageRate,
                        inbound_rate: quote.inboundRate,
                        outbound_rate: quote.outboundRate,
                        pallet_volume: quote.palletVolume,
                        monthly_revenue: quote.monthlyRevenue,
                        annual_revenue: quote.annualRevenue,
                        total_cost: quote.totalCost,
                        gp_percent: quote.gpPercent,
                        gp_amount: quote.gpAmount,
                        created_at: quote.createdAt || new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("quotes").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncQuoteCreate', error, { entityId: quote.id });
                    return [2 /*return*/];
            }
        });
    });
}
function syncQuoteUpdate(quoteId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row, mapping, _i, _a, _b, key, val, dbKey;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    row = {};
                    mapping = {
                        state: "state",
                        storageRate: "storage_rate",
                        inboundRate: "inbound_rate",
                        outboundRate: "outbound_rate",
                        palletVolume: "pallet_volume",
                        monthlyRevenue: "monthly_revenue",
                        annualRevenue: "annual_revenue",
                        totalCost: "total_cost",
                        gpPercent: "gp_percent",
                        gpAmount: "gp_amount",
                    };
                    for (_i = 0, _a = Object.entries(updates); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], val = _b[1];
                        dbKey = mapping[key] || key;
                        row[dbKey] = val;
                    }
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("quotes", quoteId, row, 'syncQuoteUpdate')];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// PROPOSAL SYNC
// ============================================================
function syncProposalCreate(proposal) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: proposal.id,
                        workspace_id: proposal.workspaceId,
                        version: proposal.version,
                        state: proposal.state,
                        title: proposal.title,
                        sections: JSON.stringify(proposal.sections || []),
                        created_at: proposal.createdAt || new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("proposals").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncProposalCreate', error, { entityId: proposal.id });
                    return [2 /*return*/];
            }
        });
    });
}
function syncProposalUpdate(proposalId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {};
                    if (updates.state !== undefined)
                        row.state = updates.state;
                    if (updates.title !== undefined)
                        row.title = updates.title;
                    if (updates.sections !== undefined)
                        row.sections = JSON.stringify(updates.sections);
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("proposals", proposalId, row, 'syncProposalUpdate')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// SIGNAL SYNC
// ============================================================
function syncSignalCreate(signal) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: signal.id,
                        workspace_id: signal.workspaceId,
                        type: signal.type,
                        severity: signal.severity,
                        message: signal.message,
                        created_at: signal.createdAt || new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("signals").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncSignalCreate', error, { entityId: signal.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// HANDOVER TASK SYNC
// ============================================================
function syncHandoverTaskCreate(task) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: task.id,
                        workspace_id: task.workspaceId,
                        department: task.department,
                        task: task.task,
                        status: task.status,
                        assigned_to: task.assignedTo || "",
                        due_date: task.dueDate || "",
                        created_at: new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("handover_tasks").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncHandoverTaskCreate', error, { entityId: task.id });
                    return [2 /*return*/];
            }
        });
    });
}
function syncHandoverTaskUpdate(taskId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {};
                    if (updates.status !== undefined)
                        row.status = updates.status;
                    if (updates.assignedTo !== undefined)
                        row.assigned_to = updates.assignedTo;
                    if (updates.dueDate !== undefined)
                        row.due_date = updates.dueDate;
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("handover_tasks", taskId, row, 'syncHandoverTaskUpdate')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// POLICY GATE SYNC
// ============================================================
function syncPolicyGateUpdate(gateId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {};
                    if (updates.mode !== undefined)
                        row.mode = updates.mode;
                    if (updates.overridable !== undefined)
                        row.overridable = updates.overridable;
                    if (updates.name !== undefined)
                        row.name = updates.name;
                    if (updates.description !== undefined)
                        row.description = updates.description;
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("policy_gates", gateId, row, 'syncPolicyGateUpdate')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// CRM SYNC EVENT
// ============================================================
function syncCRMSyncEvent(event) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: event.id,
                        direction: event.direction,
                        entity: event.entity,
                        zoho_id: event.zohoId || "",
                        status: event.status,
                        timestamp: event.timestamp || new Date().toISOString(),
                        details: event.details || "",
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("crm_sync_events").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncCRMSyncEvent', error, { entityId: event.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// DOCUMENT INSTANCE SYNC
// ============================================================
function syncDocInstanceCreate(instance) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: instance.id,
                        doc_type: instance.doc_type,
                        template_version_id: instance.template_version_id || null,
                        status: instance.status || 'draft',
                        linked_entity_type: instance.linked_entity_type || null,
                        linked_entity_id: instance.linked_entity_id || null,
                        customer_id: instance.customer_id || null,
                        customer_name: instance.customer_name || null,
                        workspace_id: instance.workspace_id || null,
                        workspace_name: instance.workspace_name || null,
                        current_version_id: instance.current_version_id || null,
                        title: instance.title || instance.doc_type,
                        branding_profile_id: instance.branding_profile_id || null,
                        is_compiled: instance.is_compiled || false,
                        compiled_at: instance.compiled_at || null,
                        created_by: instance.created_by || (0, auth_state_1.getCurrentUser)().name,
                        created_at: instance.created_at || new Date().toISOString(),
                        updated_at: instance.updated_at || new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("doc_instances").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncDocInstanceCreate', error, { entityId: instance.id });
                    return [2 /*return*/];
            }
        });
    });
}
function syncDocInstanceUpdate(instanceId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var row, mapping, _i, _a, _b, key, val, dbKey;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    row = { updated_at: new Date().toISOString() };
                    mapping = {
                        status: "status",
                        title: "title",
                        current_version_id: "current_version_id",
                        branding_profile_id: "branding_profile_id",
                        is_compiled: "is_compiled",
                        compiled_at: "compiled_at",
                    };
                    for (_i = 0, _a = Object.entries(updates); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], val = _b[1];
                        dbKey = mapping[key] || key;
                        row[dbKey] = val;
                    }
                    return [4 /*yield*/, (0, optimistic_lock_1.optimisticSyncUpdate)("doc_instances", instanceId, row, 'syncDocInstanceUpdate')];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// DOCUMENT INSTANCE VERSION SYNC
// ============================================================
function syncDocInstanceVersionCreate(version) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: version.id,
                        doc_instance_id: version.doc_instance_id,
                        version_number: version.version_number || 1,
                        blocks: JSON.stringify(version.blocks || []),
                        bindings: JSON.stringify(version.bindings || {}),
                        created_by: version.created_by || (0, auth_state_1.getCurrentUser)().name,
                        created_at: version.created_at || new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("doc_instance_versions").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncDocInstanceVersionCreate', error, { entityId: version.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// COMPILED DOCUMENT SYNC
// ============================================================
function syncCompiledDocCreate(doc) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: doc.id,
                        doc_instance_id: doc.doc_instance_id || null,
                        doc_instance_version_id: doc.doc_instance_version_id || null,
                        title: doc.title || "",
                        doc_type: doc.doc_type || "",
                        customer_id: doc.customer_id || null,
                        customer_name: doc.customer_name || null,
                        workspace_id: doc.workspace_id || null,
                        compiled_html: doc.compiled_html || "",
                        compiled_by: doc.compiled_by || (0, auth_state_1.getCurrentUser)().name,
                        compiled_at: doc.compiled_at || new Date().toISOString(),
                        status: doc.status || "final",
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("compiled_documents").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncCompiledDocCreate', error, { entityId: doc.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// VAULT ASSET SYNC
// ============================================================
function syncVaultAssetCreate(asset) {
    return __awaiter(this, void 0, void 0, function () {
        var row, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    row = {
                        id: asset.id,
                        doc_instance_id: asset.doc_instance_id || null,
                        doc_instance_version_id: asset.doc_instance_version_id || null,
                        compiled_document_id: asset.compiled_document_id || null,
                        title: asset.title || "",
                        doc_type: asset.doc_type || "",
                        customer_id: asset.customer_id || null,
                        customer_name: asset.customer_name || null,
                        workspace_id: asset.workspace_id || null,
                        status: asset.status || "final",
                        created_by: asset.created_by || (0, auth_state_1.getCurrentUser)().name,
                        created_at: asset.created_at || new Date().toISOString(),
                    };
                    return [4 /*yield*/, supabase_1.supabase.from("vault_assets").upsert(row, { onConflict: 'id' })];
                case 1:
                    error = (_a.sent()).error;
                    if (error)
                        (0, supabase_error_1.handleSupabaseError)('syncVaultAssetCreate', error, { entityId: asset.id });
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================
// DOC INSTANCE DELETE
// ============================================================
function syncDocInstanceDelete(instanceId) {
    return __awaiter(this, void 0, void 0, function () {
        var vError, cError, error, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, supabase_1.supabase
                            .from("doc_instance_versions")
                            .delete()
                            .eq("doc_instance_id", instanceId)];
                case 1:
                    vError = (_a.sent()).error;
                    if (vError)
                        (0, supabase_error_1.handleSupabaseError)('syncDocInstanceDelete:versions', vError, { entityId: instanceId });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("compiled_documents")
                            .delete()
                            .eq("doc_instance_id", instanceId)];
                case 2:
                    cError = (_a.sent()).error;
                    if (cError)
                        (0, supabase_error_1.handleSupabaseError)('syncDocInstanceDelete:compiled', cError, { entityId: instanceId });
                    return [4 /*yield*/, supabase_1.supabase
                            .from("doc_instances")
                            .delete()
                            .eq("id", instanceId)];
                case 3:
                    error = (_a.sent()).error;
                    if (error) {
                        (0, supabase_error_1.handleSupabaseError)('syncDocInstanceDelete', error, { entityId: instanceId });
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, true];
                case 4:
                    err_1 = _a.sent();
                    console.warn('[supabase-sync] syncDocInstanceDelete fallback:', err_1);
                    return [2 /*return*/, false];
                case 5: return [2 /*return*/];
            }
        });
    });
}
