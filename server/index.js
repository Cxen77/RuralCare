const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { connectDb, dbState, disconnectDb } = require('./config/db');
const { requireAuth, optionalAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { ok } = require('./utils/response');

const authRoutes = require('./routes/auth.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const consultationsRoutes = require('./routes/consultations.routes');
const prescriptionsRoutes = require('./routes/prescriptions.routes');
const pharmacyRoutes = require('./routes/pharmacy.routes');
const reservationsRoutes = require('./routes/reservations.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const referralsRoutes = require('./routes/referrals.routes');
const hospitalsRoutes = require('./routes/hospitals.routes');
const ambulancesRoutes = require('./routes/ambulances.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const lookupRoutes = require('./routes/lookup.routes');
const syncRoutes = require('./routes/sync.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();
const startedAt = Date.now();

app.set('trust proxy', 1);
// CSP disabled: the Vite portals are served from this origin and ship inline bootstrap
// scripts. Re-enable with a nonce-based policy when the portals move behind a CDN.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.isProd ? env.ALLOWED_ORIGINS : true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ── Public: static portals ───────────────────────────────────────────────
const distDir = (client) => path.join(__dirname, '..', client, 'dist');

app.use('/assets', express.static(path.join(distDir('pharmacy-website'), 'assets')));
app.use('/assets', express.static(path.join(distDir('hospital-website'), 'assets')));
app.use('/pharmacy', express.static(distDir('pharmacy-website')));
app.use('/hospital', express.static(distDir('hospital-website')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
app.get('/pharmacy', (req, res) => res.sendFile(path.join(distDir('pharmacy-website'), 'index.html')));
app.get('/hospital', (req, res) => res.sendFile(path.join(distDir('hospital-website'), 'index.html')));
app.get('/doctor', (req, res) => res.redirect('http://localhost:8082'));
app.get('/patient', (req, res) => res.redirect('http://localhost:8081'));

// ── Public: health ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const db = dbState();
  return ok(res, {
    status: db === 'connected' ? 'ok' : 'degraded',
    service: 'ruralcare-api',
    env: env.NODE_ENV,
    db,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  });
});

// ── Rate limiting ───────────────────────────────────────────────────────
const limited = (max, windowMs, code, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code, message } },
  });

const authLimiter = limited(30, 15 * 60 * 1000, 'RATE_LIMITED', 'Too many login attempts. Try again later.');
// Generous: all four clients poll this API on short intervals.
const apiLimiter = limited(600, 60 * 1000, 'RATE_LIMITED', 'Too many requests. Slow down.');

// ── Public / Semi-Public APIs ───────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ai', apiLimiter, optionalAuth, aiRoutes);

// ── Protected API ───────────────────────────────────────────────────────
const api = express.Router();
api.use(apiLimiter, requireAuth);
api.use('/appointments', appointmentsRoutes);
api.use('/consultations', consultationsRoutes);
api.use('/prescriptions', prescriptionsRoutes);
api.use('/pharmacy', pharmacyRoutes);
api.use('/reservations', reservationsRoutes);
api.use('/inventory', inventoryRoutes);
api.use('/referrals', referralsRoutes);
api.use('/hospitals', hospitalsRoutes);
api.use('/ambulances', ambulancesRoutes);
api.use('/notifications', notificationsRoutes);
api.use('/sync', syncRoutes);
api.use('/', lookupRoutes); // /doctors, /doctors/:id, /pharmacies, /patients/:id

// `/api` is the only API prefix. The four clients are wired to it; unknown paths
// under it answer 401 before 404, which avoids leaking which routes exist.
app.use('/api', api);

app.use(notFound);
app.use(errorHandler);

// ── Lifecycle ───────────────────────────────────────────────────────────
let server;

// In development the API still comes up when Atlas is unreachable, so /health can
// report *why* it is degraded and the portals get a clean error instead of a dead
// port. Production fails fast instead of serving a database-less API.
async function connectWithRetry() {
  try {
    await connectDb();
    console.log(`[db] connected (${dbState()})`);
  } catch (err) {
    if (env.isProd) throw err;
    console.error(`[db] unavailable: ${err.message}`);
    console.error('[db] API will start in a degraded state; retrying every 15s.');
    setTimeout(() => connectWithRetry(), 15000);
  }
}

async function start() {
  await connectWithRetry();
  server = app.listen(env.PORT, () => {
    console.log(`[api] RuralCare listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

async function shutdown(signal) {
  console.log(`\n[api] ${signal} received, shutting down`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDb();
    console.log('[api] closed cleanly');
    process.exit(0);
  } catch (e) {
    console.error('[api] error during shutdown:', e.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});

module.exports = app;
