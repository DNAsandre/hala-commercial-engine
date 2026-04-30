import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export const handoversRouter = Router();

// GET /api/handovers
handoversRouter.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('handover_processes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        // relation does not exist - return empty array
        return res.json({ data: [] });
      }
      throw error;
    }
    
    // Map snake_case from DB to camelCase for frontend
    const mapped = (data || []).map(row => ({
      id: row.id,
      customer: row.customer,
      workspace: row.workspace,
      crmDealId: row.crm_deal_id,
      contractValue: row.contract_value,
      startDate: row.start_date,
      targetGoLive: row.target_go_live,
      overallProgress: row.overall_progress,
      msaStatus: row.msa_status,
      departments: row.departments || []
    }));

    res.json({ data: mapped });
  } catch (error: any) {
    console.error('Error fetching handovers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/handovers/:id
handoversRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('handover_processes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Not found' });

    res.json({
      data: {
        id: data.id,
        customer: data.customer,
        workspace: data.workspace,
        crmDealId: data.crm_deal_id,
        contractValue: data.contract_value,
        startDate: data.start_date,
        targetGoLive: data.target_go_live,
        overallProgress: data.overall_progress,
        msaStatus: data.msa_status,
        departments: data.departments || []
      }
    });
  } catch (error: any) {
    console.error(`Error fetching handover ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/handovers
handoversRouter.post('/', async (req, res) => {
  try {
    const payload = req.body;
    
    // Convert camelCase to snake_case
    const dbPayload = {
      id: payload.id,
      customer: payload.customer,
      workspace: payload.workspace,
      crm_deal_id: payload.crmDealId,
      contract_value: payload.contractValue || 0,
      start_date: payload.startDate,
      target_go_live: payload.targetGoLive,
      overall_progress: payload.overallProgress || 0,
      msa_status: payload.msaStatus || 'pending',
      departments: payload.departments || []
    };

    const { data, error } = await supabaseAdmin
      .from('handover_processes')
      .insert([dbPayload])
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error: any) {
    console.error('Error creating handover:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/handovers/:id
handoversRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const dbPayload: any = {};
    if (payload.overallProgress !== undefined) dbPayload.overall_progress = payload.overallProgress;
    if (payload.msaStatus !== undefined) dbPayload.msa_status = payload.msaStatus;
    if (payload.departments !== undefined) dbPayload.departments = payload.departments;

    const { data, error } = await supabaseAdmin
      .from('handover_processes')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error: any) {
    console.error(`Error updating handover ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});
