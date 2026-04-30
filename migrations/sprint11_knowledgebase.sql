-- ═══════════════════════════════════════════════════════════════
-- Knowledgebase Subsystem — Schema Migration
-- Tables: kb_collections, kb_documents, kb_chunks,
--         kb_embeddings, bot_kb_links
-- ═══════════════════════════════════════════════════════════════

-- Clean slate
DROP TABLE IF EXISTS kb_embeddings CASCADE;
DROP TABLE IF EXISTS kb_chunks CASCADE;
DROP TABLE IF EXISTS kb_documents CASCADE;
DROP TABLE IF EXISTS bot_kb_links CASCADE;
DROP TABLE IF EXISTS kb_collections CASCADE;

-- 1. KB Collections
CREATE TABLE kb_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'admin-only')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. KB Documents
CREATE TABLE kb_documents (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('upload', 'manual', 'link')),
  file_url TEXT,
  text_content TEXT,
  mime TEXT DEFAULT 'text/plain',
  size INTEGER DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- 3. KB Chunks
CREATE TABLE kb_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. KB Embeddings (for future vector search)
CREATE TABLE kb_embeddings (
  id TEXT PRIMARY KEY DEFAULT 'emb-' || gen_random_uuid()::text,
  chunk_id TEXT NOT NULL REFERENCES kb_chunks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bot ↔ KB Links (many-to-many)
CREATE TABLE bot_kb_links (
  bot_id TEXT NOT NULL REFERENCES bot_definitions(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bot_id, collection_id)
);

-- ═══════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_kb_documents_collection ON kb_documents(collection_id);
CREATE INDEX idx_kb_documents_not_deleted ON kb_documents(collection_id) WHERE is_deleted = false;
CREATE INDEX idx_kb_chunks_document ON kb_chunks(document_id);
CREATE INDEX idx_kb_chunks_hash ON kb_chunks(content_hash);
CREATE INDEX idx_bot_kb_links_bot ON bot_kb_links(bot_id);
CREATE INDEX idx_bot_kb_links_collection ON bot_kb_links(collection_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE kb_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_kb_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_collections_all" ON kb_collections FOR ALL TO authenticated USING (true);
CREATE POLICY "kb_documents_all" ON kb_documents FOR ALL TO authenticated USING (true);
CREATE POLICY "kb_chunks_all" ON kb_chunks FOR ALL TO authenticated USING (true);
CREATE POLICY "kb_embeddings_all" ON kb_embeddings FOR ALL TO authenticated USING (true);
CREATE POLICY "bot_kb_links_all" ON bot_kb_links FOR ALL TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════
-- Seed Data (4 collections, 8 documents)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO kb_collections (id, name, description, visibility, created_by) VALUES
  ('kb-col-1', 'Hala Service Catalog', 'Complete catalog of Hala Supply Chain Services offerings, capabilities, and SLAs', 'internal', 'admin'),
  ('kb-col-2', 'Legal Templates & Clauses', 'Standard legal clauses, T&C templates, and Saudi commercial law references', 'admin-only', 'admin'),
  ('kb-col-3', 'Case Studies & References', 'Client success stories, reference architectures, and industry benchmarks', 'internal', 'admin'),
  ('kb-col-4', 'Pricing & Rate Cards', 'Standard rate cards, pricing models, and commercial terms reference', 'admin-only', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Service Catalog documents
INSERT INTO kb_documents (id, collection_id, title, source_type, text_content, mime, size, chunk_count, created_by) VALUES
  ('kb-doc-1a', 'kb-col-1', 'Hala Warehousing Services Overview', 'manual',
   'Hala Supply Chain Services operates 12 state-of-the-art warehousing facilities across Saudi Arabia, totaling over 500,000 square meters of storage capacity. Our facilities support ambient, temperature-controlled (+2°C to +8°C), and frozen storage (-18°C to -25°C) zones.',
   'text/plain', 680, 1, 'admin'),
  ('kb-doc-1b', 'kb-col-1', 'Hala Transportation & Last-Mile Delivery', 'manual',
   'Our transportation network covers all major cities and industrial zones across the Kingdom of Saudi Arabia. We operate a fleet of 450+ vehicles including refrigerated trucks, flatbed trailers, and last-mile delivery vans.',
   'text/plain', 720, 1, 'admin'),
  ('kb-doc-1c', 'kb-col-1', 'Hala Technology & Integration Capabilities', 'manual',
   'Hala''s technology stack provides end-to-end supply chain visibility through our proprietary platform. Key capabilities include WMS integration with SAP, Oracle, and Microsoft Dynamics.',
   'text/plain', 750, 1, 'admin')
ON CONFLICT (id) DO NOTHING;

-- Legal documents
INSERT INTO kb_documents (id, collection_id, title, source_type, text_content, mime, size, chunk_count, created_by) VALUES
  ('kb-doc-2a', 'kb-col-2', 'Standard Terms & Conditions Template', 'manual',
   'STANDARD TERMS AND CONDITIONS FOR LOGISTICS SERVICES. 1. DEFINITIONS: ''Services'' means the logistics, warehousing, and transportation services described in the Service Order.',
   'text/plain', 1100, 2, 'admin'),
  ('kb-doc-2b', 'kb-col-2', 'SLA Framework & KPI Definitions', 'manual',
   'SERVICE LEVEL AGREEMENT FRAMEWORK. Standard KPIs: 1. Order Accuracy: Target 99.5%, measured monthly. 2. On-Time Delivery: Target 98%, measured monthly.',
   'text/plain', 900, 1, 'admin')
ON CONFLICT (id) DO NOTHING;

-- Case Studies
INSERT INTO kb_documents (id, collection_id, title, source_type, text_content, mime, size, chunk_count, created_by) VALUES
  ('kb-doc-3a', 'kb-col-3', 'Case Study: Almarai Cold Chain Partnership', 'manual',
   'CLIENT: Almarai Company. INDUSTRY: Food & Dairy. CHALLENGE: Almarai required a reliable cold-chain partner to handle distribution of fresh dairy products across the Eastern Province.',
   'text/plain', 850, 1, 'admin'),
  ('kb-doc-3b', 'kb-col-3', 'Case Study: SABIC Industrial Logistics', 'manual',
   'CLIENT: SABIC. INDUSTRY: Petrochemicals. CHALLENGE: SABIC needed a specialized logistics partner for handling hazardous materials and oversized industrial equipment.',
   'text/plain', 700, 1, 'admin')
ON CONFLICT (id) DO NOTHING;

-- Pricing
INSERT INTO kb_documents (id, collection_id, title, source_type, text_content, mime, size, chunk_count, created_by) VALUES
  ('kb-doc-4a', 'kb-col-4', 'Standard Rate Card 2026', 'manual',
   'HALA SUPPLY CHAIN SERVICES — STANDARD RATE CARD 2026. Warehousing: Ambient storage SAR 12-18/pallet/month. Chilled storage SAR 25-35/pallet/month. Frozen storage SAR 40-55/pallet/month.',
   'text/plain', 650, 1, 'admin')
ON CONFLICT (id) DO NOTHING;
