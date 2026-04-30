import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export const ecrRulesRouter = Router();

// GET /api/ecr/rule-sets
// Fetch all rule sets along with their weights
ecrRulesRouter.get('/rule-sets', async (req, res) => {
  try {
    const { data: ruleSets, error: rsError } = await supabaseAdmin
      .from('ecr_rule_sets')
      .select('*')
      .order('version_number', { ascending: false });

    if (rsError) {
      if (rsError.code === '42P01') {
        // relation does not exist
        return res.json({ data: [] });
      }
      throw rsError;
    }

    const { data: weights, error: wError } = await supabaseAdmin
      .from('ecr_rule_weights')
      .select('*');

    if (wError) throw wError;

    // Map to frontend structure
    const mappedRuleSets = (ruleSets || []).map(rs => ({
      id: rs.id,
      versionNumber: rs.version_number,
      name: rs.name,
      description: rs.description,
      status: rs.status,
      createdBy: rs.created_by,
      createdAt: rs.created_at,
      evolutionControls: rs.evolution_controls
    }));

    const mappedWeights = (weights || []).map(w => ({
      id: w.id,
      ruleSetId: w.rule_set_id,
      metricId: w.metric_id,
      weight: w.weight,
      createdAt: w.created_at
    }));

    res.json({
      ruleSets: mappedRuleSets,
      weights: mappedWeights
    });
  } catch (error: any) {
    console.error('Error fetching ECR rule sets:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ecr/rule-sets
// Create a new rule set with initial weights
ecrRulesRouter.post('/rule-sets', async (req, res) => {
  try {
    const { ruleSet, weights } = req.body;

    // 1. Insert Rule Set
    const { error: rsError } = await supabaseAdmin
      .from('ecr_rule_sets')
      .insert([{
        id: ruleSet.id,
        version_number: ruleSet.versionNumber,
        name: ruleSet.name,
        description: ruleSet.description,
        status: ruleSet.status,
        created_by: ruleSet.createdBy,
        evolution_controls: ruleSet.evolutionControls
      }]);

    if (rsError) throw rsError;

    // 2. Insert Weights
    if (weights && weights.length > 0) {
      const dbWeights = weights.map((w: any) => ({
        id: w.id,
        rule_set_id: w.ruleSetId,
        metric_id: w.metricId,
        weight: w.weight
      }));

      const { error: wError } = await supabaseAdmin
        .from('ecr_rule_weights')
        .insert(dbWeights);

      if (wError) throw wError;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error creating ECR rule set:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ecr/rule-sets/:id
// Update rule set (status, evolution controls, etc)
ecrRulesRouter.put('/rule-sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, evolutionControls } = req.body;

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (evolutionControls !== undefined) updates.evolution_controls = evolutionControls;

    // If activating, archive others first
    if (status === 'active') {
      await supabaseAdmin
        .from('ecr_rule_sets')
        .update({ status: 'archived' })
        .eq('status', 'active');
    }

    const { error } = await supabaseAdmin
      .from('ecr_rule_sets')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error(`Error updating ECR rule set ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ecr/rule-sets/:id/weights
// Update multiple weights for a rule set
ecrRulesRouter.put('/rule-sets/:id/weights', async (req, res) => {
  try {
    const { id } = req.params;
    const { weights } = req.body;

    // Delete existing weights
    await supabaseAdmin
      .from('ecr_rule_weights')
      .delete()
      .eq('rule_set_id', id);

    // Insert new weights
    if (weights && weights.length > 0) {
      const dbWeights = weights.map((w: any) => ({
        id: w.id,
        rule_set_id: w.ruleSetId,
        metric_id: w.metricId,
        weight: w.weight
      }));

      const { error } = await supabaseAdmin
        .from('ecr_rule_weights')
        .insert(dbWeights);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(`Error updating ECR weights for ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});
