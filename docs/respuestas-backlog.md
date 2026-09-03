# Respuestas de JuanPa — comentarios de Backlog

Insumo para cargar la respuesta de JuanPa a cada ficha como **comentario en la fase `backlog`**.
Lee `AGENTS.md` antes de tocar el repo.

Son 20 comentarios, uno por tarea. Los textos vienen **filtrados de redundancia**: lo que la
respuesta original repetía de `source_note`, `steps`, `expected_result` o `production_note` se
quitó. Lo que queda es lo que el
artefacto todavía no sabe — decisiones, aprobaciones, bloqueos, cambios de plan y preguntas
abiertas. Varios comentarios son de una línea a propósito: en esas fichas la única novedad es el
visto bueno. **No los infles.**

Tres respuestas no son comentarios sino cambios de datos; están en §2 y hay que hacerlas primero.

---

## 1 · Cómo cargarlos

Migración nueva (`ls migrations/` primero; al escribir esto la última era `0004_task_detail.sql`),
con ids estables para que sea idempotente y aplique igual en local y en remoto:

```sql
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at)
VALUES ('cmt_bl_t1-01', 't1-01', 'backlog', 'Juan Pablo Medina', '…', '2026-09-02T21:00:00Z');
```

- `phase` siempre `backlog`.
- `author` siempre `Juan Pablo Medina`.
- `id` = `cmt_bl_<task_id>`.
- `created_at` fijo, el mismo para todos: `2026-09-02T21:00:00Z`. No uses `now()` — rompe la
  reproducibilidad entre local y remoto.
- Escapa las comillas simples del cuerpo duplicándolas (`''`), igual que hace `build-seed.mjs`.

Los cuerpos van **literales**, tal como están en los bloques de §3. Conservan el emoji de estado
(✅ / ⏸) porque es la voz de JuanPa en su propio comentario, no chrome de interfaz.

## 2 · Cambios que no son comentarios

Hacer esto **antes** de insertar los comentarios.

### 2.1 · Crear `t2-09` — la ficha del pie deja de estar excluida

La ficha «Vocabulario y Expresiones · clases 2, 6, 8, 10, 18» estaba fuera del tracker porque el
documento de revisión la dejó sin respuesta. Ahora tiene respuesta y va a producción, así que
**pasa a ser una tarea real**: 20 tareas, 3 excluidas.

En `scripts/seed-data.json`: quitarla del array `excluded` y agregarla al final de la Tanda 2
(`position: 8`), con estos valores:

| Campo | Valor |
|---|---|
| `id` | `t2-09` |
| `title` | `Vocabulario y Expresiones` |
| `work_type` | `reedición` |
| `scope` | `Clases 2, 6, 8, 10, 18 · líneas y CTAs sueltos` |
| `effort` | `S` |
| `owner` | `René Lora` |
| `minutes` | `4` |
| `priority` | `MEDIA` |
| `production_note` | `null` — la revisión no registró respuesta; la decisión va en el comentario |

**`source_note`**:
```text
Nivel equivocado (A2 en CTAs y diálogos) — Micro-reediciones: quitar o sustituir las líneas A2 incidentales ('I've made up my mind', comparativos en diálogo) y los CTAs que exigen past simple
```

**`steps`**:
```text
Micro-cortes de edición: clase 2 ('I've made up my mind'), clases 6 y 10 (comparativos en diálogo — dejar como input, quitar del CTA), clases 8 y 18 (CTAs que exigen past simple → regrabar solo la frase del CTA pidiendo la tarea en presente).
```

`expected_result`: `null` — la guía lo dejó en blanco para esta ficha.

**Ojo:** regenerar el seed no basta. `0002_seed.sql` usa `INSERT OR IGNORE`, así que la base
remota, que ya está desplegada, no verá la tarea nueva. La migración necesita el `INSERT` de
`t2-09` **y sus 6 filas de `phase_states`**, o la tarea sale sin checkboxes.

### 2.2 · Cancelar `t3-06`

«Estrategias para Aprender Inglés · clase 8». JuanPa la descarta. Usa el mecanismo que ya existe:
`cancelled = 1`. No la borres — la decisión queda visible y el comentario explica por qué.

### 2.3 · `t3-08` — el tipo de trabajo está mal

«Inglés para el Trabajo · clase 12». JuanPa confirma que en la práctica es **regrabación, no
reedición**, que era justo la duda de producción. Eso convierte `work_type` de `reedición` a
`grabación`. **No lo cambies todavía**: el esfuerzo y los minutos de la ficha se calcularon como
reedición y habría que revisarlos junto con el cambio. Déjalo anotado en el comentario (§3) y
consúltalo con JuanPa.

---

## 3 · Comentarios por tarea

### Tanda 1

**`t1-01`** · Preposiciones (audio)
```text
Listo para arrancar ✅ Sin cambios al plan de la ficha.
```

**`t1-02`** · Inglés para Viajes (audio)
```text
Listo para arrancar ✅ Además de los dos cortes de la ficha, barrer el curso completo: que no quede ninguna referencia a las clases VR.
```

**`t1-03`** · Pronunciación
```text
Listo para arrancar ✅ Explora el modelo de voz con edición, me gusta la idea. Antes de sintetizar la voz de Mariana hay que pedirle consentimiento, aunque sean dos palabras. Plan B si no sale rápido o no suena natural: el corte.
```

### Tanda 2

**`t2-01`** · Práctica y Checkpoint de Salida A1
```text
En pausa ⏸ El alcance está aprobado; el arranque queda bloqueado por los simuladores.
```

**`t2-02`** · Escritura (3 clases nuevas)
```text
Listo para arrancar ✅ Sobre la duda del objetivo: hoy ningún curso A1 enseña estos tres can-dos, y es de los huecos más grandes de la ruta porque son tarea clásica de examen y de la vida real. La meta es que el estudiante salga capaz de llenar formularios y escribir mensajes cortos reales, no solo oraciones sueltas. Cambio al plan de la ficha: no hay que esperar la renivelación A2→A1 del curso; se pueden ir grabando estas tres clases mientras tanto.
```

**`t2-03`** · Vocabulario y Expresiones (mediación)
```text
Sobre la duda de «transmítelo en español»: es una apuesta estratégica, no relleno. La mediación casi no se enseña, está alineada al MCER y es literalmente lo que hace a diario un profesional latinoamericano, así que sirve para diferenciar a la English Academy. Ejemplo concreto del formato: la pantalla muestra WET FLOOR, «your friend doesn't speak English, what do you tell him?», pausa, «cuidado, el piso está mojado». Hay que diseñarlo con calma para que no aparezca de la nada. Pendiente: propuesta de en qué otros cursos incorporar este can-do.
```

**`t2-04`** · Vocabulario y Expresiones (clases 14 y 17)
```text
Decisión: el contenido A2 se queda como input receptivo con rótulo, y solo se regraban las líneas de tarea y CTA para pedir producción A1. Abierto: la clase 17 es past simple completa, toda A2, y todavía no hay definición de qué hacer con ella.
```

**`t2-05`** · Escritura (clases 17 y 18)
```text
Listo para arrancar ✅ Sin cambios al plan de la ficha.
```

**`t2-06`** · Verbo To Be
```text
Listo para arrancar ✅ Aprobado el plan de voz en off + motion graphics.
```

**`t2-07`** · Escritura (acrónimos)
```text
Listo para arrancar ✅ Sin cambios al plan de la ficha.
```

**`t2-08`** · Inglés para el Trabajo (clase 13)
```text
Listo para arrancar ✅ Sin cambios al plan de la ficha.
```

**`t2-09`** · Vocabulario y Expresiones (clases 2, 6, 8, 10, 18) — tarea nueva, ver §2.1
```text
Listo para arrancar ✅ Entra al seguimiento: en la revisión original esta ficha quedó sin respuesta.
```

### Tanda 3

**`t3-01`** · Viajes en video
```text
En pausa ⏸ De acuerdo con el alcance, pero no es prioridad.
```

**`t3-02`** · Inglés para tu Trabajo
```text
En pausa ⏸ No es prioridad y hay que pensar mejor el alcance.
```

**`t3-03`** · Preparación Certificación A1
```text
En pausa ⏸ Se descarta priorizarlo. El bloqueo real no es el contrato B2B: primero tiene que existir el examen de certificación, porque el curso se prepara contra el examen real, no antes.
```

**`t3-04`** · Construcción de Oraciones
```text
Listo para arrancar ✅ Deja de estar condicionada: procede con el plan de voz en off + motion.
```

**`t3-05`** · Estrategias para Aprender Inglés (clase 3)
```text
Listo para arrancar ✅ Se resuelve la condicional: Estrategias sale de la ruta A1 pero se conserva como recurso, así que la reedición procede.
```

**`t3-06`** · Estrategias para Aprender Inglés (clase 8) — cancelar, ver §2.2
```text
Descartada. El curso sale de la ruta A1 y esta clase no justifica la regrabación.
```

**`t3-07`** · Inglés para Viajes (clases 13 y 17)
```text
Listo para arrancar ✅ No hay que esperar a Viajes en video: rotular ya. Si ese curso sale, los absorbe.
```

**`t3-08`** · Inglés para el Trabajo (clase 12)
```text
En espera ⏸ Confirmado que la acción es regrabación, no reedición: desde reedición no se puede plantear. Queda parada hasta decidir qué pasa con el curso.
```

---

## 4 · Fichas retiradas — confirmadas, sin acción

JuanPa confirmó las tres exclusiones que quedan. No crees tareas ni comentarios para ellas; siguen
en `scripts/seed-data.json → excluded`. La cuarta que estaba ahí (la ficha del pie) sale de esa
lista y pasa a ser `t2-09`.

| Ficha | Confirmación |
|---|---|
| Inglés Básico A1 para Principiantes · clase 7 | «Tienes razón. Ficha retirada, sin acción.» |
| Estrategias 2022 · clases 5 y 11 | El curso está deprecado y no se trabaja sobre lo deprecado. |
| Fechas, Horas y Expresiones Simples · clase 20 | Cae: 13082 y 12989 reemplazan a 2395. |

Actualiza el texto de la tercera en `excluded`: hoy dice que reemplaza «13082 y 12989», y JuanPa
confirmó que no tenía registrado 12989 — el dato es correcto, solo vale dejarlo explícito.

---

## 5 · Verificación

```bash
npm run build:seed
rm -rf .wrangler && npm run db:migrate:local && npm run dev
```

```sql
SELECT (SELECT COUNT(*) FROM tasks)                                AS tareas,
       (SELECT COUNT(*) FROM tasks WHERE cancelled = 1)            AS canceladas,
       (SELECT COUNT(*) FROM phase_states WHERE task_id = 't2-09') AS fases_t2_09,
       (SELECT COUNT(*) FROM comments WHERE phase = 'backlog')     AS comentarios;
-- esperado: 20 | 1 | 6 | 20
```

En la UI: el contador de comentarios de cada fila debe marcar 1, el punto bajo el checkbox de
Backlog debe aparecer en las 20 filas, y `t3-06` debe verse cancelada. Abre un par de popups en tema
oscuro y claro. Después aplica la migración a remoto y repite el `SELECT` con `--remote`.
