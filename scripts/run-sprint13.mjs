import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  const sql = fs.readFileSync('migrations/sprint13_handover_processes.sql', 'utf8');
  console.log('Running migration...');
  await client.query(sql);
  console.log('Migration successful');
  await client.end();
}

run().catch(console.error);
