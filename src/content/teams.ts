import { KIT, mirrorKit } from '../art/palette';
import type { Ratings } from '../sim';

export interface TeamRecord {
  id: string;
  name: string;
  ratings: Ratings;
  primary: number;
}

export const TEAMS: readonly TeamRecord[] = [
  { id: 'rhinos', name: 'Rhinos', ratings: { speed: 0.4, power: 0.8, skill: 0.5, dirty: 0.6 }, primary: KIT.red },
  { id: 'vipers', name: 'Vipers', ratings: { speed: 0.8, power: 0.4, skill: 0.6, dirty: 0.5 }, primary: KIT.blue },
  { id: 'comets', name: 'Comets', ratings: { speed: 0.9, power: 0.3, skill: 0.7, dirty: 0.2 }, primary: KIT.gold },
  { id: 'forge', name: 'Forge', ratings: { speed: 0.3, power: 0.9, skill: 0.4, dirty: 0.7 }, primary: KIT.orange },
  { id: 'pirates', name: 'Pirates', ratings: { speed: 0.6, power: 0.6, skill: 0.4, dirty: 0.9 }, primary: KIT.ivory },
  { id: 'orbits', name: 'Orbits', ratings: { speed: 0.5, power: 0.4, skill: 0.9, dirty: 0.3 }, primary: KIT.violet },
];

export type MatchKits = readonly [SideKit, SideKit];
interface SideKit { outfield: number; keeper: number }

export function resolveKits(home: TeamRecord, away: TeamRecord): MatchKits {
  return [
    { outfield: home.primary, keeper: KIT.cyanKeeper },
    { outfield: home.id === away.id ? mirrorKit(away.primary) : away.primary, keeper: KIT.charcoalKeeper },
  ];
}
