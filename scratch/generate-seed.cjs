const { getTenderWorkspaceById } = require('./tender.cjs');
const fs = require('fs');

const lindeWorkspace = getTenderWorkspaceById('tn-linde-001');
const lindeRequiredDocuments = lindeWorkspace.requiredDocuments;
const lindeComplianceItems = lindeWorkspace.complianceItems;

let sql = '';

const esc = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return val.toString();
    return `'${val.toString().replace(/'/g, "''")}'`;
};

// 1. Required Documents
sql += `INSERT INTO tender_required_documents (id, document_name, pack_id, pack_name, category, owner, status, native_required, signed_required, stamp_required, native_status, signed_pdf_status, evidence_status, version, included_in_output, would_block_in_production, last_updated, notes) VALUES\n`;
const rdRows = lindeRequiredDocuments.map(rd => `(${esc(rd.id)}, ${esc(rd.documentName)}, ${esc(rd.packId)}, ${esc(rd.packName)}, ${esc(rd.category)}, ${esc(rd.owner)}, ${esc(rd.status)}, ${esc(rd.nativeRequired)}, ${esc(rd.signedPdfRequired)}, ${esc(rd.stampRequired)}, ${esc(rd.nativeStatus)}, ${esc(rd.signedPdfStatus)}, ${esc(rd.evidenceStatus)}, ${esc(rd.version)}, ${esc(rd.includedInOutput)}, ${esc(rd.wouldBlockInProduction)}, ${esc(rd.lastUpdated)}, ${esc(rd.notes)})`);
sql += rdRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';

// 2. Compliance Items
sql += `INSERT INTO tender_compliance_items (id, reference, requirement, pack_id, pack_name, category, status, evidence, owner, risk_level, legal_review_required, commercial_impact, operational_impact, clarification_needed, would_block_in_production, last_updated, notes) VALUES\n`;
const ciRows = lindeComplianceItems.map(ci => `(${esc(ci.id)}, ${esc(ci.reference)}, ${esc(ci.requirement)}, ${esc(ci.packId)}, ${esc(ci.packName)}, ${esc(ci.category)}, ${esc(ci.status)}, ${esc(ci.evidence)}, ${esc(ci.owner)}, ${esc(ci.riskLevel)}, ${esc(ci.legalReviewRequired)}, ${esc(ci.commercialImpact)}, ${esc(ci.operationalImpact)}, ${esc(ci.clarificationNeeded)}, ${esc(ci.wouldBlockInProduction)}, ${esc(ci.lastUpdated)}, ${esc(ci.notes)})`);
sql += ciRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';

// 3. Split Checks (Master -> Bulk/PGP)
const splitChecks = [
    { id: "sc-01", checkName: "Remove PGP content from Bulk output", description: "All PGP-specific sections, pricing, and references must be stripped from the Bulk output pack.", category: "cross_references", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-bulk", status: "would_block", severity: "critical", wouldBlockInProduction: true, mockResolution: "Content filter would run automatically", notes: "" },
    { id: "sc-02", checkName: "Remove internal notes and draft comments", description: "All internal notes, working comments, and draft markers must be removed from the external output.", category: "internal_notes", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-bulk", status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Internal note scanner would run automatically", notes: "" },
    { id: "sc-03", checkName: "Check Bulk placeholders completed", description: "All submission-critical placeholders for the Bulk pack must have values.", category: "placeholders", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-bulk", status: "would_block", severity: "critical", wouldBlockInProduction: true, mockResolution: "Placeholder register feeds this check", notes: "" },
    { id: "sc-04", checkName: "Check Bulk required documents ready", description: "All required documents for the Bulk submission must be uploaded and approved.", category: "required_documents", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-bulk", status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Required documents register feeds this check", notes: "" },
    { id: "sc-05", checkName: "Check compliance gaps resolved", description: "Non-compliant and clarification-required items must be resolved before production output.", category: "compliance", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-bulk", status: "warning", severity: "medium", wouldBlockInProduction: false, mockResolution: "Compliance matrix feeds this check", notes: "" },
    
    // PGP targets
    { id: "sc-06", checkName: "Remove Bulk content from PGP output", description: "All Bulk-specific sections, pricing, and references must be stripped from the PGP output pack.", category: "cross_references", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-pgp", status: "would_block", severity: "critical", wouldBlockInProduction: true, mockResolution: "Content filter would run automatically", notes: "" },
    { id: "sc-07", checkName: "Remove internal notes and draft comments", description: "All internal notes, working comments, and draft markers must be removed from the external output.", category: "internal_notes", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-pgp", status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Internal note scanner would run automatically", notes: "" },
    { id: "sc-08", checkName: "Check PGP placeholders completed", description: "All submission-critical placeholders for the PGP pack must have values.", category: "placeholders", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-pgp", status: "would_block", severity: "critical", wouldBlockInProduction: true, mockResolution: "Placeholder register feeds this check", notes: "" },
    { id: "sc-09", checkName: "Check PGP required documents ready", description: "All required documents for the PGP submission must be uploaded and approved.", category: "required_documents", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-pgp", status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Required documents register feeds this check", notes: "" },
    { id: "sc-10", checkName: "Check compliance gaps resolved", description: "Non-compliant and clarification-required items must be resolved before production output.", category: "compliance", sourcePackId: "tp-linde-master", targetPackId: "tp-linde-pgp", status: "warning", severity: "medium", wouldBlockInProduction: false, mockResolution: "Compliance matrix feeds this check", notes: "" },
];

sql += `INSERT INTO tender_split_checks (id, tender_workspace_id, source_pack_id, target_pack_id, check_name, description, category, status, severity, would_block_in_production, mock_resolution, notes) VALUES\n`;
const scRows = splitChecks.map(sc => `(${esc(sc.id)}, ${esc('tn-linde-001')}, ${esc(sc.sourcePackId)}, ${esc(sc.targetPackId)}, ${esc(sc.checkName)}, ${esc(sc.description)}, ${esc(sc.category)}, ${esc(sc.status)}, ${esc(sc.severity)}, ${esc(sc.wouldBlockInProduction)}, ${esc(sc.mockResolution)}, ${esc(sc.notes)})`);
sql += scRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';

// 4. Pack Outputs (Test Output)
sql += `INSERT INTO tender_pack_outputs (id, tender_workspace_id, tender_pack_id, source_pack_id, output_name, pack_name, output_type, format, version, status, generated_by, generated_at, watermark, is_test_output, would_be_submittable_in_production, mock_warnings_count, notes) VALUES\n`;
sql += `(${esc('po-001')}, ${esc('tn-linde-001')}, ${esc('tp-linde-bulk')}, ${esc('tp-linde-master')}, ${esc('Bulk Transportation Pack — TEST OUTPUT')}, ${esc('Bulk Transportation Pack')}, ${esc('Split Pack Output')}, ${esc('PDF Mock')}, ${esc('v0.1-test')}, ${esc('generated_with_warnings')}, ${esc('Amin Al-Halabi')}, ${esc('2026-04-29T10:30:00Z')}, ${esc('TEST OUTPUT — NOT FOR CLIENT SUBMISSION')}, ${esc(true)}, ${esc(false)}, ${esc(5)}, ${esc('')})\nON CONFLICT (id) DO NOTHING;\n\n`;

// 5. Submission Emails
const emails = [
    { id: "se-bulk", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", emailType: "bulk_submission", to: "tender@linde-sigas.com", ccExt: "procurement@linde-sigas.com", ccInt: "amin.alhalabi@hala.com", sub: "Linde SIGAS Transportation Tender — Bulk Pack Submission", body: "Please find attached our Bulk Transportation proposal...", attSize: 12.5, status: "draft_mock", sim: false, subBy: "", subAt: null, warn: 2 },
    { id: "se-pgp", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", emailType: "pgp_submission", to: "tender@linde-sigas.com", ccExt: "procurement@linde-sigas.com", ccInt: "amin.alhalabi@hala.com", sub: "Linde SIGAS Transportation Tender — PGP Pack Submission", body: "Please find attached our PGP proposal...", attSize: 8.2, status: "draft_mock", sim: false, subBy: "", subAt: null, warn: 1 },
];

sql += `INSERT INTO tender_submission_emails (id, tender_workspace_id, tender_pack_id, pack_name, email_type, to_address, cc_external, cc_internal, subject, body, attachment_size_mb, status, simulated, submitted_by, submitted_at, warnings_count, notes) VALUES\n`;
const emRows = emails.map(em => `(${esc(em.id)}, ${esc('tn-linde-001')}, ${esc(em.packId)}, ${esc(em.packName)}, ${esc(em.emailType)}, ${esc(em.to)}, ${esc(em.ccExt)}, ${esc(em.ccInt)}, ${esc(em.sub)}, ${esc(em.body)}, ${esc(em.attSize)}, ${esc(em.status)}, ${esc(em.sim)}, ${esc(em.subBy)}, ${esc(em.subAt)}, ${esc(em.warn)}, ${esc('')})`);
sql += emRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';

// 6. Submission Email Attachments
const atts = [
    { id: "att-1", emailId: "se-bulk", name: "Linde_Bulk_Technical_Proposal.pdf", type: "Technical Proposal", format: "PDF", req: true, inc: true, status: "ready_mock", size: 4.5 },
    { id: "att-2", emailId: "se-bulk", name: "Linde_Bulk_Commercial_OBK.xlsx", type: "Pricing", format: "Excel", req: true, inc: false, status: "missing", size: 0 },
    { id: "att-3", emailId: "se-bulk", name: "Compliance_Pack_Bulk.pdf", type: "Compliance", format: "PDF", req: true, inc: false, status: "warning", size: 8.0 },
    
    { id: "att-4", emailId: "se-pgp", name: "Linde_PGP_Technical_Proposal.pdf", type: "Technical Proposal", format: "PDF", req: true, inc: true, status: "ready_mock", size: 3.2 },
    { id: "att-5", emailId: "se-pgp", name: "Linde_PGP_Commercial_OBK.xlsx", type: "Pricing", format: "Excel", req: true, inc: false, status: "missing", size: 0 },
    { id: "att-6", emailId: "se-pgp", name: "Compliance_Pack_PGP.pdf", type: "Compliance", format: "PDF", req: true, inc: true, status: "ready_mock", size: 5.0 },
];

sql += `INSERT INTO tender_submission_email_attachments (id, email_id, file_name, document_type, format, required, included, status, size_mb, notes) VALUES\n`;
const attRows = atts.map(att => `(${esc(att.id)}, ${esc(att.emailId)}, ${esc(att.name)}, ${esc(att.type)}, ${esc(att.format)}, ${esc(att.req)}, ${esc(att.inc)}, ${esc(att.status)}, ${esc(att.size)}, ${esc('')})`);
sql += attRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';

fs.writeFileSync('scratch/seed_extensions.sql', sql);
console.log('Seed extensions generated successfully!');
