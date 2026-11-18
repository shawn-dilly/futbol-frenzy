import type { HitType, Level, MatchConfig, TeamId } from './types';

/** Everything about the computer that differs by difficulty. Brain code reads these fields and never the level's name. */
export interface LevelSpec {
  injuryHealth: number; // one-player CPU slows below this health
  label: string; // shown on screen, upper case
  reactionTicks: number; // ticks between re-thinks
  defensiveHitIntervalTicks: number; // live ticks between defensive hit attempts
  teammateHitIntervalTicks: number; // live ticks between attempts by each human teammate
  humanJockeyTicks: number; // ticks spent screening the human carrier before each pressure window
  passMistakeChance: number; // chance a pass goes to the second-best option
  shotErrorRad: number; // max angle error on a shot, either side
  shootRange: number; // units from goal at which the carrier shoots
  pressureDist: number; // an opponent this close makes the carrier look for a pass
  teamHitCooldownTicks: number; // after any hit by the team, nobody on it starts another for this long
  hitTypes: HitType[]; // hits the level may choose
  hitAimErrorRad: number; // max angle error on the lunge direction, either side
  hitRange: number; // starts a hit when the target is this close
  lateHitChance: number; // per think: chance to go for a nearby opponent who does not have the ball
  positioning: number; // 0..1 blend from formation anchor (0) to the computed smart spot (1)
  keeperSpeedFactor: number; // multiplies GK_SPEED
  usesTurbo: boolean;
}

export const LEVEL_ORDER: Level[] = ['rookie', 'pro', 'bruiser', 'psycho'];

export const LEVELS: Record<Level, LevelSpec> = {
  rookie: {
    injuryHealth: 85, label: 'ROOKIE', teammateHitIntervalTicks: 90, humanJockeyTicks: 200, defensiveHitIntervalTicks: 240, reactionTicks: 24, passMistakeChance: 0.35, shotErrorRad: 1.2, shootRange: 70, pressureDist: 14,
    teamHitCooldownTicks: 2000, hitTypes: ['shoulder'], hitAimErrorRad: 0.5, hitRange: 8, lateHitChance: 0,
    positioning: 0.3, keeperSpeedFactor: 1.4, usesTurbo: false,
  },
  pro: {
    injuryHealth: 75, label: 'PRO', teammateHitIntervalTicks: 240, humanJockeyTicks: 0, defensiveHitIntervalTicks: 0, reactionTicks: 14, passMistakeChance: 0.15, shotErrorRad: 0.4, shootRange: 90, pressureDist: 20,
    teamHitCooldownTicks: 750, hitTypes: ['shoulder', 'slide'], hitAimErrorRad: 0.3, hitRange: 10, lateHitChance: 0,
    positioning: 0.6, keeperSpeedFactor: 1, usesTurbo: true,
  },
  bruiser: {
    injuryHealth: 55, label: 'BRUISER', teammateHitIntervalTicks: 420, humanJockeyTicks: 0, defensiveHitIntervalTicks: 0, reactionTicks: 10, passMistakeChance: 0.12, shotErrorRad: 0.12, shootRange: 95, pressureDist: 22,
    teamHitCooldownTicks: 240, hitTypes: ['shoulder', 'slide', 'big'], hitAimErrorRad: 0.2, hitRange: 11, lateHitChance: 0.15,
    positioning: 0.7, keeperSpeedFactor: 1, usesTurbo: true,
  },
  psycho: {
    injuryHealth: 35, label: 'PSYCHO', teammateHitIntervalTicks: 600, humanJockeyTicks: 0, defensiveHitIntervalTicks: 0, reactionTicks: 6, passMistakeChance: 0.05, shotErrorRad: 0.06, shootRange: 105, pressureDist: 26,
    teamHitCooldownTicks: 150, hitTypes: ['shoulder', 'slide', 'big'], hitAimErrorRad: 0.1, hitRange: 12, lateHitChance: 0.4,
    positioning: 0.9, keeperSpeedFactor: 1.1, usesTurbo: true,
  },
};

/** Live ticks between AI tackle attempts. CPU defenders also wait this long at kickoff. */
export function hitInterval(config: MatchConfig, team: TeamId): number {
  const level = LEVELS[config.level[team]];
  if (config.human[team]) return level.teammateHitIntervalTicks;
  return level.defensiveHitIntervalTicks + (config.human[1 - team] ? level.humanJockeyTicks : 0);
}
