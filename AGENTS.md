# Contexto del producto — english-tracker

Documento de contexto para agentes de código. Léelo completo antes de tocar el repo.
Si algo de acá contradice al código, el código gana: corrige este archivo en el mismo cambio.

---

## 1 · Qué es

Tablero interno de **seguimiento de producción audiovisual** para la Ruta de Inglés A1 de Platzi.
No es un gestor de tareas genérico: modela un proceso concreto de producción de clases
(grabar, reeditar, crear cursos nuevos) donde cada tarea atraviesa seis fases fijas.

**Quién lo usa:** el equipo de producción de la Escuela de Inglés (pocas personas, todas con
acceso de escritura). No hay login, ni roles, ni permisos. Cualquiera que abra la URL puede
marcar fases y comentar. Eso es deliberado: el costo de un login supera el riesgo interno.

**De dónde salieron los datos:** del documento `Revisión detallada por clase — Ruta Inglés A1`,
sección A (Cámara y edición), agosto 2026. Ese documento tenía 22 fichas revisadas; el seed
carga **19 tareas en 3 tandas**. Las exclusiones y su motivo están en
`scripts/seed-data.json → excluded` — no las vuelvas a agregar sin que lo pidan.

**Idioma:** español (es-LA), tuteo, sentence case. Los nombres de las seis fases son la
excepción y van en inglés porque así los definió el equipo: `Backlog`, `In planning`,
`In execution`, `In edition`, `In review`, `Done`.

---

## 2 · Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Runtime | Cloudflare Worker (módulo ES) | Un solo artefacto sirve API y front |
| Datos | Cloudflare D1 (SQLite) | Estado compartido entre el equipo; el tablero es la fuente de verdad |
| Front | HTML + CSS + JS vanilla, **sin build** | 19-100 tareas no justifican un framework; el deploy es `wrangler deploy` y nada más |
| Estilos | Tokens Platzi Sinapsis servidos localmente | Cero CDN externo, cero dependencia de red |

**No introduzcas un bundler, React, TypeScript ni Tailwind** sin que te lo pidan explícitamente.
La ausencia de paso de build es una propiedad del proyecto, no una deuda: `public/` se sirve tal
cual desde el binding `ASSETS`. Si agregas un build, hay que reconfigurar Workers Builds.

---

## 3 · Mapa de archivos

```
src/index.js                 Worker: router de /api/* + fallback al SPA. Toda la lógica de servidor.
src/phases.js                Las 6 fases (id + label) y el validador isPhase(). Fuente única.
migrations/0001_init.sql     Esquema: batches, tasks, phase_states, comments.
migrations/0002_seed.sql      GENERADO. No editar a mano.
scripts/seed-data.json       Fuente del seed + lista de fichas excluidas. Acá sí se edita.
scripts/build-seed.mjs       Regenera 0002_seed.sql desde el JSON.
public/index.html            Estructura estática: topbar, KPIs, toolbar, contenedores de panel/modal/toasts.
public/app.js                Todo el front: fetch, render, eventos, importador, export.
public/styles/app.css        Capa de componentes propia sobre los tokens.
public/styles/*.css          Tokens Sinapsis copiados del design system. NO editar.
public/assets/fonts/*.woff2  Webfonts Sinapsis (incluye el icon font subsetado).
docs/sinapsis-icon-subset.txt Nombres de ligadura disponibles en el icon font. Consultar antes de usar un icono.
wrangler.jsonc               Nombre del Worker, binding D1, directorio de assets.
```

---

## 4 · Modelo de datos

Cuatro tablas, ids de texto generados en el Worker (`newId('tsk')` → `tsk_a1b2c3d4e5f6`).
El seed usa ids legibles y estables (`t1`, `t1-01`) para poder re-ejecutarse con `INSERT OR IGNORE`.

```
batches       id · name · position · created_at
tasks         id · batch_id → batches · title · work_type · scope · effort · owner
              minutes (REAL) · priority · source_note · production_note · steps
              expected_result · cancelled (0|1) · position · created_at · updated_at
phase_states  (task_id, phase) PK · done (0|1) · done_at · done_by
comments      id · task_id → tasks · phase · author · body · created_at
```

Notas que importan:

- **`phase_states` tiene una fila por tarea × fase** (6 filas por tarea), creadas al insertar la
  tarea con `ensurePhaseRows()`. No asumas que puede faltar una fila, pero tampoco rompas si falta:
  `readBoard()` rellena las seis con `done:false` antes de aplicar lo que venga de la base.
- **Las foreign keys sí se aplican.** D1 corre con `PRAGMA foreign_keys = 1`, así que el
  `ON DELETE CASCADE` declarado en el esquema funciona: borrar una tanda arrastra sus tareas,
  y borrar una tarea arrastra sus `phase_states` y `comments` (verificado). El Worker además
  borra los hijos a mano en orden (`comments` → `phase_states` → `tasks` → `batches`); es
  redundante y explícito a propósito. Si agregas una tabla hija, declárala con
  `REFERENCES ... ON DELETE CASCADE` y, si sigues el patrón, súmala a esos borrados.
- **`work_type`** es texto libre en la base, pero la UI espera `grabación`, `reedición` o `nuevo`
  (mapeados a iconos en `WORK_ICON`). Un valor desconocido cae al icono `label` sin romper nada.
- **`effort`** es `S` | `M` | `L`; **`priority`** es `ALTA` | `MEDIA` | `BAJA`. Ambos opcionales.
- **`minutes`** acepta coma decimal en la entrada (`num()` normaliza `"3,5"` → `3.5`).
- **No hay columna de etiquetas.** Existió (`tags`, con `de acuerdo`/`duda`/`propuesta`) y se
  eliminó por pedido explícito: la única etiqueta visible es `work_type`. La decisión de producción
  vive completa en `production_note`. No la reintroduzcas.
- **`steps` y `expected_result`** son texto largo de la ficha original (`docs/tareas-detalladas.md`):
  pasos sugeridos de producción y resultado esperado del estudiante. `steps` está en las 19 tareas;
  `expected_result` es nullable (15 de 19 lo traen). Se ven solo en el popup de detalle, nunca en la
  fila de la tabla — la fila ya tiene 12 columnas. `can_dos` y `applies_when` de la misma ficha
  quedaron fuera del alcance por decisión explícita: no existen como columnas.
- **`cancelled`** (0|1, default 0) marca una tarea como cancelada sin borrarla: tacha el título y
  muestra una tag roja. No tiene historial ni fecha, igual que las fases.

---

## 5 · Modelo de fases y reglas de negocio

Las seis fases son **checkboxes independientes, no un kanban**. Eso es lo central del producto:

- Una tarea no "está en" una fase — tiene seis marcas que se prenden y apagan sueltas.
- **No hay orden forzado.** Puedes marcar `Done` sin marcar `Backlog`. No agregues validación de
  secuencia; el equipo trabaja en paralelo y a veces retrocede.
- Marcar guarda `done_at` (ISO UTC, sin milisegundos) y `done_by` (el nombre local del usuario).
  Desmarcar los pone en `NULL` — **no se guarda historial de marcas**, solo el estado actual.
  El historial narrativo vive en los comentarios.
- `Done` marcado ⇒ la tarea cuenta como completa (`isComplete`). Cualquier marca ⇒ "en curso"
  (`isStarted`). Los KPIs y el filtro `Sin empezar / En curso / Done` derivan de eso.
- El porcentaje de una tanda es `fases marcadas / (tareas × 6)`, no tareas completas.

**Comentarios:** cada comentario pertenece a una tarea *y a una fase*. El popup de detalle muestra
un bloque por fase con su caja de escritura y su histórico descendente (más reciente arriba).
Esa granularidad es el requisito, no un detalle: no la colapses en un único hilo por tarea.

**Autoría:** el nombre se guarda en `localStorage` (`et.me`) y se manda como `author` / `by`.
No es autenticación — es una firma de cortesía. Puede venir vacío (`Sin firma`).

---

## 6 · API

Todo bajo `/api`. JSON en ambas direcciones, `cache-control: no-store`.
Errores: `{ "error": "mensaje en español" }` con 400/404/500. Cualquier ruta no reconocida → 404.
Lo que no es `/api/*` cae al `index.html` del SPA.

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/board` | Todo el tablero en una llamada: `{phases, batches[{...tasks[{...phases, comment_counts, comments_total}]}]}` |
| `POST` | `/api/batches` | `{name}` → 201 `{id, name}` |
| `PATCH` `DELETE` | `/api/batches/:id` | Renombrar / borrar con sus tareas |
| `POST` | `/api/tasks` | `{batch_id, title, ...}`; `title` y `batch_id` obligatorios |
| `GET` | `/api/tasks/:id` | Detalle + `comments[]` (DESC por fecha) |
| `PATCH` | `/api/tasks/:id` | Campos parciales; solo los de `TASK_FIELDS` + `minutes` + `batch_id` |
| `DELETE` | `/api/tasks/:id` | |
| `PUT` | `/api/tasks/:id/phases/:phase` | `{done, by}` → upsert idempotente en `phase_states` |
| `POST` | `/api/tasks/:id/comments` | `{phase, body, author}`; `phase` validado contra `isPhase` |
| `DELETE` | `/api/comments/:id` | |
| `POST` | `/api/import` | `{batch_id?, rows[]}`, máx. 500 filas; responde `{created, errors[]}` parcial |

`GET /api/board` hace **4 queries y arma el árbol en JS**. Es deliberado: evita N+1 y a esta escala
es más barato que un JOIN con agregados. Si el volumen crece mucho, ese es el lugar a revisar.

Todos los strings pasan por `str(v, max)`, que hace trim, convierte `''` → `null` y trunca.
Los máximos están en `insertTask()`; respétalos si agregas campos. `TASK_FIELDS` (habilita el
`PATCH` parcial) incluye también `steps` (máx. 3000) y `expected_result` (máx. 1000).

`/api/import` resuelve la tanda por nombre (case-insensitive, con trim) y **la crea si no existe**;
si la fila no trae tanda, usa el `batch_id` del body. Falla por fila, no en bloque.

---

## 7 · Front

Un solo módulo, `public/app.js`, sin dependencias. Patrón:

- **Estado** en el objeto `state`: `board` (respuesta cruda de `/api/board`), `q`, `filter`, `me`,
  `phaseOpen`. `load()` re-lee el tablero completo y re-renderiza.
- **Render por strings** con `innerHTML`. **Todo valor de datos pasa por `esc()`** — si agregas
  interpolación de datos y te la olvidas, abres un XSS almacenado (los comentarios son texto libre).
- **Delegación de eventos**: un único listener de `click` en `document` que resuelve por
  `t.closest('[data-...]')` en orden. El orden importa (ver trampas, §10).
- **Actualización puntual**: al marcar una fase, `refreshRow()` reemplaza solo el `<tr>` y actualiza
  progreso y KPIs, para no perder el scroll horizontal de la tabla. El re-render completo
  (`renderAll()`) se reserva para cambios estructurales.
- **Optimismo**: el checkbox cambia `aria-checked` antes de la respuesta y lo revierte si el `PUT`
  falla, mostrando un toast.

Convenciones:

- `localStorage`: `et.me` (nombre), `et.theme` (`sinapsis-dark` | `sinapsis-light`),
  `et.phaseOpen` (mapa `"taskId:phaseId" → bool`, preferencia explícita de plegado).
- Valores del filtro: `todas` | `sin` | `curso` | `done`.
- Atajos: `Esc` cierra modal y luego panel; `/` enfoca el buscador.
- Formatos con `Intl` y locale `es-CO` (`fmtMin`, `fmtWhen`).
- El plegado de una fase es tri-estado: si no hay preferencia guardada, se abre sola cuando tiene
  comentarios **o** cuando es la primera fase sin marcar (la "fase actual").

**Importador** (`mapRows`): detecta el separador (tab, `;`, `,`), parsea comillas dobles al estilo
CSV, y mapea encabezados vía `COLUMN_ALIASES` (español o inglés). Solo `tarea` es obligatoria.
`EXPORT_COLUMNS` debe seguir espejando esos alias para que el ida y vuelta CSV funcione — **si
agregas un campo, tócalo en los dos lados**.

---

## 8 · Sinapsis — reglas duras

El design system es **Platzi Sinapsis** (Material 3, dark-first). Los archivos de
`public/styles/` que no son `app.css` son copias del design system: **no los edites**, se
reemplazan cuando el sistema actualiza.

1. **Cero hex en `app.css`.** Todo color sale de `var(--sin-*)`. Hay 61 roles; si no encuentras
   uno que sirva, estás resolviendo el problema mal.
2. **Estados con los tokens, no con números:** `--sin-state-hover` (8%), `--sin-state-focus` (12%),
   `--sin-state-pressed` (16%) vía `color-mix`; deshabilitado es `opacity: var(--sin-state-disabled)`
   sobre el contenido, nunca sobre el relleno.
3. **Iconos = ligaduras de Material Symbols Rounded**, nunca SVG, nunca emoji, nunca menos de 20px:
   `<span class="sin-icon">nombre</span>`. **El font está subsetado**: un nombre que no esté dentro
   se renderiza como texto literal. Antes de usar uno nuevo:
   ```bash
   grep -x "nombre_del_icono" docs/sinapsis-icon-subset.txt
   ```
   Si no está, elige otro de esa lista. (`contrast` no está, por eso el toggle de tema usa
   `light_mode` / `dark_mode`.)
4. **Tipografía por rol, no por px:** clases `.sin-title-md`, `.sin-body-sm`, `.sin-label-xs`, etc.
   Bricolage Grotesque para títulos, Plus Jakarta Sans para cuerpo, IBM Plex Mono para datos.
5. **Radios:** tarjetas `3xl` (16px), campos `xl` (12px), botones y chips píldora, tags `sm` (6px).
6. **Espaciado** con la escala base-4 (`--sin-space-*`).
7. **Un componente canónico por concepto.** `Tag` es estático, `Chip` es interactivo, `Badge` es
   contador sobre un host. No inventes variantes nuevas.
8. Dark es el default (`data-theme="sinapsis-dark"` en `<html>`); claro es
   `data-theme="sinapsis-light"`. **Todo cambio visual debe verse bien en los dos** — revísalo.
9. El isotipo va inline en `index.html` con `fill="var(--sin-primary)"`. Es una marca: se copia,
   no se redibuja.

---

## 9 · Flujos de trabajo

```bash
npm install                  # binarios de workerd por plataforma: reinstalar si cambias de OS
npm run db:migrate:local     # crea/actualiza la base local en .wrangler/
npm run dev                  # http://localhost:8787

rm -rf .wrangler && npm run db:migrate:local        # volver al estado inicial
npm run build:seed                                   # tras editar scripts/seed-data.json
npx wrangler d1 execute english-tracker --local --command "SELECT ..."
```

**Migraciones.** El proyecto ya está desplegado, así que **no edites migraciones existentes**:
agrega `migrations/0003_*.sql`. Las migraciones **no corren en CI** — después de un push hay que
ejecutar `npm run db:migrate` (remoto) a mano. Dilo en el PR si agregas una.

**Deploy.** `git push` a la rama de producción → Workers Builds corre `npx wrangler deploy`.
Sin build command. El nombre del Worker en Cloudflare tiene que coincidir con `name` en
`wrangler.jsonc` (`english-tracker`). `database_id` va commiteado; no es un secreto.

**Verificación mínima antes de entregar un cambio:** levantar `npm run dev`, ejercitar el flujo
afectado, y revisarlo en tema oscuro **y** claro. Si tocaste el Worker, prueba también el camino
de error (payload inválido, id inexistente).

---

## 10 · Trampas ya pisadas

Estas rompieron el producto una vez. No las repitas.

1. **`[hidden]` pierde contra `display:flex/grid`.** El panel, el scrim y el modal usan `display`
   propio; sin la regla `[hidden] { display: none !important; }` (arriba de `app.css`) quedan
   invisibles pero **capturando clicks** en toda la página. No la borres.
2. **Colisión de atributos en la delegación de eventos.** El botón de abrir detalle usa
   `data-open`; las tarjetas de fase usan `data-expanded` justamente porque antes usaban
   `data-open` y `closest('[data-open]')` las capturaba primero, disparando un 404. Al agregar un
   `data-*` clickeable, revisa que no lo capture un selector anterior del listener de `document`.
3. **Iconos fuera del subset** salen como texto literal, sin error en consola. Siempre `grep`.
4. **`node_modules` no es portable entre sistemas operativos** (workerd trae binario nativo).
   El `package-lock.json` sí es multiplataforma y va commiteado.
5. **Varias instancias de `wrangler dev` a la vez** siguen sirviendo la base vieja aunque borres
   `.wrangler/` (SQLite sigue con el archivo abierto). Si ves datos fantasma, mata todos los
   procesos antes de re-migrar.
6. **`build-seed.mjs` no puede insertar en columnas que una migración posterior todavía no creó.**
   `0002_seed.sql` corre antes que cualquier `000N_*.sql` con número mayor; si agregas una columna
   nueva en, digamos, `0004`, el `INSERT` que genera `build-seed.mjs` **no puede mencionarla** aunque
   `seed-data.json` ya traiga el dato (rompe con `table tasks has no column named ...` en una base
   nueva). La columna nueva se rellena con un `UPDATE` dentro de esa misma migración `000N`, que
   corre después y alcanza tanto a las filas que acaba de crear `0002` como a las de una base ya
   desplegada.

---

## 11 · Decisiones cerradas

No las reabras sin que el equipo lo pida; si te parecen mal, dilo antes de cambiarlas.

- **Checkboxes, no kanban.** Se evaluó y se descartó arrastrar tarjetas entre columnas.
- **Sin autenticación.** El nombre del autor es una firma local, no identidad.
- **Sin etiquetas de respuesta.** Se eliminó la columna `tags`; el juicio de producción vive en
  `production_note`.
- **Tres fichas «no aplica» y una del pie quedaron fuera del seed.** Motivos en
  `scripts/seed-data.json → excluded`.
- **Sin textos descriptivos en la UI.** Nada de párrafos de ayuda, tooltips explicativos ni
  estados vacíos con instrucciones. Etiquetas y datos, nada más.
- **El seed es reproducible desde JSON.** Nunca edites `0002_seed.sql`; edita el JSON y regenera.
