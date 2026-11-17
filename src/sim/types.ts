export type Vec = { x: number; y: number };
export type TeamId = 0 | 1;
export type Phase = 'kickoff' | 'play' | 'goal' | 'halftime' | 'fulltime';
export type Level = 'rookie' | 'pro' | 'bruiser' | 'psycho';
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
/** `level[team]` drives every brain-controlled player of that team. */
export interface MatchConfig { seed: number; halfSeconds: number; human: [boolean, boolean]; level: [Level, Level] }
export type BrainRole = 'keeper' | 'carrier' | 'presser' | 'cover' | 'marker' | 'support' | 'receiver' | 'chaser';
/** What the computer brain remembers between re-thinks, one per player (index = player id). */
export interface BrainMemory {
  thinkAt: number; // tick of the next re-think
  role: BrainRole;
  target: Vec; // where the plan says to go
  action: 'none' | 'pass' | 'shot' | 'tap' | 'chargeBig'; // what to do with the buttons on the way
  aim: Vec; // kick aim (zero when unused)
  turbo: boolean; // press turbo when available
  holdHitUntil: number; // tick until which HIT stays held (big-hit charge); 0 = not holding
  thinkOwner: number | null; // who had the ball when the plan was made (a change forces a re-think)
  targetPlayer: number | null; // the player the plan moves at or hits (steered at live each tick); null = go to `target`
  aimError: number; // radians: the lunge heading error, drawn once at think and applied to the live direction at release
}
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
  brain: BrainMemory[];
  liveTicks: number; // live ticks since kickoff
  defensiveHitAt: number[]; // earliest live tick for each player
  controlled: [number, number]; turbo: [number, number];
  prevInput: [PadInput, PadInput]; events: SimEvent[];
}
