/**
 * Sprint 11 — Knowledgebase Engine
 *
 * Data model, chunking, retrieval, and citation logic for the
 * Bot Builder + Editor AI integration.
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
const SEED_COLLECTIONS: KBCollection[] = [
  {
    id: "kb-col-1",
    name: "Hala Service Catalog",
    description: "Complete catalog of Hala Supply Chain Services offerings, capabilities, and SLAs",
    visibility: "internal",
    created_by: "admin",
    created_at: "2025-11-01T00:00:00Z",
    doc_count: 3,
    chunk_count: 18,
  },
  {
    id: "kb-col-2",
    name: "Legal Templates & Clauses",
    description: "Standard legal clauses, T&C templates, and Saudi commercial law references",
    visibility: "admin-only",
    created_by: "admin",
    created_at: "2025-11-15T00:00:00Z",
    doc_count: 2,
    chunk_count: 12,
  },
  {
    id: "kb-col-3",
    name: "Case Studies & References",
    description: "Client success stories, reference architectures, and industry benchmarks",
    visibility: "internal",
    created_by: "admin",
    created_at: "2025-12-01T00:00:00Z",
    doc_count: 4,
    chunk_count: 24,
  },
  {
    id: "kb-col-4",
    name: "Pricing & Rate Cards",
    description: "Standard rate cards, pricing models, and commercial terms reference",
    visibility: "admin-only",
    created_by: "admin",
    created_at: "2026-01-10T00:00:00Z",
    doc_count: 2,
    chunk_count: 10,
  },
];

const SEED_DOCUMENTS: KBDocument[] = [
  // Collection 1: Service Catalog
  {
    id: "kb-doc-1a",
    collection_id: "kb-col-1",
    title: "Hala Warehousing Services Overview",
    source_type: "manual",
    file_url: null,
    text_content: "Hala Supply Chain Services operates 12 state-of-the-art warehousing facilities across Saudi Arabia, totaling over 500,000 square meters of storage capacity. Our facilities support ambient, temperature-controlled (+2°C to +8°C), and frozen storage (-18°C to -25°C) zones. Each facility is equipped with advanced Warehouse Management Systems (WMS) integrated with real-time inventory tracking, automated pick-and-pack systems, and IoT-enabled environmental monitoring. We maintain 99.8% inventory accuracy through cycle counting and barcode/RFID verification. Our warehousing services include inbound receiving and quality inspection, put-away optimization, inventory management with real-time visibility, order fulfillment and kitting, value-added services (labeling, repackaging, quality checks), and cross-docking for time-sensitive shipments.",
    mime: "text/plain",
    size: 680,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2025-11-01T10:00:00Z",
    is_deleted: false,
  },
  {
    id: "kb-doc-1b",
    collection_id: "kb-col-1",
    title: "Hala Transportation & Last-Mile Delivery",
    source_type: "manual",
    file_url: null,
    text_content: "Our transportation network covers all major cities and industrial zones across the Kingdom of Saudi Arabia. We operate a fleet of 450+ vehicles including refrigerated trucks, flatbed trailers, and last-mile delivery vans. Route optimization is powered by AI-driven logistics planning that reduces transit times by an average of 18%. We offer same-day delivery within major metropolitan areas (Riyadh, Jeddah, Dammam), next-day delivery to secondary cities, and scheduled delivery windows for B2B clients. Our cold-chain transportation maintains unbroken temperature integrity from warehouse to destination, with real-time GPS tracking and temperature logging accessible through our client portal. All drivers are trained in safe handling procedures for pharmaceutical, food, and hazardous materials categories.",
    mime: "text/plain",
    size: 720,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2025-11-05T10:00:00Z",
    is_deleted: false,
  },
  {
    id: "kb-doc-1c",
    collection_id: "kb-col-1",
    title: "Hala Technology & Integration Capabilities",
    source_type: "manual",
    file_url: null,
    text_content: "Hala's technology stack provides end-to-end supply chain visibility through our proprietary platform. Key capabilities include: WMS integration with SAP, Oracle, and Microsoft Dynamics via standard APIs and EDI connections. Real-time dashboard with KPI tracking for fill rates, order accuracy, on-time delivery, and inventory turns. Client portal with self-service reporting, order tracking, and document management. IoT sensor network for temperature, humidity, and security monitoring across all facilities. Mobile app for delivery confirmation with photo proof-of-delivery and electronic signatures. Business intelligence suite with predictive analytics for demand forecasting and capacity planning. We support integration timelines of 4-6 weeks for standard ERP connections and 8-12 weeks for custom integrations.",
    mime: "text/plain",
    size: 750,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2025-11-10T10:00:00Z",
    is_deleted: false,
  },
  // Collection 2: Legal
  {
    id: "kb-doc-2a",
    collection_id: "kb-col-2",
    title: "Standard Terms & Conditions Template",
    source_type: "manual",
    file_url: null,
    text_content: "STANDARD TERMS AND CONDITIONS FOR LOGISTICS SERVICES. 1. DEFINITIONS: 'Services' means the logistics, warehousing, and transportation services described in the Service Order. 'Client' means the party engaging Hala for Services. 'Goods' means the items entrusted to Hala for storage, handling, or transportation. 2. LIABILITY: Hala's liability for loss or damage to Goods shall be limited to the lesser of (a) the declared value of the Goods or (b) SAR 100 per kilogram of gross weight. Hala shall not be liable for consequential, indirect, or special damages. 3. INSURANCE: Client shall maintain adequate insurance coverage for all Goods. Hala maintains comprehensive warehouse legal liability insurance with coverage of SAR 50 million per occurrence. 4. FORCE MAJEURE: Neither party shall be liable for failure to perform due to Force Majeure events including natural disasters, government actions, pandemics, strikes, or civil unrest. 5. GOVERNING LAW: This Agreement shall be governed by the laws of the Kingdom of Saudi Arabia. Disputes shall be resolved through arbitration under SCCA rules in Riyadh. 6. TERMINATION: Either party may terminate with 90 days written notice. Early termination fees apply as specified in the Service Order.",
    mime: "text/plain",
    size: 1100,
    chunk_count: 2,
    created_by: "admin",
    created_at: "2025-11-15T10:00:00Z",
    is_deleted: false,
  },
  {
    id: "kb-doc-2b",
    collection_id: "kb-col-2",
    title: "SLA Framework & KPI Definitions",
    source_type: "manual",
    file_url: null,
    text_content: "SERVICE LEVEL AGREEMENT FRAMEWORK. Standard KPIs: 1. Order Accuracy: Target 99.5%, measured monthly. Penalty: 2% credit per 0.1% below target. 2. On-Time Delivery: Target 98%, measured monthly. Penalty: 1.5% credit per 1% below target. 3. Inventory Accuracy: Target 99.8%, measured quarterly via cycle counts. 4. Inbound Processing: Target 24-hour turnaround for standard receipts, 4-hour for urgent. 5. Temperature Compliance: Target 100% for cold-chain, with automated alerts for any deviation exceeding 2°C from set point for more than 15 minutes. 6. Damage Rate: Target below 0.1% of units handled. Escalation Matrix: Level 1 (Operational) — Account Manager, response within 4 hours. Level 2 (Management) — Operations Director, response within 8 hours. Level 3 (Executive) — VP Operations, response within 24 hours. Monthly service review meetings with detailed KPI reporting and continuous improvement action plans.",
    mime: "text/plain",
    size: 900,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2025-11-20T10:00:00Z",
    is_deleted: false,
  },
  // Collection 3: Case Studies
  {
    id: "kb-doc-3a",
    collection_id: "kb-col-3",
    title: "Case Study: Almarai Cold Chain Partnership",
    source_type: "manual",
    file_url: null,
    text_content: "CLIENT: Almarai Company. INDUSTRY: Food & Dairy. CHALLENGE: Almarai required a reliable cold-chain partner to handle distribution of fresh dairy products across the Eastern Province, maintaining strict temperature controls from production facility to retail outlets. SOLUTION: Hala deployed a dedicated fleet of 35 refrigerated vehicles with real-time temperature monitoring, established a 15,000 sqm temperature-controlled distribution center in Dammam, and implemented a custom WMS integration with Almarai's SAP system. RESULTS: 99.7% temperature compliance maintained across all shipments. 98.5% on-time delivery rate achieved within 6 months. 15% reduction in distribution costs through route optimization. Zero product recalls due to cold-chain breaks over 18-month period. CLIENT TESTIMONIAL: 'Hala's cold-chain expertise and technology integration have been instrumental in maintaining the quality standards our customers expect.' — Supply Chain Director, Almarai.",
    mime: "text/plain",
    size: 850,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2025-12-01T10:00:00Z",
    is_deleted: false,
  },
  {
    id: "kb-doc-3b",
    collection_id: "kb-col-3",
    title: "Case Study: SABIC Industrial Logistics",
    source_type: "manual",
    file_url: null,
    text_content: "CLIENT: SABIC. INDUSTRY: Petrochemicals. CHALLENGE: SABIC needed a specialized logistics partner for handling hazardous materials and oversized industrial equipment across multiple manufacturing sites in Jubail Industrial City. SOLUTION: Hala provided certified hazmat handling teams, specialized transport equipment, and a dedicated warehouse facility with appropriate safety systems. We implemented a custom tracking system for regulatory compliance documentation. RESULTS: 100% regulatory compliance maintained across all shipments. 40% improvement in warehouse utilization through optimized layout design. Successful handling of 12,000+ hazmat shipments without incident. Integration with SABIC's procurement system reduced order processing time by 60%.",
    mime: "text/plain",
    size: 700,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2025-12-05T10:00:00Z",
    is_deleted: false,
  },
  // Collection 4: Pricing
  {
    id: "kb-doc-4a",
    collection_id: "kb-col-4",
    title: "Standard Rate Card 2026",
    source_type: "manual",
    file_url: null,
    text_content: "HALA SUPPLY CHAIN SERVICES — STANDARD RATE CARD 2026. Warehousing: Ambient storage SAR 12-18/pallet/month. Chilled storage SAR 25-35/pallet/month. Frozen storage SAR 40-55/pallet/month. Handling: Inbound receiving SAR 3-5/pallet. Outbound picking SAR 2-4/order line. Value-added services priced per activity. Transportation: Local delivery (within city) SAR 150-300/trip. Regional delivery SAR 500-1,200/trip. Long-haul SAR 2,500-5,000/trip. Cold-chain premium: +25-40% on base rates. Technology: Standard WMS access included. Custom integration setup SAR 15,000-50,000. API access included for enterprise clients. All rates subject to volume commitments and contract duration. Minimum contract term: 12 months.",
    mime: "text/plain",
    size: 650,
    chunk_count: 1,
    created_by: "admin",
    created_at: "2026-01-10T10:00:00Z",
    is_deleted: false,
  },
];

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
