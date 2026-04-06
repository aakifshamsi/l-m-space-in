import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './config';
import { app as appRouter } from './app';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Serve sw.js for Monetag site verification (inlined to avoid static file issues)
app.get('/sw.js', (c) => {
  return c.text(`self.options = {
    "domain": "5gvci.com",
    "zoneId": 10836229
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')`, {
    headers: { 'Content-Type': 'application/javascript' }
  });
});

// Mount the main app router
app.route('/', appRouter);

// 404 handler
app.notFound((c) => c.html('<html><body><h1>404 - Not Found</h1></body></html>', 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.html('<html><body><h1>500 - Internal Server Error</h1></body></html>', 500);
});

export default app;