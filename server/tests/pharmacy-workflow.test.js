// Offline state-machine test for the pharmacy request workflow.
// Mocks the Mongoose models + middleware so no MongoDB is required.
const assert = require('assert');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
function makeDoc(data) {
  return { ...data, async save() { store.set(this.id, this); return this; } };
}
const store = new Map();
const rxStore = new Map();
const resvStore = new Map();
const inventory = [];
function seedRx() {
  const rx = { id: 'rx-test-1', consultationId: 'c1', patientId: 'p1',
    patientName: 'Test Patient', items: [{ drugName: 'Dolo 650', quantity: 2 }],
    dispensingStatus: 'pending' };
  rx.save = async function () { rxStore.set(this.id, this); return this; };
  rxStore.set('rx-test-1', rx);
}
function seedRequest(id, status, availability) {
  const doc = makeDoc({ id, prescriptionId: 'rx-test-1', prescriptionCode: 'RX-1',
    pharmacyId: 'ph1', patientName: 'Test Patient',
    items: [{ drugName: 'Dolo 650', quantity: 2 }], status, availability });
  store.set(id, doc);
  return doc;
}
const models = {
  PharmacyRequest: { async findOne(q) { return store.get(q.id) || null; },
    async updateMany(filter, update) {
      let n = 0;
      for (const d of store.values()) {
        if (d.prescriptionId === filter.prescriptionId
          && d.pharmacyId && d.pharmacyId !== filter.pharmacyId.$ne
          && filter.status.$in.includes(d.status)) {
          Object.assign(d, update.$set || update); n += 1;
        }
      }
      return { modifiedCount: n };
    } },
  Prescription: { async findOne(q) { return rxStore.get(q.id) || null; } },
  Reservation: {
    async findOne(q) {
      for (const x of resvStore.values()) {
        if (x.prescriptionId === q.prescriptionId
          && (!q.pharmacyId || x.pharmacyId === q.pharmacyId)) return x;
      }
      return null;
    },
    async create(d) { const x = { ...d }; resvStore.set(d.id, x); return x; },
  },
  Pharmacy: { findOne() {
    const doc = { id: 'ph1', name: 'T' };
    doc.lean = () => Promise.resolve(doc);
    return doc;
  } },
  InventoryItem: { find(q) {
    const rows = inventory.filter((i) => !q || !q.pharmacyId || i.pharmacyId === q.pharmacyId);
    rows.lean = () => Promise.resolve(rows);
    return rows;
  } },
  Patient: { async findOne() { return { id: 'p1', name: 'T' }; } },
};
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  const map = {
    '../models/PharmacyRequest': models.PharmacyRequest,
    '../models/Prescription': models.Prescription,
    '../models/Reservation': models.Reservation,
    '../models/Pharmacy': models.Pharmacy,
    '../models/InventoryItem': models.InventoryItem,
    '../models/Patient': models.Patient,
  };
  if (map[request]) return map[request];
  return origLoad.apply(this, arguments);
};
const rbacPath = require.resolve('../middleware/rbac');
require.cache[rbacPath] = { id: rbacPath, filename: rbacPath, loaded: true,
  exports: { requireRole: () => (req, _r, next) => {
    req.user = { sub: 'u1', role: 'PHARMACIST', pharmacyId: 'ph1' }; next();
  } } };
const auditPath = require.resolve('../utils/audit');
require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true,
  exports: { writeAudit: async () => {} } };
const notifyPath = require.resolve('../utils/notify');
require.cache[notifyPath] = { id: notifyPath, filename: notifyPath, loaded: true,
  exports: { sendNotification: async () => {} } };
const pharmacyRoutes = require('../routes/pharmacy.routes');
function callRoute(path, params, body) {
  const layer = pharmacyRoutes.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods.post);
  if (!layer) throw new Error('route not found: ' + path);
  const handlers = layer.route.stack.map((s) => s.handle);
  return new Promise((resolve) => {
    const req = { params, body, user: { sub: 'u1', role: 'PHARMACIST', pharmacyId: 'ph1' } };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(payload) { resolve({ status: this.statusCode, json: payload }); },
    };
    let i = 0;
    const next = (err) => {
      if (err) {
        resolve({ status: err.status || 500,
          json: { success: false, error: { code: err.code || 'ERR', message: err.message } } });
        return;
      }
      const fn = handlers[i++];
      if (!fn) { resolve({ status: 500, json: null }); return; }
      try {
        const out = fn(req, res, next);
        if (out && out.catch) out.catch(next);
      } catch (e) { next(e); }
    };
    next();
  });
}
async function post(path, body) {
  const m = path.match(/^\/api\/pharmacy\/requests\/([^/]+)\/(confirm|respond)$/);
  return callRoute('/requests/:id/' + m[2], { id: m[1] }, body);
}
seedRx();
inventory.push({ pharmacyId: 'ph1', medicine: 'Dolo 650',
  generic: 'Paracetamol', quantity: 10 });
(async () => {
  seedRequest('phreq-accept-1', 'pending');
  let r = await post('/api/pharmacy/requests/phreq-accept-1/confirm', { pharmacyId: 'ph1' });
  assert.strictEqual(r.status, 200, 'accept fresh: ' + JSON.stringify(r.json));
  assert.strictEqual(r.json.data.request.status, 'confirmed');
  r = await post('/api/pharmacy/requests/phreq-accept-1/confirm', { pharmacyId: 'ph1' });
  assert.strictEqual(r.status, 200, 'accept twice: ' + JSON.stringify(r.json));
  assert.strictEqual(r.json.data.deduped, true);
  seedRequest('phreq-unavail-1', 'pending');
  r = await post('/api/pharmacy/requests/phreq-unavail-1/respond',
    { availability: 'none', reserve: false });
  assert.strictEqual(r.status, 200, 'unavail fresh: ' + JSON.stringify(r.json));
  assert.strictEqual(r.json.data.request.status, 'unavailable');
  r = await post('/api/pharmacy/requests/phreq-unavail-1/respond',
    { availability: 'none', reserve: false });
  assert.strictEqual(r.status, 200, 'unavail twice: ' + JSON.stringify(r.json));
  assert.strictEqual(r.json.data.deduped, true);
  r = await post('/api/pharmacy/requests/phreq-unavail-1/confirm', { pharmacyId: 'ph1' });
  assert.strictEqual(r.status, 409, 'accept-after-unavail: ' + JSON.stringify(r.json));
  r = await post('/api/pharmacy/requests/phreq-accept-1/respond',
    { availability: 'none', reserve: false });
  assert.strictEqual(r.status, 409, 'unavail-after-accept: ' + JSON.stringify(r.json));
  assert.strictEqual(store.get('phreq-accept-1').status, 'confirmed');
  seedRequest('phreq-alias-1', 'pending');
  r = await post('/api/pharmacy/requests/phreq-alias-1/respond',
    { availability: 'unavailable', reserve: false });
  assert.strictEqual(r.status, 200, 'alias: ' + JSON.stringify(r.json));
  assert.strictEqual(r.json.data.request.status, 'unavailable');
  seedRequest('phreq-bad-1', 'pending');
  r = await post('/api/pharmacy/requests/phreq-bad-1/respond', {});
  assert.strictEqual(r.status, 400, 'missing avail: ' + JSON.stringify(r.json));
  assert.strictEqual(r.json.error.code, 'INVALID_AVAILABILITY');
  console.log('pharmacy workflow state-machine tests: ALL PASSED (8/8)');
  process.exit(0);
})().catch((e) => { console.error('pharmacy workflow test FAILED:', e.message); process.exit(1); });


