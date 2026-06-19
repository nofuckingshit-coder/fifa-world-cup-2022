// SPDX-License-Identifier: MIT
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import customRoutes from './custom-routes'
import { createToolsHandlers } from '@shogo-ai/sdk/tools/server'

const app = new Hono()

app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (c.req.method === 'OPTIONS') return c.text('', 204)
  await next()
})

app.get('/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }))

try {
  const { createAllRoutes } = await import('./src/generated')
  const { prisma } = await import('./src/lib/db')
  app.route('/api', createAllRoutes(prisma))
} catch {}

app.route('/api', customRoutes)

const tools = createToolsHandlers({})
app.post('/api/tools/execute', (c) => tools.execute(c.req.raw))
app.get('/api/tools/schemas', (c) => tools.list(c.req.raw))

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))
