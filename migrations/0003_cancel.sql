-- english-tracker · cancelar tarea sin eliminarla
-- "Cancelar" es un indicador visual (tachado + tag roja), no un borrado. No hay
-- historial de cancelación por diseño, igual que las fases (ver AGENTS.md §5).

ALTER TABLE tasks ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0;
