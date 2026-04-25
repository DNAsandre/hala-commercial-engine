/**
 * Document API Routes — Sprint 6 + Sprint 7 (Vault & Versioning)
 * Server-side PDF generation, Supabase Storage, metadata tracking.
 * Sprint 7 adds: vault search, filters, status management, version lineage.
 * No CRM, email, AI, or e-signature.
 */
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';
import { generatePdfBuffer } from '../lib/pdf-generator.js';
import { buildRenderContext } from '../lib/document-render-context.js';

export const documentRoutes = Router();
documentRoutes.use(requireAuth);

const BUCKET = 'documents';

// Resolves generated_by user IDs → display names. Best-effort: never throws.
async function enrichWithUserNames(docs: any[]): Promise<any[]> {
  const ids = [...new Set(docs.map(d => d.generated_by).filter(Boolean))];
  if (ids.length === 0) return docs;
  try {
    const { data: users } = await supabaseAdmin.from('users').select('id, name').in('id', ids);
    const nameMap: Record<string, string> = {};
    for (const u of users || []) nameMap[u.id] = u.name;
    return docs.map(d => ({ ...d, generated_by_name: nameMap[d.generated_by] || null }));
  } catch {
    return docs;
  }
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.find((b: any) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
  }
  bucketReady = true;
}

// ─── POST /api/documents/generate-pdf ─────────────────────
const generateSchema = z.object({
  workspace_id: z.string().min(1),
  document_type: z.enum(['quote', 'proposal', 'sla']),
  source_id: z.string().min(1),
  source_version: z.number().optional(),
  language: z.string().default('en'),
  notes: z.string().default(''),
});

documentRoutes.post('/documents/generate-pdf',
  validateBody(generateSchema),
  async (req, res, next) => {
    try {
      const body = (req as any).validatedBody;
      const { workspace_id, document_type, source_id, language, notes } = body;

      const ctx = await buildRenderContext(document_type, source_id, workspace_id);
      const pdfBuffer = await generatePdfBuffer(ctx);
      const checksum = crypto.createHash('md5').update(pdfBuffer).digest('hex');

      // Find previous latest to link supersedes
      const { data: existing } = await supabaseAdmin
        .from('generated_documents').select('id, version_number')
        .eq('workspace_id', workspace_id).eq('document_type', document_type).eq('source_id', source_id)
        .eq('status', 'generated')
        .order('version_number', { ascending: false }).limit(1);
      const prevId = existing?.[0]?.id || null;
      const ver = (existing?.[0]?.version_number || 0) + 1;

      const custSlug = (ctx.customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const date = new Date().toISOString().split('T')[0];
      const fileName = `${document_type}-v${ver}-${date}.pdf`;
      const storagePath = `customers/${custSlug}/workspaces/${workspace_id}/${document_type}/v${ver}/${fileName}`;

      await ensureBucket();
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET).upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) throw { status: 500, message: `Storage upload failed: ${uploadErr.message}`, code: 'STORAGE_ERROR' };

      // Mark old versions as superseded
      if (prevId) {
        const { error: supersededErr } = await supabaseAdmin.from('generated_documents')
          .update({ status: 'superseded' })
          .eq('workspace_id', workspace_id).eq('document_type', document_type).eq('source_id', source_id)
          .eq('status', 'generated');
        if (supersededErr) console.warn('[documents] supersede failed (non-blocking):', supersededErr.message);
      }

      const row = {
        workspace_id, customer_id: ctx.sourceData?.customer_id || null,
        document_type, source_type: document_type, source_id,
        source_version: body.source_version || ctx.sourceData?.version_number || ctx.sourceData?.version || 1,
        file_name: fileName, storage_path: storagePath,
        file_size: pdfBuffer.length, mime_type: 'application/pdf',
        language, status: 'generated',
        generated_by: req.authUser?.userId, version_number: ver,
        checksum, notes, supersedes_document_id: prevId,
      };

      const { data: doc, error: dbErr } = await supabaseAdmin
        .from('generated_documents').insert(row).select().single();
      if (dbErr) throw { status: 500, message: dbErr.message, code: 'DB_ERROR' };

      // Consistency guard: warn if multiple generated records exist for same source
      const { count: generatedCount } = await supabaseAdmin
        .from('generated_documents')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id).eq('document_type', document_type).eq('source_id', source_id)
        .eq('status', 'generated');
      if (generatedCount && generatedCount > 1) {
        console.warn(`[documents] consistency warning: ${generatedCount} generated records for ${document_type}/${source_id} in workspace ${workspace_id} — supersede may have failed`);
      }

      await writeAuditLog({
        actor: req.authUser, action: 'document.generated',
        entityType: 'generated_document', entityId: doc.id,
        after: { document_type, source_id, storage_path: storagePath, version: ver, supersedes: prevId },
        source: 'human',
      });
      res.status(201).json({ data: doc });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/documents/download/:id ──────────────────────
documentRoutes.get('/documents/download/:id', async (req, res, next) => {
  try {
    const { data: doc } = await supabaseAdmin
      .from('generated_documents').select('*').eq('id', req.params.id).single();
    if (!doc) { res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' }); return; }

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET).createSignedUrl(doc.storage_path, 3600);
    if (error || !signed) { res.status(500).json({ error: 'Failed to generate download URL', code: 'STORAGE_ERROR' }); return; }

    // Track last downloaded
    await supabaseAdmin.from('generated_documents').update({ last_downloaded_at: new Date().toISOString() }).eq('id', doc.id);

    await writeAuditLog({
      actor: req.authUser, action: 'document.downloaded',
      entityType: 'generated_document', entityId: doc.id,
      after: { document_type: doc.document_type, file_name: doc.file_name },
      source: 'human',
    });
    res.json({ data: { ...doc, download_url: signed.signedUrl } });
  } catch (err) { next(err); }
});

// ─── GET /api/documents/:id ──────────────────────────────
documentRoutes.get('/documents/:id', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('generated_documents').select('*').eq('id', req.params.id).single();
    if (!data) { res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' }); return; }
    res.json({ data });
  } catch (err) { next(err); }
});

// ─── GET /api/workspaces/:workspaceId/documents ───────────
documentRoutes.get('/workspaces/:workspaceId/documents', async (req, res, next) => {
  try {
    let q = supabaseAdmin.from('generated_documents').select('*')
      .eq('workspace_id', req.params.workspaceId);
    if (req.query.document_type) q = q.eq('document_type', req.query.document_type as string);
    if (req.query.status) q = q.eq('status', req.query.status as string);
    q = q.order('generated_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    const enriched = await enrichWithUserNames(data || []);
    res.json({ data: enriched, count: enriched.length });
  } catch (err) { next(err); }
});

// ─── GET /api/customers/:customerId/documents ─────────────
documentRoutes.get('/customers/:customerId/documents', async (req, res, next) => {
  try {
    let q = supabaseAdmin.from('generated_documents').select('*')
      .eq('customer_id', req.params.customerId);
    if (req.query.document_type) q = q.eq('document_type', req.query.document_type as string);
    if (req.query.status) q = q.eq('status', req.query.status as string);
    q = q.order('generated_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) { next(err); }
});

// ─── GET /api/documents — Central Vault (filtered) ────────
documentRoutes.get('/documents', async (req, res, next) => {
  try {
    let q = supabaseAdmin.from('generated_documents').select('*');
    if (req.query.workspace_id) q = q.eq('workspace_id', req.query.workspace_id as string);
    if (req.query.customer_id) q = q.eq('customer_id', req.query.customer_id as string);
    if (req.query.document_type) q = q.eq('document_type', req.query.document_type as string);
    if (req.query.source_type) q = q.eq('source_type', req.query.source_type as string);
    if (req.query.status) q = q.eq('status', req.query.status as string);
    if (req.query.language) q = q.eq('language', req.query.language as string);
    if (req.query.generated_by) q = q.eq('generated_by', req.query.generated_by as string);
    if (req.query.date_from) q = q.gte('generated_at', req.query.date_from as string);
    if (req.query.date_to) q = q.lte('generated_at', req.query.date_to as string);
    if (req.query.search) q = q.ilike('file_name', `%${req.query.search}%`);
    q = q.order('generated_at', { ascending: false }).limit(200);
    const { data, error } = await q;
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    const enriched = await enrichWithUserNames(data || []);
    res.json({ data: enriched, count: enriched.length });
  } catch (err) { next(err); }
});

// ─── PATCH /api/documents/:id/status ──────────────────────
const statusSchema = z.object({
  status: z.enum(['generated', 'superseded', 'archived']),
}).strict();

documentRoutes.patch('/documents/:id/status',
  validateBody(statusSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { status } = (req as any).validatedBody;
      const { data: before } = await supabaseAdmin.from('generated_documents').select('*').eq('id', id).single();
      if (!before) { res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' }); return; }
      const { data: after, error } = await supabaseAdmin.from('generated_documents')
        .update({ status }).eq('id', id).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      await writeAuditLog({
        actor: req.authUser, action: `document.status_changed`,
        entityType: 'generated_document', entityId: id,
        before: { status: before.status }, after: { status },
        source: 'human',
      });
      res.json({ data: after });
    } catch (err) { next(err); }
  }
);
