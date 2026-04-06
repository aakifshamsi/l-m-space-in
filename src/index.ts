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
app.notFound((c) => c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Found | M-Space</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  <div class="text-center p-8">
    <div class="mb-8">
      <span class="text-4xl font-bold text-blue-600">M-Space</span>
    </div>
    <h1 class="text-6xl font-bold text-gray-800 mb-4">404</h1>
    <h2 class="text-2xl font-semibold text-gray-600 mb-4">Page Not Found</h2>
    <p class="text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
    <div class="flex flex-wrap gap-4 justify-center mb-6">
      <a href="/" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">Go Home</a>
      <a href="/admin/dashboard" class="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300 transition">Dashboard</a>
      <a href="/admin/login" class="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300 transition">Login</a>
      <a href="/blog" class="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300 transition">Blog</a>
    </div>
    <p class="text-gray-400 text-sm">Return to <a href="https://m-space.in" class="text-blue-500 hover:underline">m-space.in</a></p>
  </div>
</body>
</html>
`, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.html('<html><body><h1>500 - Internal Server Error</h1></body></html>', 500);
});

export default app;