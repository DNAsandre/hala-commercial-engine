#!/usr/bin/env python3
"""Generate INSERT SQL for the 4 variable tables matching the recreated schema."""

lines = []

# ── variable_definitions ──
# Columns: id, key, label, scope, namespace, data_type, format, default_value, fallback, description, source, is_required
defs = [
    ("vd-001", "customer.name", "Customer Name", "global", "customer", "text", None, None, "N/A", "Legal entity name of the customer", "binding", True),
    ("vd-002", "customer.code", "Customer Code", "global", "customer", "text", None, None, "N/A", "Internal customer reference code", "binding", False),
    ("vd-003", "customer.cr_number", "CR Number", "global", "customer", "text", None, None, "N/A", "Commercial registration number", "binding", False),
    ("vd-004", "customer.vat_number", "VAT Number", "global", "customer", "text", None, None, "N/A", "VAT registration number", "binding", False),
    ("vd-005", "customer.address", "Customer Address", "global", "customer", "text", None, None, "N/A", "Primary business address", "binding", False),
    ("vd-006", "customer.city", "Customer City", "global", "customer", "text", None, None, "N/A", "City of the customer", "binding", False),
    ("vd-007", "customer.contact_name", "Contact Person", "global", "customer", "text", None, None, "N/A", "Primary contact person name", "binding", False),
    ("vd-008", "customer.contact_email", "Contact Email", "global", "customer", "text", None, None, "N/A", "Primary contact email", "binding", False),
    ("vd-009", "customer.contact_phone", "Contact Phone", "global", "customer", "text", None, None, "N/A", "Primary contact phone", "binding", False),
    ("vd-010", "customer.industry", "Industry", "global", "customer", "text", None, None, "General", "Customer industry sector", "binding", False),
    ("vd-011", "workspace.name", "Workspace Name", "global", "workspace", "text", None, None, "N/A", "Name of the active workspace", "binding", True),
    ("vd-012", "workspace.stage", "Current Stage", "global", "workspace", "text", None, None, "N/A", "Current pipeline stage", "binding", False),
    ("vd-013", "workspace.total_value", "Total Value", "global", "workspace", "currency", "SAR #,##0.00", None, "0.00", "Total contract value", "binding", False),
    ("vd-014", "workspace.gross_profit", "Gross Profit %", "global", "workspace", "percentage", "0.0%", None, "0%", "Gross profit margin", "binding", False),
    ("vd-015", "workspace.volume", "Volume", "global", "workspace", "number", "#,##0", None, "0", "Total volume in pallets", "binding", False),
    ("vd-016", "workspace.start_date", "Start Date", "global", "workspace", "date", "DD/MM/YYYY", None, "TBD", "Contract start date", "binding", False),
    ("vd-017", "workspace.end_date", "End Date", "global", "workspace", "date", "DD/MM/YYYY", None, "TBD", "Contract end date", "binding", False),
    ("vd-018", "workspace.duration_months", "Duration (Months)", "global", "workspace", "number", None, None, "12", "Contract duration in months", "binding", False),
    ("vd-019", "company.name", "Company Name", "global", "company", "text", None, "Hala Supply Chain Services", "Hala SCS", "Our company legal name", "manual", False),
    ("vd-020", "company.cr_number", "Company CR", "global", "company", "text", None, "1010XXXXXX", "N/A", "Our CR number", "manual", False),
    ("vd-021", "company.vat_number", "Company VAT", "global", "company", "text", None, "3XXXXXXXXXX0003", "N/A", "Our VAT number", "manual", False),
    ("vd-022", "company.address", "Company Address", "global", "company", "text", None, "Riyadh, Saudi Arabia", "N/A", "Our business address", "manual", False),
    ("vd-023", "company.signatory", "Authorized Signatory", "global", "company", "text", None, "Amin Al-Rashid", "N/A", "Default authorized signatory", "manual", False),
    ("vd-024", "company.signatory_title", "Signatory Title", "global", "company", "text", None, "Chief Executive Officer", "N/A", "Title of the signatory", "manual", False),
    ("vd-025", "pricing.base_rate", "Base Rate", "global", "pricing", "currency", "SAR #,##0.00", None, "0.00", "Base rate per pallet", "manual", False),
    ("vd-026", "pricing.fuel_surcharge", "Fuel Surcharge %", "global", "pricing", "percentage", "0.0%", "5.0%", "0%", "Fuel surcharge percentage", "manual", False),
    ("vd-027", "pricing.insurance_rate", "Insurance Rate %", "global", "pricing", "percentage", "0.0%", "0.5%", "0%", "Insurance rate percentage", "manual", False),
    ("vd-028", "pricing.payment_terms", "Payment Terms", "global", "pricing", "text", None, "Net 30", "Net 30", "Default payment terms", "manual", False),
    ("vd-029", "pricing.currency", "Currency", "global", "pricing", "text", None, "SAR", "SAR", "Default currency", "manual", False),
    ("vd-030", "sla.uptime_target", "Uptime Target %", "global", "sla", "percentage", "0.0%", "99.5%", "99%", "Target uptime percentage", "manual", False),
    ("vd-031", "sla.response_time", "Response Time", "global", "sla", "text", None, "4 hours", "24 hours", "Maximum response time", "manual", False),
    ("vd-032", "sla.resolution_time", "Resolution Time", "global", "sla", "text", None, "24 hours", "72 hours", "Maximum resolution time", "manual", False),
    ("vd-033", "sla.penalty_rate", "Penalty Rate %", "global", "sla", "percentage", "0.0%", "2.0%", "0%", "SLA breach penalty rate", "manual", False),
    ("vd-034", "legal.jurisdiction", "Jurisdiction", "global", "legal", "text", None, "Kingdom of Saudi Arabia", "KSA", "Legal jurisdiction", "manual", False),
    ("vd-035", "legal.governing_law", "Governing Law", "global", "legal", "text", None, "Saudi Arabian Commercial Law", "Saudi Law", "Governing law", "manual", False),
    ("vd-036", "legal.arbitration_body", "Arbitration Body", "global", "legal", "text", None, "Saudi Center for Commercial Arbitration", "SCCA", "Arbitration body", "manual", False),
    ("vd-037", "legal.notice_period", "Notice Period", "global", "legal", "text", None, "90 days", "30 days", "Termination notice period", "manual", False),
    ("vd-038", "legal.confidentiality_years", "Confidentiality Period", "global", "legal", "number", None, "5", "3", "Years of confidentiality", "manual", False),
    ("vd-039", "doc.date", "Document Date", "global", "document", "date", "DD/MM/YYYY", None, "TBD", "Date of the document", "system", False),
    ("vd-040", "doc.reference", "Document Reference", "global", "document", "text", None, None, "DRAFT", "Document reference number", "system", False),
]

def esc(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

lines.append("-- variable_definitions")
for d in defs:
    vals = f"({esc(d[0])}, {esc(d[1])}, {esc(d[2])}, {esc(d[3])}, {esc(d[4])}, {esc(d[5])}, {esc(d[6])}, {esc(d[7])}, {esc(d[8])}, {esc(d[9])}, {esc(d[10])}, {str(d[11]).lower()})"
    lines.append(f"INSERT INTO variable_definitions (id, key, label, scope, namespace, data_type, format, default_value, fallback, description, source, is_required) VALUES {vals} ON CONFLICT (id) DO NOTHING;")

# ── variable_sets ──
lines.append("")
lines.append("-- variable_sets")
sets = [
    ("vs-001", "Standard Quote Variables", "Default variable set for quotations", "global"),
    ("vs-002", "SLA Variables", "Default variable set for SLAs", "global"),
    ("vs-003", "Proposal Variables", "Default variable set for proposals", "global"),
    ("vs-004", "Contract Variables", "Default variable set for contracts", "global"),
    ("vs-005", "Company Defaults", "Company-wide default values", "global"),
]
for s in sets:
    lines.append(f"INSERT INTO variable_sets (id, name, description, scope) VALUES ({esc(s[0])}, {esc(s[1])}, {esc(s[2])}, {esc(s[3])}) ON CONFLICT (id) DO NOTHING;")

# ── variable_set_items ──
lines.append("")
lines.append("-- variable_set_items")
items = [
    ("vsi-001", "vs-001", "vd-001", None),
    ("vsi-002", "vs-001", "vd-013", None),
    ("vsi-003", "vs-001", "vd-025", None),
    ("vsi-004", "vs-001", "vd-028", None),
    ("vsi-005", "vs-002", "vd-030", None),
    ("vsi-006", "vs-002", "vd-031", None),
    ("vsi-007", "vs-002", "vd-032", None),
    ("vsi-008", "vs-002", "vd-033", None),
    ("vsi-009", "vs-003", "vd-001", None),
    ("vsi-010", "vs-003", "vd-011", None),
    ("vsi-011", "vs-003", "vd-013", None),
    ("vsi-012", "vs-004", "vd-034", None),
    ("vsi-013", "vs-004", "vd-035", None),
    ("vsi-014", "vs-004", "vd-037", None),
]
for i in items:
    lines.append(f"INSERT INTO variable_set_items (id, set_id, variable_id, override_value) VALUES ({esc(i[0])}, {esc(i[1])}, {esc(i[2])}, {esc(i[3])}) ON CONFLICT (id) DO NOTHING;")

# ── doc_variable_overrides ──
lines.append("")
lines.append("-- doc_variable_overrides")
overrides = [
    ("dvo-001", "doc-inst-001", "vd-028", "Net 45"),
    ("dvo-002", "doc-inst-001", "vd-026", "3.5%"),
    ("dvo-003", "doc-inst-002", "vd-030", "99.9%"),
    ("dvo-004", "doc-inst-002", "vd-031", "2 hours"),
    ("dvo-005", "doc-inst-003", "vd-037", "60 days"),
    ("dvo-006", "doc-inst-003", "vd-038", "7"),
    ("dvo-007", "doc-inst-004", "vd-028", "Net 60"),
    ("dvo-008", "doc-inst-004", "vd-025", "45.00"),
]
for o in overrides:
    lines.append(f"INSERT INTO doc_variable_overrides (id, doc_instance_id, variable_id, override_value) VALUES ({esc(o[0])}, {esc(o[1])}, {esc(o[2])}, {esc(o[3])}) ON CONFLICT (id) DO NOTHING;")

sql = "\n".join(lines)
with open("scripts/seed-v2.sql", "w") as f:
    f.write(sql + "\n")

print(f"Generated {len(lines)} lines of SQL")
print(f"Written to scripts/seed-v2.sql")
