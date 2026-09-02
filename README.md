# english-tracker

Seguimiento de tandas y tareas de producción — **Ruta Inglés A1**.
Cloudflare Worker + D1, front en HTML/CSS/JS sin build, diseño con tokens **Platzi Sinapsis**.

> Vas a modificar el proyecto (o le pasas la tarea a un agente): lee **[`AGENTS.md`](./AGENTS.md)**
> primero. Ahí está el contexto del producto, las reglas del design system, las decisiones ya
> cerradas y las trampas conocidas.

## Qué hay dentro

| Ruta | Qué es |
|---|---|
| `src/index.js` | Worker: router de `/api/*` y fallback al SPA |
| `src/phases.js` | Las 6 fases (`backlog`, `planning`, `execution`, `edition`, `review`, `done`) |
| `migrations/0001_init.sql` | Esquema: `batches`, `tasks`, `phase_states`, `comments` |
| `migrations/0002_seed.sql` | Generado: 3 tandas · 19 tareas del documento de revisión |
| `scripts/seed-data.json` | Fuente editable del seed (+ lista de fichas excluidas) |
| `scripts/build-seed.mjs` | Regenera `0002_seed.sql` desde el JSON |
| `public/` | Front: `index.html`, `app.js`, `styles/` (tokens Sinapsis + `app.css`), `assets/` (webfonts + isotipo) |
| `docs/sinapsis-icon-subset.txt` | Nombres de icono disponibles en el font subsetado |
| `AGENTS.md` | Contexto del producto para quien (o lo que) vaya a cambiar el código |

Las tareas vienen de `Revisión detallada por clase — Ruta Inglés A1`, sección A. Se excluyeron
las 3 fichas marcadas **no aplica** y la ficha del pie sin respuesta registrada; el detalle está
en `scripts/seed-data.json` → `excluded`.

## Puesta en marcha

```bash
npm install

# 1 · crear la base D1 y pegar el database_id en wrangler.jsonc
npm run db:create

# 2 · migraciones
npm run db:migrate:local     # entorno local
npm run db:migrate           # base remota (una vez, antes del primer deploy)

# 3 · desarrollo
npm run dev                  # http://localhost:8787
```

`npm run db:create` imprime algo como `database_id = "xxxx-…"`. Ese valor reemplaza a
`REEMPLAZAR_CON_TU_DATABASE_ID` en `wrangler.jsonc` — sin eso el Worker responde 500.

## Despliegue continuo desde GitHub

1. Push del repo a GitHub.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository** → elegí este repo.
3. Build command: *(vacío)* · Deploy command: `npx wrangler deploy`.
4. En el Worker → **Settings → Bindings**, confirmá el binding **D1 `DB`** apuntando a `english-tracker`.
5. Cada `git push` a la rama de producción dispara un deploy.

Las migraciones **no** corren solas en el build. Cuando agregues una:

```bash
npm run db:migrate
```

## API

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/board` | Tablero completo: fases, tandas, tareas, estado por fase y conteo de comentarios |
| `POST` | `/api/batches` | Crea tanda `{name}` |
| `PATCH` `DELETE` | `/api/batches/:id` | Renombra / elimina (arrastra sus tareas) |
| `POST` | `/api/tasks` | Crea tarea `{batch_id, title, …}` |
| `GET` `PATCH` `DELETE` | `/api/tasks/:id` | Detalle con comentarios / edita / elimina |
| `PUT` | `/api/tasks/:id/phases/:phase` | Marca o desmarca una fase `{done, by}` |
| `POST` | `/api/tasks/:id/comments` | Comentario en una fase `{phase, body, author}` |
| `DELETE` | `/api/comments/:id` | Elimina comentario |
| `POST` | `/api/import` | Importa `{batch_id?, rows: [...]}`, máx. 500 filas |

## Importador

Acepta CSV, TSV o una tabla pegada (detecta el separador). Columnas reconocidas — en español o inglés:

```
tanda · tarea|curso|título · tipo · clases|alcance · esfuerzo · responsable
minutos|duración · prioridad · ficha · respuesta
```

Sólo `tarea` es obligatoria. Si hay columna `tanda` y el nombre no existe, la tanda se crea;
si no hay columna, se usa la tanda destino elegida en el modal. **Exportar CSV** produce
exactamente esas columnas más una por fase, así que el ida y vuelta funciona.

## Notas de diseño

Todo color sale de `var(--sin-*)` (cero hex en `app.css`), los estados usan los tokens
`--sin-state-hover|focus|pressed|disabled`, los iconos son ligaduras de Material Symbols Rounded
del subset de Sinapsis, y las webfonts se sirven desde `public/assets/fonts/` (sin CDN externo).
Tema oscuro por defecto; el toggle del topbar cambia a `data-theme="sinapsis-light"`.
