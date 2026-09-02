import { PHASES, PHASE_IDS, isPhase } from './phases.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const bad = (message, status = 400) => json({ error: message }, status);

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

const str = (v, max = 2000) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s.slice(0, max);
};
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const parsed = Number(String(v).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const TASK_FIELDS = [
  'title',
  'work_type',
  'scope',
  'effort',
  'owner',
  'priority',
  'source_note',
  'production_note',
  'steps',
  'expected_result',
];

async function readBoard(db) {
  const [batches, tasks, states, counts] = await Promise.all([
    db.prepare('SELECT id, name, position FROM batches ORDER BY position, created_at').all(),
    db
      .prepare(
        'SELECT id, batch_id, title, work_type, scope, effort, owner, minutes, priority, source_note, production_note, steps, expected_result, cancelled, position, created_at, updated_at FROM tasks ORDER BY position, created_at'
      )
      .all(),
    db.prepare('SELECT task_id, phase, done, done_at, done_by FROM phase_states').all(),
    db.prepare('SELECT task_id, phase, COUNT(*) AS n FROM comments GROUP BY task_id, phase').all(),
  ]);

  const byTask = new Map();
  for (const row of tasks.results) {
    const phases = {};
    for (const p of PHASE_IDS) phases[p] = { done: false, done_at: null, done_by: null };
    const task = {
      ...row,
      minutes: row.minutes === null ? null : Number(row.minutes),
      cancelled: !!row.cancelled,
      phases,
      comment_counts: Object.fromEntries(PHASE_IDS.map((p) => [p, 0])),
      comments_total: 0,
    };
    byTask.set(row.id, task);
  }
  for (const s of states.results) {
    const t = byTask.get(s.task_id);
    if (t && isPhase(s.phase)) t.phases[s.phase] = { done: !!s.done, done_at: s.done_at, done_by: s.done_by };
  }
  for (const c of counts.results) {
    const t = byTask.get(c.task_id);
    if (!t) continue;
    if (isPhase(c.phase)) t.comment_counts[c.phase] = c.n;
    t.comments_total += c.n;
  }

  const grouped = batches.results.map((b) => ({ ...b, tasks: [] }));
  const index = new Map(grouped.map((b) => [b.id, b]));
  for (const t of byTask.values()) index.get(t.batch_id)?.tasks.push(t);

  return { phases: PHASES, batches: grouped };
}

async function ensurePhaseRows(db, taskId) {
  await db.batch(
    PHASE_IDS.map((p) =>
      db.prepare('INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES (?, ?, 0)').bind(taskId, p)
    )
  );
}

async function insertTask(db, body) {
  const batchId = str(body.batch_id, 64);
  const title = str(body.title, 240);
  if (!batchId) return { error: 'batch_id es obligatorio' };
  if (!title) return { error: 'El título de la tarea es obligatorio' };

  const exists = await db.prepare('SELECT id FROM batches WHERE id = ?').bind(batchId).first();
  if (!exists) return { error: `La tanda ${batchId} no existe` };

  const pos = await db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE batch_id = ?')
    .bind(batchId)
    .first();

  const id = newId('tsk');
  await db
    .prepare(
      'INSERT INTO tasks (id, batch_id, title, work_type, scope, effort, owner, minutes, priority, source_note, production_note, steps, expected_result, position) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )
    .bind(
      id,
      batchId,
      title,
      str(body.work_type, 40),
      str(body.scope, 500),
      str(body.effort, 8),
      str(body.owner, 120),
      num(body.minutes),
      str(body.priority, 16),
      str(body.source_note, 1000),
      str(body.production_note, 2000),
      str(body.steps, 3000),
      str(body.expected_result, 1000),
      pos?.next ?? 0
    )
    .run();
  await ensurePhaseRows(db, id);
  return { id };
}

async function handleApi(request, env, url) {
  const db = env.DB;
  if (!db) return bad('Falta el binding D1 "DB" en wrangler.jsonc', 500);

  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const parts = path === '' ? [] : path.split('/');
  const method = request.method.toUpperCase();
  const body = ['POST', 'PATCH', 'PUT'].includes(method)
    ? await request.json().catch(() => ({}))
    : {};

  // GET /api/board
  if (parts[0] === 'board' && parts.length === 1 && method === 'GET') {
    return json(await readBoard(db));
  }

  // POST /api/batches
  if (parts[0] === 'batches' && parts.length === 1 && method === 'POST') {
    const name = str(body.name, 160);
    if (!name) return bad('El nombre de la tanda es obligatorio');
    const pos = await db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM batches').first();
    const id = newId('bch');
    await db
      .prepare('INSERT INTO batches (id, name, position) VALUES (?, ?, ?)')
      .bind(id, name, pos?.next ?? 0)
      .run();
    return json({ id, name }, 201);
  }

  // PATCH / DELETE /api/batches/:id
  if (parts[0] === 'batches' && parts.length === 2) {
    const id = parts[1];
    if (method === 'PATCH') {
      const name = str(body.name, 160);
      if (!name) return bad('El nombre de la tanda es obligatorio');
      const r = await db.prepare('UPDATE batches SET name = ? WHERE id = ?').bind(name, id).run();
      if (!r.meta.changes) return bad('Tanda no encontrada', 404);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE batch_id = ?)').bind(id).run();
      await db.prepare('DELETE FROM phase_states WHERE task_id IN (SELECT id FROM tasks WHERE batch_id = ?)').bind(id).run();
      await db.prepare('DELETE FROM tasks WHERE batch_id = ?').bind(id).run();
      const r = await db.prepare('DELETE FROM batches WHERE id = ?').bind(id).run();
      if (!r.meta.changes) return bad('Tanda no encontrada', 404);
      return json({ ok: true });
    }
  }

  // POST /api/tasks
  if (parts[0] === 'tasks' && parts.length === 1 && method === 'POST') {
    const result = await insertTask(db, body);
    if (result.error) return bad(result.error);
    return json(result, 201);
  }

  // /api/tasks/:id
  if (parts[0] === 'tasks' && parts.length === 2) {
    const id = parts[1];
    if (method === 'GET') {
      const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      if (!task) return bad('Tarea no encontrada', 404);
      const [states, comments] = await Promise.all([
        db.prepare('SELECT phase, done, done_at, done_by FROM phase_states WHERE task_id = ?').bind(id).all(),
        db
          .prepare('SELECT id, phase, author, body, created_at FROM comments WHERE task_id = ? ORDER BY created_at DESC')
          .bind(id)
          .all(),
      ]);
      const phases = {};
      for (const p of PHASE_IDS) phases[p] = { done: false, done_at: null, done_by: null };
      for (const s of states.results) if (isPhase(s.phase)) phases[s.phase] = { done: !!s.done, done_at: s.done_at, done_by: s.done_by };
      return json({
        ...task,
        minutes: task.minutes === null ? null : Number(task.minutes),
        cancelled: !!task.cancelled,
        phases,
        comments: comments.results,
      });
    }
    if (method === 'PATCH') {
      const sets = [];
      const values = [];
      for (const f of TASK_FIELDS) {
        if (f in body) {
          sets.push(`${f} = ?`);
          values.push(f === 'title' ? str(body[f], 240) : f === 'steps' ? str(body[f], 3000) : str(body[f], 2000));
        }
      }
      if ('minutes' in body) {
        sets.push('minutes = ?');
        values.push(num(body.minutes));
      }
      if ('batch_id' in body) {
        sets.push('batch_id = ?');
        values.push(str(body.batch_id, 64));
      }
      if ('cancelled' in body) {
        sets.push('cancelled = ?');
        values.push(body.cancelled ? 1 : 0);
      }
      if (!sets.length) return bad('Nada que actualizar');
      sets.push('updated_at = ?');
      values.push(now(), id);
      const r = await db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
      if (!r.meta.changes) return bad('Tarea no encontrada', 404);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM comments WHERE task_id = ?').bind(id).run();
      await db.prepare('DELETE FROM phase_states WHERE task_id = ?').bind(id).run();
      const r = await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
      if (!r.meta.changes) return bad('Tarea no encontrada', 404);
      return json({ ok: true });
    }
  }

  // PUT /api/tasks/:id/phases/:phase
  if (parts[0] === 'tasks' && parts[2] === 'phases' && parts.length === 4 && method === 'PUT') {
    const [, taskId, , phase] = parts;
    if (!isPhase(phase)) return bad('Fase inválida');
    const task = await db.prepare('SELECT id FROM tasks WHERE id = ?').bind(taskId).first();
    if (!task) return bad('Tarea no encontrada', 404);
    const done = body.done ? 1 : 0;
    const at = done ? now() : null;
    const by = done ? str(body.by, 80) : null;
    await db
      .prepare(
        'INSERT INTO phase_states (task_id, phase, done, done_at, done_by) VALUES (?,?,?,?,?) ' +
          'ON CONFLICT(task_id, phase) DO UPDATE SET done = excluded.done, done_at = excluded.done_at, done_by = excluded.done_by'
      )
      .bind(taskId, phase, done, at, by)
      .run();
    await db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').bind(now(), taskId).run();
    return json({ phase, done: !!done, done_at: at, done_by: by });
  }

  // POST /api/tasks/:id/comments
  if (parts[0] === 'tasks' && parts[2] === 'comments' && parts.length === 3 && method === 'POST') {
    const taskId = parts[1];
    const phase = str(body.phase, 32);
    const text = str(body.body, 4000);
    if (!isPhase(phase)) return bad('Fase inválida');
    if (!text) return bad('El comentario no puede estar vacío');
    const task = await db.prepare('SELECT id FROM tasks WHERE id = ?').bind(taskId).first();
    if (!task) return bad('Tarea no encontrada', 404);
    const id = newId('cmt');
    const created = now();
    await db
      .prepare('INSERT INTO comments (id, task_id, phase, author, body, created_at) VALUES (?,?,?,?,?,?)')
      .bind(id, taskId, phase, str(body.author, 80), text, created)
      .run();
    return json({ id, task_id: taskId, phase, author: str(body.author, 80), body: text, created_at: created }, 201);
  }

  // DELETE /api/comments/:id
  if (parts[0] === 'comments' && parts.length === 2 && method === 'DELETE') {
    const r = await db.prepare('DELETE FROM comments WHERE id = ?').bind(parts[1]).run();
    if (!r.meta.changes) return bad('Comentario no encontrado', 404);
    return json({ ok: true });
  }

  // POST /api/import  { batch_id? , new_batch_name?, rows: [...] }
  if (parts[0] === 'import' && parts.length === 1 && method === 'POST') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return bad('No hay filas para importar');
    if (rows.length > 500) return bad('Máximo 500 filas por importación');

    const created = [];
    const errors = [];
    const batchCache = new Map();

    const resolveBatch = async (name) => {
      const key = (name || '').trim().toLowerCase();
      if (!key) return null;
      if (batchCache.has(key)) return batchCache.get(key);
      const found = await db.prepare('SELECT id FROM batches WHERE lower(trim(name)) = ?').bind(key).first();
      let id = found?.id;
      if (!id) {
        const pos = await db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM batches').first();
        id = newId('bch');
        await db.prepare('INSERT INTO batches (id, name, position) VALUES (?,?,?)').bind(id, str(name, 160), pos?.next ?? 0).run();
      }
      batchCache.set(key, id);
      return id;
    };

    const fallback = str(body.batch_id, 64);
    for (const [i, row] of rows.entries()) {
      const batchId = (await resolveBatch(row.batch || row.tanda)) || fallback;
      if (!batchId) {
        errors.push({ row: i + 1, error: 'Sin tanda: indica una columna "tanda" o elige una tanda destino' });
        continue;
      }
      const result = await insertTask(db, { ...row, batch_id: batchId });
      if (result.error) errors.push({ row: i + 1, error: result.error });
      else created.push(result.id);
    }
    return json({ created: created.length, errors }, errors.length && !created.length ? 400 : 201);
  }

  return bad('Ruta no encontrada', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error('api error', err?.stack || err);
        return json({ error: 'Parece que ocurrió un error. Por favor, inténtalo de nuevo.' }, 500);
      }
    }
    // Cualquier otra ruta cae en el index del SPA.
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  },
};
