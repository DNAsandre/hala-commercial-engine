"""
Generate SQL INSERT statements for the 4 variable tables.
Output is a single SQL file that can be pasted into the Supabase SQL Editor.
"""
import json

# ============================================================
# SEED DATA
# ============================================================

variable_definitions = [
    {"id":"vd-001","key":"customer.name","label":"Customer Name","description":"Legal entity name of the customer","data_type":"text","scope":"global","source":"binding","binding_path":"customer.name","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-002","key":"customer.code","label":"Customer Code","description":"Internal customer reference code","data_type":"text","scope":"global","source":"binding","binding_path":"customer.code","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-003","key":"customer.industry","label":"Customer Industry","description":"Industry classification","data_type":"text","scope":"global","source":"binding","binding_path":"customer.industry","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-004","key":"customer.contact_name","label":"Contact Name","description":"Primary contact person","data_type":"text","scope":"global","source":"binding","binding_path":"customer.contact_name","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-005","key":"customer.contact_email","label":"Contact Email","description":"Primary contact email","data_type":"text","scope":"global","source":"binding","binding_path":"customer.contact_email","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-006","key":"customer.contact_phone","label":"Contact Phone","description":"Primary contact phone number","data_type":"text","scope":"global","source":"binding","binding_path":"customer.contact_phone","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-007","key":"customer.region","label":"Customer Region","description":"Geographic region","data_type":"text","scope":"global","source":"binding","binding_path":"customer.region","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-008","key":"customer.grade","label":"Customer Grade","description":"Customer tier/grade classification","data_type":"text","scope":"global","source":"binding","binding_path":"customer.grade","default_value_json":None,"allowed_in_doc_types":[],"namespace":"customer","created_by":"system"},
    {"id":"vd-010","key":"quote.ref_number","label":"Quote Reference","description":"Unique quotation reference number","data_type":"text","scope":"record","source":"computed","binding_path":None,"default_value_json":None,"allowed_in_doc_types":["quote"],"namespace":"quote","created_by":"system"},
    {"id":"vd-011","key":"quote.date","label":"Quote Date","description":"Date the quotation was issued","data_type":"date","scope":"record","source":"computed","binding_path":None,"default_value_json":None,"allowed_in_doc_types":["quote"],"namespace":"quote","created_by":"system"},
    {"id":"vd-012","key":"quote.validity_days","label":"Validity Period","description":"Number of days the quote remains valid","data_type":"number","scope":"template","source":"static","binding_path":None,"default_value_json":30,"allowed_in_doc_types":["quote"],"namespace":"quote","created_by":"system"},
    {"id":"vd-013","key":"quote.total_amount","label":"Total Amount","description":"Total quoted amount in SAR","data_type":"currency","scope":"record","source":"binding","binding_path":"pricing_snapshot.total","default_value_json":None,"allowed_in_doc_types":["quote"],"namespace":"quote","created_by":"system"},
    {"id":"vd-014","key":"quote.gp_percent","label":"Gross Profit %","description":"Gross profit margin percentage","data_type":"percent","scope":"record","source":"binding","binding_path":"pricing_snapshot.gp_percent","default_value_json":None,"allowed_in_doc_types":["quote"],"namespace":"quote","created_by":"system"},
    {"id":"vd-015","key":"quote.pallets","label":"Pallet Count","description":"Number of pallet positions","data_type":"number","scope":"record","source":"binding","binding_path":"pricing_snapshot.pallets","default_value_json":None,"allowed_in_doc_types":["quote"],"namespace":"quote","created_by":"system"},
    {"id":"vd-020","key":"proposal.title","label":"Proposal Title","description":"Title of the commercial proposal","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"Commercial Proposal","allowed_in_doc_types":["proposal"],"namespace":"proposal","created_by":"system"},
    {"id":"vd-021","key":"proposal.subtitle","label":"Proposal Subtitle","description":"Subtitle or tagline","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"","allowed_in_doc_types":["proposal"],"namespace":"proposal","created_by":"system"},
    {"id":"vd-022","key":"proposal.scope_summary","label":"Scope Summary","description":"Brief description of services offered","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"","allowed_in_doc_types":["proposal"],"namespace":"proposal","created_by":"system"},
    {"id":"vd-023","key":"proposal.delivery_timeline","label":"Delivery Timeline","description":"Expected delivery or implementation timeline","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"","allowed_in_doc_types":["proposal"],"namespace":"proposal","created_by":"system"},
    {"id":"vd-030","key":"sla.service_level","label":"Service Level","description":"Agreed service level tier","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"Standard","allowed_in_doc_types":["sla"],"namespace":"sla","created_by":"system"},
    {"id":"vd-031","key":"sla.response_time","label":"Response Time","description":"Maximum response time in hours","data_type":"number","scope":"record","source":"static","binding_path":None,"default_value_json":24,"allowed_in_doc_types":["sla"],"namespace":"sla","created_by":"system"},
    {"id":"vd-032","key":"sla.uptime_target","label":"Uptime Target","description":"Target uptime percentage","data_type":"percent","scope":"record","source":"static","binding_path":None,"default_value_json":99.5,"allowed_in_doc_types":["sla"],"namespace":"sla","created_by":"system"},
    {"id":"vd-033","key":"sla.penalty_rate","label":"Penalty Rate","description":"Penalty rate for SLA breach","data_type":"percent","scope":"record","source":"static","binding_path":None,"default_value_json":2.0,"allowed_in_doc_types":["sla"],"namespace":"sla","created_by":"system"},
    {"id":"vd-034","key":"sla.start_date","label":"SLA Start Date","description":"Effective start date of the SLA","data_type":"date","scope":"record","source":"static","binding_path":None,"default_value_json":None,"allowed_in_doc_types":["sla"],"namespace":"sla","created_by":"system"},
    {"id":"vd-035","key":"sla.end_date","label":"SLA End Date","description":"Expiry date of the SLA","data_type":"date","scope":"record","source":"static","binding_path":None,"default_value_json":None,"allowed_in_doc_types":["sla"],"namespace":"sla","created_by":"system"},
    {"id":"vd-040","key":"company.name","label":"Company Name","description":"Hala Supply Chain Services legal name","data_type":"text","scope":"global","source":"static","binding_path":None,"default_value_json":"Hala Supply Chain Services Co.","allowed_in_doc_types":[],"namespace":"company","created_by":"system"},
    {"id":"vd-041","key":"company.cr_number","label":"CR Number","description":"Commercial registration number","data_type":"text","scope":"global","source":"static","binding_path":None,"default_value_json":"1010XXXXXX","allowed_in_doc_types":[],"namespace":"company","created_by":"system"},
    {"id":"vd-042","key":"company.vat_number","label":"VAT Number","description":"VAT registration number","data_type":"text","scope":"global","source":"static","binding_path":None,"default_value_json":"3XXXXXXXXXX0003","allowed_in_doc_types":[],"namespace":"company","created_by":"system"},
    {"id":"vd-043","key":"company.address","label":"Company Address","description":"Registered office address","data_type":"text","scope":"global","source":"static","binding_path":None,"default_value_json":"Riyadh, Kingdom of Saudi Arabia","allowed_in_doc_types":[],"namespace":"company","created_by":"system"},
    {"id":"vd-044","key":"company.phone","label":"Company Phone","description":"Main office phone number","data_type":"text","scope":"global","source":"static","binding_path":None,"default_value_json":"+966-11-XXX-XXXX","allowed_in_doc_types":[],"namespace":"company","created_by":"system"},
    {"id":"vd-045","key":"company.email","label":"Company Email","description":"Main office email","data_type":"text","scope":"global","source":"static","binding_path":None,"default_value_json":"info@halascs.com","allowed_in_doc_types":[],"namespace":"company","created_by":"system"},
    {"id":"vd-050","key":"doc.title","label":"Document Title","description":"Title of the document","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"","allowed_in_doc_types":[],"namespace":"doc","created_by":"system"},
    {"id":"vd-051","key":"doc.subtitle","label":"Document Subtitle","description":"Subtitle or secondary heading","data_type":"text","scope":"record","source":"static","binding_path":None,"default_value_json":"","allowed_in_doc_types":[],"namespace":"doc","created_by":"system"},
    {"id":"vd-052","key":"doc.ref_number","label":"Document Reference","description":"Document reference number","data_type":"text","scope":"record","source":"computed","binding_path":None,"default_value_json":None,"allowed_in_doc_types":[],"namespace":"doc","created_by":"system"},
    {"id":"vd-053","key":"doc.date","label":"Document Date","description":"Date of document creation","data_type":"date","scope":"record","source":"computed","binding_path":None,"default_value_json":None,"allowed_in_doc_types":[],"namespace":"doc","created_by":"system"},
    {"id":"vd-054","key":"doc.version","label":"Version Number","description":"Document version","data_type":"text","scope":"record","source":"computed","binding_path":None,"default_value_json":"v1","allowed_in_doc_types":[],"namespace":"doc","created_by":"system"},
    {"id":"vd-055","key":"doc.author","label":"Author","description":"Document author name","data_type":"text","scope":"record","source":"binding","binding_path":"user.name","default_value_json":None,"allowed_in_doc_types":[],"namespace":"doc","created_by":"system"},
    {"id":"vd-060","key":"pricing.storage_rate","label":"Storage Rate","description":"Rate per pallet per month","data_type":"currency","scope":"record","source":"binding","binding_path":"pricing_snapshot.storage_rate","default_value_json":None,"allowed_in_doc_types":["quote","proposal"],"namespace":"pricing","created_by":"system"},
    {"id":"vd-061","key":"pricing.handling_rate","label":"Handling Rate","description":"Rate per pallet movement","data_type":"currency","scope":"record","source":"binding","binding_path":"pricing_snapshot.handling_rate","default_value_json":None,"allowed_in_doc_types":["quote","proposal"],"namespace":"pricing","created_by":"system"},
    {"id":"vd-062","key":"pricing.transport_rate","label":"Transport Rate","description":"Rate per delivery trip","data_type":"currency","scope":"record","source":"binding","binding_path":"pricing_snapshot.transport_rate","default_value_json":None,"allowed_in_doc_types":["quote","proposal"],"namespace":"pricing","created_by":"system"},
    {"id":"vd-063","key":"pricing.vas_total","label":"VAS Total","description":"Total value-added services amount","data_type":"currency","scope":"record","source":"binding","binding_path":"pricing_snapshot.vas_total","default_value_json":None,"allowed_in_doc_types":["quote","proposal"],"namespace":"pricing","created_by":"system"},
]

variable_sets = [
    {"id":"vs-quote-en","name":"Standard Quotation (EN)","doc_type":"quote","template_version_id":"tpl-quote-en","variable_ids":["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-010","vd-011","vd-012","vd-013","vd-014","vd-015","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055","vd-060","vd-061","vd-062","vd-063"]},
    {"id":"vs-quote-bi","name":"Bilingual Quotation (EN/AR)","doc_type":"quote","template_version_id":"tpl-quote-bi","variable_ids":["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-010","vd-011","vd-012","vd-013","vd-014","vd-015","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055","vd-060","vd-061","vd-062","vd-063"]},
    {"id":"vs-proposal-en","name":"Standard Proposal (EN)","doc_type":"proposal","template_version_id":"tpl-proposal-en","variable_ids":["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-020","vd-021","vd-022","vd-023","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055","vd-060","vd-061","vd-062","vd-063"]},
    {"id":"vs-sla-en","name":"Standard SLA (EN)","doc_type":"sla","template_version_id":"tpl-sla-en","variable_ids":["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-030","vd-031","vd-032","vd-033","vd-034","vd-035","vd-040","vd-041","vd-042","vd-043","vd-050","vd-052","vd-053","vd-055"]},
    {"id":"vs-contract-en","name":"Standard Contract (EN)","doc_type":"contract","template_version_id":"tpl-contract-en","variable_ids":["vd-001","vd-002","vd-003","vd-004","vd-005","vd-007","vd-040","vd-041","vd-042","vd-043","vd-044","vd-045","vd-050","vd-052","vd-053","vd-055"]},
]

variable_set_items = [
    {"id":"vsi-001","variable_set_id":"vs-quote-en","variable_definition_id":"vd-001","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-002","variable_set_id":"vs-quote-en","variable_definition_id":"vd-010","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-003","variable_set_id":"vs-quote-en","variable_definition_id":"vd-011","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-004","variable_set_id":"vs-quote-en","variable_definition_id":"vd-013","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-005","variable_set_id":"vs-quote-en","variable_definition_id":"vd-040","required":True,"fallback_mode":"warning"},
    {"id":"vsi-006","variable_set_id":"vs-quote-en","variable_definition_id":"vd-012","required":False,"fallback_mode":"empty"},
    {"id":"vsi-010","variable_set_id":"vs-proposal-en","variable_definition_id":"vd-001","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-011","variable_set_id":"vs-proposal-en","variable_definition_id":"vd-020","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-012","variable_set_id":"vs-proposal-en","variable_definition_id":"vd-022","required":True,"fallback_mode":"warning"},
    {"id":"vsi-013","variable_set_id":"vs-proposal-en","variable_definition_id":"vd-040","required":True,"fallback_mode":"warning"},
    {"id":"vsi-020","variable_set_id":"vs-sla-en","variable_definition_id":"vd-001","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-021","variable_set_id":"vs-sla-en","variable_definition_id":"vd-030","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-022","variable_set_id":"vs-sla-en","variable_definition_id":"vd-034","required":True,"fallback_mode":"block_compile"},
    {"id":"vsi-023","variable_set_id":"vs-sla-en","variable_definition_id":"vd-035","required":True,"fallback_mode":"block_compile"},
]

doc_variable_overrides = [
    {"id":"dvo-001","doc_instance_id":"doc-inst-q1","key":"customer.name","value_json":"Almarai Company","created_by":"hano"},
    {"id":"dvo-002","doc_instance_id":"doc-inst-q1","key":"quote.ref_number","value_json":"HQ-2026-0042","created_by":"hano"},
    {"id":"dvo-003","doc_instance_id":"doc-inst-q1","key":"quote.date","value_json":"2026-02-01","created_by":"hano"},
    {"id":"dvo-004","doc_instance_id":"doc-inst-q1","key":"quote.total_amount","value_json":8500000,"created_by":"hano"},
    {"id":"dvo-005","doc_instance_id":"doc-inst-p1","key":"customer.name","value_json":"SABIC","created_by":"rami"},
    {"id":"dvo-006","doc_instance_id":"doc-inst-p1","key":"proposal.title","value_json":"SABIC National Warehousing — Commercial Proposal","created_by":"rami"},
    {"id":"dvo-007","doc_instance_id":"doc-inst-s1","key":"customer.name","value_json":"Almarai Company","created_by":"hano"},
    {"id":"dvo-008","doc_instance_id":"doc-inst-s1","key":"sla.service_level","value_json":"Premium Cold Chain","created_by":"hano"},
]

def esc(val):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (list, dict)):
        return "'" + json.dumps(val).replace("'", "''") + "'::jsonb"
    # string
    return "'" + str(val).replace("'", "''") + "'"

def jsonb_val(val):
    if val is None:
        return "NULL"
    return "'" + json.dumps(val).replace("'", "''") + "'::jsonb"

lines = []

# variable_definitions
lines.append("-- variable_definitions")
for r in variable_definitions:
    lines.append(f"""INSERT INTO variable_definitions (id, key, label, description, data_type, scope, source, binding_path, default_value_json, allowed_in_doc_types, namespace, created_by) VALUES ({esc(r['id'])}, {esc(r['key'])}, {esc(r['label'])}, {esc(r['description'])}, {esc(r['data_type'])}, {esc(r['scope'])}, {esc(r['source'])}, {esc(r['binding_path'])}, {jsonb_val(r['default_value_json'])}, {jsonb_val(r['allowed_in_doc_types'])}, {esc(r['namespace'])}, {esc(r['created_by'])}) ON CONFLICT (id) DO NOTHING;""")

lines.append("")
lines.append("-- variable_sets")
for r in variable_sets:
    lines.append(f"""INSERT INTO variable_sets (id, name, doc_type, template_version_id, variable_ids) VALUES ({esc(r['id'])}, {esc(r['name'])}, {esc(r['doc_type'])}, {esc(r['template_version_id'])}, {jsonb_val(r['variable_ids'])}) ON CONFLICT (id) DO NOTHING;""")

lines.append("")
lines.append("-- variable_set_items")
for r in variable_set_items:
    lines.append(f"""INSERT INTO variable_set_items (id, variable_set_id, variable_definition_id, required, fallback_mode) VALUES ({esc(r['id'])}, {esc(r['variable_set_id'])}, {esc(r['variable_definition_id'])}, {esc(r['required'])}, {esc(r['fallback_mode'])}) ON CONFLICT (id) DO NOTHING;""")

lines.append("")
lines.append("-- doc_variable_overrides")
for r in doc_variable_overrides:
    lines.append(f"""INSERT INTO doc_variable_overrides (id, doc_instance_id, key, value_json, created_by) VALUES ({esc(r['id'])}, {esc(r['doc_instance_id'])}, {esc(r['key'])}, {jsonb_val(r['value_json'])}, {esc(r['created_by'])}) ON CONFLICT (id) DO NOTHING;""")

sql = "\n".join(lines)
with open("/home/ubuntu/hala-commercial-engine/scripts/seed-inserts.sql", "w") as f:
    f.write(sql + "\n")

print(f"Generated {len(lines)} lines of SQL")
print(f"Written to scripts/seed-inserts.sql")
