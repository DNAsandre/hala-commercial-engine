// DEFCON 1 — Area A: Auth Enforcement Tests
async function run() {
  const h = { 'Content-Type': 'application/json' };
  const tests = [];

  // 1. Health (should be open)
  const r1 = await fetch('http://localhost:3001/api/health');
  tests.push({ test: 'Health (no auth)', status: r1.status, pass: r1.status === 200 });

  // 2-10. All mutation+read routes without auth
  const noAuthRoutes = [
    ['GET', '/api/workspaces/test/quotes'],
    ['POST', '/api/workspaces/test/quotes', '{}'],
    ['PATCH', '/api/quotes/test', '{"notes":"hack"}'],
    ['POST', '/api/quotes/test/approve', '{}'],
    ['POST', '/api/quotes/test/submit', '{}'],
    ['POST', '/api/quotes/test/reject', '{"reason":"test"}'],
    ['POST', '/api/quotes/test/create-version', '{"change_reason":"test"}'],
    ['GET', '/api/workspaces/test/proposals'],
    ['POST', '/api/workspaces/test/proposals', '{"linked_quote_id":"x"}'],
    ['PATCH', '/api/proposals/test', '{"title":"hack"}'],
    ['POST', '/api/proposals/test/approve', '{}'],
    ['GET', '/api/workspaces/test/slas'],
    ['POST', '/api/workspaces/test/slas', '{"linked_proposal_id":"x"}'],
    ['PATCH', '/api/slas/test', '{"title":"hack"}'],
    ['POST', '/api/slas/test/approve', '{}'],
    ['POST', '/api/documents/generate-pdf', '{"workspace_id":"x","document_type":"quote","source_id":"x"}'],
    ['GET', '/api/documents'],
    ['GET', '/api/documents/download/test'],
    ['PATCH', '/api/documents/test/status', '{"status":"archived"}'],
    ['GET', '/api/workspaces/test/contract-status'],
    ['PATCH', '/api/workspaces/test/contract-status', '{"notes":"hack"}'],
  ];

  for (const [method, path, body] of noAuthRoutes) {
    const opts = { method, headers: h };
    if (body) opts.body = body;
    const r = await fetch(`http://localhost:3001${path}`, opts);
    tests.push({ test: `${method} ${path.split('/').slice(-2).join('/')} (no auth)`, status: r.status, pass: r.status === 401 });
  }

  // 11-13. Invalid token formats
  const tokenTests = [
    ['Fake JWT token', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiMSJ9.fake'],
    ['Empty bearer', 'Bearer '],
    ['Basic auth scheme', 'Basic dGVzdDp0ZXN0'],
    ['No Bearer prefix', 'some-random-token'],
    ['Expired-looking JWT', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.test'],
  ];

  for (const [label, token] of tokenTests) {
    const r = await fetch('http://localhost:3001/api/workspaces/test/quotes', { headers: { Authorization: token } });
    tests.push({ test: `Token: ${label}`, status: r.status, pass: r.status === 401 });
  }

  // Print results
  let fails = 0;
  for (const t of tests) {
    console.log(t.pass ? '✅' : '❌', t.test, ':', t.status);
    if (!t.pass) fails++;
  }
  console.log(`\n${tests.length} tests, ${fails} failures`);
}

run().catch(e => console.error(e));
