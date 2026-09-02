export const PHASES = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'planning', label: 'In planning' },
  { id: 'execution', label: 'In execution' },
  { id: 'edition', label: 'In edition' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' },
];

export const PHASE_IDS = PHASES.map((p) => p.id);
export const isPhase = (id) => PHASE_IDS.includes(id);
