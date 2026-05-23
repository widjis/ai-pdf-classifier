import express from 'express';
import healthRoutes from '../../modules/health/routes/health.routes.js';
import dbRoutes from '../../modules/db/routes/db.routes.js';
import usersRoutes from '../../modules/users/routes/users.routes.js';
import userPreferencesRoutes from '../../modules/userPreferences/routes/userPreferences.routes.js';
import mappingProfilesRoutes from '../../modules/mappings/routes/mappingProfiles.routes.js';
import mappingRulesRoutes from '../../modules/mappings/routes/mappingRules.routes.js';
import batchesRoutes from '../../modules/batches/routes/batches.routes.js';
import { corsMiddleware } from './cors.js';
import { errorMiddleware, notFoundMiddleware } from './errorMiddleware.js';

export const createApp = () => {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/health', healthRoutes);
  app.use('/api/db', dbRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/user-preferences', userPreferencesRoutes);
  app.use('/api/mapping-profiles', mappingProfilesRoutes);
  app.use('/api/mapping-rules', mappingRulesRoutes);
  app.use('/api/batches', batchesRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
