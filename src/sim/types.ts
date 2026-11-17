export type Vec = { x: number; y: number };
export type TeamId = 0 | 1;
export type Phase = 'kickoff' | 'play' | 'goal' | 'halftime' | 'fulltime';
export type AnimName = 'idle' | 'run' | 'kick';
export interface PadInput { moveX: number; moveY: number; pass: boolean; shoot: boolean; hit: boolean; turbo: boolean }
export interface PlayerIntent { moveX: number; moveY: number; pass: boolean; shoot: boolean; turbo: boolean }
export interface PlayerState {
  id: number; team: TeamId; role: 'gk' | 'out';
  pos: Vec; vel: Vec; facing: Vec; anchor: Vec;
  kickCooldown: number; turboTicks: number; anim: AnimName; animTick: number;
}
export interface BallState { pos: Vec; vel: Vec; owner: number | null; ownerTicks: number; passTarget: number | null }
export interface MatchConfig { seed: number; halfSeconds: number; human: [boolean, boolean] }
export type SimEvent =
  | { type: 'kick'; kind: 'pass' | 'shot'; player: number }
  | { type: 'bounce' }
  | { type: 'goal'; team: TeamId }
  | { type: 'whistle'; what: 'kickoff' | 'halftime' | 'fulltime' };
export interface MatchState {
  config: MatchConfig; tick: number; rng: number;
  phase: Phase; phaseTicks: number; half: 1 | 2; clockTicks: number;
  score: [number, number]; kickoffTeam: TeamId;
  players: PlayerState[]; ball: BallState;
  controlled: [number, number]; turbo: [number, number];
  prevInput: [PadInput, PadInput]; events: SimEvent[];
}
