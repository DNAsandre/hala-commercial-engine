-- Exact-id cleanup approved by the Human Architect on 2026-08-19.
-- No title, prefix, date, or wildcard deletion is permitted in this migration.

delete from public.doc_instances
where id in (
  'a1100000-0000-4000-8000-000000000130'::uuid, -- HALA-UAT-ARV2 pack
  '287576f7-9234-4650-bad9-518840279d9b'::uuid, -- Claude verification blank
  '776914c7-ab8a-4df3-b01f-9664ae538b3b'::uuid, -- empty untitled blank
  '5aa5a5c4-85fe-479c-9ad1-4788d57198b3'::uuid, -- duplicate empty untitled blank
  'a8582379-25b4-424e-8f6e-9a00f65c0fc1'::uuid, -- superseded Linde pack
  '51614a18-a5c0-4a3a-9c2c-9fa1bb48e741'::uuid, -- superseded Linde pack
  '760b3592-e188-45c2-9565-080995158f69'::uuid, -- superseded Linde pack
  '0cf51f7a-4cb4-4710-929d-e36bc42f9967'::uuid  -- duplicate Full Commercial Proposal pack
);

delete from public.doc_templates
where id in (
  'uat-arv2-template-001',
  'tpl-7431cda4-91d4-49aa-b7e1-43008bb5243b',
  'tpl-aa440a11',
  'tpl-b1c91ff8'
);

delete from public.commercial_ticket_audit
where ticket_id in (
  'a1100000-0000-4000-8000-000000000030'::uuid,
  'a1100000-0000-4000-8000-000000000040'::uuid,
  'a1200000-0000-4000-8000-000000000001'::uuid,
  'a1200000-0000-4000-8000-000000000002'::uuid
);

delete from public.commercial_tickets
where id in (
  'a1100000-0000-4000-8000-000000000030'::uuid,
  'a1100000-0000-4000-8000-000000000040'::uuid,
  'a1200000-0000-4000-8000-000000000001'::uuid,
  'a1200000-0000-4000-8000-000000000002'::uuid
);

delete from public.customers
where id = 'a1100000-0000-4000-8000-000000000010';
