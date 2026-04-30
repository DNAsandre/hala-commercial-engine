/**
 * Document Instance API Routes — Sprint 2
 * CRUD for doc_instances and doc_instance_versions.
 * Includes compile endpoint that generates a branded PDF.
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';
import { generatePdfBuffer } from '../lib/pdf-generator.js';

export const docInstanceRoutes = Router();
docInstanceRoutes.use(requireAuth);

// ─── GET /api/doc-instances ───────────────────────────────
docInstanceRoutes.get('/doc-instances', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('doc_instances')
      .select('*')
      .order('updated_at', { ascending: false });

    if (req.query.workspace_id) query = query.eq('workspace_id', req.query.workspace_id as string);
    if (req.query.customer_id) query = query.eq('customer_id', req.query.customer_id as string);
    if (req.query.doc_type) query = query.eq('doc_type', req.query.doc_type as string);

    const { data: instances, error } = await query;
    if (error) throw { status: 500, message: error.message };
    if (!instances || instances.length === 0) return res.json({ data: [] });

    const ids = instances.map((i: any) => i.id);
    const { data: versions } = await supabaseAdmin
      .from('doc_instance_versions')
      .select('*')
      .in('doc_instance_id', ids)
      .order('version_number');

    const vMap: Record<string, any[]> = {};
    for (const v of (versions || [])) {
      if (!vMap[v.doc_instance_id]) vMap[v.doc_instance_id] = [];
      vMap[v.doc_instance_id].push(v);
    }

    res.json({ data: instances.map((i: any) => ({ ...i, versions: vMap[i.id] || [] })) });
  } catch (err) { next(err); }
});

// ─── POST /api/doc-instances ──────────────────────────────
const createSchema = z.object({
  doc_type: z.enum(['quote', 'proposal', 'sla', 'msa', 'service_order_transport', 'service_order_warehouse']),
  template_version_id: z.string().nullable().optional(),   // TEXT in DB — no uuid() constraint
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().default(''),
  workspace_id: z.string().uuid().nullable().optional(),
  workspace_name: z.string().nullable().optional(),
  title: z.string().optional(),
  branding_profile_id: z.string().nullable().optional(),   // TEXT in DB — no uuid() constraint
  linked_entity_type: z.string().nullable().optional(),
  linked_entity_id: z.string().nullable().optional(),
  initial_blocks: z.array(z.any()).default([]),
});

docInstanceRoutes.post('/doc-instances', validateBody(createSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const now = new Date().toISOString();

    const { data: instance, error: instErr } = await supabaseAdmin
      .from('doc_instances')
      .insert({
        doc_type: body.doc_type,
        template_version_id: body.template_version_id ?? null,
        status: 'draft',
        customer_id: body.customer_id ?? null,
        customer_name: body.customer_name,
        workspace_id: body.workspace_id ?? null,
        workspace_name: body.workspace_name ?? null,
        title: body.title ?? null,
        branding_profile_id: body.branding_profile_id ?? null,
        linked_entity_type: body.linked_entity_type ?? null,
        linked_entity_id: body.linked_entity_id ?? null,
        is_compiled: false,
        created_by: req.authUser?.userId || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (instErr) throw { status: 500, message: instErr.message };

    const { data: version, error: verErr } = await supabaseAdmin
      .from('doc_instance_versions')
      .insert({
        doc_instance_id: instance.id,
        version_number: 1,
        blocks: body.initial_blocks,
        bindings: {},
        created_by: req.authUser?.userId || null,
        created_at: now,
      })
      .select()
      .single();
    if (verErr) throw { status: 500, message: verErr.message };

    await supabaseAdmin
      .from('doc_instances')
      .update({ current_version_id: version.id, updated_at: now })
      .eq('id', instance.id);

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_instance.create',
      entityType: 'doc_instances',
      entityId: instance.id,
      after: { doc_type: body.doc_type, title: body.title },
      source: 'human',
    });

    res.status(201).json({ data: { ...instance, current_version_id: version.id, versions: [version] } });
  } catch (err) { next(err); }
});

// ─── GET /api/doc-instances/:id ───────────────────────────
docInstanceRoutes.get('/doc-instances/:id', async (req, res, next) => {
  try {
    const { data: instance, error } = await supabaseAdmin
      .from('doc_instances')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !instance) throw { status: 404, message: 'Document instance not found', code: 'NOT_FOUND' };

    const { data: versions } = await supabaseAdmin
      .from('doc_instance_versions')
      .select('*')
      .eq('doc_instance_id', req.params.id)
      .order('version_number');

    res.json({ data: { ...instance, versions: versions || [] } });
  } catch (err) { next(err); }
});

// ─── PATCH /api/doc-instances/:id ────────────────────────
const updateSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['draft', 'canon']).optional(),
  branding_profile_id: z.string().nullable().optional(),
});

docInstanceRoutes.patch('/doc-instances/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const { data, error } = await supabaseAdmin
      .from('doc_instances')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };
    if (!data) throw { status: 404, message: 'Document instance not found', code: 'NOT_FOUND' };

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_instance.update',
      entityType: 'doc_instances',
      entityId: req.params.id,
      after: body,
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ─── POST /api/doc-instances/:id/versions ─────────────────
const saveVersionSchema = z.object({
  blocks: z.array(z.any()).default([]),
  bindings: z.record(z.string(), z.any()).default(() => ({})),
});

docInstanceRoutes.post('/doc-instances/:id/versions', validateBody(saveVersionSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('doc_instance_versions')
      .select('version_number')
      .eq('doc_instance_id', req.params.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVer = ((existing?.[0]?.version_number) ?? 0) + 1;

    const { data: version, error: verErr } = await supabaseAdmin
      .from('doc_instance_versions')
      .insert({
        doc_instance_id: req.params.id,
        version_number: nextVer,
        blocks: body.blocks,
        bindings: body.bindings,
        created_by: req.authUser?.userId || null,
        created_at: now,
      })
      .select()
      .single();
    if (verErr) throw { status: 500, message: verErr.message };

    await supabaseAdmin
      .from('doc_instances')
      .update({ current_version_id: version.id, updated_at: now })
      .eq('id', req.params.id);

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_instance.save_version',
      entityType: 'doc_instance_versions',
      entityId: version.id,
      after: { version_number: nextVer, doc_instance_id: req.params.id },
      source: 'human',
    });

    res.status(201).json({ data: version });
  } catch (err) { next(err); }
});

// ─── POST /api/doc-instances/:id/compile ──────────────────
const compileSchema = z.object({
  branding_profile_id: z.string().nullable().optional(),
  title: z.string().optional(),
  variables: z.record(z.string(), z.string()).default(() => ({})),
});

const BUCKET = 'documents';

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.find((b: any) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
  }
}

docInstanceRoutes.post('/doc-instances/:id/compile', validateBody(compileSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;

    const { data: instance, error: instErr } = await supabaseAdmin
      .from('doc_instances')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (instErr || !instance) throw { status: 404, message: 'Document instance not found', code: 'NOT_FOUND' };

    const { data: version, error: verErr } = await supabaseAdmin
      .from('doc_instance_versions')
      .select('*')
      .eq('id', instance.current_version_id)
      .single();
    if (verErr || !version) throw { status: 404, message: 'Current version not found', code: 'NOT_FOUND' };

    // Resolve branding color
    const brandingId = body.branding_profile_id || instance.branding_profile_id;
    let primaryColor = '#1B2A4A';
    if (brandingId) {
      const { data: bp } = await supabaseAdmin
        .from('doc_branding_profiles')
        .select('primary_color')
        .eq('id', brandingId)
        .single();
      if (bp?.primary_color) primaryColor = bp.primary_color;
    }

    // Build variables context
    const variables: Record<string, string> = {
      customer_name: instance.customer_name || '',
      workspace_name: instance.workspace_name || '',
      date: new Date().toISOString().split('T')[0],
      ref_number: `HCS-${instance.doc_type.toUpperCase()}-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
      ...body.variables,
    };

    // Build PDF sections from blocks
    const blocks: any[] = Array.isArray(version.blocks)
      ? version.blocks
      : JSON.parse(String(version.blocks) || '[]');

    const sections = blocks
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .flatMap((block: any) => {
        const raw = block.content || '';
        const resolved = raw.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => variables[key] ?? `{{${key}}}`);
        const text = resolved.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) return [];
        return [{ type: 'text' as const, text }];
      });

    const title = body.title || instance.title || `${instance.customer_name} — ${instance.doc_type}`;
    const docNumber = `HCS-${instance.doc_type.toUpperCase()}-${new Date().toISOString().replace(/\D/g, '').substring(0, 8)}`;

    const pdfBuffer = await generatePdfBuffer({
      title,
      documentNumber: docNumber,
      customerName: instance.customer_name || '',
      generatedDate: new Date().toISOString().split('T')[0],
      sections,
      footer: `Hala Commercial Engine — ${title} — Confidential`,
      primaryColor,
    });

    const checksum = crypto.createHash('md5').update(pdfBuffer).digest('hex');

    // Upload PDF to storage
    await ensureBucket();
    const custSlug = (instance.customer_name || 'customer').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${instance.doc_type}-${date}.pdf`;
    const storagePath = `composer/${custSlug}/${instance.id}/${fileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) throw { status: 500, message: `Upload failed: ${uploadErr.message}`, code: 'STORAGE_ERROR' };

    // Create compiled_documents record
    const { data: compiled, error: cErr } = await supabaseAdmin
      .from('compiled_documents')
      .insert({
        doc_instance_id: instance.id,
        doc_instance_version_id: version.id,
        title,
        doc_type: instance.doc_type,
        customer_id: instance.customer_id ?? null,
        customer_name: instance.customer_name,
        workspace_id: instance.workspace_id ?? null,
        compiled_html: '',
        compiled_by: req.authUser?.name || req.authUser?.userId || 'system',
        status: 'success',
      })
      .select()
      .single();
    if (cErr) throw { status: 500, message: cErr.message };

    // Mark instance as compiled
    await supabaseAdmin
      .from('doc_instances')
      .update({ is_compiled: true, compiled_at: new Date().toISOString() })
      .eq('id', instance.id);

    // Return with signed download URL
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600);

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_instance.compile',
      entityType: 'compiled_documents',
      entityId: compiled.id,
      after: { doc_instance_id: instance.id, title, storage_path: storagePath },
      source: 'human',
    });

    res.status(201).json({
      data: {
        ...compiled,
        download_url: signed?.signedUrl ?? null,
        storage_path: storagePath,
        checksum,
        file_size: pdfBuffer.length,
      },
    });
  } catch (err) { next(err); }
});
