export type Vec = { x: number; y: number };
export type TeamId = 0 | 1;
export type Phase = 'kickoff' | 'play' | 'goal' | 'halftime' | 'fulltime';
export type HitType = 'shoulder' | 'slide' | 'big';
export type HurtTier = 'stumble' | 'knockdown' | 'wipeout' | 'overTheTop';
export type PlayerStatus =
  | { kind: 'free' } | { kind: 'kicking' } | { kind: 'charging' }
  | { kind: 'lunging'; hit: HitType }
  | { kind: 'recovering'; hit: HitType; landed: boolean }
  | { kind: 'hurt'; tier: HurtTier; variant: number };
export interface PadInput { moveX: number; moveY: number; pass: boolean; shoot: boolean; hit: boolean; turbo: boolean }
export interface PlayerIntent { moveX: number; moveY: number; pass: boolean; shoot: boolean; turbo: boolean; hitPress: boolean; hitHeld: boolean }
export interface PlayerState {
  id: number; team: TeamId; role: 'gk' | 'out';
  pos: Vec; vel: Vec; facing: Vec; anchor: Vec;
  kickCooldown: number; turboTicks: number;
  status: PlayerStatus; statusTick: number /* ticks spent in this status */; statusTicks: number /* its length; 0 = open-ended */;
  health: number; hitCooldown: number; knock: Vec /* knockback velocity, units/s */;
}
export interface BallState { pos: Vec; vel: Vec; owner: number | null; ownerTicks: number; passTarget: number | null }
export interface MatchConfig { seed: number; halfSeconds: number; human: [boolean, boolean] }
export type SimEvent =
  | { type: 'kick'; kind: 'pass' | 'shot'; player: number }
  | { type: 'bounce' }
  | { type: 'goal'; team: TeamId }
  | { type: 'hit'; tackler: number; victim: number; hit: HitType; tier: HurtTier; variant: number; damage: number; late: boolean }
  | { type: 'whiff'; player: number; hit: HitType }
  | { type: 'whistle'; what: 'kickoff' | 'halftime' | 'fulltime' };
export interface MatchState {
  config: MatchConfig; tick: number; rng: number;
  phase: Phase; phaseTicks: number; half: 1 | 2; clockTicks: number;
  score: [number, number]; kickoffTeam: TeamId;
  rage: [number, number]; lastHitTick: [number, number] /* tick the team last landed a hit */;
  players: PlayerState[]; ball: BallState;
  controlled: [number, number]; turbo: [number, number];
  prevInput: [PadInput, PadInput]; events: SimEvent[];
}
