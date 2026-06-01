const {createClient}=require('@supabase/supabase-js');
const s=createClient('https://kositquaqmuousalmoar.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mzg1NjUsImV4cCI6MjA4NzQxNDU2NX0.ULDr14MImvZz6ssst3m-mtgEtsJ5o2TDe9cz4mOTcEc');
async function go(){
  // Try common owner columns
  const co=await s.from('commercial_opportunities').select('*').limit(1);
  if(co.data&&co.data[0])console.log('OPPORTUNITY COLS:',Object.keys(co.data[0]).join(', '));
  else console.log('OPPORTUNITIES:',co.error?co.error.message:'empty');
  const t=await s.from('tenders').select('*').limit(1);
  if(t.data&&t.data[0])console.log('TENDER COLS:',Object.keys(t.data[0]).join(', '));
  else console.log('TENDERS:',t.error?t.error.message:'empty');
  // check customer_master with no filter
  const cm=await s.from('customer_master').select('id,display_name').limit(3);
  console.log('CUSTOMER_MASTER:',cm.error?cm.error.message:JSON.stringify(cm.data));
}
go();
