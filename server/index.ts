/**
 * Hala Commercial Engine — Backend API Server
 * 
 * Sprint 1: Foundation server skeleton.
 * 
 * This server sits between the frontend and Supabase,
 * providing a secure authority for mutations, validation,
 * and audit logging. It does NOT replace the frontend's
 * direct Supabase reads yet — that migration happens later.
 * 
 * NO gates, locks, or enforcement logic.
 */

import express from 'express';
import cors from 'cors';

import { customerRoutes } from './routes/customers.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { escalationRoutes } from './routes/escalations.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { quoteRoutes } from './routes/quotes.js';
import { proposalRoutes } from './routes/proposals.js';
import { slaRoutes } from './routes/slas.js';
import { documentRoutes } from './routes/documents.js';
import { templateRoutes } from './routes/templates.js';
import { brandingRoutes } from './routes/branding.js';
import { blockRoutes } from './routes/blocks.js';
import { docInstanceRoutes } from './routes/doc-instances.js';
import { botGovernanceRoutes } from './routes/bot-governance.js';
import { systemSettingsRoutes } from './routes/system-settings.js';
import { systemHealthRoutes } from './routes/system-health.js';
import { handoversRouter } from './routes/handovers.js';
import { ecrRulesRouter } from './routes/ecr-rules.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost origin for development
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else if (origin === FRONTEND_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// ─── Health Check ────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'hala-commercial-engine-api',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/customers', customerRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', quoteRoutes);
app.use('/api', proposalRoutes);
app.use('/api', slaRoutes);
app.use('/api', documentRoutes);
app.use('/api', templateRoutes);
app.use('/api', brandingRoutes);
app.use('/api', blockRoutes);
app.use('/api', docInstanceRoutes);
app.use('/api', botGovernanceRoutes);
app.use('/api', systemSettingsRoutes);
app.use('/api', systemHealthRoutes);
app.use('/api/handovers', handoversRouter);
app.use('/api/ecr', ecrRulesRouter);

// ─── Global Error Handler ────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API ERROR]', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    code: err.code || 'UNKNOWN_ERROR',
  });
});

// ─── 404 Catch ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ─── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 Hala API Server running on http://localhost:${PORT}`);
  console.log(`  📋 Health: http://localhost:${PORT}/api/health`);
  console.log(`  🔗 CORS origin: ${FRONTEND_ORIGIN}\n`);
});

export default app;
