import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import auditHandler from './api/audit';
import { DEFAULT_REGULATION_CONFIG } from './src/data/defaultRegulations';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  // Official Regulation & Tariff JSON Database Endpoint (Always Up-To-Date)
  app.get('/api/regulations', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ...DEFAULT_REGULATION_CONFIG,
      lastUpdated: new Date().toISOString(),
    });
  });

  // Serverless-compatible AI & Deterministic Audit Endpoint
  app.all('/api/audit', async (req, res) => {
    await auditHandler(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AURA-SOFTWARE Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
