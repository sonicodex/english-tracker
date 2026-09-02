/* english-tracker — seguimiento de tandas y tareas · Ruta Inglés A1
   UI sobre tokens Sinapsis. Estado en D1 vía /api. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  board: { phases: [], batches: [] },
  q: '',
  filter: 'todas',
  me: localStorage.getItem('et.me') || '',
  // Preferencia explícita por fase: true abierta, false cerrada, ausente = automático.
  phaseOpen: JSON.parse(localStorage.getItem('et.phaseOpen') || '{}'),
};

const WORK_ICON = { grabación: 'videocam', grabacion: 'videocam', reedición: 'movie_edit', reedicion: 'movie_edit', nuevo: 'add_circle' };
const PRIORITY_TAG = { ALTA: 'error', MEDIA: 'warning', BAJA: 'neutral' };
const EFFORT_TAG = { S: 'neutral', M: 'warning', L: 'error' };

/* ---------- API ---------- */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Parece que ocurrió un error. Por favor, inténtalo de nuevo.');
  return data;
}

/* ---------- Toasts ---------- */

function toast(message, variant = 'success') {
  const icon = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' }[variant] || 'info';
  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.innerHTML = `<span class="sin-icon" aria-hidden="true">${icon}</span><div class="sin-body-sm">${esc(message)}</div>`;
  $('#toasts').append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 4000);
}

/* ---------- Formato ---------- */

const fmtMin = (m) => (m === null || m === undefined ? '—' : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(m)} min`);

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(+d)) return iso;
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

const initials = (name) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const tag = (text, color = 'neutral', { outlined = false, icon } = {}) =>
  `<span class="tag tag--${color}${outlined ? ' tag--out' : ''}">${icon ? `<span class="sin-icon" aria-hidden="true">${icon}</span>` : ''}${esc(text)}</span>`;

/* ---------- Métricas ---------- */

const doneCount = (task) => state.board.phases.filter((p) => task.phases[p.id]?.done).length;
const isComplete = (task) => !!task.phases.done?.done;
const isStarted = (task) => doneCount(task) > 0;
const isCancelled = (task) => !!task.cancelled;

function taskMatches(task) {
  if (state.filter === 'done' && !isComplete(task)) return false;
  if (state.filter === 'curso' && (!isStarted(task) || isComplete(task))) return false;
  if (state.filter === 'sin' && isStarted(task)) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  return [task.title, task.owner, task.scope, task.work_type, task.priority, task.effort]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

const allTasks = () => state.board.batches.flatMap((b) => b.tasks);

/* ---------- Render: KPIs ---------- */

function renderKpis() {
  const tasks = allTasks();
  const total = tasks.length;
  const done = tasks.filter(isComplete).length;
  const running = tasks.filter((t) => isStarted(t) && !isComplete(t)).length;
  const minutes = tasks.reduce((a, t) => a + (t.minutes || 0), 0);
  const phaseTotal = total * state.board.phases.length || 1;
  const phaseDone = tasks.reduce((a, t) => a + doneCount(t), 0);
  const pct = Math.round((phaseDone / phaseTotal) * 100);

  const kpi = (icon, value, label, { accent = false, bar = null } = {}) => `
    <div class="kpi">
      <div class="kpi__top"><span class="sin-icon" aria-hidden="true">${icon}</span></div>
      <div class="kpi__value${accent ? ' kpi__value--accent' : ''}">${esc(value)}</div>
      <div class="kpi__label sin-body-sm">${esc(label)}</div>
      ${bar === null ? '' : `<div class="progress"><div class="progress__fill" style="width:${bar}%"></div></div>`}
    </div>`;

  $('#kpis').innerHTML = [
    kpi('stack', total, 'Tareas en seguimiento'),
    kpi('pending', running, 'En curso'),
    kpi('check_circle', done, 'Done', { accent: true }),
    kpi('timer', fmtMin(minutes), 'Minutos de producción'),
    kpi('percent', `${pct}%`, 'Fases completadas', { bar: pct }),
  ].join('');

  $('#head-sub').textContent = `${state.board.batches.length} tandas · ${total} tareas · ${state.board.phases.length} fases`;
}

/* ---------- Render: tablero ---------- */

function phaseCell(task, phase) {
  const st = task.phases[phase.id] || {};
  const comments = task.comment_counts?.[phase.id] || 0;
  const stamp = st.done ? `Marcado ${fmtWhen(st.done_at)}${st.done_by ? ` · ${st.done_by}` : ''}` : `Marcar ${phase.label}`;
  return `<td class="col-phase${st.done ? ' is-done' : ''}">
    <span class="chkcell">
      <button class="chk" type="button" role="checkbox" aria-checked="${st.done ? 'true' : 'false'}"
        aria-label="${esc(`${phase.label} · ${task.title}`)}" title="${esc(stamp)}"
        data-toggle data-task="${esc(task.id)}" data-phase="${esc(phase.id)}">
        <span class="sin-icon" aria-hidden="true">check</span>
      </button>
      <span class="chkcell__dot${comments ? ' on' : ''}" title="${comments} comentario(s)"></span>
    </span>
  </td>`;
}

function taskRow(task) {
  const icon = WORK_ICON[(task.work_type || '').toLowerCase()] || 'label';
  const rowClass = [isComplete(task) && 'task--complete', isCancelled(task) && 'task--cancelled'].filter(Boolean).join(' ');
  return `<tr data-row="${esc(task.id)}"${rowClass ? ` class="${rowClass}"` : ''}>
    <td class="col-task">
      <div class="task__title">
        ${isCancelled(task) ? tag('Cancelada', 'error') : ''}
        ${task.work_type ? tag(task.work_type, 'neutral') : ''}
        <span class="sin-icon" aria-hidden="true" style="color:var(--sin-on-surface-variant);font-size:20px">${icon}</span>
        <span class="task__name sin-title-sm">${esc(task.title)}</span>
      </div>
      ${task.scope ? `<span class="task__scope sin-label-xs">${esc(task.scope)}</span>` : ''}
    </td>
    <td class="col-meta col-owner"><span class="task__owner sin-body-sm">${esc(task.owner || '—')}</span></td>
    <td class="col-meta">${task.effort ? tag(`Esfuerzo ${task.effort}`, EFFORT_TAG[task.effort] || 'neutral') : '—'}</td>
    <td class="col-meta">${task.priority ? tag(task.priority, PRIORITY_TAG[task.priority] || 'neutral') : '—'}</td>
    <td class="col-num"><span class="task__mono">${esc(fmtMin(task.minutes))}</span></td>
    ${state.board.phases.map((p) => phaseCell(task, p)).join('')}
    <td class="col-tail">
      <span class="task__tail">
        <span class="count${task.comments_total ? ' on' : ''}"><span class="sin-icon" aria-hidden="true">comment</span>${task.comments_total}</span>
        <button class="btn btn--plain btn--icon btn--sm" type="button" data-open="${esc(task.id)}" aria-label="Abrir detalle">
          <span class="sin-icon" aria-hidden="true">chevron_right</span>
        </button>
      </span>
    </td>
  </tr>`;
}

function batchProgress(batch) {
  const tasks = batch.tasks;
  const totalCells = tasks.length * state.board.phases.length || 1;
  const done = tasks.reduce((a, t) => a + doneCount(t), 0);
  return Math.round((done / totalCells) * 100);
}

function renderBoard() {
  const board = $('#board');
  const visible = state.board.batches
    .map((b) => ({ ...b, tasks: b.tasks.filter(taskMatches) }))
    .filter((b) => b.tasks.length || (!state.q.trim() && state.filter === 'todas'));

  $('#empty').hidden = visible.length > 0;

  board.innerHTML = visible
    .map((batch) => {
      const pct = batchProgress(batch);
      const complete = batch.tasks.filter(isComplete).length;
      return `<section class="batch" data-batch="${esc(batch.id)}">
      <header class="batch__head">
        <h2 class="batch__title sin-title-lg">${esc(batch.name)}</h2>
        <span class="batch__count sin-body-sm">${batch.tasks.length} tareas · ${complete} done</span>
        <div class="batch__bar">
          <div class="progress"><div class="progress__fill" style="width:${pct}%"></div></div>
        </div>
        <span class="sin-label-md" style="color:var(--sin-on-surface-variant)">${pct}%</span>
        <div class="batch__actions">
          <button class="btn btn--plain btn--icon btn--sm" type="button" data-batch-add="${esc(batch.id)}" aria-label="Añadir tarea a esta tanda">
            <span class="sin-icon" aria-hidden="true">add</span>
          </button>
          <button class="btn btn--plain btn--icon btn--sm" type="button" data-batch-edit="${esc(batch.id)}" aria-label="Renombrar tanda">
            <span class="sin-icon" aria-hidden="true">edit</span>
          </button>
          <button class="btn btn--plain btn--icon btn--sm" type="button" data-batch-del="${esc(batch.id)}" aria-label="Eliminar tanda">
            <span class="sin-icon" aria-hidden="true">delete</span>
          </button>
        </div>
      </header>
      <div class="tablewrap">
        <table class="grid">
          <thead>
            <tr>
              <th class="col-task">Tarea</th>
              <th class="col-meta col-owner">Responsable</th>
              <th class="col-meta">Esfuerzo</th>
              <th class="col-meta">Prioridad</th>
              <th class="col-num">Duración</th>
              ${state.board.phases.map((p) => `<th class="col-phase">${esc(p.label)}</th>`).join('')}
              <th class="col-tail"></th>
            </tr>
          </thead>
          <tbody>${batch.tasks.map(taskRow).join('') || `<tr><td colspan="${6 + state.board.phases.length}" class="empty sin-body-sm">Sin tareas</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
    })
    .join('');
}

function renderIdentity() {
  const btn = $('#who');
  btn.innerHTML = `<span class="avatar">${esc(initials(state.me))}</span>${esc(state.me || 'Tu nombre')}`;
  btn.title = state.me ? `Comentando como ${state.me}` : 'Define tu nombre para firmar comentarios';
}

function renderSegmented() {
  const opts = [
    ['todas', 'Todas'],
    ['sin', 'Sin empezar'],
    ['curso', 'En curso'],
    ['done', 'Done'],
  ];
  $('#seg').innerHTML = opts
    .map(([v, l]) => `<button type="button" data-seg="${v}" aria-pressed="${state.filter === v}">${l}</button>`)
    .join('');
}

function renderAll() {
  renderKpis();
  renderBoard();
}

/* ---------- Actualización puntual de una fila ---------- */

function refreshRow(taskId) {
  const task = allTasks().find((t) => t.id === taskId);
  const tr = $(`tr[data-row="${CSS.escape(taskId)}"]`);
  if (!task || !tr) return renderAll();
  tr.outerHTML = taskRow(task);
  const batch = state.board.batches.find((b) => b.tasks.some((t) => t.id === taskId));
  if (batch) {
    const section = $(`section[data-batch="${CSS.escape(batch.id)}"]`);
    if (section) {
      const pct = batchProgress(batch);
      $('.progress__fill', section).style.width = `${pct}%`;
      $('.batch__head .sin-label-md', section).textContent = `${pct}%`;
      $('.batch__count', section).textContent = `${batch.tasks.length} tareas · ${batch.tasks.filter(isComplete).length} done`;
    }
  }
  renderKpis();
}

/* ---------- Toggle de fase ---------- */

async function togglePhase(taskId, phaseId, el) {
  const task = allTasks().find((t) => t.id === taskId);
  if (!task) return;
  const next = !task.phases[phaseId]?.done;
  el.setAttribute('aria-checked', String(next));
  try {
    const res = await api(`/tasks/${encodeURIComponent(taskId)}/phases/${encodeURIComponent(phaseId)}`, {
      method: 'PUT',
      body: { done: next, by: state.me || null },
    });
    task.phases[phaseId] = { done: res.done, done_at: res.done_at, done_by: res.done_by };
    refreshRow(taskId);
    if (panelTaskId === taskId) openDetail(taskId, { keepScroll: true });
  } catch (err) {
    el.setAttribute('aria-checked', String(!next));
    toast(err.message, 'error');
  }
}

/* ---------- Panel de detalle ---------- */

let panelTaskId = null;

function closePanel() {
  panelTaskId = null;
  $('#panel').hidden = true;
  $('#scrim').hidden = true;
}

function persistOpen() {
  localStorage.setItem('et.phaseOpen', JSON.stringify(state.phaseOpen));
}

async function openDetail(taskId, { keepScroll = false } = {}) {
  let detail;
  try {
    detail = await api(`/tasks/${encodeURIComponent(taskId)}`);
  } catch (err) {
    return toast(err.message, 'error');
  }
  const body = $('#panel-body');
  const scrollTop = keepScroll ? body.scrollTop : 0;
  panelTaskId = taskId;

  $('#panel-title').textContent = detail.title;
  $('#panel-title').classList.toggle('is-cancelled', !!detail.cancelled);
  $('#panel-meta').innerHTML = [
    detail.cancelled ? tag('Cancelada', 'error') : '',
    detail.work_type ? tag(detail.work_type, 'neutral', { icon: WORK_ICON[(detail.work_type || '').toLowerCase()] || 'label' }) : '',
    detail.priority ? tag(detail.priority, PRIORITY_TAG[detail.priority] || 'neutral') : '',
    detail.effort ? tag(`Esfuerzo ${detail.effort}`, EFFORT_TAG[detail.effort] || 'neutral') : '',
    detail.owner ? tag(detail.owner, 'neutral', { outlined: true, icon: 'person' }) : '',
    detail.minutes === null ? '' : tag(fmtMin(detail.minutes), 'neutral', { outlined: true, icon: 'timer' }),
    `<span class="sin-label-xs" style="color:var(--sin-on-surface-variant)">${esc(detail.scope || '')}</span>`,
  ]
    .filter(Boolean)
    .join('');

  const byPhase = new Map(state.board.phases.map((p) => [p.id, []]));
  for (const c of detail.comments) if (byPhase.has(c.phase)) byPhase.get(c.phase).push(c);

  const notes = [
    detail.source_note ? `<div class="note note--source"><span class="note__k sin-label-md">Ficha en la guía</span><span class="sin-body-sm">${esc(detail.source_note)}</span></div>` : '',
    detail.production_note ? `<div class="note note--production"><span class="note__k sin-label-md">Respuesta de producción</span><span class="sin-body-sm">${esc(detail.production_note)}</span></div>` : '',
  ]
    .filter(Boolean)
    .join('');

  // La fase actual = la primera sin marcar; se abre sola, igual que las que ya tienen historial.
  const current = state.board.phases.find((p) => !detail.phases[p.id]?.done)?.id ?? null;

  const phases = state.board.phases
    .map((p) => {
      const st = detail.phases[p.id] || {};
      const list = byPhase.get(p.id) || [];
      const key = `${taskId}:${p.id}`;
      const open = state.phaseOpen[key] ?? (list.length > 0 || p.id === current);
      return `<section class="phase${st.done ? ' is-done' : ''}" data-phase-card="${esc(p.id)}" data-expanded="${open}">
      <header class="phase__head" data-phase-toggle="${esc(key)}">
        <button class="chk" type="button" role="checkbox" aria-checked="${st.done ? 'true' : 'false'}"
          aria-label="${esc(`${p.label} · ${detail.title}`)}"
          data-toggle data-task="${esc(taskId)}" data-phase="${esc(p.id)}">
          <span class="sin-icon" aria-hidden="true">check</span>
        </button>
        <span class="phase__name sin-title-md">${esc(p.label)}</span>
        ${st.done ? `<span class="phase__stamp sin-label-xs">${esc(fmtWhen(st.done_at))}${st.done_by ? ` · ${esc(st.done_by)}` : ''}</span>` : ''}
        <span class="count${list.length ? ' on' : ''}"><span class="sin-icon" aria-hidden="true">comment</span>${list.length}</span>
        <span class="sin-icon phase__caret" aria-hidden="true">expand_more</span>
      </header>
      <div class="phase__body">
        <div class="phase__compose">
          <textarea class="sin-body-sm" data-comment-input="${esc(p.id)}" rows="2" aria-label="${esc(`Comentario en ${p.label}`)}" placeholder="Comentario en ${esc(p.label)}"></textarea>
          <div class="phase__compose-row">
            <span class="phase__hint sin-label-xs">${state.me ? `Firmando como ${esc(state.me)}` : 'Sin nombre definido'}</span>
            <button class="btn btn--tonal btn--sm" type="button" data-comment-send="${esc(p.id)}">
              <span class="sin-icon" aria-hidden="true">add</span>Añadir
            </button>
          </div>
        </div>
        <ul class="history">
          ${list
            .map(
              (c) => `<li class="comment">
            <span class="avatar">${esc(initials(c.author))}</span>
            <div class="comment__body">
              <div class="comment__by">
                <span class="comment__author sin-label-lg">${esc(c.author || 'Sin firma')}</span>
                <span class="comment__when sin-label-xs">${esc(fmtWhen(c.created_at))}</span>
              </div>
              <p class="comment__text sin-body-sm">${esc(c.body)}</p>
            </div>
            <button class="btn btn--plain btn--icon btn--sm comment__del" type="button" data-comment-del="${esc(c.id)}" aria-label="Eliminar comentario">
              <span class="sin-icon" aria-hidden="true">delete</span>
            </button>
          </li>`
            )
            .join('')}
        </ul>
      </div>
    </section>`;
    })
    .join('');

  body.innerHTML = `
    ${notes ? `<div class="detail-notes">${notes}</div>` : ''}
    <div class="phaselist">${phases}</div>
    <div class="phase__compose-row" style="justify-content:space-between">
      <button class="btn btn--outlined btn--sm" type="button" data-task-edit="${esc(taskId)}">
        <span class="sin-icon" aria-hidden="true">edit</span>Editar tarea
      </button>
      <div style="display:flex;gap:var(--sin-space-8)">
        <button class="btn btn--outlined btn--sm" type="button" data-task-cancel="${esc(taskId)}" data-cancelled="${detail.cancelled ? '1' : '0'}">
          <span class="sin-icon" aria-hidden="true">${detail.cancelled ? 'undo' : 'block'}</span>${detail.cancelled ? 'Reactivar tarea' : 'Cancelar tarea'}
        </button>
        <button class="btn btn--destroy btn--sm" type="button" data-task-del="${esc(taskId)}">
          <span class="sin-icon" aria-hidden="true">delete</span>Eliminar tarea
        </button>
      </div>
    </div>`;

  $('#panel').hidden = false;
  $('#scrim').hidden = false;
  body.scrollTop = scrollTop;
}

/* ---------- Modal ---------- */

function openModal({ title, body, actions, size = 'md' }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  $('#modal-foot').innerHTML = actions;
  $('#modal-card').className = `modal__card${size === 'sm' ? ' modal__card--sm' : ''}`;
  $('#modal').hidden = false;
  const first = $('#modal-body input, #modal-body textarea, #modal-body select');
  first?.focus();
}
const closeModal = () => {
  $('#modal').hidden = true;
};

const field = (name, label, { value = '', type = 'text', span = false, options = null, textarea = false, placeholder = '' } = {}) => {
  const control = options
    ? `<select name="${name}">${options
        .map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`)
        .join('')}</select>`
    : textarea
      ? `<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  return `<div class="field${options ? ' field--select' : ''}${span ? ' span2' : ''}">
    <label class="sin-label-lg" for="${name}">${esc(label)}</label>${control}
  </div>`;
};

const batchOptions = () => state.board.batches.map((b) => ({ value: b.id, label: b.name }));

function taskForm(task = {}, defaultBatch = null) {
  return `<div class="formgrid">
    ${field('title', 'Tarea / curso', { value: task.title || '', span: true })}
    ${field('batch_id', 'Tanda', { value: task.batch_id || defaultBatch || state.board.batches[0]?.id || '', options: batchOptions() })}
    ${field('work_type', 'Tipo de trabajo', {
      value: task.work_type || '',
      options: [
        { value: '', label: '—' },
        { value: 'grabación', label: 'grabación' },
        { value: 'reedición', label: 'reedición' },
        { value: 'nuevo', label: 'nuevo' },
      ],
    })}
    ${field('scope', 'Clases / segmentos', { value: task.scope || '', span: true })}
    ${field('owner', 'Responsable', { value: task.owner || '' })}
    ${field('effort', 'Esfuerzo', {
      value: task.effort || '',
      options: [
        { value: '', label: '—' },
        { value: 'S', label: 'S' },
        { value: 'M', label: 'M' },
        { value: 'L', label: 'L' },
      ],
    })}
    ${field('priority', 'Prioridad', {
      value: task.priority || '',
      options: [
        { value: '', label: '—' },
        { value: 'ALTA', label: 'ALTA' },
        { value: 'MEDIA', label: 'MEDIA' },
        { value: 'BAJA', label: 'BAJA' },
      ],
    })}
    ${field('minutes', 'Duración (min)', { value: task.minutes ?? '', type: 'number' })}
    ${field('source_note', 'Ficha en la guía', { value: task.source_note || '', textarea: true, span: true })}
    ${field('production_note', 'Respuesta de producción', { value: task.production_note || '', textarea: true, span: true })}
  </div>`;
}

const readForm = () => {
  const out = {};
  for (const el of $$('#modal-body [name]')) out[el.name] = el.value;
  return out;
};

function newTaskModal(defaultBatch = null) {
  if (!state.board.batches.length) return toast('Crea una tanda primero', 'warning');
  openModal({
    title: 'Nueva tarea',
    body: taskForm({}, defaultBatch),
    actions: `<button class="btn btn--outlined" data-close type="button">Cancelar</button>
              <button class="btn btn--primary" id="save-task" type="button">Crear tarea</button>`,
  });
  $('#save-task').onclick = async () => {
    const form = readForm();
    try {
      await api('/tasks', { method: 'POST', body: form });
      closeModal();
      await load();
      toast('Tarea creada');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

async function editTaskModal(taskId) {
  let task;
  try {
    task = await api(`/tasks/${encodeURIComponent(taskId)}`);
  } catch (err) {
    return toast(err.message, 'error');
  }
  openModal({
    title: 'Editar tarea',
    body: taskForm(task),
    actions: `<button class="btn btn--outlined" data-close type="button">Cancelar</button>
              <button class="btn btn--primary" id="save-task" type="button">Guardar</button>`,
  });
  $('#save-task').onclick = async () => {
    const form = readForm();
    try {
      await api(`/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: form });
      closeModal();
      await load();
      if (panelTaskId === taskId) await openDetail(taskId);
      toast('Tarea actualizada');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

function batchModal(batch = null) {
  openModal({
    title: batch ? 'Renombrar tanda' : 'Nueva tanda',
    size: 'sm',
    body: field('name', 'Nombre de la tanda', { value: batch?.name || '', span: true, placeholder: 'Tanda 4 — …' }),
    actions: `<button class="btn btn--outlined" data-close type="button">Cancelar</button>
              <button class="btn btn--primary" id="save-batch" type="button">${batch ? 'Guardar' : 'Crear tanda'}</button>`,
  });
  $('#save-batch').onclick = async () => {
    const { name } = readForm();
    try {
      if (batch) await api(`/batches/${encodeURIComponent(batch.id)}`, { method: 'PATCH', body: { name } });
      else await api('/batches', { method: 'POST', body: { name } });
      closeModal();
      await load();
      toast(batch ? 'Tanda actualizada' : 'Tanda creada');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

function confirmModal({ title, label, onConfirm }) {
  openModal({
    title,
    size: 'sm',
    body: '',
    actions: `<button class="btn btn--outlined" data-close type="button">Cancelar</button>
              <button class="btn btn--destroy" id="confirm" type="button">${esc(label)}</button>`,
  });
  $('#confirm').onclick = async () => {
    try {
      await onConfirm();
      closeModal();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

function whoModal() {
  openModal({
    title: 'Tu nombre',
    size: 'sm',
    body: field('me', 'Firma tus comentarios como', { value: state.me, span: true, placeholder: 'Juan Pablo Medina' }),
    actions: `<button class="btn btn--outlined" data-close type="button">Cancelar</button>
              <button class="btn btn--primary" id="save-me" type="button">Guardar</button>`,
  });
  $('#save-me').onclick = () => {
    state.me = readForm().me.trim();
    localStorage.setItem('et.me', state.me);
    renderIdentity();
    closeModal();
    if (panelTaskId) openDetail(panelTaskId, { keepScroll: true });
  };
}

/* ---------- Importador CSV / tabla ---------- */

const COLUMN_ALIASES = {
  tanda: 'batch', batch: 'batch', lote: 'batch',
  tarea: 'title', titulo: 'title', 'título': 'title', title: 'title', curso: 'title', nombre: 'title',
  tipo: 'work_type', 'tipo de trabajo': 'work_type', work_type: 'work_type', formato: 'work_type',
  alcance: 'scope', clases: 'scope', clase: 'scope', scope: 'scope', segmento: 'scope', segmentos: 'scope',
  esfuerzo: 'effort', effort: 'effort',
  responsable: 'owner', owner: 'owner', profesor: 'owner', profesora: 'owner', 'dueño': 'owner',
  minutos: 'minutes', min: 'minutes', minutes: 'minutes', 'duración': 'minutes', duracion: 'minutes',
  prioridad: 'priority', priority: 'priority',
  ficha: 'source_note', source_note: 'source_note', nota: 'source_note', hallazgo: 'source_note',
  respuesta: 'production_note', production_note: 'production_note', comentario: 'production_note', 'decisión': 'production_note', decision: 'production_note',
};

const EXPORT_COLUMNS = ['tanda', 'tarea', 'tipo', 'clases', 'esfuerzo', 'responsable', 'minutos', 'prioridad', 'ficha', 'respuesta'];

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { '\t': (line.match(/\t/g) || []).length, ';': (line.match(/;/g) || []).length, ',': (line.match(/,/g) || []).length };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function mapRows(text) {
  const delimiter = detectDelimiter(text);
  const raw = parseDelimited(text, delimiter);
  if (!raw.length) return { rows: [], headers: [], unknown: [], delimiter };
  const headerCells = raw[0].map((h) => h.trim().toLowerCase().replace(/^﻿/, ''));
  const headers = headerCells.map((h) => COLUMN_ALIASES[h] || null);
  const unknown = headerCells.filter((h, i) => h && !headers[i]);
  const rows = raw.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((key, i) => {
      if (key) obj[key] = (cells[i] ?? '').trim();
    });
    return obj;
  });
  return { rows: rows.filter((r) => (r.title || '').trim()), headers: headerCells, unknown, delimiter };
}

function importModal() {
  const columns = [...new Set(Object.values(COLUMN_ALIASES))];
  openModal({
    title: 'Importar tareas',
    body: `<div class="importer">
      <div class="importer__row">
        <div class="field field--select" style="flex:1 1 240px">
          <label class="sin-label-lg" for="imp-batch">Tanda destino</label>
          <select name="imp_batch">
            <option value="">Según columna «tanda»</option>
            ${state.board.batches.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}
          </select>
        </div>
        <label class="btn btn--outlined" style="flex:none">
          <span class="sin-icon" aria-hidden="true">upload_file</span>Archivo CSV
          <input type="file" id="imp-file" accept=".csv,.tsv,.txt,text/csv" hidden>
        </label>
      </div>
      <textarea id="imp-text" spellcheck="false" aria-label="Pega aquí tu CSV o tabla" placeholder="tanda,tarea,tipo,clases,esfuerzo,responsable,minutos,prioridad&#10;Tanda 4,Listening A1,grabación,Clases 1-4,M,Por asignar,12,ALTA"></textarea>
      <div class="importer__cols">${columns.map((c) => tag(c, 'neutral', { outlined: true })).join('')}</div>
      <div id="imp-preview"></div>
    </div>`,
    actions: `<button class="btn btn--outlined" data-close type="button">Cancelar</button>
              <button class="btn btn--primary" id="do-import" type="button" disabled>Importar</button>`,
  });

  let parsed = { rows: [], unknown: [] };

  const preview = () => {
    parsed = mapRows($('#imp-text').value);
    const btn = $('#do-import');
    btn.disabled = !parsed.rows.length;
    const cols = ['batch', 'title', 'work_type', 'scope', 'effort', 'owner', 'minutes', 'priority'];
    $('#imp-preview').innerHTML = !parsed.rows.length
      ? ''
      : `<div class="importer__preview"><table>
          <thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${parsed.rows
            .slice(0, 8)
            .map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] || '')}</td>`).join('')}</tr>`)
            .join('')}</tbody>
        </table></div>
        <p class="sin-label-xs" style="color:var(--sin-on-surface-variant);margin:var(--sin-space-8) 0 0">
          ${parsed.rows.length} filas${parsed.rows.length > 8 ? ' (8 en vista previa)' : ''}${parsed.unknown.length ? ` · columnas ignoradas: ${esc(parsed.unknown.join(', '))}` : ''}
        </p>`;
  };

  $('#imp-text').addEventListener('input', preview);
  $('#imp-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $('#imp-text').value = await file.text();
    preview();
  });

  $('#do-import').onclick = async () => {
    const batchId = $('[name="imp_batch"]').value;
    try {
      const res = await api('/import', { method: 'POST', body: { batch_id: batchId || null, rows: parsed.rows } });
      closeModal();
      await load();
      toast(`${res.created} tareas importadas${res.errors?.length ? ` · ${res.errors.length} con error` : ''}`, res.errors?.length ? 'warning' : 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

/* ---------- Export ---------- */

function exportCsv() {
  const q = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const phases = state.board.phases;
  const header = [...EXPORT_COLUMNS, ...phases.map((p) => p.label), 'comentarios'];
  const lines = [header.map(q).join(',')];
  for (const batch of state.board.batches) {
    for (const t of batch.tasks) {
      lines.push(
        [
          batch.name,
          t.title,
          t.work_type,
          t.scope,
          t.effort,
          t.owner,
          t.minutes,
          t.priority,
          t.source_note,
          t.production_note,
          ...phases.map((p) => (t.phases[p.id]?.done ? 'x' : '')),
          t.comments_total,
        ]
          .map(q)
          .join(',')
      );
    }
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `english-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Tema ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('et.theme', theme);
  $('#theme .sin-icon').textContent = theme === 'sinapsis-dark' ? 'light_mode' : 'dark_mode';
}

/* ---------- Carga ---------- */

async function load() {
  try {
    state.board = await api('/board');
    renderAll();
  } catch (err) {
    $('#board').innerHTML = `<p class="empty sin-body-sm">${esc(err.message)}</p>`;
    toast(err.message, 'error');
  }
}

/* ---------- Eventos ---------- */

document.addEventListener('click', async (e) => {
  const t = e.target;

  const chk = t.closest('[data-toggle]');
  if (chk) {
    e.stopPropagation();
    return togglePhase(chk.dataset.task, chk.dataset.phase, chk);
  }

  const openBtn = t.closest('[data-open]');
  if (openBtn) return openDetail(openBtn.dataset.open);

  const row = t.closest('tr[data-row]');
  if (row && !t.closest('button')) return openDetail(row.dataset.row);

  const phaseToggle = t.closest('[data-phase-toggle]');
  if (phaseToggle) {
    const card = phaseToggle.closest('.phase');
    const key = phaseToggle.dataset.phaseToggle;
    const nowOpen = card.dataset.expanded !== 'true';
    card.dataset.expanded = String(nowOpen);
    state.phaseOpen[key] = nowOpen;
    persistOpen();
    return;
  }

  const send = t.closest('[data-comment-send]');
  if (send) {
    const phase = send.dataset.commentSend;
    const input = $(`[data-comment-input="${CSS.escape(phase)}"]`);
    const body = input.value.trim();
    if (!body) return toast('El comentario no puede estar vacío', 'warning');
    send.disabled = true;
    try {
      await api(`/tasks/${encodeURIComponent(panelTaskId)}/comments`, { method: 'POST', body: { phase, body, author: state.me || null } });
      input.value = '';
      state.phaseOpen[`${panelTaskId}:${phase}`] = true;
      persistOpen();
      const task = allTasks().find((x) => x.id === panelTaskId);
      if (task) {
        task.comment_counts[phase] = (task.comment_counts[phase] || 0) + 1;
        task.comments_total += 1;
        refreshRow(panelTaskId);
      }
      await openDetail(panelTaskId, { keepScroll: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      send.disabled = false;
    }
    return;
  }

  const delComment = t.closest('[data-comment-del]');
  if (delComment) {
    try {
      await api(`/comments/${encodeURIComponent(delComment.dataset.commentDel)}`, { method: 'DELETE' });
      await load();
      await openDetail(panelTaskId, { keepScroll: true });
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  const editTask = t.closest('[data-task-edit]');
  if (editTask) return editTaskModal(editTask.dataset.taskEdit);

  const cancelTask = t.closest('[data-task-cancel]');
  if (cancelTask) {
    const id = cancelTask.dataset.taskCancel;
    const next = cancelTask.dataset.cancelled !== '1';
    try {
      await api(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: { cancelled: next } });
      await load();
      if (panelTaskId === id) await openDetail(id, { keepScroll: true });
      toast(next ? 'Tarea cancelada' : 'Tarea reactivada');
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  const delTask = t.closest('[data-task-del]');
  if (delTask) {
    const id = delTask.dataset.taskDel;
    return confirmModal({
      title: '¿Eliminar esta tarea?',
      label: 'Eliminar',
      onConfirm: async () => {
        await api(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
        closePanel();
        await load();
        toast('Tarea eliminada');
      },
    });
  }

  const batchAdd = t.closest('[data-batch-add]');
  if (batchAdd) return newTaskModal(batchAdd.dataset.batchAdd);

  const batchEdit = t.closest('[data-batch-edit]');
  if (batchEdit) return batchModal(state.board.batches.find((b) => b.id === batchEdit.dataset.batchEdit));

  const batchDel = t.closest('[data-batch-del]');
  if (batchDel) {
    const id = batchDel.dataset.batchDel;
    const batch = state.board.batches.find((b) => b.id === id);
    return confirmModal({
      title: `¿Eliminar «${batch?.name}» y sus ${batch?.tasks.length || 0} tareas?`,
      label: 'Eliminar tanda',
      onConfirm: async () => {
        await api(`/batches/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await load();
        toast('Tanda eliminada');
      },
    });
  }

  const seg = t.closest('[data-seg]');
  if (seg) {
    state.filter = seg.dataset.seg;
    renderSegmented();
    return renderBoard();
  }

  if (t.closest('[data-panel-close]') || t === $('#scrim')) return closePanel();
  if (t.closest('[data-close]') || t === $('#modal')) return closeModal();
});

$('#new-task').onclick = () => newTaskModal();
$('#new-batch').onclick = () => batchModal();
$('#import').onclick = () => importModal();
$('#export').onclick = () => exportCsv();
$('#who').onclick = () => whoModal();
$('#theme').onclick = () =>
  applyTheme(document.documentElement.dataset.theme === 'sinapsis-dark' ? 'sinapsis-light' : 'sinapsis-dark');

$('#q').addEventListener('input', (e) => {
  state.q = e.target.value;
  $('#q-clear').hidden = !state.q;
  renderBoard();
});
$('#q-clear').onclick = () => {
  $('#q').value = '';
  state.q = '';
  $('#q-clear').hidden = true;
  renderBoard();
  $('#q').focus();
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) return closeModal();
    if (!$('#panel').hidden) return closePanel();
  }
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    $('#q').focus();
  }
});

/* ---------- Arranque ---------- */

applyTheme(localStorage.getItem('et.theme') || 'sinapsis-dark');
renderIdentity();
renderSegmented();
load();
