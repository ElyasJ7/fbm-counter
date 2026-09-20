// Golive API smoke helpers — run with: node scripts/golive-smoke.mjs
import fs from 'fs';
import path from 'path';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3001/api';

async function req(method, urlPath, { token, body, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (raw) return { status: res.status, headers: res.headers, body: json, text };
  return { status: res.status, body: json, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function extractCookieToken(setCookie) {
  if (!setCookie) return null;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of parts) {
    const m = /access_token=([^;]+)/.exec(c);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  let token = extractCookieToken(setCookie);
  if (!token && body?.accessToken) token = body.accessToken;
  if (!token) {
    const raw = res.headers.get('set-cookie');
    token = extractCookieToken(raw);
  }
  return { status: res.status, body, token, setCookie };
}

const results = [];
function log(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  // Health
  {
    const h = await req('GET', '/health');
    log('health', h.status === 200 && h.body?.status === 'ok', JSON.stringify(h.body));
    const r = await req('GET', '/health/ready');
    log('health/ready', r.status === 200 && r.body?.database === 'up', JSON.stringify(r.body));
  }

  // Auth
  const adminLogin = await login('admin@musterbau.example', 'Admin123!');
  log(
    'admin login',
    (adminLogin.status === 200 || adminLogin.status === 201) && !!adminLogin.token,
    `status=${adminLogin.status} token=${!!adminLogin.token}`,
  );
  const adminToken = adminLogin.token;

  const me = await req('GET', '/auth/me', { token: adminToken });
  log('auth/me', me.status === 200 && me.body?.email === 'admin@musterbau.example', `status=${me.status}`);

  const bad = await req('GET', '/auth/me', { token: 'invalid.token.here' });
  log('invalid token 401', bad.status === 401, `status=${bad.status}`);

  const noAuth = await req('GET', '/projects');
  log('no auth 401', noAuth.status === 401, `status=${noAuth.status}`);

  const viewerLogin = await login('viewer@musterbau.example', 'Viewer123!');
  log(
    'viewer login',
    (viewerLogin.status === 200 || viewerLogin.status === 201) && !!viewerLogin.token,
    `status=${viewerLogin.status} token=${!!viewerLogin.token}`,
  );
  const viewerMut = await req('POST', '/projects', {
    token: viewerLogin.token,
    body: {
      projectNumber: 'X-VIEWER',
      name: 'Should Fail',
      customerId: 'x',
      contractValue: '1.00',
    },
  });
  log('viewer mutation 403', viewerMut.status === 403, `status=${viewerMut.status}`);

  // Logout
  const logout = await req('POST', '/auth/logout', { token: adminToken });
  log('logout', logout.status === 200 || logout.status === 201, `status=${logout.status}`);

  // Re-login admin for rest
  const admin2 = await login('admin@musterbau.example', 'Admin123!');
  const at = admin2.token;
  assert(at, 'admin token missing after re-login');

  // Ensure PM2 exists via users API if available, else use prisma-seeded and update projects
  // Create second PM by hashing via admin users endpoint
  let pm2Id = null;
  const usersList = await req('GET', '/users', { token: at });
  if (usersList.status === 200) {
    const list = Array.isArray(usersList.body) ? usersList.body : usersList.body?.items || usersList.body?.data || [];
    const pm2 = list.find((u) => u.email === 'pm2@musterbau.example');
    if (pm2) pm2Id = pm2.id;
  }

  // Get PM1
  const pm1Login = await login('pm@musterbau.example', 'Project123!');
  log(
    'pm1 login',
    (pm1Login.status === 200 || pm1Login.status === 201) && !!pm1Login.token,
    `status=${pm1Login.status} token=${!!pm1Login.token}`,
  );
  const pm1Token = pm1Login.token;
  const pm1Me = await req('GET', '/auth/me', { token: pm1Token });
  const pm1Id = pm1Me.body?.id;

  // Customers for project create
  const customers = await req('GET', '/customers', { token: at });
  const customerId =
    (Array.isArray(customers.body) ? customers.body[0]?.id : customers.body?.items?.[0]?.id) ||
    customers.body?.data?.[0]?.id;
  assert(customerId, 'no customer for project create');

  // Create PM2 via direct DB if users POST not available — try POST /users
  if (!pm2Id) {
    const createPm2 = await req('POST', '/users', {
      token: at,
      body: {
        email: 'pm2@musterbau.example',
        password: 'Project223!',
        firstName: 'Paul',
        lastName: 'Zwei',
        role: 'PROJECT_MANAGER',
        status: 'ACTIVE',
      },
    });
    if (createPm2.status === 201 || createPm2.status === 200) {
      pm2Id = createPm2.body?.id;
      log('create pm2', true, pm2Id);
    } else {
      log(
        'create pm2',
        false,
        `status=${createPm2.status} ${createPm2.text?.slice?.(0, 200)}`,
      );
    }
  } else {
    // Ensure ACTIVE (create default may be INVITED)
    const activate = await req('PATCH', `/users/${pm2Id}`, {
      token: at,
      body: { status: 'ACTIVE' },
    });
    log('pm2 activate', activate.status === 200, `id=${pm2Id} patch=${activate.status}`);
  }

  // Create Project A for PM1, Project B for PM2
  const projA = await req('POST', '/projects', {
    token: at,
    body: {
      projectNumber: `GL-A-${Date.now().toString().slice(-6)}`,
      name: 'GoLive Project A',
      customerId,
      projectManagerId: pm1Id,
      contractValue: '100000.00',
      initialBudget: '80000.00',
      status: 'ACTIVE',
    },
  });
  log(
    'create project A',
    projA.status === 201 || projA.status === 200,
    `status=${projA.status} ${String(projA.text).slice(0, 160)}`,
  );
  const projectAId = projA.body?.id;

  const projB = await req('POST', '/projects', {
    token: at,
    body: {
      projectNumber: `GL-B-${Date.now().toString().slice(-6)}`,
      name: 'GoLive Project B',
      customerId,
      projectManagerId: pm2Id || pm1Id,
      contractValue: '200000.00',
      initialBudget: '150000.00',
      status: 'ACTIVE',
    },
  });
  log(
    'create project B',
    (projB.status === 201 || projB.status === 200) && !!pm2Id,
    `status=${projB.status} ${String(projB.text).slice(0, 160)}`,
  );
  const projectBId = projB.body?.id;

  // If we couldn't create PM2, skip H3 cross-PM checks as FAIL
  if (!pm2Id || !projectAId || !projectBId || pm2Id === pm1Id) {
    log('H3 setup', false, 'missing distinct PM2 or projects');
  } else {
    // Create invoice/expense/doc on B as admin
    const invB = await req('POST', '/invoices', {
      token: at,
      body: {
        type: 'CUSTOMER',
        projectId: projectBId,
        customerId,
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        netAmount: '1000.00',
        taxRate: '19',
        status: 'SENT',
        items: [{ description: 'Leistung B', unitPrice: '1000.00', quantity: '1' }],
      },
    });
    log('invoice B create', invB.status === 201 || invB.status === 200, `status=${invB.status}`);
    const invoiceBId = invB.body?.id;

    const expB = await req('POST', '/expenses', {
      token: at,
      body: {
        projectId: projectBId,
        description: 'Kosten B',
        netAmount: '100.00',
        taxRate: '19',
        status: 'APPROVED',
      },
    });
    log('expense B create', expB.status === 201 || expB.status === 200, `status=${expB.status}`);
    const expenseBId = expB.body?.id;

    // Upload doc on B
    const form = new FormData();
    const blob = new Blob(['golive-doc-b'], { type: 'text/plain' });
    form.append('file', blob, 'golive-b.txt');
    form.append('projectId', projectBId);
    form.append('category', 'OTHER');
    const docB = await req('POST', '/documents', { token: at, body: form });
    log('document B upload', docB.status === 201 || docB.status === 200, `status=${docB.status} ${String(docB.text).slice(0,120)}`);
    const documentBId = docB.body?.id;

    // PM1 list should include A not B
    const pmProjects = await req('GET', '/projects', { token: pm1Token });
    const pmItems = Array.isArray(pmProjects.body)
      ? pmProjects.body
      : pmProjects.body?.items || pmProjects.body?.data || [];
    const seesA = pmItems.some((p) => p.id === projectAId);
    const seesB = pmItems.some((p) => p.id === projectBId);
    log('PM1 sees A', seesA, `count=${pmItems.length}`);
    log('PM1 not see B in list', !seesB);

    const getB = await req('GET', `/projects/${projectBId}`, { token: pm1Token });
    log('PM1 direct project B denied', getB.status === 403 || getB.status === 404, `status=${getB.status}`);

    if (invoiceBId) {
      const getInv = await req('GET', `/invoices/${invoiceBId}`, { token: pm1Token });
      log('PM1 invoice B denied', getInv.status === 403 || getInv.status === 404, `status=${getInv.status}`);
    }
    if (expenseBId) {
      const getExp = await req('GET', `/expenses/${expenseBId}`, { token: pm1Token });
      log('PM1 expense B denied', getExp.status === 403 || getExp.status === 404, `status=${getExp.status}`);
    }
    if (documentBId) {
      const getDoc = await req('GET', `/documents/${documentBId}`, { token: pm1Token });
      log('PM1 document B denied', getDoc.status === 403 || getDoc.status === 404, `status=${getDoc.status}`);
      const dl = await req('GET', `/documents/${documentBId}/download`, { token: pm1Token });
      log('PM1 document B download denied', dl.status === 403 || dl.status === 404, `status=${dl.status}`);
    }

    const search = await req('GET', `/search?q=${encodeURIComponent('GoLive Project B')}`, { token: pm1Token });
    const searchText = JSON.stringify(search.body || '');
    log('PM1 search excludes B', !searchText.includes(projectBId), `status=${search.status}`);

    const dash = await req('GET', '/dashboard', { token: pm1Token });
    log('PM1 dashboard ok', dash.status === 200, `status=${dash.status}`);
  }

  // Financial E2E as admin
  const finProj = await req('POST', '/projects', {
    token: at,
    body: {
      projectNumber: `GL-F-${Date.now().toString().slice(-6)}`,
      name: 'GoLive Finance Flow',
      customerId,
      projectManagerId: pm1Id,
      contractValue: '50000.00',
      initialBudget: '40000.00',
      status: 'ACTIVE',
    },
  });
  const finProjectId = finProj.body?.id;
  log(
    'finance project',
    !!finProjectId,
    `status=${finProj.status} ${String(finProj.text).slice(0, 160)}`,
  );

  const suppliers = await req('GET', '/suppliers', { token: at });
  const supplierId =
    (Array.isArray(suppliers.body) ? suppliers.body[0]?.id : suppliers.body?.items?.[0]?.id) ||
    suppliers.body?.data?.[0]?.id;

  const expense = await req('POST', '/expenses', {
    token: at,
    body: {
      projectId: finProjectId,
      supplierId: supplierId || undefined,
      description: 'Lieferung Stahl',
      netAmount: '500.00',
      taxRate: '19',
      status: 'APPROVED',
    },
  });
  log('create expense', expense.status === 201 || expense.status === 200, `status=${expense.status}`);

  const custInv = await req('POST', '/invoices', {
    token: at,
    body: {
      type: 'CUSTOMER',
      projectId: finProjectId,
      customerId,
      issueDate: '2026-09-10',
      dueDate: '2026-10-10',
      netAmount: '1000.00',
      taxRate: '19',
      status: 'SENT',
      items: [{ description: 'Abschlag 1', unitPrice: '1000.00', quantity: '1' }],
    },
  });
  log('create customer invoice', custInv.status === 201 || custInv.status === 200, `status=${custInv.status}`);
  const invoiceId = custInv.body?.id;
  const gross = Number(custInv.body?.grossAmount ?? custInv.body?.totalAmount ?? 1190);

  const pay1 = await req('POST', '/payments', {
    token: at,
    body: {
      invoiceId,
      projectId: finProjectId,
      paymentDate: '2026-09-15',
      amount: '500.00',
      method: 'BANK_TRANSFER',
      reference: 'partial-1',
    },
  });
  log('partial payment', pay1.status === 201 || pay1.status === 200, `status=${pay1.status}`);

  const invAfter1 = await req('GET', `/invoices/${invoiceId}`, { token: at });
  const paid1 = Number(invAfter1.body?.paidAmount ?? 0);
  log('paidAmount after partial', paid1 === 500, `paid=${paid1} status=${invAfter1.body?.status}`);

  const over = await req('POST', '/payments', {
    token: at,
    body: {
      invoiceId,
      projectId: finProjectId,
      paymentDate: '2026-09-16',
      amount: '99999.00',
      method: 'BANK_TRANSFER',
    },
  });
  log('overpayment rejected', over.status >= 400, `status=${over.status}`);

  const remaining = (gross - paid1).toFixed(2);
  const pay2 = await req('POST', '/payments', {
    token: at,
    body: {
      invoiceId,
      projectId: finProjectId,
      paymentDate: '2026-09-20',
      amount: remaining,
      method: 'BANK_TRANSFER',
      reference: 'final',
    },
  });
  log('final payment', pay2.status === 201 || pay2.status === 200, `status=${pay2.status}`);

  const invFinal = await req('GET', `/invoices/${invoiceId}`, { token: at });
  log(
    'invoice paid',
    invFinal.body?.status === 'PAID' || Number(invFinal.body?.paidAmount) >= gross - 0.01,
    `status=${invFinal.body?.status} paid=${invFinal.body?.paidAmount}`,
  );

  // Document workflow on finance project
  const form2 = new FormData();
  form2.append('file', new Blob(['hello-golive'], { type: 'text/plain' }), 'golive.txt');
  form2.append('projectId', finProjectId);
  form2.append('category', 'OTHER');
  const up = await req('POST', '/documents', { token: at, body: form2 });
  log('doc upload', up.status === 201 || up.status === 200, `status=${up.status}`);
  const docId = up.body?.id;
  const list = await req('GET', `/documents?projectId=${finProjectId}`, { token: at });
  log('doc list', list.status === 200, `status=${list.status}`);
  if (docId) {
    const dlOk = await req('GET', `/documents/${docId}/download`, { token: at });
    log('doc download auth', dlOk.status === 200, `status=${dlOk.status}`);
    const del = await req('DELETE', `/documents/${docId}`, { token: at });
    log('doc soft-delete', del.status === 200 || del.status === 204, `status=${del.status}`);
  }

  // Reports CSV/PDF
  const csv = await req('GET', '/reports/export?format=csv', { token: at, raw: true });
  log('report csv', csv.status === 200, `status=${csv.status}`);
  const pdf = await req('GET', '/reports/export?format=pdf', { token: at, raw: true });
  log('report pdf', pdf.status === 200, `status=${pdf.status}`);

  // Metrics admin-only (mounted under /health/metrics)
  const metricsAdmin = await req('GET', '/health/metrics', { token: at });
  const metricsViewer = await req('GET', '/health/metrics', {
    token: viewerLogin.token,
  });
  const metricsAnon = await req('GET', '/health/metrics');
  log('metrics admin', metricsAdmin.status === 200, `status=${metricsAdmin.status}`);
  log(
    'metrics viewer denied',
    metricsViewer.status === 401 || metricsViewer.status === 403,
    `status=${metricsViewer.status}`,
  );
  log(
    'metrics anon denied',
    metricsAnon.status === 401 || metricsAnon.status === 403,
    `status=${metricsAnon.status}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- SUMMARY ---');
  console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL: ${f.name} ${f.detail}`);
    process.exitCode = 1;
  }
  fs.writeFileSync(
    path.resolve('tmp-golive-smoke-results.json'),
    JSON.stringify({ results, failed }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
