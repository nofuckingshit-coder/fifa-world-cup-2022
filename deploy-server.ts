import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from './src/generated/prisma/client'

const adapter = new PrismaLibSql({ url: 'file:./prisma/prod.db' })
const prisma = new PrismaClient({ adapter })

const app = new Hono()

app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (c.req.method === 'OPTIONS') return c.text('', 204)
  await next()
})

app.get('/health', (c) => c.json({ ok: true }))

app.get('/api/fifa/standings', async (c) => {
  const teams = await prisma.team.findMany({ orderBy: [{ group: 'asc' }, { points: 'desc' }, { goalsFor: 'desc' }] })
  const groups: Record<string, typeof teams> = {}
  for (const t of teams) { if (!groups[t.group]) groups[t.group] = []; groups[t.group].push(t) }
  return c.json({ groups })
})
app.get('/api/fifa/matches', async (c) => {
  const matches = await prisma.match.findMany({ include: { homeTeam: true, awayTeam: true }, orderBy: [{ date: 'asc' }] })
  return c.json({ matches })
})
app.get('/api/fifa/players', async (c) => {
  const players = await prisma.player.findMany({ include: { team: true }, orderBy: [{ goals: 'desc' }, { assists: 'desc' }] })
  return c.json({ players })
})
app.get('/api/fifa/stats', async (c) => {
  const [teamCount, matchCount, playerCount, totalGoals] = await Promise.all([
    prisma.team.count(), prisma.match.count(), prisma.player.count(),
    prisma.match.aggregate({ _sum: { homeScore: true, awayScore: true } })
  ])
  return c.json({ teamCount, matchCount, playerCount, totalGoals: (totalGoals._sum.homeScore ?? 0) + (totalGoals._sum.awayScore ?? 0) })
})

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = Number(process.env.PORT || 3000)
export default { port, fetch: app.fetch }