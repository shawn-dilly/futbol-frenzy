import type { BrainMemory, MatchState, PlayerState, TeamId, Vec } from './types';
import {
  DRIBBLE_SWERVE_PRESSURE_FACTOR, DRIBBLE_SWERVE_RAD, FIELD_MID_Y, GOAL_HALF, LANE_HALF_WIDTH, LANE_SHIFT, PASS_BACK_LIMIT, SHOT_Y_MARGIN,
  SUPPORT_AHEAD, SUPPORT_BEHIND, SUPPORT_CHANNEL_Y, SUPPORT_GOAL_MARGIN, TURBO_SPACE_DIST,
} from './constants';
import type { LevelSpec } from './levels';
import { ballSide } from './brainRoles';
import { shiftedAnchor, smartSpot } from './brainDefend';
import { clampToPitch } from './movement';
import { nextRandom } from './rng';
import { attackDir, goalCenter, otherTeam } from './setup';
import { isDown, standingOrAll } from './status';
import { add, distToSegment, dist, norm, rotate, scale, sub } from './vec';

type Plan = Partial<BrainMemory>;

const standingOpponents = (state: MatchState, team: TeamId): PlayerState[] => state.players.filter(q => q.team !== team && !isDown(q));
const outfielders = (state: MatchState, team: TeamId): PlayerState[] => state.players.filter(q => q.team === team && q.role === 'out');

/** The standing opponent of `team` nearest the segment from -> to, if one is within LANE_HALF_WIDTH of it. */
function laneBlocker(state: MatchState, from: Vec, to: Vec, team: TeamId): PlayerState | null {
  let blocker: PlayerState | null = null, best = Infinity;
  for (const q of standingOpponents(state, team)) {
    const d = distToSegment(q.pos, from, to);
    if (d <= LANE_HALF_WIDTH && d < best) { blocker = q; best = d; }
  }
  return blocker;
}

/** No standing opponent of `team` within LANE_HALF_WIDTH of the segment from -> to. */
export function laneIsOpen(state: MatchState, from: Vec, to: Vec, team: TeamId): boolean {
  return laneBlocker(state, from, to, team) === null;
}

/** The aim point of a shot: the post farther from the opposing keeper (ties to the lower post), SHOT_Y_MARGIN inside it. */
function farPost(state: MatchState, p: PlayerState): Vec {
  const goal = goalCenter(otherTeam(p.team));
  const keeper = state.players.find(q => q.team !== p.team && q.role === 'gk')!;
  const posts = [goal.y - GOAL_HALF + SHOT_Y_MARGIN, goal.y + GOAL_HALF - SHOT_Y_MARGIN];
  const y = Math.abs(posts[1] - keeper.pos.y) > Math.abs(posts[0] - keeper.pos.y) ? posts[1] : posts[0];
  return { x: goal.x, y };
}

/** The shot direction from the ball: at the far post, turned by a random error of up to the level's shotErrorRad either side (draws one number). */
export function shotAim(state: MatchState, p: PlayerState, level: LevelSpec): Vec {
  return rotate(sub(farPost(state, p), state.ball.pos), (nextRandom(state) * 2 - 1) * level.shotErrorRad);
}

/** An opponent is ahead when his position, projected on the carrier's direction to goal, is in front of the carrier. */
const isAhead = (carrier: PlayerState, toGoal: Vec, q: PlayerState): boolean => {
  const rel = sub(q.pos, carrier.pos);
  return rel.x * toGoal.x + rel.y * toGoal.y > 0;
};

/** Pass options in order: open lane, not too far back, most advanced first (ties to the lower id). */
function passOptions(state: MatchState, p: PlayerState): PlayerState[] {
  const goal = goalCenter(otherTeam(p.team));
  const ownDist = dist(p.pos, goal);
  return outfielders(state, p.team)
    .filter(m => m.id !== p.id && !isDown(m) && dist(m.pos, goal) - ownDist <= PASS_BACK_LIMIT && laneIsOpen(state, state.ball.pos, m.pos, p.team))
    .sort((a, b) => dist(a.pos, goal) - dist(b.pos, goal) || a.id - b.id);
}

/** Dribble heading: straight at goal, turned DRIBBLE_SWERVE_RAD away from the nearest opponent ahead within pressureDist x 1.5. */
function dribbleHeading(state: MatchState, p: PlayerState, toGoal: Vec, level: LevelSpec): Vec {
  const ahead = standingOpponents(state, p.team).filter(q => isAhead(p, toGoal, q) && dist(q.pos, p.pos) <= level.pressureDist * DRIBBLE_SWERVE_PRESSURE_FACTOR);
  let near: PlayerState | null = null;
  for (const q of ahead) if (near === null || dist(q.pos, p.pos) < dist(near.pos, p.pos)) near = q;
  if (!near) return toGoal;
  const rel = sub(near.pos, p.pos);
  const side = toGoal.x * rel.y - toGoal.y * rel.x; // > 0: he is on the +y side of the run
  const turnPositive = side === 0 ? p.pos.y <= FIELD_MID_Y : side < 0; // dead ahead: turn toward the middle
  return rotate(toGoal, turnPositive ? DRIBBLE_SWERVE_RAD : -DRIBBLE_SWERVE_RAD);
}

/** The ball carrier: shoot from range with an open lane; pass under pressure; otherwise dribble at goal. */
export function planCarrier(state: MatchState, p: PlayerState, level: LevelSpec): Plan {
  const goal = goalCenter(otherTeam(p.team));
  const toGoal = norm(sub(goal, p.pos));
  if (dist(p.pos, goal) <= level.shootRange && laneIsOpen(state, state.ball.pos, farPost(state, p), p.team)) {
    return { target: goal, action: 'shot', aim: shotAim(state, p, level) };
  }
  const pressed = standingOpponents(state, p.team).some(q => dist(q.pos, p.pos) <= level.pressureDist);
  const options = pressed ? passOptions(state, p) : [];
  if (options.length > 0) {
    const mistake = options.length > 1 && nextRandom(state) < level.passMistakeChance;
    const mate = options[mistake ? 1 : 0];
    return { target: { ...mate.pos }, action: 'pass', aim: sub(mate.pos, p.pos), turbo: false };
  }
  const heading = dribbleHeading(state, p, toGoal, level);
  const clear = !standingOpponents(state, p.team).some(q => isAhead(p, toGoal, q) && dist(q.pos, p.pos) <= TURBO_SPACE_DIST);
  return { target: add(p.pos, scale(heading, dist(p.pos, goal))), action: 'none', turbo: level.usesTurbo && clear };
}

/** The spot a supporter aims for before blending: a channel for the two outfielders nearest the goal (lower y takes the first), else the safe spot behind the ball. */
function supportSpot(state: MatchState, p: PlayerState): Vec {
  const dir = attackDir(p.team), goal = goalCenter(otherTeam(p.team)), ball = state.ball.pos;
  const owner = state.ball.owner;
  const pool = standingOrAll(outfielders(state, p.team).filter(q => q.id !== owner));
  const runners = [...pool].sort((a, b) => dist(a.pos, goal) - dist(b.pos, goal) || a.id - b.id).slice(0, SUPPORT_CHANNEL_Y.length)
    .sort((a, b) => a.pos.y - b.pos.y || a.id - b.id);
  const channel = runners.indexOf(p);
  if (channel < 0) return { x: ball.x - dir * SUPPORT_BEHIND, y: FIELD_MID_Y };
  const limit = goal.x - dir * SUPPORT_GOAL_MARGIN;
  return { x: dir > 0 ? Math.min(ball.x + SUPPORT_AHEAD, limit) : Math.max(ball.x - SUPPORT_AHEAD, limit), y: SUPPORT_CHANNEL_Y[channel] };
}

/** An outfielder who does not have the ball: runs into space for the carrier while his team has it, else holds his shifted spot. */
export function planSupport(state: MatchState, p: PlayerState, level: LevelSpec): Plan {
  const anchor = shiftedAnchor(state, p);
  if (ballSide(state, p.team) !== 'own') return { target: anchor, action: 'none', turbo: false, targetPlayer: null };
  let spot = smartSpot(anchor, supportSpot(state, p), level.positioning);
  const blocker = laneBlocker(state, state.ball.pos, spot, p.team);
  if (blocker) spot = clampToPitch({ x: spot.x, y: spot.y + (spot.y >= blocker.pos.y ? LANE_SHIFT : -LANE_SHIFT) });
  return { target: spot, action: 'none', turbo: false, targetPlayer: null };
}
