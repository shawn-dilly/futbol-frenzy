import type { Ratings } from '../sim';

export interface TeamRecord {
  id: string;
  name: string;
  ratings: Ratings;
  /** Atlas indices for outfield and keeper, selected by match side. */
  kits: { home: readonly [number, number]; away: readonly [number, number] };
}

// The existing atlas has one red and one blue outfield kit. Side-based kits
// guarantee contrast even for mirror matches; names and ratings identify teams.
const kits = { home: [0, 2], away: [1, 3] } as const;
export const TEAMS: readonly TeamRecord[] = [
  { id: 'rhinos', name: 'Rhinos', ratings: { speed: 0.4, power: 0.8, skill: 0.5, dirty: 0.6 }, kits },
  { id: 'vipers', name: 'Vipers', ratings: { speed: 0.8, power: 0.4, skill: 0.6, dirty: 0.5 }, kits },
  { id: 'comets', name: 'Comets', ratings: { speed: 0.9, power: 0.3, skill: 0.7, dirty: 0.2 }, kits },
  { id: 'forge', name: 'Forge', ratings: { speed: 0.3, power: 0.9, skill: 0.4, dirty: 0.7 }, kits },
  { id: 'pirates', name: 'Pirates', ratings: { speed: 0.6, power: 0.6, skill: 0.4, dirty: 0.9 }, kits },
  { id: 'orbits', name: 'Orbits', ratings: { speed: 0.5, power: 0.4, skill: 0.9, dirty: 0.3 }, kits },
];
