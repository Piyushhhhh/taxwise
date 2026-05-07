import express from 'express';
import { config } from 'dotenv';
import path from 'path';
import { taxRouter } from './routes/tax.routes.js';
import { ZodError } from 'zod';

config();

const app = express();

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'taxwise', timestamp: new Date().toISOString() });
});

app.use('/api/tax', taxRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.errors });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
