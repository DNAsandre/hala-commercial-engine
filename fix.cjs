const fs = require('fs');
const file = 'c:/ANtigravity Apps/Hala App - Amin review/hala-commercial-engine/supabase/migrations/20260506_supa006_linde_seed.sql';
let content = fs.readFileSync(file, 'utf8');

// The file contains 'Ra'\''ed'
// We want to replace it with 'Ra''ed'
content = content.replace(/'Ra'\\'\\'ed'/g, "'Ra''ed'");

fs.writeFileSync(file, content);
console.log("Done");
