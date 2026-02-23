import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mzg1NjUsImV4cCI6MjA4NzQxNDU2NX0.ULDr14MImvZz6ssst3m-mtgEtsJ5o2TDe9cz4mOTcEc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
