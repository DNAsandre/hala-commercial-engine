import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzODU2NSwiZXhwIjoyMDg3NDE0NTY1fQ.AR5WyyxVgXtHt8Foj66ms15vl-fBskXhxwTb99tz99A';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Use the Supabase SQL endpoint (PostgREST doesn't support DDL)
// We'll use the /rest/v1/rpc endpoint with a custom function, or fall back to direct SQL via the management API
const PROJECT_REF = 'kositquaqmuousalmoar';

async function runSQL(sql) {
  // Use the Supabase Management API to execute SQL
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql_text: sql }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    // If exec_sql doesn't exist, try the database REST API
    if (text.includes('Could not find the function')) {
      console.log('exec_sql RPC not available, trying direct approach...');
      return null;
    }
    throw new Error(`SQL execution failed: ${res.status} ${text}`);
  }
  return await res.json();
}

async function createTablesDirectly() {
  console.log('Creating escalation tables via direct inserts...');
  
  // Step 1: Try to create tables by inserting a test row and catching errors
  // If table doesn't exist, we need to use the SQL Editor approach
  
  // First, let's try inserting into escalation_rules
  const testRule = {
    id: 'test-rule',
    trigger_type: 'margin_breach',
    name: 'Test Rule',
    description: 'Test',
    severity: 'high',
    enabled: false,
    threshold_config: {},
    auto_assign_role: 'admin',
    created_by: 'system',
  };
  
  const { error: ruleError } = await supabase.from('escalation_rules').insert(testRule);
  
  if (ruleError && ruleError.code === 'PGRST205') {
    console.log('❌ Tables do not exist. Need to create via SQL Editor.');
    console.log('');
    console.log('Please run the following SQL in the Supabase SQL Editor:');
    console.log('File: migrations/007_escalation_engine.sql');
    console.log('');
    
    // Alternative: Use the Supabase Management API (requires project access token)
    // Let's try the pg_net approach or create a helper function
    
    // Try creating a helper RPC function first
    const createFnSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_text text) RETURNS void AS $$
      BEGIN
        EXECUTE sql_text;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // This won't work via PostgREST either... 
    // Let's use the Supabase Dashboard API instead
    const dashboardUrl = `https://${PROJECT_REF}.supabase.co/pg/query`;
    const res = await fetch(dashboardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: createFnSQL }),
    });
    
    if (res.ok) {
      console.log('✅ exec_sql function created, now running migration...');
      return true;
    } else {
      console.log('Dashboard API not available:', res.status);
      return false;
    }
  } else if (ruleError) {
    console.log('Insert error (table may exist with different schema):', ruleError);
  } else {
    console.log('✅ escalation_rules table exists, cleaning up test row...');
    await supabase.from('escalation_rules').delete().eq('id', 'test-rule');
  }
  
  return true;
}

async function seedRules() {
  console.log('📦 Seeding escalation rules...');
  
  const rules = [
    {
      id: 'rule-margin-breach',
      trigger_type: 'margin_breach',
      name: 'Margin Below Authority Threshold',
      description: 'GP% falls below 10% (CEO/CFO authority level). Requires executive review.',
      severity: 'critical',
      enabled: true,
      threshold_config: { gp_threshold: 10 },
      auto_assign_role: 'admin',
      created_by: 'system',
    },
    {
      id: 'rule-delta-breach',
      trigger_type: 'delta_breach',
      name: 'SLA vs P&L Delta Breach',
      description: 'SLA terms deviate from approved P&L beyond critical threshold (5% GP).',
      severity: 'high',
      enabled: true,
      threshold_config: { gp_delta_critical: 5, rate_delta_critical: 15 },
      auto_assign_role: 'admin',
      created_by: 'system',
    },
    {
      id: 'rule-stage-override',
      trigger_type: 'stage_override',
      name: 'Stage Forced Override',
      description: 'Admin bypassed a stage gate or pricing lock. Requires audit review.',
      severity: 'medium',
      enabled: true,
      threshold_config: {},
      auto_assign_role: 'admin',
      created_by: 'system',
    },
    {
      id: 'rule-customer-red',
      trigger_type: 'customer_score_red',
      name: 'Customer Score Critical',
      description: 'Customer grade is D or F — high commercial risk.',
      severity: 'high',
      enabled: true,
      threshold_config: { red_grades: ['D', 'F'] },
      auto_assign_role: 'admin',
      created_by: 'system',
    },
    {
      id: 'rule-renewal-risk',
      trigger_type: 'renewal_risk_red',
      name: 'Renewal Risk Critical',
      description: 'Renewal risk assessment flagged as critical (margin or churn risk).',
      severity: 'high',
      enabled: true,
      threshold_config: {},
      auto_assign_role: 'admin',
      created_by: 'system',
    },
  ];
  
  const { error } = await supabase.from('escalation_rules').upsert(rules, { onConflict: 'id' });
  if (error) {
    console.log('❌ Failed to seed rules:', error.message);
    return false;
  }
  console.log('✅ 5 escalation rules seeded');
  return true;
}

async function seedDemoEvents() {
  console.log('📦 Seeding demo escalation events...');
  
  const events = [
    {
      id: 'esc-demo-001',
      workspace_id: 'w4',
      rule_id: 'rule-margin-breach',
      trigger_type: 'margin_breach',
      severity: 'critical',
      title: 'Margin Breach: Al-Rajhi Emergency Storage',
      description: 'GP% at 8.5% — below 10% CEO/CFO threshold. Deal value SAR 800,000.',
      trigger_data: { workspace_name: 'Al-Rajhi Emergency Storage', gp_percent: 8.5, threshold: 10 },
      status: 'open',
      assigned_to: null,
      created_by: 'system',
    },
    {
      id: 'esc-demo-002',
      workspace_id: 'w4',
      rule_id: 'rule-customer-red',
      trigger_type: 'customer_score_red',
      severity: 'high',
      title: 'Customer Risk: Al-Rajhi Steel — Payment Issues',
      description: 'Customer Al-Rajhi Steel has DSO of 68 days and Bad payment status.',
      trigger_data: { customer_name: 'Al-Rajhi Steel', dso: 68, payment_status: 'Bad' },
      status: 'open',
      assigned_to: null,
      created_by: 'system',
    },
  ];
  
  const { error } = await supabase.from('escalation_events').upsert(events, { onConflict: 'id' });
  if (error) {
    console.log('❌ Failed to seed events:', error.message);
    return false;
  }
  console.log('✅ 2 demo escalation events seeded');
  
  // Seed tasks
  const tasks = [
    {
      id: 'esc-task-001',
      escalation_id: 'esc-demo-001',
      title: 'Review margin breach: Al-Rajhi Emergency Storage',
      description: 'GP% at 8.5% for Al-Rajhi Steel. Requires CEO/CFO review and decision.',
      assigned_to: null,
      status: 'pending',
    },
    {
      id: 'esc-task-002',
      escalation_id: 'esc-demo-002',
      title: 'Assess customer credit risk: Al-Rajhi Steel',
      description: 'Customer has DSO 68 days and Bad payment status. Evaluate credit terms.',
      assigned_to: null,
      status: 'pending',
    },
  ];
  
  const { error: taskError } = await supabase.from('escalation_tasks').upsert(tasks, { onConflict: 'id' });
  if (taskError) {
    console.log('❌ Failed to seed tasks:', taskError.message);
    return false;
  }
  console.log('✅ 2 demo escalation tasks seeded');
  return true;
}

async function main() {
  console.log('🚀 Running Escalation Engine Migration...\n');
  
  const tablesExist = await createTablesDirectly();
  
  if (tablesExist) {
    await seedRules();
    await seedDemoEvents();
  } else {
    console.log('\n⚠️  Tables need to be created manually.');
    console.log('Run the SQL from migrations/007_escalation_engine.sql in the Supabase SQL Editor.');
  }
  
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
