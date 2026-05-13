// DATA-002B-FIX: Generate monthly phasing SQL from opportunity data
// Run: node excell/generate_phasing.js > supabase/migrations/20260511_data002b_fix_phasing.sql

const deals = [
  {id:'co-001',rate:200000,start:'2026-07',prob:20},
  {id:'co-002',rate:200000,start:'2026-06',prob:90},
  {id:'co-003',rate:75000,start:'2026-05',prob:90},
  {id:'co-004',rate:35000,start:'2026-05',prob:60},
  {id:'co-005',rate:22000,start:'2026-05',prob:60},
  {id:'co-006',rate:17500,start:'2026-08',prob:60},
  {id:'co-007',rate:13542,start:'2026-06',prob:60},
  {id:'co-008',rate:12500,start:'2026-05',prob:60},
  {id:'co-009',rate:4167,start:'2026-06',prob:60},
  {id:'co-010',rate:6500,start:'2026-07',prob:60},
  {id:'co-011',rate:77000,start:'2026-06',prob:75},
  {id:'co-012',rate:60500,start:'2026-05',prob:75},
  {id:'co-013',rate:11550,start:'2026-06',prob:75},
  {id:'co-014',rate:24750,start:'2026-06',prob:60},
  {id:'co-015',rate:45833,start:'2026-09',prob:60},
  {id:'co-016',rate:70833,start:'2026-07',prob:75},
  {id:'co-017',rate:135000,start:'2026-08',prob:60},
  {id:'co-018',rate:90000,start:'2026-05',prob:90},
  {id:'co-019',rate:74250,start:'2026-06',prob:75},
  {id:'co-020',rate:49600,start:'2026-06',prob:60},
  {id:'co-021',rate:33000,start:'2026-07',prob:60},
  {id:'co-022',rate:366667,start:'2026-07',prob:60},
  {id:'co-023',rate:42000,start:'2026-07',prob:60},
  {id:'co-024',rate:42250,start:'2026-07',prob:60},
  {id:'co-025',rate:10583,start:'2026-07',prob:60},
  {id:'co-026',rate:70500,start:'2026-06',prob:60},
  {id:'co-027',rate:145000,start:'2026-09',prob:60},
  {id:'co-028',rate:508500,start:'2026-11',prob:60},
  {id:'co-029',rate:42000,start:'2026-07',prob:60},
  {id:'co-030',rate:168750,start:'2026-07',prob:60},
  {id:'co-031',rate:8171,start:'2026-05',prob:60},
  {id:'co-032',rate:83333,start:'2026-06',prob:60},
  {id:'co-033',rate:66667,start:'2026-05',prob:60},
  {id:'co-034',rate:70833,start:'2026-06',prob:40},
  {id:'co-035',rate:164616,start:'2026-05',prob:60},
];

const months = [
  '2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
  '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12'
];

const lines = [];
lines.push(`-- DATA-002B-FIX: Monthly Phasing (auto-generated)`);
lines.push(`-- Import batch: data002b-fix-20260511`);
lines.push(`-- Source: Pipeline Data Input.csv monthly columns`);
lines.push(``);
lines.push(`INSERT INTO commercial_opportunity_monthly_phasing`);
lines.push(`  (id, opportunity_id, month, revenue_amount, weighted_amount, source_type, source_file, source_sheet)`);
lines.push(`VALUES`);

const rows = [];
for (const d of deals) {
  for (const m of months) {
    if (m >= d.start) {
      const num = d.id.replace('co-','');
      const mShort = m.replace('20','');
      const wt = Math.round(d.rate * d.prob / 100);
      rows.push(`  ('ph-${num}-${mShort}','${d.id}','${m}',${d.rate},${wt},'excel_import','Pipeline Data Input.csv','Pipeline Data Input')`);
    }
  }
}

lines.push(rows.join(',\n'));
lines.push(`ON CONFLICT (id) DO NOTHING;`);

console.log(lines.join('\n'));
console.log(`\n-- Total rows: ${rows.length}`);
