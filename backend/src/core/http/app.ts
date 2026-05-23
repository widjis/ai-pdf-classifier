import express from 'express';
import healthRoutes from '../../modules/health/routes/health.routes.js';
import dbRoutes from '../../modules/db/routes/db.routes.js';

export const createApp = () => {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  app.use('/api/health', healthRoutes);
  app.use('/api/db', dbRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({ error: message });
  });

  return app;
};
