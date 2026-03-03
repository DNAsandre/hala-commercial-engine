import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seedProviders() {
  console.log('📦 Seeding AI providers...');

  const providers = [
    {
      id: 'aip-openai-001',
      name: 'openai',
      display_name: 'OpenAI',
      model_default: 'gpt-4o',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      enabled: true,
      config: { max_tokens: 4096, endpoint: 'openai-generate' },
    },
    {
      id: 'aip-google-001',
      name: 'google',
      display_name: 'Google AI (Gemini)',
      model_default: 'gemini-1.5-pro',
      models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
      enabled: true,
      config: { max_tokens: 4096, endpoint: 'google-generate' },
    },
  ];

  const { error } = await supabase
    .from('ai_providers')
    .upsert(providers, { onConflict: 'name' });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      console.log('❌ ai_providers table does not exist.');
      console.log('   Run scripts/009_ai_providers.sql in the Supabase SQL Editor first.');
      return false;
    }
    console.log('❌ Seed error:', error.message);
    return false;
  }

  console.log('✅ 2 AI providers seeded (OpenAI, Google AI)');
  return true;
}

async function main() {
  console.log('🚀 Running AI Providers Migration...\n');
  const ok = await seedProviders();
  if (!ok) {
    console.log('\n⚠️  Run the SQL migration first:');
    console.log('   File: scripts/009_ai_providers.sql');
  }
  console.log('\n✅ Migration script complete!');
}

main().catch(console.error);
