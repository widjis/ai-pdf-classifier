import { createApp } from './core/http/app.js';
import { env } from './core/config/env.js';

const app = createApp();

const startServer = (port: number) => {
  const server = app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
      server.close(() => startServer(port + 1));
      return;
    }
    throw err;
  });
};

startServer(env.port);
