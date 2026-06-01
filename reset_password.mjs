import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetPassword() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Failed to list users:', listError);
    return;
  }
  
  const user = users.users.find(u => u.email === 'amin@halascs.com');
  if (!user) {
    console.log('User amin@halascs.com not found!');
    return;
  }
  
  console.log('Found user:', user.id);
  
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: 'Hala2026!' }
  );
  
  if (error) {
    console.error('Failed to reset password:', error);
  } else {
    console.log('Successfully reset password to Hala2026!');
  }
}

resetPassword();
