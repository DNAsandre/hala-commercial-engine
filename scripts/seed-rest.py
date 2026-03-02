#!/usr/bin/env python3
"""Bulk-insert seed data via Supabase REST API (schema cache is now refreshed)."""
import json, requests

URL = "https://kositquaqmuousalmoar.supabase.co/rest/v1"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mzg1NjUsImV4cCI6MjA4NzQxNDU2NX0.ULDr14MImvZz6ssst3m-mtgEtsJ5o2TDe9cz4mOTcEc"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal,resolution=ignore-duplicates"
}

def bulk_insert(table, rows):
    r = requests.post(f"{URL}/{table}", headers=HEADERS, json=rows, timeout=30)
    print(f"  {table}: {r.status_code} ({len(rows)} rows)")
    if r.status_code >= 400:
        print(f"    Error: {r.text[:200]}")
    return r.status_code < 400

# ── variable_definitions (39 remaining, vd-001 already inserted) ──
defs = []
raw_defs = [
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
for d in raw_defs:
    defs.append({
        "id": d[0], "key": d[1], "label": d[2], "scope": d[3], "namespace": d[4],
        "data_type": d[5], "format": d[6], "default_value": d[7], "fallback": d[8],
        "description": d[9], "source": d[10], "is_required": d[11]
    })

# ── variable_sets ──
sets = [
    {"id": "vs-001", "name": "Standard Quote Variables", "description": "Default variable set for quotations", "scope": "global"},
    {"id": "vs-002", "name": "SLA Variables", "description": "Default variable set for SLAs", "scope": "global"},
    {"id": "vs-003", "name": "Proposal Variables", "description": "Default variable set for proposals", "scope": "global"},
    {"id": "vs-004", "name": "Contract Variables", "description": "Default variable set for contracts", "scope": "global"},
    {"id": "vs-005", "name": "Company Defaults", "description": "Company-wide default values", "scope": "global"},
]

# ── variable_set_items ──
items = [
    {"id": "vsi-001", "set_id": "vs-001", "variable_id": "vd-001", "override_value": None},
    {"id": "vsi-002", "set_id": "vs-001", "variable_id": "vd-013", "override_value": None},
    {"id": "vsi-003", "set_id": "vs-001", "variable_id": "vd-025", "override_value": None},
    {"id": "vsi-004", "set_id": "vs-001", "variable_id": "vd-028", "override_value": None},
    {"id": "vsi-005", "set_id": "vs-002", "variable_id": "vd-030", "override_value": None},
    {"id": "vsi-006", "set_id": "vs-002", "variable_id": "vd-031", "override_value": None},
    {"id": "vsi-007", "set_id": "vs-002", "variable_id": "vd-032", "override_value": None},
    {"id": "vsi-008", "set_id": "vs-002", "variable_id": "vd-033", "override_value": None},
    {"id": "vsi-009", "set_id": "vs-003", "variable_id": "vd-001", "override_value": None},
    {"id": "vsi-010", "set_id": "vs-003", "variable_id": "vd-011", "override_value": None},
    {"id": "vsi-011", "set_id": "vs-003", "variable_id": "vd-013", "override_value": None},
    {"id": "vsi-012", "set_id": "vs-004", "variable_id": "vd-034", "override_value": None},
    {"id": "vsi-013", "set_id": "vs-004", "variable_id": "vd-035", "override_value": None},
    {"id": "vsi-014", "set_id": "vs-004", "variable_id": "vd-037", "override_value": None},
]

# ── doc_variable_overrides ──
overrides = [
    {"id": "dvo-001", "doc_instance_id": "doc-inst-001", "variable_id": "vd-028", "override_value": "Net 45"},
    {"id": "dvo-002", "doc_instance_id": "doc-inst-001", "variable_id": "vd-026", "override_value": "3.5%"},
    {"id": "dvo-003", "doc_instance_id": "doc-inst-002", "variable_id": "vd-030", "override_value": "99.9%"},
    {"id": "dvo-004", "doc_instance_id": "doc-inst-002", "variable_id": "vd-031", "override_value": "2 hours"},
    {"id": "dvo-005", "doc_instance_id": "doc-inst-003", "variable_id": "vd-037", "override_value": "60 days"},
    {"id": "dvo-006", "doc_instance_id": "doc-inst-003", "variable_id": "vd-038", "override_value": "7"},
    {"id": "dvo-007", "doc_instance_id": "doc-inst-004", "variable_id": "vd-028", "override_value": "Net 60"},
    {"id": "dvo-008", "doc_instance_id": "doc-inst-004", "variable_id": "vd-025", "override_value": "45.00"},
]

print("Seeding variable tables via REST API...")
ok = True
ok = bulk_insert("variable_definitions", defs) and ok
ok = bulk_insert("variable_sets", sets) and ok
ok = bulk_insert("variable_set_items", items) and ok
ok = bulk_insert("doc_variable_overrides", overrides) and ok

if ok:
    print("\n✅ All 4 tables seeded successfully!")
else:
    print("\n❌ Some inserts failed — check errors above")
