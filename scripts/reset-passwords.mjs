// Use Supabase Management API to reset passwords
import https from 'https';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzODU2NSwiZXhwIjoyMDg3NDE0NTY1fQ.AR5WyyxVgXtHt8Foj66ms15vl-fBskXhxwTb99tz99A';

const users = [
  { email: 'amin@halascs.com', id: '1cf8e799-65b7-407f-a0c2-c6648d9cf6c4' },
  { email: 'albert@halascs.com', id: 'bc5f3da6-cf6a-400c-b01e-0b1143eb8b58' },
  { email: 'hano@halascs.com', id: 'e966fec0-a0aa-41ab-8042-88c95676c712' },
  { email: 'samer@halascs.com', id: '9ef37148-09ee-403e-82a0-1a712c762733' },
  { email: 'raed@halascs.com', id: '04a4c116-0956-4451-9129-db1819423307' },
];

async function updatePassword(userId, email) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users/${userId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: 'Hala2026!' }),
  });
  if (res.ok) {
    console.log(`✅ Reset password for ${email}`);
  } else {
    const text = await res.text();
    console.error(`❌ Failed for ${email}: ${res.status} ${text}`);
  }
}

for (const u of users) {
  await updatePassword(u.id, u.email);
}
