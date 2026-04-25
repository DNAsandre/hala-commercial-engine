-- ==============================================================================
-- BOT GOVERNANCE — Supabase Migration
-- Tables: editor_bots, ai_runs
-- ==============================================================================

DROP TABLE IF EXISTS ai_runs CASCADE;
DROP TABLE IF EXISTS editor_bots CASCADE;

-- 1. Editor Bots (bot definitions — replaces hardcoded array)
CREATE TABLE editor_bots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bot_type TEXT NOT NULL CHECK (bot_type IN ('block','document')),
    provider TEXT NOT NULL CHECK (provider IN ('openai','google')),
    model TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    knowledge_base_refs JSONB DEFAULT '[]',
    allowed_doc_types JSONB NOT NULL DEFAULT '[]',
    allowed_block_types JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    icon TEXT DEFAULT 'Bot',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI Runs (audit trail for every AI generation)
CREATE TABLE ai_runs (
    id TEXT PRIMARY KEY,
    doc_instance_id TEXT NOT NULL,
    workspace_id TEXT,
    bot_id TEXT REFERENCES editor_bots(id),
    bot_name TEXT NOT NULL,
    bot_type TEXT NOT NULL,
    target_scope TEXT NOT NULL CHECK (target_scope IN ('block','document')),
    target_block_ids JSONB DEFAULT '[]',
    input_prompt TEXT,
    input_transcript_ref TEXT,
    output_text TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft','applied','discarded')) DEFAULT 'draft',
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    run_mode TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_runs_doc ON ai_runs(doc_instance_id);
CREATE INDEX idx_ai_runs_bot ON ai_runs(bot_id);
CREATE INDEX idx_ai_runs_status ON ai_runs(status);

-- ==============================================================================
-- SEED: 8 Editor Bots (matching current hardcoded array)
-- ==============================================================================

INSERT INTO editor_bots (id, name, bot_type, provider, model, system_prompt, knowledge_base_refs, allowed_doc_types, allowed_block_types, enabled, description, icon) VALUES
('ebot-proposal-writer','Proposal Section Writer','block','openai','gpt-4o',
 'You are a commercial proposal writer for Hala Supply Chain Services, a leading 3PL provider in Saudi Arabia. Write professional, client-focused content for the specified section. Use Hala brand voice — solution-oriented, confident, specific. Reference operational capabilities when relevant. Output HTML-formatted text suitable for a TipTap editor.',
 '["kb-1","kb-4"]','["proposal","quote"]',NULL,true,
 'Writes professional proposal sections using Hala brand voice and knowledge base','PenTool'),

('ebot-sla-clause-writer','SLA Clause Drafter','block','openai','gpt-4o',
 'You are an SLA clause drafting assistant for Hala Supply Chain Services. Draft clear, enforceable SLA clauses with specific KPIs, measurement methods, penalty structures, and escalation procedures. Follow Saudi commercial law conventions. Output HTML-formatted text.',
 '["kb-2"]','["sla"]',NULL,true,
 'Drafts SLA clauses with KPIs, penalties, and escalation procedures','Shield'),

('ebot-executive-summary','Executive Summary Generator','block','openai','gpt-4o-mini',
 'You generate concise executive summaries for commercial documents. Summarize the key value proposition, scope of services, commercial terms, and expected outcomes in 2-3 paragraphs. Use professional business English. Output HTML-formatted text.',
 '["kb-1","kb-3"]','["proposal","quote","sla"]','["intro.narrative","intro.executive_summary"]',true,
 'Generates concise executive summaries from document context','FileText'),

('ebot-legal-clause','Legal Clause Assistant','block','google','gemini-1.5-pro',
 'You are a legal clause drafting assistant specializing in Saudi Arabian commercial contracts for logistics and supply chain services. Draft legally sound clauses covering liability, indemnification, force majeure, dispute resolution, and governing law. Follow KSA commercial law. Output HTML-formatted text.',
 '["kb-2"]','["proposal","sla","msa"]','["legal.terms","legal.liability","legal.governing_law"]',true,
 'Drafts legal clauses following Saudi commercial law conventions','Scale'),

('ebot-transcript-filler','Transcript → Document Filler','document','openai','gpt-4o',
 'You are a document assembly assistant. Given a meeting transcript and a document structure with existing blocks, extract relevant information from the transcript and generate content for each block. Return a JSON array of objects with {block_id, block_key, block_name, suggested_text} for each block that should be updated.',
 '["kb-1","kb-3","kb-4"]','["proposal","quote","sla"]',NULL,true,
 'Fills document blocks from meeting transcripts — extracts and maps content automatically','FileText'),

('ebot-legal-reviewer','Legal Review Pass','document','openai','gpt-4o',
 'You are a legal review assistant for commercial documents. Review all blocks for legal risks, ambiguous language, missing protections, and compliance issues under Saudi commercial law. For each block that needs attention, suggest improved text. Return a JSON array.',
 '["kb-2"]','["proposal","sla","msa"]',NULL,true,
 'Reviews all document blocks for legal risks and suggests improvements','Shield'),

('ebot-spellcheck','Spellcheck & Grammar Pass','document','google','gemini-1.5-flash',
 'You are a proofreading assistant. Review all document blocks for spelling errors, grammar issues, inconsistent formatting, and style problems. Return a JSON array of corrections.',
 '[]','["proposal","quote","sla","msa","service_order_transport","service_order_warehouse"]',NULL,true,
 'Checks spelling, grammar, and formatting across all document blocks','CheckCircle'),

('ebot-rewriter','Full Document Rewriter','document','openai','gpt-4o',
 'You are a professional document rewriter for Hala Supply Chain Services. Rewrite all document blocks to improve clarity, professionalism, and persuasiveness while maintaining the original meaning and structure. Use Hala brand voice. Return a JSON array.',
 '["kb-1","kb-4"]','["proposal","quote"]',NULL,true,
 'Rewrites all blocks for improved clarity and professionalism','RefreshCw')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- ROW LEVEL SECURITY
-- Without RLS, Supabase anon key grants unrestricted access to all table data.
-- ==============================================================================

ALTER TABLE editor_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- editor_bots: authenticated users can read/write
CREATE POLICY IF NOT EXISTS "editor_bots_select" ON editor_bots FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "editor_bots_insert" ON editor_bots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "editor_bots_update" ON editor_bots FOR UPDATE TO authenticated USING (true);

-- ai_runs: authenticated users can read/insert/update — no DELETE (immutable audit)
CREATE POLICY IF NOT EXISTS "ai_runs_select" ON ai_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ai_runs_insert" ON ai_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "ai_runs_update" ON ai_runs FOR UPDATE TO authenticated USING (true);
