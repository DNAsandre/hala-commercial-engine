/**
 * Sprint 11 — Knowledgebase Engine
 *
 * Data model, chunking, retrieval, and citation logic for the
 * Bot Builder + Editor AI integration.
 *
 * ⚠️ FUTURE WIRE — SEED DATA IS MOCK (SUPABASE-FIRST WITH FALLBACK)
 * ════════════════════════════════════════════════════════════════════
 * Supabase tables exist (kb_collections, kb_documents, kb_chunks) but fall
 * back to hardcoded SEED_COLLECTIONS[] and SEED_DOCUMENTS[] when empty.
 *
 * TARGET WIRING:
 *   SEED_COLLECTIONS[] → Remove once Supabase kb_collections is populated
 *   SEED_DOCUMENTS[]   → Remove once Supabase kb_documents is populated
 *   Embeddings         → Real embedding provider (OpenAI/Voyage)
 *
 * DO NOT add more seed data. Populate Supabase directly.
 *
 * Architecture:
 *   kb_collections → kb_documents → kb_chunks → kb_embeddings
 *   bot_kb_links (many-to-many: bot ↔ collection)
 *   bot_runs (execution trace with citations)
 *
 * Retrieval: keyword-based (ILIKE) with optional embedding similarity.
 * Citations: [Source: <doc_title> #<chunk_index>]
 *
 * Design: Swiss Precision Instrument
 * Deep navy accents, IBM Plex Sans typography
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";
import { syncAuditEntry } from "./supabase-sync";

// ============================================================
// TYPES
// ============================================================

export interface KBCollection {
  id: string;
  name: string;
  description: string;
  visibility: "internal" | "admin-only";
  created_by: string;
  created_at: string;
  doc_count?: number;
  chunk_count?: number;
}

export interface KBDocument {
  id: string;
  collection_id: string;
  title: string;
  source_type: "upload" | "manual" | "link";
  file_url: string | null;
  text_content: string | null;
  mime: string | null;
  size: number | null;
  chunk_count: number;
  created_by: string;
  created_at: string;
  is_deleted: boolean;
}

export interface KBChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  created_at: string;
}

export interface KBEmbedding {
  id: string;
  chunk_id: string;
  provider: string;
  model: string;
  embedding: number[] | null; // null when stored as jsonb
  created_at: string;
}

export interface BotKBLink {
  bot_id: string;
  collection_id: string;
  priority: number;
  collection_name?: string; // joined
}

export interface BotRun {
  id: string;
  bot_id: string;
  bot_name: string;
  doc_instance_id: string | null;
  workspace_id: string | null;
  scope: "block" | "document";
  target_block_ids: string[] | null;
  prompt: string;
  provider: string;
  model: string;
  kb_collections: string[];
  retrieved_chunks: RetrievedChunk[];
  output: any; // draft text or multi-block mapping
  status: "draft" | "applied" | "discarded" | "failed";
  created_by: string;
  created_at: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  collection_name: string;
  chunk_index: number;
  content: string;
  relevance_score: number;
}

export interface Citation {
  source: string; // document title
  chunkIndex: number;
  snippet: string;
}

// ============================================================
// CHUNKING ENGINE
// ============================================================

const CHUNK_SIZE = 1000;      // target chars per chunk
const CHUNK_OVERLAP = 150;    // overlap between adjacent chunks
const MIN_CHUNK_SIZE = 100;   // discard chunks smaller than this

/**
 * Split text into overlapping chunks for retrieval.
 * Strategy: paragraph-aware splitting with fallback to character-based.
 */
export function chunkText(text: string): { content: string; index: number }[] {
  if (!text || text.trim().length < MIN_CHUNK_SIZE) {
    return text?.trim() ? [{ content: text.trim(), index: 0 }] : [];
  }

  const chunks: { content: string; index: number }[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed chunk size, finalize current chunk
    if (currentChunk.length + trimmed.length + 2 > CHUNK_SIZE && currentChunk.length >= MIN_CHUNK_SIZE) {
      chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });

      // Start new chunk with overlap from end of previous
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP);
      currentChunk = currentChunk.substring(overlapStart) + "\n\n" + trimmed;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }

    // If single paragraph exceeds chunk size, split by sentences
    if (currentChunk.length > CHUNK_SIZE * 1.5) {
      const sentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [currentChunk];
      let sentenceChunk = "";

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length > CHUNK_SIZE && sentenceChunk.length >= MIN_CHUNK_SIZE) {
          chunks.push({ content: sentenceChunk.trim(), index: chunkIndex++ });
          const overlapStart = Math.max(0, sentenceChunk.length - CHUNK_OVERLAP);
          sentenceChunk = sentenceChunk.substring(overlapStart) + sentence;
        } else {
          sentenceChunk += sentence;
        }
      }
      currentChunk = sentenceChunk;
    }
  }

  // Final chunk
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  } else if (currentChunk.trim() && chunks.length > 0) {
    // Append small remainder to last chunk
    chunks[chunks.length - 1].content += "\n\n" + currentChunk.trim();
  } else if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}

/**
 * Generate a simple content hash for deduplication.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================
// IN-MEMORY STORES (Supabase-first with fallback)
// ============================================================

let collectionsCache: KBCollection[] | null = null;
let documentsCache: Map<string, KBDocument[]> = new Map();
let chunksCache: Map<string, KBChunk[]> = new Map();
let botKBLinksCache: Map<string, BotKBLink[]> = new Map();
let botRunsCache: BotRun[] = [];

// Seed data for demo
const SEED_COLLECTIONS: KBCollection[] = [];

const SEED_DOCUMENTS: KBDocument[] = [];

// Pre-generate chunks from seed documents
function generateSeedChunks(): Map<string, KBChunk[]> {
  const map = new Map<string, KBChunk[]>();
  for (const doc of SEED_DOCUMENTS) {
    if (!doc.text_content) continue;
    const textChunks = chunkText(doc.text_content);
    const kbChunks: KBChunk[] = textChunks.map((tc) => ({
      id: `chunk-${doc.id}-${tc.index}`,
      document_id: doc.id,
      chunk_index: tc.index,
      content: tc.content,
      content_hash: hashContent(tc.content),
      created_at: doc.created_at,
    }));
    const existing = map.get(doc.collection_id) || [];
    map.set(doc.collection_id, [...existing, ...kbChunks]);
  }
  return map;
}

// Initialize caches
function ensureCaches() {
  if (!collectionsCache) {
    collectionsCache = [...SEED_COLLECTIONS];
  }
  if (documentsCache.size === 0) {
    for (const doc of SEED_DOCUMENTS) {
      const existing = documentsCache.get(doc.collection_id) || [];
      documentsCache.set(doc.collection_id, [...existing, doc]);
    }
  }
  if (chunksCache.size === 0) {
    chunksCache = generateSeedChunks();
  }
}

// ============================================================
// COLLECTION CRUD
// ============================================================

export async function fetchCollections(): Promise<KBCollection[]> {
  ensureCaches();

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("kb_collections")
      .select("*, kb_documents(count), kb_chunks(count)")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        visibility: row.visibility,
        created_by: row.created_by,
        created_at: row.created_at,
        doc_count: row.kb_documents?.[0]?.count || 0,
        chunk_count: row.kb_chunks?.[0]?.count || 0,
      }));
    }
  } catch (err) {
    console.warn('[KB] fetchCollections Supabase fallback:', err);
  }

  return collectionsCache!;
}

export async function createCollection(params: {
  name: string;
  description: string;
  visibility: "internal" | "admin-only";
}): Promise<KBCollection> {
  ensureCaches();
  const user = getCurrentUser();
  const id = `kb-col-${crypto.randomUUID().substring(0, 8)}`;

  const collection: KBCollection = {
    id,
    name: params.name,
    description: params.description,
    visibility: params.visibility,
    created_by: user.id,
    created_at: new Date().toISOString(),
    doc_count: 0,
    chunk_count: 0,
  };

  // Try Supabase
  try {
    await supabase.from("kb_collections").insert({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      visibility: collection.visibility,
      created_by: collection.created_by,
      created_at: collection.created_at,
    });
  } catch (err) {
    console.warn('[KB] createCollection Supabase fallback:', err);
  }

  collectionsCache!.unshift(collection);

  await syncAuditEntry({
    id: crypto.randomUUID(),
    entityType: "kb_collection",
    entityId: id,
    action: "kb_collection_created",
    userId: user.id,
    userName: user.name,
    details: `Created KB collection: ${params.name}`,
  }).catch((err) => { console.warn('[KB] createCollection audit fallback:', err); });

  return collection;
}

export async function deleteCollection(collectionId: string): Promise<boolean> {
  ensureCaches();

  try {
    await supabase.from("kb_collections").delete().eq("id", collectionId);
  } catch (err) {
    console.warn('[KB] deleteCollection Supabase fallback:', err);
  }

  collectionsCache = collectionsCache!.filter(c => c.id !== collectionId);
  documentsCache.delete(collectionId);
  chunksCache.delete(collectionId);

  const user = getCurrentUser();
  await syncAuditEntry({
    id: crypto.randomUUID(),
    entityType: "kb_collection",
    entityId: collectionId,
    action: "kb_collection_deleted",
    userId: user.id,
    userName: user.name,
    details: `Deleted KB collection: ${collectionId}`,
  }).catch((err) => { console.warn('[KB] deleteCollection audit fallback:', err); });

  return true;
}

// ============================================================
// DOCUMENT CRUD
// ============================================================

export async function fetchDocuments(collectionId: string): Promise<KBDocument[]> {
  ensureCaches();

  try {
    const { data, error } = await supabase
      .from("kb_documents")
      .select("*")
      .eq("collection_id", collectionId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map(mapDocRow);
    }
  } catch (err) {
    console.warn('[KB] fetchDocuments Supabase fallback:', err);
  }

  return (documentsCache.get(collectionId) || []).filter(d => !d.is_deleted);
}

function mapDocRow(row: any): KBDocument {
  return {
    id: row.id,
    collection_id: row.collection_id,
    title: row.title,
    source_type: row.source_type,
    file_url: row.file_url,
    text_content: row.text_content,
    mime: row.mime,
    size: row.size,
    chunk_count: row.chunk_count || 0,
    created_by: row.created_by,
    created_at: row.created_at,
    is_deleted: row.is_deleted || false,
  };
}

export async function addDocument(params: {
  collectionId: string;
  title: string;
  sourceType: "upload" | "manual" | "link";
  textContent: string;
  mime?: string;
  fileUrl?: string;
}): Promise<{ document: KBDocument; chunks: KBChunk[] }> {
  ensureCaches();
  const user = getCurrentUser();
  const docId = `kb-doc-${crypto.randomUUID().substring(0, 8)}`;

  // Chunk the text
  const textChunks = chunkText(params.textContent);
  const kbChunks: KBChunk[] = textChunks.map((tc) => ({
    id: `chunk-${docId}-${tc.index}`,
    document_id: docId,
    chunk_index: tc.index,
    content: tc.content,
    content_hash: hashContent(tc.content),
    created_at: new Date().toISOString(),
  }));

  const doc: KBDocument = {
    id: docId,
    collection_id: params.collectionId,
    title: params.title,
    source_type: params.sourceType,
    file_url: params.fileUrl || null,
    text_content: params.textContent,
    mime: params.mime || "text/plain",
    size: params.textContent.length,
    chunk_count: kbChunks.length,
    created_by: user.id,
    created_at: new Date().toISOString(),
    is_deleted: false,
  };

  // Try Supabase
  try {
    await supabase.from("kb_documents").insert({
      id: doc.id,
      collection_id: doc.collection_id,
      title: doc.title,
      source_type: doc.source_type,
      file_url: doc.file_url,
      text_content: doc.text_content,
      mime: doc.mime,
      size: doc.size,
      chunk_count: doc.chunk_count,
      created_by: doc.created_by,
      created_at: doc.created_at,
      is_deleted: false,
    });

    if (kbChunks.length > 0) {
      await supabase.from("kb_chunks").insert(
        kbChunks.map(c => ({
          id: c.id,
          document_id: c.document_id,
          chunk_index: c.chunk_index,
          content: c.content,
          content_hash: c.content_hash,
          created_at: c.created_at,
        }))
      );
    }
  } catch (err) {
    console.warn('[KB] addDocument Supabase fallback:', err);
  }

  // Update caches
  const existing = documentsCache.get(params.collectionId) || [];
  documentsCache.set(params.collectionId, [doc, ...existing]);

  const existingChunks = chunksCache.get(params.collectionId) || [];
  chunksCache.set(params.collectionId, [...existingChunks, ...kbChunks]);

  // Update collection doc/chunk counts
  const col = collectionsCache!.find(c => c.id === params.collectionId);
  if (col) {
    col.doc_count = (col.doc_count || 0) + 1;
    col.chunk_count = (col.chunk_count || 0) + kbChunks.length;
  }

  await syncAuditEntry({
    id: crypto.randomUUID(),
    entityType: "kb_document",
    entityId: docId,
    action: "kb_document_added",
    userId: user.id,
    userName: user.name,
    details: `Added KB document: ${params.title} (${kbChunks.length} chunks) to collection ${params.collectionId}`,
  }).catch((err) => { console.warn('[KB] addDocument audit fallback:', err); });

  return { document: doc, chunks: kbChunks };
}

export async function softDeleteDocument(docId: string, collectionId: string): Promise<boolean> {
  ensureCaches();

  try {
    await supabase.from("kb_documents").update({ is_deleted: true }).eq("id", docId);
  } catch (err) {
    console.warn('[KB] softDeleteDocument Supabase fallback:', err);
  }

  const docs = documentsCache.get(collectionId) || [];
  const doc = docs.find(d => d.id === docId);
  if (doc) {
    doc.is_deleted = true;
    const col = collectionsCache!.find(c => c.id === collectionId);
    if (col) {
      col.doc_count = Math.max(0, (col.doc_count || 0) - 1);
      col.chunk_count = Math.max(0, (col.chunk_count || 0) - (doc.chunk_count || 0));
    }
  }

  return true;
}

// ============================================================
// BOT ↔ KB LINKS
// ============================================================

export async function fetchBotKBLinks(botId: string): Promise<BotKBLink[]> {
  ensureCaches();

  try {
    const { data, error } = await supabase
      .from("bot_kb_links")
      .select("*, kb_collections(name)")
      .eq("bot_id", botId)
      .order("priority");

    if (!error && data) {
      return data.map((row: any) => ({
        bot_id: row.bot_id,
        collection_id: row.collection_id,
        priority: row.priority,
        collection_name: row.kb_collections?.name,
      }));
    }
  } catch (err) {
    console.warn('[KB] fetchBotKBLinks Supabase fallback:', err);
  }

  return botKBLinksCache.get(botId) || [];
}

export async function linkBotToCollection(botId: string, collectionId: string, priority = 0): Promise<BotKBLink> {
  ensureCaches();

  const link: BotKBLink = {
    bot_id: botId,
    collection_id: collectionId,
    priority,
    collection_name: collectionsCache!.find(c => c.id === collectionId)?.name,
  };

  try {
    await supabase.from("bot_kb_links").upsert({
      bot_id: botId,
      collection_id: collectionId,
      priority,
    });
  } catch (err) {
    console.warn('[KB] linkBotToCollection Supabase fallback:', err);
  }

  const existing = botKBLinksCache.get(botId) || [];
  const filtered = existing.filter(l => l.collection_id !== collectionId);
  botKBLinksCache.set(botId, [...filtered, link].sort((a, b) => a.priority - b.priority));

  return link;
}

export async function unlinkBotFromCollection(botId: string, collectionId: string): Promise<boolean> {
  try {
    await supabase.from("bot_kb_links").delete().eq("bot_id", botId).eq("collection_id", collectionId);
  } catch (err) {
    console.warn('[KB] unlinkBotFromCollection Supabase fallback:', err);
  }

  const existing = botKBLinksCache.get(botId) || [];
  botKBLinksCache.set(botId, existing.filter(l => l.collection_id !== collectionId));
  return true;
}

export async function updateBotKBPriority(botId: string, collectionId: string, priority: number): Promise<void> {
  try {
    await supabase.from("bot_kb_links").update({ priority }).eq("bot_id", botId).eq("collection_id", collectionId);
  } catch (err) {
    console.warn('[KB] updateBotKBPriority Supabase fallback:', err);
  }

  const existing = botKBLinksCache.get(botId) || [];
  const link = existing.find(l => l.collection_id === collectionId);
  if (link) {
    link.priority = priority;
    botKBLinksCache.set(botId, existing.sort((a, b) => a.priority - b.priority));
  }
}

// ============================================================
// RETRIEVAL ENGINE
// ============================================================

/**
 * Retrieve context chunks for a bot's linked KB collections.
 * Strategy: keyword-based search (ILIKE) with relevance scoring.
 * Falls back to returning top chunks by priority if no keyword matches.
 */
export async function retrieveContext(
  botId: string,
  query: string,
  maxChunks = 6,
): Promise<RetrievedChunk[]> {
  ensureCaches();

  // 1. Get bot's linked collections
  const links = await fetchBotKBLinks(botId);
  if (links.length === 0) return [];

  const collectionIds = links.map(l => l.collection_id);

  // 2. Gather all chunks from linked collections
  const allChunks: (KBChunk & { doc_title: string; collection_name: string; collection_priority: number })[] = [];

  for (const link of links) {
    const docs = (documentsCache.get(link.collection_id) || []).filter(d => !d.is_deleted);
    const chunks = chunksCache.get(link.collection_id) || [];

    for (const chunk of chunks) {
      const doc = docs.find(d => d.id === chunk.document_id);
      if (doc) {
        allChunks.push({
          ...chunk,
          doc_title: doc.title,
          collection_name: link.collection_name || link.collection_id,
          collection_priority: link.priority,
        });
      }
    }
  }

  if (allChunks.length === 0) return [];

  // 3. Score chunks by keyword relevance
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = allChunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      const matches = (contentLower.match(new RegExp(term, "g")) || []).length;
      score += matches * (1 / (chunk.collection_priority + 1)); // higher priority = higher weight
    }

    // Boost exact phrase matches
    const queryLower = query.toLowerCase().substring(0, 100);
    if (contentLower.includes(queryLower)) {
      score += 10;
    }

    return { chunk, score };
  });

  // 4. Sort by score (descending), then by collection priority
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chunk.collection_priority - b.chunk.collection_priority;
  });

  // 5. Take top N chunks
  const topChunks = scored.slice(0, maxChunks);

  // If no keyword matches, return top chunks by priority
  if (topChunks.every(tc => tc.score === 0)) {
    return allChunks
      .sort((a, b) => a.collection_priority - b.collection_priority)
      .slice(0, maxChunks)
      .map(chunk => ({
        chunk_id: chunk.id,
        document_id: chunk.document_id,
        document_title: chunk.doc_title,
        collection_name: chunk.collection_name,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        relevance_score: 0,
      }));
  }

  return topChunks
    .filter(tc => tc.score > 0)
    .map(tc => ({
      chunk_id: tc.chunk.id,
      document_id: tc.chunk.document_id,
      document_title: tc.chunk.doc_title,
      collection_name: tc.chunk.collection_name,
      chunk_index: tc.chunk.chunk_index,
      content: tc.chunk.content,
      relevance_score: tc.score,
    }));
}

/**
 * Format retrieved chunks as context string for the AI prompt.
 * Includes citation markers.
 */
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = ["--- KNOWLEDGEBASE CONTEXT ---", ""];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    lines.push(`[Source: ${chunk.document_title} #${chunk.chunk_index}]`);
    lines.push(chunk.content);
    lines.push("");
  }

  lines.push("--- END KNOWLEDGEBASE CONTEXT ---");
  lines.push("");
  lines.push("When using information from the knowledgebase context above, include inline citations in the format [Source: <document title> #<chunk_index>].");

  return lines.join("\n");
}

/**
 * Extract citations from AI-generated text.
 */
export function extractCitations(text: string): Citation[] {
  const regex = /\[Source:\s*([^\]#]+?)(?:\s*#(\d+))?\]/g;
  const citations: Citation[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    citations.push({
      source: match[1].trim(),
      chunkIndex: match[2] ? parseInt(match[2], 10) : 0,
      snippet: text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50),
    });
  }

  return citations;
}

// ============================================================
// BOT RUNS (Execution Trace)
// ============================================================

export function createBotRun(params: Omit<BotRun, "id" | "created_at" | "created_by">): BotRun {
  const user = getCurrentUser();
  const run: BotRun = {
    ...params,
    id: `botrun-${crypto.randomUUID().substring(0, 8)}`,
    created_by: user.id,
    created_at: new Date().toISOString(),
  };

  botRunsCache.unshift(run);

  // Try Supabase
  supabase.from("bot_runs").insert({
    id: run.id,
    bot_id: run.bot_id,
    doc_instance_id: run.doc_instance_id,
    workspace_id: run.workspace_id,
    scope: run.scope,
    target_block_ids: run.target_block_ids,
    prompt: run.prompt,
    provider: run.provider,
    model: run.model,
    kb_collections: run.kb_collections,
    retrieved_chunks: run.retrieved_chunks,
    output: run.output,
    status: run.status,
    created_by: run.created_by,
    created_at: run.created_at,
  }).then(() => {});

  return run;
}

export function updateBotRunStatus(runId: string, status: "applied" | "discarded"): void {
  const run = botRunsCache.find(r => r.id === runId);
  if (run) {
    run.status = status;
  }

  supabase.from("bot_runs").update({ status }).eq("id", runId).then(() => {});
}

export function getBotRunsForDocument(docInstanceId: string): BotRun[] {
  return botRunsCache.filter(r => r.doc_instance_id === docInstanceId);
}

export function getBotRunById(runId: string): BotRun | null {
  return botRunsCache.find(r => r.id === runId) || null;
}

// ============================================================
// FETCH CHUNKS FOR A DOCUMENT
// ============================================================

export async function fetchChunksForDocument(docId: string): Promise<KBChunk[]> {
  ensureCaches();

  try {
    const { data, error } = await supabase
      .from("kb_chunks")
      .select("*")
      .eq("document_id", docId)
      .order("chunk_index");

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn('[KB] fetchChunksForDocument Supabase fallback:', err);
  }

  // Search all caches
  const cacheKeys = Array.from(chunksCache.keys());
  for (const key of cacheKeys) {
    const chunks = chunksCache.get(key) || [];
    const docChunks = chunks.filter((c: KBChunk) => c.document_id === docId);
    if (docChunks.length > 0) return docChunks;
  }

  return [];
}
