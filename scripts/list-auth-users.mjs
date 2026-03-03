import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzODU2NSwiZXhwIjoyMDg3NDE0NTY1fQ.AR5WyyxVgXtHt8Foj66ms15vl-fBskXhxwTb99tz99A';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// List all auth users
const { data, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error('Error:', error);
} else {
  console.log(`Found ${data.users.length} auth users:\n`);
  for (const u of data.users) {
    console.log(`  Email: ${u.email} | ID: ${u.id} | Created: ${u.created_at}`);
  }
}

// Also list app users table
const { data: appUsers, error: appErr } = await supabase.from('users').select('*');
if (appErr) {
  console.error('App users error:', appErr);
} else {
  console.log(`\nApp users (${appUsers.length}):`);
  for (const u of appUsers) {
    console.log(`  ${u.name} | ${u.email} | ${u.role} | auth_id: ${u.auth_id}`);
  }
}
