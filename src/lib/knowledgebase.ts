/**
 * knowledgebase.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.10).
 *
 * Knowledgebase reads over the established Supabase tables
 * (kb_collections, kb_documents, kb_chunks, bot_kb_links) plus pure
 * formatting/construction helpers.
 *
 * There is no seed data and no in-memory fallback: empty tables yield empty
 * results, and read failures surface to the caller. Nothing here executes a
 * bot — retrieval is a data read, createBotRun only constructs a record.
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";

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

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  collection_name: string;
  chunk_index: number;
  content: string;
  relevance_score: number;
}

// Internal (non-exported): row/link/run shapes used by this module.
interface KBDocumentRow {
  id: string;
  collection_id: string;
  title: string;
  is_deleted: boolean;
}

interface KBChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
}

interface BotKBLink {
  bot_id: string;
  collection_id: string;
  priority: number;
  collection_name?: string;
}

interface BotRun {
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
  output: any;
  status: "draft" | "applied" | "discarded" | "failed";
  created_by: string;
  created_at: string;
}

// ============================================================
// COLLECTIONS
// ============================================================

export async function fetchCollections(): Promise<KBCollection[]> {
  const { data, error } = await supabase
    .from("kb_collections")
    .select("*, kb_documents(count), kb_chunks(count)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load knowledgebase collections: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
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

// ============================================================
// RETRIEVAL ENGINE (Supabase reads + pure scoring)
// ============================================================

async function fetchBotKBLinks(botId: string): Promise<BotKBLink[]> {
  const { data, error } = await supabase
    .from("bot_kb_links")
    .select("*, kb_collections(name)")
    .eq("bot_id", botId)
    .order("priority");

  if (error) {
    throw new Error(`Failed to load bot knowledgebase links: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    bot_id: row.bot_id,
    collection_id: row.collection_id,
    priority: row.priority,
    collection_name: row.kb_collections?.name,
  }));
}

/**
 * Retrieve context chunks for a bot's linked KB collections.
 * Strategy: read live kb_documents + kb_chunks for the linked collections,
 * then keyword-score locally. If nothing is linked or stored, the result is
 * an explicit empty list.
 */
export async function retrieveContext(
  botId: string,
  query: string,
  maxChunks = 6,
): Promise<RetrievedChunk[]> {
  // 1. Get bot's linked collections
  const links = await fetchBotKBLinks(botId);
  if (links.length === 0) return [];

  const collectionIds = links.map(l => l.collection_id);
  const priorityByCollection = new Map(links.map(l => [l.collection_id, l.priority] as const));
  const nameByCollection = new Map(links.map(l => [l.collection_id, l.collection_name || l.collection_id] as const));

  // 2. Load live documents for those collections
  const docsRes = await supabase
    .from("kb_documents")
    .select("id, collection_id, title, is_deleted")
    .in("collection_id", collectionIds)
    .eq("is_deleted", false);
  if (docsRes.error) {
    throw new Error(`Failed to load knowledgebase documents: ${docsRes.error.message}`);
  }
  const docs = (docsRes.data ?? []) as KBDocumentRow[];
  if (docs.length === 0) return [];

  const docIds = docs.map(d => d.id);
  const docById = new Map(docs.map(d => [d.id, d] as const));

  // 3. Load live chunks for those documents
  const chunksRes = await supabase
    .from("kb_chunks")
    .select("id, document_id, chunk_index, content")
    .in("document_id", docIds)
    .order("chunk_index");
  if (chunksRes.error) {
    throw new Error(`Failed to load knowledgebase chunks: ${chunksRes.error.message}`);
  }
  const chunkRows = (chunksRes.data ?? []) as KBChunkRow[];

  const allChunks = chunkRows.flatMap((chunk) => {
    const doc = docById.get(chunk.document_id);
    if (!doc) return [];
    return [{
      ...chunk,
      doc_title: doc.title,
      collection_name: nameByCollection.get(doc.collection_id) ?? doc.collection_id,
      collection_priority: priorityByCollection.get(doc.collection_id) ?? 0,
    }];
  });

  if (allChunks.length === 0) return [];

  // 4. Score chunks by keyword relevance
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = allChunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = (contentLower.match(new RegExp(escaped, "g")) || []).length;
      score += matches * (1 / (chunk.collection_priority + 1)); // higher priority = higher weight
    }

    // Boost exact phrase matches
    const queryLower = query.toLowerCase().substring(0, 100);
    if (queryLower && contentLower.includes(queryLower)) {
      score += 10;
    }

    return { chunk, score };
  });

  // 5. Sort by score (descending), then by collection priority
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chunk.collection_priority - b.chunk.collection_priority;
  });

  // 6. Take top N chunks
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
 * Includes citation markers. Pure formatting — no I/O.
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

// ============================================================
// BOT RUNS (record construction only — no execution, no I/O)
// ============================================================

export function createBotRun(params: Omit<BotRun, "id" | "created_at" | "created_by">): BotRun {
  const user = getCurrentUser();
  return {
    ...params,
    id: `botrun-${crypto.randomUUID().substring(0, 8)}`,
    created_by: user.id,
    created_at: new Date().toISOString(),
  };
}
