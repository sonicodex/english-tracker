// Genera migrations/0002_seed.sql a partir de scripts/seed-data.json.
// Correr con: npm run build:seed
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PHASES = ['backlog', 'planning', 'execution', 'edition', 'review', 'done'];

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));

const data = JSON.parse(readFileSync(join(here, 'seed-data.json'), 'utf8'));
const out = [
  '-- english-tracker · seed generado desde scripts/seed-data.json — NO editar a mano.',
  `-- Fuente: ${data.source}`,
  '-- Excluidas del seguimiento:',
  ...data.excluded.map((e) => `--   · ${e}`),
  '',
];

data.batches.forEach((batch, bi) => {
  out.push(
    `INSERT OR IGNORE INTO batches (id, name, position) VALUES (${q(batch.id)}, ${q(batch.name)}, ${bi});`
  );
  batch.tasks.forEach((t, ti) => {
    // Nota: steps/expected_result NO van aquí aunque seed-data.json ya los traiga. 0002_seed.sql
    // corre antes que la migración que agrega esas columnas (0004_task_detail.sql), así que un
    // INSERT que las mencione rompe una base nueva. Es el UPDATE de 0004 quien las rellena,
    // tanto en bases nuevas como en la ya desplegada — ver migrations/0004_task_detail.sql.
    out.push(
      'INSERT OR IGNORE INTO tasks (id, batch_id, title, work_type, scope, effort, owner, minutes, priority, source_note, production_note, position) VALUES (' +
        [
          q(t.id),
          q(batch.id),
          q(t.title),
          q(t.work_type),
          q(t.scope),
          q(t.effort),
          q(t.owner),
          n(t.minutes),
          q(t.priority),
          q(t.source_note),
          q(t.production_note),
          ti,
        ].join(', ') +
        ');'
    );
    for (const phase of PHASES) {
      out.push(
        `INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES (${q(t.id)}, ${q(phase)}, 0);`
      );
    }
  });
  out.push('');
});

writeFileSync(join(root, 'migrations', '0002_seed.sql'), out.join('\n') + '\n');
const total = data.batches.reduce((a, b) => a + b.tasks.length, 0);
console.log(`0002_seed.sql · ${data.batches.length} tandas · ${total} tareas · ${data.excluded.length} excluidas`);
