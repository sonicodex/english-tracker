# Tareas detalladas — Ruta Inglés A1

Insumo para **actualizar las 19 tareas que ya existen** en el tracker (`english-tracker`) con la
descripción completa de cada ficha. Lee `AGENTS.md` antes de tocar el repo.

**Fuente:** `Guía de ejecución — Ruta Inglés A1`, sección **A · Cámara y edición** (23 fichas).
El seed actual salió del documento de *respuesta* a esa guía, que resumía cada ficha en una línea.
Esta guía es la original y trae tres bloques por ficha que hoy no existen en el artefacto:
**qué está mal**, **pasos sugeridos** y **resultado esperado**, más los can-dos y la condición
de aplicabilidad.

De las 23 fichas, **19 aplican** y son exactamente las 19 que ya están en el tracker (§5 lista las
4 excluidas, para que no se creen). El mapeo por `id` está verificado: tipo de trabajo, esfuerzo y
prioridad de la guía coinciden con el seed en las 19.

---

## 1 · Qué hay que hacer

Para cada una de las 19 tareas: **enriquecer `source_note`** y **agregar dos campos nuevos**.
No es una migración de datos masiva — son 19 registros con texto más largo y mejor estructurado.

| Campo | Estado | Contenido |
|---|---|---|
| `source_note` | **se reemplaza** | El bloque «Qué está mal / qué falta» completo. Hoy tiene solo el titular (ej. «Referencias rotas (clases VR retiradas).»); pasa a incluir el diagnóstico *y* la recomendación. |
| `steps` | **nuevo** | «Pasos sugeridos»: la secuencia concreta de producción. Es el campo más útil para quien ejecuta. |
| `expected_result` | **nuevo**, nullable | «Resultado esperado»: qué debe poder hacer el estudiante. Funciona como definición de terminado. 15 de 19 lo traen; en la guía, 4 fichas lo dejaron en blanco. |

**`can_dos` y `applies_when` NO se implementaron.** La guía original trae ambos (códigos de
can-do del currículo y condición de aplicabilidad — varias tareas de la Tanda 3 caen si se retira
un curso), y quedaron documentados tal cual en §4 como referencia, pero por decisión explícita del
equipo no son columnas del tracker. Si en el futuro se piden, §4 ya trae el contenido literal para
esas 15 (`can_dos`) y 12 (`applies_when`) fichas.

**Lo que NO cambia:** `title`, `batch_id`, `work_type`, `scope`, `owner`, `minutes`, `priority`,
`effort` ni `production_note`. Ya son correctos y están verificados contra la guía. Los títulos
del seed omiten a propósito sufijos como «(curso nuevo)» que la guía sí trae — déjalos como están.

## 2 · Archivos a tocar

1. **`migrations/0004_task_detail.sql`** — nueva migración (el proyecto ya está desplegado, **no
   edites `0001_init.sql`**). Corre `ls migrations/` antes: el número tiene que ser el siguiente
   libre; al escribirse este documento la última era `0003_cancel.sql`:
   ```sql
   ALTER TABLE tasks ADD COLUMN steps TEXT;
   ALTER TABLE tasks ADD COLUMN expected_result TEXT;
   ```
   D1 acepta un `ALTER TABLE ADD COLUMN` por sentencia; no uses `ALTER ... ADD COLUMN ... NOT NULL`
   sin default. Los `UPDATE` de los 19 registros van en la misma migración — **no** se pueden
   regenerar vía seed, ver el punto 3.

2. **`scripts/seed-data.json`** — la fuente de verdad del seed y de esta misma migración. Agrega
   `steps` y `expected_result` a cada tarea y reemplaza `source_note`. Después: `npm run build:seed`.
   **Nunca edites `migrations/0002_seed.sql` a mano** — es generado.

   Ojo: `0002_seed.sql` usa `INSERT OR IGNORE`, así que regenerarlo **no actualiza filas que ya
   existen** en una base viva. Para la base remota que ya está desplegada hacen falta `UPDATE`
   explícitos en `0004`. Para bases nuevas, el `UPDATE` de `0004` también alcanza — ver punto 3
   sobre por qué el seed regenerado *no* basta esta vez.

3. **`scripts/build-seed.mjs`** — **NO** sumes `steps` ni `expected_result` a la lista de columnas
   del `INSERT`. `0002_seed.sql` corre antes que `0004_task_detail.sql` (que es quien agrega esas
   columnas): un `INSERT` que las mencione rompe una base nueva con
   `table tasks has no column named steps`. `source_note` sí va en el `INSERT` (esa columna ya
   existe desde `0001`); `steps`/`expected_result` quedan en `NULL` tras `0002` y los llena el
   `UPDATE` de `0004`, tanto en una base nueva como en la ya desplegada. Ver trampa #6 de
   `AGENTS.md`.

4. **`src/index.js`** — cuatro puntos:
   - `TASK_FIELDS`: agregar `steps`, `expected_result` (habilita `PATCH`).
   - `readBoard()`: el `SELECT` de `tasks` es explícito, agrega las dos columnas.
   - `insertTask()`: sumarlas al `INSERT` con sus `str(body.x, max)`. Sugerencia de máximos:
     `steps` 3000, `expected_result` 1000.
   - `GET /api/tasks/:id` usa `SELECT *`, no hay que tocarlo.

5. **`public/app.js`** — tres puntos:
   - **Panel de detalle**: es donde vive el valor. Hoy `detail-notes` muestra dos `.note`
     (`source` y `production`). Agrega los bloques nuevos ahí, antes de la lista de fases:
     `steps` y `expected_result` merecen su propio `.note`.
   - **Formulario** (`taskForm`): dos campos más, ambos `textarea` con `span: true`.
   - **Importador y export**: sumar alias en `COLUMN_ALIASES` (`pasos`, `resultado`) y las columnas
     equivalentes en `EXPORT_COLUMNS` y `exportCsv()`. Los dos lados tienen que quedar espejados o
     se rompe el ida y vuelta CSV.

6. **`AGENTS.md`** — actualizar §4 (modelo de datos) y §6 con los campos nuevos.

**No agregues estos campos a la tabla del tablero.** La fila ya tiene 12 columnas; `steps` es
texto largo y va solo en el popup. La UI no lleva textos descriptivos (decisión cerrada, §11 de
`AGENTS.md`) — estos son datos de la ficha, no ayuda de interfaz, por eso sí entran.

## 3 · Verificación

```bash
npm run build:seed
rm -rf .wrangler && npm run db:migrate:local
npm run dev
```

Abre el popup de al menos una tarea por tanda y confirma que los dos campos se ven en tema
oscuro **y** claro, y que `expected_result` no deja un hueco cuando es `null` (ej. `t2-05`,
`t3-06`, `t3-07`, `t3-08`). Revisa también que exportar e importar el CSV conserve los campos
nuevos.

---

## 4 · Contenido por tarea

Los textos de abajo van tal cual, en bloques de código para que no haya ambigüedad de comillas o
acentos. Cada tarea se identifica por su `id`, que es estable y coincide con la base.

`can_dos` y `applies_when` quedan **como referencia de la guía original únicamente**: no se
implementaron como columnas (§1). No los busques en `tasks`; si algún día se necesitan, el texto
literal ya está aquí abajo.




### Tanda 1 — lista para agendar ya

#### `t1-01` · Preposiciones (audio)

`grabación` · esfuerzo M · Ravee Lakhmani · 7 min · MEDIA  
*Clases 1, 7, 8, 9 · segmentos 'have a look at the screen' (~6-8 min)*

**`source_note`** — reemplaza el valor actual:

```text
Formato: audio que señala una pantalla inexistente — Reeditar los segmentos 'have a look at the screen' con descripciones verbales autosuficientes de las posiciones (o insertar audio-descripción), para que el andamiaje de lugar funcione en modo podcast
```

**`steps`** (nuevo):

```text
1) Localizar en las clases 1, 7, 8 y 9 los segmentos que dicen 'have a look at the screen' (≈6-8 min en total). 2) Regrabar SOLO el audio: la profesora describe las posiciones con palabras ('the cat is ON the box — on top of it'), sin referencia visual. 3) Sustituir el audio en esos rangos y verificar que cada ejercicio funcione sin pantalla.
```

**`expected_result`** (nuevo):

```text
Entender posiciones y lugares descritos SOLO con palabras, como corresponde al formato audio — L4/PS1
```

**`can_dos`**: `L4, PS1`  
**`applies_when`**: `null`

#### `t1-02` · Inglés para Viajes (audio)

`reedición` · esfuerzo S · Carolina Boquín · 1 min · MEDIA  
*Clase 2 [01:13–01:40] y clase 10 [04:52]*

**`source_note`** — reemplaza el valor actual:

```text
Referencias rotas (clases VR retiradas) — Recortar las menciones a las 3 clases VR inactivas (cls 2 [01:13-01:40], cls 10 [04:52]) o reactivar/regrabar ese bonus; hoy es promesa rota evaluada en examen
```

**`steps`** (nuevo):

```text
1) Cortar clase 2 [01:13–01:40] y la mención de clase 10 en [04:52]. 2) Re-render y verificar continuidad de audio. (Alternativa solo si se decide: reactivar las 3 clases VR.)
```

**`expected_result`** (nuevo):

```text
Seguir el curso sin referencias rotas
```

**`can_dos`**: `null`  
**`applies_when`**: `null`

#### `t1-03` · Pronunciación

`reedición` · esfuerzo S · Mariana Lafon · 0.5 min · MEDIA  
*Clase 18 · [07:37–07:53]*

**`source_note`** — reemplaza el valor actual:

```text
Modelo incorrecto dictado ('catched', 'payed') — Reeditar el segmento final del ejercicio ([07:37]-[07:53]) que dicta las formas incorrectas 'catched' y 'payed' como palabras a practicar (deberían ser caught/paid o sustituirse por regulares)
```

**`steps`** (nuevo):

```text
1) Cortar [07:37–07:53] de la clase 18, o regrabar ~20s con las formas correctas caught/paid (o sustituir por verbos regulares). 2) Verificar que el worksheet no liste 'catched/payed'.
```

**`expected_result`** (nuevo):

```text
Practicar pronunciación sin aprender formas erróneas
```

**`can_dos`**: `null`  
**`applies_when`**: `null`


### Tanda 2 — ruta obligatoria

#### `t2-01` · Práctica y Checkpoint de Salida A1

`nuevo` · esfuerzo L · por asignar · 21 min · ALTA  
*Curso nuevo (~6-8 clases) — no existe*

**`source_note`** — reemplaza el valor actual:

```text
Modo sin práctica medible (interacción oral y teléfono) — 'Práctica y Checkpoint de Salida A1': ~6-8 clases — sesiones guiadas de simulador (escenarios rescatados de 2175/2395), tarea telefónica (material de 3996), checkpoint contra el banco. Requiere A07/A08 resueltos
```

**`steps`** (nuevo):

```text
1) Guion contra IS1/IS3/IS6 con la estructura tentativa: 1-2 sesiones guiadas de simulador (presentación personal, compras — escenarios ya escritos en 2175/2395), 1 clase de teléfono + tarea telefónica (las 2 llamadas modeladas de Inglés para el Trabajo sirven de base), 1 simulacro, checkpoint contra el banco. 2) Validación del guion contra la pestaña 1 del workbook. 3) NO producir antes de que los simuladores estén renivelados y midiendo (sección C).
```

**`expected_result`** (nuevo):

```text
Sostener la conversación guiada del simulador, cumplir una tarea telefónica y pasar el checkpoint de salida A1 — IS1, IS3, IS6
```

**`can_dos`**: `IS1, IS3, IS6`  
**`applies_when`**: `aprobada — pendiente alcance`

#### `t2-02` · Escritura

`nuevo` · esfuerzo M · Fernanda Machado · 10.5 min · ALTA  
*3 clases nuevas — no existe*

**`source_note`** — reemplaza el valor actual:

```text
Can-dos sin fuente (escritura transaccional) — Formulario de registro · formulario de compra en línea · tarjeta/postal — dentro de 2256 tras su renivelación A2
```

**`steps`** (nuevo):

```text
1) Guion de 3 clases: (a) llenar formulario de registro — nombre, nacionalidad, dirección, fecha de nacimiento; (b) compra en línea — datos + dirección de envío + confirmación; (c) tarjeta/postal — saludo, 2-3 frases, despedida. 2) Cada clase termina con el challenge correspondiente YA creado en banco (sección B, curso Escritura). 3) Grabar tras la renivelación A2→A1 del curso (fila 10).
```

**`expected_result`** (nuevo):

```text
Llenar un formulario de registro, completar una compra en línea y escribir una tarjeta/postal simple — PW3, IW3, PW4
```

**`can_dos`**: `PW3, IW3, PW4`  
**`applies_when`**: `aprobada — pendiente alcance`

#### `t2-03` · Vocabulario y Expresiones

`nuevo` · esfuerzo S · René Lora · 4.5 min · MEDIA  
*2-3 segmentos nuevos sobre clases existentes — no existe*

**`source_note`** — reemplaza el valor actual:

```text
Can-dos sin fuente (mediación es↔en) — Añadir la capa 'transmítelo en español' sobre los letreros/menús/cuentas que 2921 ya muestra en pantalla
```

**`steps`** (nuevo):

```text
1) Guion de 2-3 segmentos sobre las clases existentes de letreros/menús/cuenta: la profesora muestra el material ya filmado y pide 'tu amigo no habla inglés — ¿qué le dices?'. 2) Cerrar cada segmento con el ítem de mediación correspondiente (sección B, curso Vocabulario, clase 13).
```

**`expected_result`** (nuevo):

```text
Contarle en español a alguien lo que dice un letrero/aviso y listar nombres/precios entre idiomas — M2, M3, M1
```

**`can_dos`**: `M1, M2, M3`  
**`applies_when`**: `aprobada — pendiente alcance`

#### `t2-04` · Vocabulario y Expresiones

`reedición` · esfuerzo M · René Lora · 15 min · MEDIA  
*Clase 14 (segmento present continuous) y clase 17 (segmento past simple)*

**`source_note`** — reemplaza el valor actual:

```text
Nivel equivocado (A2 como objetivo) — Reencuadrar present continuous (14) y past simple (17) como exposición receptiva o mover a A2; decisión de matriz a nivel ruta, no urgente por sí sola
```

**`steps`** (nuevo):

```text
Para cada segmento: si el estudiante debe PRODUCIR la estructura, regrabar el segmento con tarea A1; si solo la escucha, dejarla con rótulo de exposición ('así suena el pasado — lo aprenderás en A2'). Clase 14: segmento present continuous. Clase 17: past simple es el objetivo de la clase completa — decisión de matriz (receptivo vs mover a A2) antes de tocar.
```

**`expected_result`** (nuevo):

```text
Recibir ropa/anécdotas solo como INPUT receptivo, sin que el nivel A1 se rompa (o el contenido migra a A2)
```

**`can_dos`**: `PS1, IS3`  
**`applies_when`**: `null`

#### `t2-05` · Escritura

`grabación` · esfuerzo M · Fernanda Machado · 8 min · MEDIA  
*Clases 17 (rutinas con adverbios) y 18 (biografía en pasado) + nivel de tareas del curso*

**`source_note`** — reemplaza el valor actual:

```text
Nivel equivocado (tareas A2 como objetivo) — Reencuadrar ambas clases a tareas A1 (rutina simple en presente; descripción de una persona en vez de biografía en pasado). Va junto con la renivelación general A2
```

**`steps`** (nuevo):

```text
1) Clase 17: regrabar el segmento de tarea para pedir rutina simple en presente (sin adverbios de frecuencia como objetivo). 2) Clase 18: cambiar la tarea de 'biografía en pasado' a 'describe a una persona' (presente). 3) Aplicar la pauta general de renivelación del curso al revisar los guiones de las 3 clases nuevas (A142).
```

**`expected_result`**: `null` — la guía lo dejó en blanco para esta ficha.

**`can_dos`**: `PW1, PW2`  
**`applies_when`**: `pendiente — par de A142`

#### `t2-06` · Verbo To Be

`reedición` · esfuerzo S · Jhon Carvajal · 0.3 min · BAJA  
*Clase 10 · cierre (~últimos 20s)*

**`source_note`** — reemplaza el valor actual:

```text
Tarea desalineada con lo enseñado — Reeditar el cierre (últimos ~20s) para que la tarea pida escribir presentaciones con 'this is' + saludo, no descripciones genéricas
```

**`steps`** (nuevo):

```text
Regrabar o reeditar los últimos ~20s de la clase 10: la tarea dice 'descripciones'; debe decir 'presenta a dos personas con This is… + saludo'.
```

**`expected_result`** (nuevo):

```text
Presentar a alguien por escrito con 'This is…' + saludo — IS2/PS1
```

**`can_dos`**: `IS2, PS1`  
**`applies_when`**: `null`

#### `t2-07` · Escritura

`reedición` · esfuerzo S · Fernanda Machado · 2.5 min · BAJA  
*Clase 2 · segmento acrónimos (~2.5 min)*

**`source_note`** — reemplaza el valor actual:

```text
Metalenguaje fuera de nivel — Recortar el segmento acrónimo/inicialismo y punto británico vs americano (≈2.5 min de metalenguaje fuera de A1) de la clase más larga del curso
```

**`steps`** (nuevo):

```text
Cortar el segmento de acrónimo vs inicialismo y puntuación británica/americana (≈2.5 min, en la primera mitad de la clase 2). El contenido restante queda al nivel.
```

**`expected_result`** (nuevo):

```text
Escribir oraciones simples sin desvío metalingüístico — PW1
```

**`can_dos`**: `PW1`  
**`applies_when`**: `null`

#### `t2-08` · Inglés para el Trabajo

`reedición` · esfuerzo S · Gina Pedraza · 2 min · BAJA  
*Clase 13 · cierre*

**`source_note`** — reemplaza el valor actual:

```text
Material de examen invisible para el estudiante — Añadir al video los perfiles de los dos candidatos (hoy solo en worksheet) para que los ítems de examen tengan base en el video; duración actual anómala (1m14s)
```

**`steps`** (nuevo):

```text
Añadir al cierre de la clase 13 una pantalla (~2 min de motion/gráfico) con los DOS perfiles de candidatos que hoy solo existen en el worksheet, para que los ítems del examen tengan referente visible. Texto de los perfiles: en el worksheet de la clase.
```

**`expected_result`** (nuevo):

```text
Leer los dos perfiles en pantalla y decidir con esa información — R5
```

**`can_dos`**: `R5`  
**`applies_when`**: `null`


### Tanda 3 — condicionadas y opcionales

#### `t3-01` · Viajes en video

`nuevo` · esfuerzo L · por asignar · 38.5 min · MEDIA  
*Curso nuevo opcional (~10-12 clases) — reemplaza al audio 2175*

**`source_note`** — reemplaza el valor actual:

```text
Refuerzo opcional (audiencia de viajes) — En video (no audio), simuladores re-escritos a A1; desvío clásico de viajes
```

**`steps`** (nuevo):

```text
Alcance por definir tras la decisión de ruta mínima. Insumos listos: escenarios de simulador de 2175 (check-in, small talk) re-escritos a A1 y estructura de can-dos IS4/IS5/R2/L4/L5. No agendar.
```

**`expected_result`** (nuevo):

```text
Resolver aeropuerto, hotel, compras y direcciones en un viaje real — IS4, IS5, R2, L4, L5, M1/M2
```

**`can_dos`**: `IS4, IS5, R2, L4, L5, M1/M2`  
**`applies_when`**: `propuesta aprobada — decidir tras la ruta mínima`

#### `t3-02` · Inglés para tu Trabajo

`nuevo` · esfuerzo L · por asignar (base: Gina Pedraza) · 31.5 min · MEDIA  
*Curso nuevo opcional (~8-10 clases) — evolución de 3996*

**`source_note`** — reemplaza el valor actual:

```text
Refuerzo opcional (audiencia laboral) — Sector English profesional; vehículo natural de IS6 ampliado; entrevista marcada como puente A1+/A2
```

**`steps`** (nuevo):

```text
Alcance por definir tras la decisión de ruta mínima. Base: 3996 (Gina Pedraza); rescatar las 2 llamadas telefónicas modeladas; entrevista marcada A1+/A2. No agendar.
```

**`expected_result`** (nuevo):

```text
Presentarse, seguir instrucciones y atender una llamada simple en contexto laboral — PS2, L4, IS6, R5, PW2
```

**`can_dos`**: `PS2, L4, IS6, R5, PW2`  
**`applies_when`**: `propuesta aprobada — decidir tras la ruta mínima`

#### `t3-03` · Preparación Certificación A1

`nuevo` · esfuerzo M · por asignar · 15 min · BAJA  
*Curso corto nuevo opcional (~4-6 clases) — no existe*

**`source_note`** — reemplaza el valor actual:

```text
Preparación de examen (audiencia B2B) — Qué esperar del examen, práctica por modo contra el banco, simulacro completo; da meta visible (punto de Ofelia). La más especulativa: depende del contrato
```

**`steps`** (nuevo):

```text
Condicionada al contrato B2B (Diana). Estructura tentativa: qué esperar del examen · práctica por modo contra el banco · simulacro completo. No agendar.
```

**`expected_result`** (nuevo):

```text
Llegar al examen de certificación sabiendo qué esperar, con un simulacro completo encima — transversal (los 30)
```

**`can_dos`**: `transversal`  
**`applies_when`**: `condicionada al contrato B2B`

#### `t3-04` · Construcción de Oraciones

`reedición` · esfuerzo S · Vicky Peña · 0.5 min · MEDIA  
*Clase 18 (63860) · clip completo*

**`source_note`** — reemplaza el valor actual:

```text
Clip duplicado y fuera de lugar — Reemplazar el clip duplicado de cl.23 por un resumen real de módulos 1-3 (o eliminar la clase y renumerar): hoy 'repasa' contenido que aún no se ha visto; corregir 'introductions'
```

**`steps`** (nuevo):

```text
CONDICIONADA: si Construcción de Oraciones sale a B1, no hay acción. Si se conserva: reemplazar el clip de la clase 18 (duplicado exacto de la 23) por un resumen real de módulos 1-3, y corregir 'introductions'→'interjections' en ambos.
```

**`expected_result`** (nuevo):

```text
— (si 8024 se retira a B1 esta acción cae; mientras viva: un resumen real de módulos 1-3)
```

**`can_dos`**: `null`  
**`applies_when`**: `CAE si Construcción de Oraciones sale a B1; si se conserva, reeditar`

#### `t3-05` · Estrategias para Aprender Inglés

`reedición` · esfuerzo S · Gina Pedraza · 0.5 min · MEDIA  
*Clase 3 (84347) · cierre (~últimos 30s)*

**`source_note`** — reemplaza el valor actual:

```text
Tarea sin idioma ni plantilla — Reeditar el cierre (o añadir tarjeta/recurso) para pedir la meta en inglés con plantilla A1 ('My goal is...'), convirtiendo el único CTA capturado del curso en producción PW1/IW2 real
```

**`steps`** (nuevo):

```text
CONDICIONADA al futuro de Estrategias: si se conserva como recurso, reeditar el cierre de la clase 3 (~30s) para pedir la meta EN INGLÉS con plantilla: 'Write your goal in English: My goal is…'.
```

**`expected_result`** (nuevo):

```text
Escribir su meta en inglés con la plantilla 'My goal is…' — PW1/IW2
```

**`can_dos`**: `PW1, IW2`  
**`applies_when`**: `CAE si Estrategias sale del camino; si se conserva como recurso, reeditar`

#### `t3-06` · Estrategias para Aprender Inglés

`reedición` · esfuerzo S · Gina Pedraza · 3 min · BAJA  
*Clase 8 (IA sin pena)*

**`source_note`** — reemplaza el valor actual:

```text
Nivel equivocado (clase en inglés B1+) — Si el curso se conserva como recurso fuera del camino: regrabar la clase en español o con inglés A1; sus prompts apuntan a herramientas externas.
```

**`steps`** (nuevo):

```text
CONDICIONADA: si Estrategias se conserva como recurso, regrabar la clase 8 en español o con inglés A1 (hoy está en B1+).
```

**`expected_result`**: `null` — la guía lo dejó en blanco para esta ficha.

**`can_dos`**: `null`  
**`applies_when`**: `CAE con el retiro del curso`

#### `t3-07` · Inglés para Viajes (audio)

`reedición` · esfuerzo S · Carolina Boquín · 3 min · BAJA  
*Clases 13 y 17 (segmentos parciales)*

**`source_note`** — reemplaza el valor actual:

```text
Nivel equivocado (like+ing, idioms como objetivo) — Los absorbe el rediseño de Viajes en video (A146). Si Viajes sigue en audio: recortar los segmentos de idioms/like+ing o marcarlos como 'extra'.
```

**`steps`** (nuevo):

```text
Los absorbe el rediseño de Viajes (A146). Si Viajes sigue en audio: recortar los segmentos de idioms ('kill two birds…') y like+ing de las clases 13 y 17, o rotularlos como 'extra — nivel A2'.
```

**`expected_result`**: `null` — la guía lo dejó en blanco para esta ficha.

**`can_dos`**: `integridad de nivel`  
**`applies_when`**: `absorbida por A146 si procede`

#### `t3-08` · Inglés para el Trabajo

`reedición` · esfuerzo S · Gina Pedraza · 2 min · BAJA  
*Clase 12 (agendar reuniones)*

**`source_note`** — reemplaza el valor actual:

```text
Nivel equivocado (in/on/at de tiempo como objetivo) — Si el curso sigue en catálogo como opcional: reencuadrar el segmento a hora simple ('at 3 o'clock' como fórmula) sin la regla in/on/at.
```

**`steps`** (nuevo):

```text
Si el curso sigue en catálogo: reencuadrar el segmento de la clase 12 a hora simple ('the meeting is at 3 o'clock' como fórmula), sin la regla in/on/at de tiempo.
```

**`expected_result`**: `null` — la guía lo dejó en blanco para esta ficha.

**`can_dos`**: `integridad de nivel`  
**`applies_when`**: `si el curso sigue en catálogo`

---

## 5 · Fichas excluidas — no crear

La guía trae 23 fichas; estas 4 quedaron fuera del tracker por decisión del equipo. Si
aparecen en el repo, es un error. El motivo también está en `scripts/seed-data.json → excluded`.

| Ficha en la guía | Alcance | Motivo |
|---|---|---|
| **Inglés Básico A1 para Principiantes** (reedición) | clase 7 (71372) · segmento [01:36–02:24] | no aplica — son ejemplos actuados; el análisis original no tomó ese contexto |
| **Vocabulario y Expresiones** (reedición) | clases 2, 6, 8, 10, 18 · líneas y CTAs sueltos | sin respuesta registrada en el documento de revisión (ficha del pie) |
| **Estrategias 2022** (reedición) | clases 5 y 11 | no aplica — el curso está deprecado |
| **Fechas, Horas y Expresiones Simples** (grabación) | clase 20 (12m53s) | no aplica — 2395 deprecado, reemplazado por 13082 y 12989 |

---

## 6 · Cobertura

Sirve como checklist: al terminar, estos son los conteos de campos no nulos que debe
devolver la base. `can_dos` y `applies_when` no están en esta tabla porque no son columnas
(§1) — sus conteos de la guía (15 y 12) quedan solo como dato dentro de §4.

| | Tareas | `steps` | `expected_result` |
|---|---|---|---|
| Tanda 1 — lista para agendar ya | 3 | 3 | 3 |
| Tanda 2 — ruta obligatoria | 8 | 8 | 7 |
| Tanda 3 — condicionadas y opcionales | 8 | 8 | 5 |
| **Total** | **19** | **19** | **15** |

```sql
-- comprobación rápida tras aplicar los cambios
SELECT COUNT(*) AS tareas,
       COUNT(steps) AS steps,
       COUNT(expected_result) AS resultado
FROM tasks;
-- esperado: 19 | 19 | 15
```

Los dos campos nullable se dejan en `null`, nunca en `'—'` ni en cadena vacía: la UI
decide si renderiza el bloque según la ausencia del valor.
