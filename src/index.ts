import { Hono } from 'hono';

const MARKER = 'SERVERLESS_BUILD_RATE_LIMITING_HONO_V1';
const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.json({
  pattern: 'Workers Rate Limiting binding',
  marker: MARKER,
  endpoints: { 'GET /limited?actor=...': 'Consume one token; a rejected call returns 429', 'GET /health': 'Liveness check (does not consume a token)' },
  limit: '5 requests per 10 seconds per actor, per Cloudflare location',
}));

app.get('/health', (c) => c.json({ ok: true, marker: MARKER }));

app.use('/limited', async (c, next) => {
  c.header('cache-control', 'no-store');
  // A caller-supplied actor makes the PUBLIC DEMO easy to explore. In a real
  // application derive this from a verified user / tenant / API credential.
  const actor = c.req.query('actor');
  if (!actor || !/^[a-zA-Z0-9_-]{1,40}$/.test(actor)) {
    return c.json({ error: 'Provide an actor of 1–40 letters, numbers, hyphens, or underscores.' }, 400);
  }

  const { success } = await c.env.RATE_LIMITER.limit({ key: `demo:${actor}:/limited` });
  if (!success) {
    return c.json({ error: 'Rate limit exceeded', actor, marker: MARKER }, 429);
  }
  await next();
});

app.get('/limited', (c) => c.json({ allowed: true, actor: c.req.query('actor'), marker: MARKER }));

export default app;
