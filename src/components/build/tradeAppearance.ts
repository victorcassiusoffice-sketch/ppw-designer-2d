import type { JobStatus } from '../../designer/link/tradeWork';

export const tradeAppearance = {
  planned: { symbol: '◇', ink: '#385675', word: 'Planned' },
  started: { symbol: '▶', ink: '#086655', word: 'Started' },
  waiting: { symbol: 'Ⅱ', ink: '#795005', word: 'Waiting' },
  done: { symbol: '✓', ink: '#376028', word: 'Done' },
  snagged: { symbol: '!', ink: '#932c48', word: 'Snagged' },
} as const satisfies Record<JobStatus, { symbol: string; ink: string; word: string }>;
