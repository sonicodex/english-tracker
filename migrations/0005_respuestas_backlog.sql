-- english-tracker · respuestas de JuanPa a cada ficha, cargadas como comentarios en Backlog
-- firmados por Lina López Lalinde (quien las registra en el tracker)
-- Fuente: docs/respuestas-backlog.md. Ids estables (cmt_bl_<task_id>) y created_at fijo para
-- que la migración sea idempotente e igual en local y en remoto.

-- 1) t2-09: la ficha del pie deja de estar excluida (20 tareas, 3 excluidas).
-- 0002_seed.sql ya trae esta fila para bases nuevas (build-seed.mjs regenerado), pero la base
-- remota, ya desplegada, aplicó una versión anterior de 0002 sin esta tarea — hace falta el
-- INSERT explícito aquí + sus 6 phase_states, o la tarea sale sin checkboxes. El UPDATE de
-- steps cubre también el caso local (fresh migrate), donde 0002 ya insertó la fila sin steps.
INSERT OR IGNORE INTO tasks (id, batch_id, title, work_type, scope, effort, owner, minutes, priority, source_note, production_note, position) VALUES ('t2-09', 't2', 'Vocabulario y Expresiones', 'reedición', 'Clases 2, 6, 8, 10, 18 · líneas y CTAs sueltos', 'S', 'René Lora', 4, 'MEDIA', 'Nivel equivocado (A2 en CTAs y diálogos) — Micro-reediciones: quitar o sustituir las líneas A2 incidentales (''I''ve made up my mind'', comparativos en diálogo) y los CTAs que exigen past simple', NULL, 8);
INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES ('t2-09', 'backlog', 0);
INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES ('t2-09', 'planning', 0);
INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES ('t2-09', 'execution', 0);
INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES ('t2-09', 'edition', 0);
INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES ('t2-09', 'review', 0);
INSERT OR IGNORE INTO phase_states (task_id, phase, done) VALUES ('t2-09', 'done', 0);
UPDATE tasks SET steps = 'Micro-cortes de edición: clase 2 (''I''ve made up my mind''), clases 6 y 10 (comparativos en diálogo — dejar como input, quitar del CTA), clases 8 y 18 (CTAs que exigen past simple → regrabar solo la frase del CTA pidiendo la tarea en presente).' WHERE id = 't2-09';

-- 2) t3-06: JuanPa la descarta. Se cancela, no se borra — la decisión queda visible y el
-- comentario de abajo explica por qué.
UPDATE tasks SET cancelled = 1 WHERE id = 't3-06';

-- 3) t3-08: el tipo de trabajo real es grabación, no reedición — confirmado por JuanPa en el
-- comentario de abajo. NO se toca work_type todavía: esfuerzo y minutos se calcularon como
-- reedición y hay que revisarlos junto con él antes de cambiarlos.

-- 4) Comentarios en la fase backlog, uno por tarea (20), firmados por Lina López Lalinde. Cuerpos literales — ya
-- vienen filtrados de lo que repetían de source_note, steps o production_note.
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t1-01', 't1-01', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Sin cambios al plan de la ficha.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t1-02', 't1-02', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Además de los dos cortes de la ficha, barrer el curso completo: que no quede ninguna referencia a las clases VR.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t1-03', 't1-03', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Explora el modelo de voz con edición, me gusta la idea. Antes de sintetizar la voz de Mariana hay que pedirle consentimiento, aunque sean dos palabras. Plan B si no sale rápido o no suena natural: el corte.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-01', 't2-01', 'backlog', 'Lina López Lalinde', 'En pausa ⏸ El alcance está aprobado; el arranque queda bloqueado por los simuladores.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-02', 't2-02', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Sobre la duda del objetivo: hoy ningún curso A1 enseña estos tres can-dos, y es de los huecos más grandes de la ruta porque son tarea clásica de examen y de la vida real. La meta es que el estudiante salga capaz de llenar formularios y escribir mensajes cortos reales, no solo oraciones sueltas. Cambio al plan de la ficha: no hay que esperar la renivelación A2→A1 del curso; se pueden ir grabando estas tres clases mientras tanto.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-03', 't2-03', 'backlog', 'Lina López Lalinde', 'Sobre la duda de «transmítelo en español»: es una apuesta estratégica, no relleno. La mediación casi no se enseña, está alineada al MCER y es literalmente lo que hace a diario un profesional latinoamericano, así que sirve para diferenciar a la English Academy. Ejemplo concreto del formato: la pantalla muestra WET FLOOR, «your friend doesn''t speak English, what do you tell him?», pausa, «cuidado, el piso está mojado». Hay que diseñarlo con calma para que no aparezca de la nada. Pendiente: propuesta de en qué otros cursos incorporar este can-do.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-04', 't2-04', 'backlog', 'Lina López Lalinde', 'Decisión: el contenido A2 se queda como input receptivo con rótulo, y solo se regraban las líneas de tarea y CTA para pedir producción A1. Abierto: la clase 17 es past simple completa, toda A2, y todavía no hay definición de qué hacer con ella.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-05', 't2-05', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Sin cambios al plan de la ficha.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-06', 't2-06', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Aprobado el plan de voz en off + motion graphics.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-07', 't2-07', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Sin cambios al plan de la ficha.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-08', 't2-08', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Sin cambios al plan de la ficha.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t2-09', 't2-09', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Entra al seguimiento: en la revisión original esta ficha quedó sin respuesta.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-01', 't3-01', 'backlog', 'Lina López Lalinde', 'En pausa ⏸ De acuerdo con el alcance, pero no es prioridad.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-02', 't3-02', 'backlog', 'Lina López Lalinde', 'En pausa ⏸ No es prioridad y hay que pensar mejor el alcance.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-03', 't3-03', 'backlog', 'Lina López Lalinde', 'En pausa ⏸ Se descarta priorizarlo. El bloqueo real no es el contrato B2B: primero tiene que existir el examen de certificación, porque el curso se prepara contra el examen real, no antes.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-04', 't3-04', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Deja de estar condicionada: procede con el plan de voz en off + motion.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-05', 't3-05', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ Se resuelve la condicional: Estrategias sale de la ruta A1 pero se conserva como recurso, así que la reedición procede.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-06', 't3-06', 'backlog', 'Lina López Lalinde', 'Descartada. El curso sale de la ruta A1 y esta clase no justifica la regrabación.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-07', 't3-07', 'backlog', 'Lina López Lalinde', 'Listo para arrancar ✅ No hay que esperar a Viajes en video: rotular ya. Si ese curso sale, los absorbe.', '2026-09-02T21:00:00Z');
INSERT OR IGNORE INTO comments (id, task_id, phase, author, body, created_at) VALUES ('cmt_bl_t3-08', 't3-08', 'backlog', 'Lina López Lalinde', 'En espera ⏸ Confirmado que la acción es regrabación, no reedición: desde reedición no se puede plantear. Queda parada hasta decidir qué pasa con el curso.', '2026-09-02T21:00:00Z');
