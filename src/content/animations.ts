import type { HurtTier } from '../sim';

export type ColorRole = 'skin' | 'hair' | 'jersey' | 'trim' | 'shorts' | 'boot' | 'eye' | 'star';
/** One filled rectangle relative to the feet centre, facing right. */
export type Px = [dx: number, dy: number, w: number, h: number, role: ColorRole];
export interface AnimDef {
  frames: Px[][];
  ticksPerFrame: number;
  loop: boolean;
  /** Peak lift in pixels over the air time; the sprite rises and falls, the shadow stays down. */
  arcHeight?: number;
  /** How many leading frames are airborne; the air time is airFrames x ticksPerFrame and the body lands as the next frame shows. */
  airFrames?: number;
  /** The body lands face first and leaves a crater where it lands. */
  crater?: true;
}

/** Ticks at the end of a hurt or recovering status spent getting back up. */
export const GETUP_TICKS = 12;

/** Ticks of air time: the leading airborne frames, after which the body lands. */
export function airTicks(def: AnimDef): number {
  return (def.airFrames ?? 0) * def.ticksPerFrame;
}

export function hurtAnimKey(tier: HurtTier, variant: number): string {
  return `hurt_${tier}_${variant}`;
}

type R = [number, number, number, number];
const px = (role: ColorRole, rects: R[]): Px[] => rects.map(([x, y, w, h]): Px => [x, y, w, h, role]);
const shift = (list: Px[], dx: number, dy: number): Px[] => list.map(([x, y, w, h, role]): Px => [x + dx, y + dy, w, h, role]);
/** Reflect left-right: a rect spanning columns x..x+w-1 maps to c-(x+w-1)..c-x. */
const mirrorX = (list: Px[], c: number): Px[] => list.map(([x, y, w, h, role]): Px => [c - (x + w - 1), y, w, h, role]);
/** Reflect top-bottom: a rect spanning rows y..y+h-1 maps to c-(y+h-1)..c-y. */
const flipY = (list: Px[], c: number): Px[] => list.map(([x, y, w, h, role]): Px => [x, c - (y + h - 1), w, h, role]);
const repeat = <T>(items: T[], times: number): T[] => Array.from({ length: items.length * times }, (_, i) => items[i % items.length]);

/** Head, torso and shorts of the standing figure, moved by (dx, dy). */
const bodyAt = (dx: number, dy: number): Px[] => [
  [-2 + dx, -15 + dy, 5, 2, 'hair'], [-2 + dx, -13 + dy, 5, 3, 'skin'], [2 + dx, -12 + dy, 1, 1, 'eye'],
  [-3 + dx, -10 + dy, 7, 5, 'jersey'], [-3 + dx, -8 + dy, 7, 1, 'trim'], [-3 + dx, -5 + dy, 7, 2, 'shorts'],
];

/** The upright figure: `bob` pixels lower head, torso and shorts; skin legs, boots and arms as given. */
function standing(bob: 0 | 1, legs: R[], boots: R[], arms: R[]): Px[] {
  return [...px('skin', legs), ...px('boot', boots), ...bodyAt(0, bob), ...shift(px('skin', arms), 0, bob)];
}

interface LyingOptions {
  faceUp: boolean;
  headRight?: boolean;
  /** Top row of the body; the body is 4 rows tall. */
  y?: number;
  /** Rows the head is raised (negative = up) or the feet are raised. */
  headLift?: number;
  footLift?: number;
  /** Replaces the straight legs. */
  legs?: Px[];
  /** Arm pieces in the head-left frame. */
  arms?: Px[];
  /** Both arms stretched out beyond the head instead. */
  reach?: boolean;
}
const LYING_X = -9;
/** Mirror axis that keeps a head-right body inside the cell. */
const LYING_MIRROR = -1;
/** A body lying flat, drawn head-left then mirrored when the head is right. */
function lying(o: LyingOptions): Px[] {
  const y = o.y ?? -4, hl = o.headLift ?? 0, fl = o.footLift ?? 0, x = LYING_X;
  const eyeY = o.faceUp ? y + hl : y + hl + 3;
  const legs: Px[] = o.legs ?? [[x + 12, y + 1 + fl, 4, 2, 'skin'], [x + 16, y + fl, 2, 3, 'boot']];
  const alongBody: Px[] = [[x + 6, o.faceUp ? y - 1 : y + 4, 4, 1, 'skin']];
  const arms: Px[] = o.reach ? [[x - 3, y + 1, 3, 1, 'skin'], [x - 3, y + 3, 3, 1, 'skin']] : o.arms ?? alongBody;
  const body: Px[] = [
    ...legs,
    [x + 5, y, 5, 4, 'jersey'], [x + 7, y, 1, 4, 'trim'], [x + 10, y, 2, 4, 'shorts'],
    [x, y + hl, 2, 4, 'hair'], [x + 2, y + hl, 3, 4, 'skin'], [x + 3, eyeY, 1, 1, 'eye'],
    ...arms,
  ];
  return o.headRight ? mirrorX(body, LYING_MIRROR) : body;
}

/** Knee pulled up, shin folded back down to the foot, both hands reaching for the shin; for lying on the back. */
const SHIN_CLUTCH = (kneeLift: number): Px[] => [
  [LYING_X + 11, -5, 3, 2, 'skin'], [LYING_X + 12, -7 + kneeLift, 2, 3, 'skin'],
  [LYING_X + 14, -8 + kneeLift, 2, 2, 'skin'], [LYING_X + 15, -6 + kneeLift, 2, 3, 'skin'], [LYING_X + 15, -3 + kneeLift, 3, 2, 'boot'],
];
const SHIN_CLUTCH_ARMS = (kneeLift: number): Px[] => [
  [LYING_X + 6, -5, 4, 1, 'skin'], [LYING_X + 9, -7 + kneeLift, 4, 1, 'skin'], [LYING_X + 12, -9 + kneeLift, 3, 1, 'skin'],
];
/** One rocking pose: the whole body shifted sideways, tilted by lifting the head or the knee. */
const rockingOnBack = (dx: number, headLift: number, kneeLift: number): Px[] =>
  shift(lying({ faceUp: true, headLift, legs: SHIN_CLUTCH(kneeLift), arms: SHIN_CLUTCH_ARMS(kneeLift) }), dx, 0);
const ROCK_SHIFT = 2;

/** Arm pieces for a body lying on its back, head-left frame. */
const ARM_FLUNG_BEHIND_HEAD: Px[] = [[LYING_X - 2, -3, 3, 1, 'skin']];
const ARM_PROPPED: Px[] = [[LYING_X + 5, -2, 2, 1, 'skin']];
const ARMS_SPREAD_ON_BACK: Px[] = [[LYING_X + 6, -5, 4, 1, 'skin'], ...ARM_FLUNG_BEHIND_HEAD];

const ARM_FWD: R[] = [[4, -9, 1, 2], [5, -10, 1, 2]];
const ARM_BACK: R[] = [[-4, -9, 1, 2], [-5, -8, 1, 2]];
const ARM_HANG: R[] = [[-4, -9, 1, 3], [4, -9, 1, 3]];
const ARM_FWD_HANG: R[] = [[4, -8, 1, 3]];
const lowered = (rects: R[]): R[] => rects.map(([x, y, w, h]): R => [x, y + 1, w, h]);

/** Standing legs with boots, for the poses that only change the upper body. */
const STAND_LEGS: R[] = [[-3, -3, 2, 2], [2, -3, 2, 2]];
const STAND_BOOTS: R[] = [[-3, -1, 2, 1], [2, -1, 3, 1]];

/** The same upright figure with arms and legs flung wide, for spinning in the air. */
const AIRBORNE_UPRIGHT: Px[] = [
  ...px('skin', [[-3, -5, 2, 2], [2, -5, 2, 2]]), ...px('boot', [[-4, -3, 3, 1], [2, -3, 3, 1]]),
  ...bodyAt(0, -2), ...px('skin', [[-8, -11, 5, 1], [4, -11, 5, 1]]),
];
const AIRBORNE_ROW_FLIP = -20;
const AIRBORNE_SIDEWAYS: Px[] = lying({ faceUp: false, y: -11, arms: [[LYING_X + 6, -12, 4, 1, 'skin'], [LYING_X - 2, -9, 3, 1, 'skin']] });

const AIRBORNE_INVERTED = flipY(AIRBORNE_UPRIGHT, AIRBORNE_ROW_FLIP);
/** Sideways the other way up and the other way round, on the same rows as AIRBORNE_SIDEWAYS. */
const AIRBORNE_SIDEWAYS_REVERSED = mirrorX(flipY(AIRBORNE_SIDEWAYS, AIRBORNE_ROW_FLIP + 1), LYING_MIRROR);

/** Rotor arms sticking up and down from a body held horizontal, head-left frame. */
const ROTOR_ROW = -11;
const ROTOR_ARMS: Px[] = [[LYING_X + 7, ROTOR_ROW - 3, 1, 3, 'skin'], [LYING_X + 7, ROTOR_ROW + 4, 1, 3, 'skin']];
const HELI_FULL_LEFT = lying({ faceUp: true, y: ROTOR_ROW, arms: ROTOR_ARMS });
const HELI_FULL_RIGHT = lying({ faceUp: false, headRight: true, y: ROTOR_ROW, arms: ROTOR_ARMS });
/** The same body swung end-on to the viewer, so it looks shorter. */
const HELI_END_ON: Px[] = [
  ...px('skin', [[6, ROTOR_ROW + 1, 2, 2]]), ...px('boot', [[8, ROTOR_ROW + 1, 1, 2]]),
  [4, ROTOR_ROW, 2, 4, 'shorts'], [0, ROTOR_ROW, 4, 4, 'jersey'], [2, ROTOR_ROW, 1, 4, 'trim'],
  [-5, ROTOR_ROW, 2, 4, 'hair'], [-3, ROTOR_ROW, 3, 4, 'skin'], [-2, ROTOR_ROW, 1, 1, 'eye'],
  [1, ROTOR_ROW - 3, 1, 3, 'skin'], [1, ROTOR_ROW + 4, 1, 3, 'skin'],
];
const HELI_END_ON_REVERSED = mirrorX(HELI_END_ON, 0);
const SPIN_FRAMES = [HELI_FULL_LEFT, HELI_END_ON, HELI_FULL_RIGHT, HELI_END_ON_REVERSED];
const SPIN_REVOLUTIONS = 6;

/** Four poses of the dizzy sitting figure, with stars orbiting the head. */
const SIT_X = -4;
function sitting(bob: number, starAngle: number | null): Px[] {
  const body: Px[] = [
    ...px('skin', [[SIT_X + 5, -3, 5, 2]]), ...px('boot', [[SIT_X + 10, -4, 2, 3]]),
    [SIT_X + 1, -4, 5, 3, 'shorts'], [SIT_X, -9, 6, 5, 'jersey'], [SIT_X, -7, 6, 1, 'trim'],
    [SIT_X + 0, -14 + bob, 5, 2, 'hair'], [SIT_X, -12 + bob, 5, 3, 'skin'], [SIT_X + 4, -11 + bob, 1, 1, 'eye'],
    [SIT_X - 2, -6, 2, 1, 'skin'], [SIT_X - 3, -5, 1, 3, 'skin'],
    [SIT_X + 4, -7, 2, 1, 'skin'],
  ];
  if (starAngle === null) return body;
  return [...body, ...orbitStars(starAngle)];
}
const STAR_COUNT = 3;
const STAR_RADIUS_X = 6;
const STAR_RADIUS_Y = 2;
const STAR_CENTRE: [number, number] = [-2, -15];
const STAR_SIZE = 2;
function orbitStars(angle: number): Px[] {
  return Array.from({ length: STAR_COUNT }, (_, i): Px => {
    const a = angle + (i * 2 * Math.PI) / STAR_COUNT;
    return [Math.round(STAR_CENTRE[0] + Math.cos(a) * STAR_RADIUS_X), Math.round(STAR_CENTRE[1] + Math.sin(a) * STAR_RADIUS_Y), STAR_SIZE, STAR_SIZE, 'star'];
  });
}
const DIZZY_FRAMES = 8;

/** Backside up, face in the turf, knees folded under, hands out ahead; facing right. */
const crumpled = (): Px[] => [
  ...px('skin', [[3, -1, 9, 1], [-6, -6, 2, 4], [-10, -2, 5, 2]]), ...px('boot', [[-12, -2, 2, 2]]),
  [-4, -9, 3, 4, 'shorts'], [-1, -8, 3, 4, 'jersey'], [2, -6, 3, 5, 'jersey'], [3, -6, 1, 5, 'trim'],
  [8, -4, 2, 4, 'hair'], [5, -4, 3, 4, 'skin'], [6, -1, 1, 1, 'eye'],
];
/** Scissoring, flailing legs for the flight, head-left frame; `a` and `b` are rows each leg is raised (negative) or lowered. */
const flailingLegs = (a: number, b: number): Px[] => [
  [LYING_X + 12, -3 + a, 4, 1, 'skin'], [LYING_X + 16, -3 + a, 2, 1, 'boot'],
  [LYING_X + 12, -3 + b, 4, 1, 'skin'], [LYING_X + 16, -3 + b, 2, 1, 'boot'],
];
/** One arm raised diagonally, one low. Joined to the head so nothing floats. */
const ARMS_FLAILING_A: Px[] = [[LYING_X - 1, -5, 1, 2, 'skin'], [LYING_X - 3, -6, 2, 1, 'skin'], [LYING_X - 3, -1, 3, 1, 'skin']];
/** One arm straight up, one low and out. */
const ARMS_FLAILING_B: Px[] = [[LYING_X - 1, -6, 1, 3, 'skin'], [LYING_X - 3, -2, 3, 1, 'skin']];
const ARMS_ON_KNEES: R[] = [[3, -6, 2, 1], [-4, -6, 2, 1]];
/** Hunched forward on bent legs, as when charging or just getting up. */
const CROUCHED: Px[] = [
  ...px('skin', [[-4, -2, 2, 1], [2, -2, 2, 1]]), ...px('boot', [[-5, -1, 3, 1], [1, -1, 3, 1]]),
  ...bodyAt(1, 3), ...px('skin', [[5, -7, 3, 1], [4, -6, 3, 1]]),
];

export const ANIMATIONS: Record<string, AnimDef> = {
  idle: {
    ticksPerFrame: 30, loop: true,
    frames: [
      standing(0, [[-3, -3, 2, 2], [2, -3, 2, 2]], STAND_BOOTS, ARM_HANG),
      standing(1, [[-3, -2, 2, 1], [2, -2, 2, 1]], STAND_BOOTS, ARM_HANG),
    ],
  },
  run: {
    ticksPerFrame: 5, loop: true,
    frames: [
      // 0 contact: near leg reaches forward, far arm forward
      standing(0, [[2, -3, 2, 1], [3, -2, 2, 1], [-3, -3, 2, 1], [-4, -2, 2, 1]],
        [[4, -1, 3, 1], [-6, -1, 3, 1]], [...ARM_FWD, ...ARM_BACK]),
      // 1 down: body drops, front knee bent
      standing(1, [[1, -2, 2, 1], [-3, -2, 2, 1]], [[1, -1, 3, 1], [-5, -1, 3, 1]],
        [[4, -8, 1, 2], [5, -9, 1, 2], [-4, -8, 1, 2], [-5, -7, 1, 2]]),
      // 2 passing: trailing foot kicked up behind
      standing(0, [[-1, -3, 2, 2], [-4, -3, 2, 1], [-5, -2, 2, 1]], [[-1, -1, 3, 1], [-7, -2, 2, 1]], ARM_HANG),
      // 3 contact: far leg reaches forward, near arm forward
      standing(0, [[3, -3, 2, 1], [4, -2, 2, 1], [-4, -3, 2, 1], [-5, -2, 2, 1]],
        [[5, -1, 3, 1], [-7, -1, 3, 1]], lowered([...ARM_FWD, ...ARM_BACK])),
      // 4 down
      standing(1, [[2, -2, 2, 1], [-4, -2, 2, 1]], [[2, -1, 3, 1], [-5, -1, 2, 1]],
        [[4, -9, 1, 2], [5, -10, 1, 2], [-4, -9, 1, 2], [-5, -8, 1, 2]]),
      // 5 passing: frame 2 on the other leg, arms swapped
      standing(0, [[0, -3, 2, 2], [-4, -3, 2, 1], [-5, -2, 2, 1]], [[0, -1, 3, 1], [-7, -2, 2, 1]],
        [[-4, -8, 1, 3], [4, -10, 1, 3]]),
    ],
  },
  kick: {
    ticksPerFrame: 4, loop: false,
    frames: [
      // 0 wind-up: kicking foot cocked high behind
      standing(0, [[-1, -3, 2, 2], [-4, -3, 2, 1], [-5, -4, 1, 2]], [[-1, -1, 3, 1], [-7, -4, 2, 1]], [...ARM_FWD, ...ARM_BACK]),
      // 1 strike: leg straight out forward
      standing(0, [[-2, -3, 2, 2], [1, -3, 5, 1]], [[-2, -1, 3, 1], [6, -3, 2, 1]], [...ARM_BACK, ...ARM_FWD_HANG]),
      // 2 follow-through: leg swung up high
      standing(0, [[-2, -3, 2, 2], [4, -4, 2, 1], [5, -5, 2, 1]], [[-2, -1, 3, 1], [7, -5, 2, 1]],
        [[-4, -9, 1, 2], [-5, -10, 1, 2], ...ARM_FWD_HANG]),
    ],
  },

  // Attacks
  charge: {
    ticksPerFrame: 8, loop: true,
    frames: [
      // hunched low, fists forward
      CROUCHED,
      [...px('skin', [[-4, -2, 2, 1], [2, -2, 2, 1]]), ...px('boot', [[-5, -1, 3, 1], [1, -1, 3, 1]]),
        ...bodyAt(1, 2), ...px('skin', [[5, -8, 3, 1], [4, -7, 3, 1]])],
    ],
  },
  lunge_shoulder: {
    ticksPerFrame: 4, loop: false,
    frames: [
      [...px('skin', [[-3, -3, 3, 1], [-2, -2, 3, 1]]), ...px('boot', [[-6, -3, 3, 1], [-1, -1, 3, 1]]),
        ...bodyAt(3, 2), ...px('skin', [[7, -8, 2, 2]])],
      [...px('skin', [[-3, -3, 5, 1], [0, -2, 2, 1]]), ...px('boot', [[-7, -3, 4, 1], [0, -1, 3, 1]]),
        ...bodyAt(5, 3), ...px('skin', [[9, -7, 2, 2]])],
    ],
  },
  lunge_slide: {
    ticksPerFrame: 6, loop: false,
    frames: [
      // dropping into the slide
      [...px('skin', [[-3, -2, 3, 1], [0, -2, 5, 1]]), ...px('boot', [[-5, -1, 3, 1], [5, -3, 2, 2]]),
        ...bodyAt(-2, 2), ...px('skin', [[-6, -8, 1, 3]])],
      // leaning back, leading leg out
      [...px('skin', [[-1, -2, 6, 1]]), ...px('boot', [[5, -3, 3, 2]]),
        ...bodyAt(-3, 3), ...px('skin', [[-7, -6, 1, 3], [-3, -4, 3, 1]])],
      // low on the hip, leg stretched along the grass
      lying({ faceUp: true, headLift: -2, arms: ARM_PROPPED,
        legs: [[LYING_X + 12, -3, 6, 2, 'skin'], [LYING_X + 18, -4, 2, 3, 'boot']] }),
    ],
  },
  lunge_big: {
    ticksPerFrame: 7, loop: false,
    frames: [
      // launching off both feet
      [...px('skin', [[-2, -4, 3, 2], [-4, -3, 2, 2], [-6, -2, 2, 2], [2, -2, 2, 1]]), ...px('boot', [[-9, -1, 3, 1], [2, -1, 3, 1]]),
        ...bodyAt(4, 1), ...px('skin', [[8, -9, 3, 1], [8, -7, 3, 1]])],
      // full-length dive, arms out front
      lying({ faceUp: false, headRight: true, y: -8,
        reach: true, legs: [[LYING_X + 12, -7, 4, 2, 'skin'], [LYING_X + 16, -8, 2, 3, 'boot']] }),
    ],
  },
  recover_shoulder: {
    ticksPerFrame: 6, loop: false,
    frames: [
      // overbalanced, arms wheeling
      [...px('skin', [[-2, -3, 2, 2], [1, -3, 2, 2]]), ...px('boot', [[-4, -1, 3, 1], [1, -1, 3, 1]]),
        ...bodyAt(2, 1), ...px('skin', [[6, -12, 1, 3], [-2, -10, 1, 3]])],
      // hunched, catching their breath
      standing(1, STAND_LEGS, STAND_BOOTS, ARMS_ON_KNEES),
    ],
  },
  recover_slide: {
    ticksPerFrame: 12, loop: false,
    frames: [
      lying({ faceUp: true, headLift: -2, arms: ARM_PROPPED }),
    ],
  },
  getup: {
    ticksPerFrame: GETUP_TICKS / 2, loop: false,
    frames: [sitting(0, null), CROUCHED],
  },
  recover_big: {
    ticksPerFrame: 20, loop: false,
    frames: [
      lying({ faceUp: false, headRight: true, footLift: -1, reach: true }),
      lying({ faceUp: false, headRight: true, reach: true }),
      lying({ faceUp: false, headRight: true, headLift: -2, arms: [[LYING_X + 3, -3, 1, 3, 'skin']] }),
    ],
  },

  // Hurt: stumble
  hurt_stumble_0: {
    ticksPerFrame: 6, loop: false, arcHeight: 3, airFrames: 2,
    frames: [
      // hopping on the left foot, the other held up
      [...px('skin', [[-2, -3, 2, 2], [1, -5, 3, 1]]), ...px('boot', [[-2, -1, 3, 1], [4, -6, 2, 2]]),
        ...bodyAt(-1, 0), ...px('skin', [[-5, -12, 1, 3], [3, -11, 1, 3]])],
      [...px('skin', [[-2, -4, 2, 2], [1, -6, 3, 1]]), ...px('boot', [[-2, -2, 3, 1], [4, -7, 2, 2]]),
        ...bodyAt(-1, -1), ...px('skin', [[-5, -13, 1, 3], [3, -12, 1, 3]])],
      [...px('skin', [[-2, -3, 2, 2], [1, -5, 3, 1]]), ...px('boot', [[-2, -1, 3, 1], [4, -6, 2, 2]]),
        ...bodyAt(-1, 0), ...px('skin', [[-5, -10, 1, 3], [3, -13, 1, 3]])],
      [...px('skin', [[-2, -4, 2, 2], [1, -6, 3, 1]]), ...px('boot', [[-2, -2, 3, 1], [4, -7, 2, 2]]),
        ...bodyAt(-1, -1), ...px('skin', [[-5, -11, 1, 3], [3, -10, 1, 3]])],
    ],
  },
  hurt_stumble_1: {
    ticksPerFrame: 6, loop: false, arcHeight: 3, airFrames: 2,
    frames: [
      // arms windmilling: up/down, forward/back, down/up, back/forward
      standing(0, [[-4, -3, 2, 2], [3, -3, 2, 2]], [[-5, -1, 3, 1], [3, -1, 3, 1]], [[4, -13, 1, 3], [-4, -8, 1, 3]]),
      standing(0, [[-3, -3, 2, 2], [2, -3, 2, 2]], STAND_BOOTS, [[4, -10, 3, 1], [-6, -9, 3, 1]]),
      standing(1, [[-4, -3, 2, 2], [3, -3, 2, 2]], [[-5, -1, 3, 1], [3, -1, 3, 1]], [[4, -7, 1, 3], [-4, -13, 1, 3]]),
      standing(0, [[-3, -3, 2, 2], [2, -3, 2, 2]], STAND_BOOTS, [[-6, -10, 3, 1], [4, -9, 3, 1]]),
    ],
  },

  // Hurt: knockdown
  hurt_knockdown_0: {
    ticksPerFrame: 5, loop: false, arcHeight: 9, airFrames: 2,
    frames: [
      // pitching forward
      [...px('skin', [[-2, -3, 2, 2], [0, -3, 2, 2]]), ...px('boot', [[-4, -1, 3, 1], [0, -1, 3, 1]]),
        ...bodyAt(2, 1), ...px('skin', [[6, -9, 3, 1]])],
      // body angled down, legs trailing up behind
      [...px('skin', [[-1, -4, 3, 2], [-3, -6, 3, 2]]), ...px('boot', [[-6, -8, 3, 2], [-5, -4, 3, 2]]),
        ...bodyAt(5, 3), ...px('skin', [[9, -5, 3, 1]])],
      // slamming down, feet still in the air
      lying({ faceUp: false, headRight: true, footLift: -2, reach: true }),
      // flat on the face
      lying({ faceUp: false, headRight: true, reach: true }),
    ],
  },
  hurt_knockdown_1: {
    ticksPerFrame: 5, loop: false, arcHeight: 9, airFrames: 2,
    frames: [
      // leaning back, arms up
      [...px('skin', [[-3, -3, 2, 2], [2, -3, 2, 2]]), ...px('boot', [[-3, -1, 2, 1], [2, -1, 3, 1]]),
        ...bodyAt(-2, 0), ...px('skin', [[-6, -13, 1, 3], [2, -13, 1, 3]])],
      // falling over backwards, feet kicking up
      [...px('skin', [[-1, -3, 3, 2], [1, -5, 3, 2]]), ...px('boot', [[4, -7, 3, 2], [3, -4, 3, 2]]),
        ...bodyAt(-5, 3), ...px('skin', [[-8, -10, 1, 3]])],
      // slam: bounce
      lying({ faceUp: true, headLift: -1, footLift: -2 }),
      // flat on the back
      lying({ faceUp: true, arms: ARMS_SPREAD_ON_BACK }),
    ],
  },

  // Hurt: wipeout
  hurt_wipeout_0: {
    ticksPerFrame: 8, loop: true,
    frames: [
      rockingOnBack(0, 0, 0), rockingOnBack(ROCK_SHIFT, -1, 0), rockingOnBack(0, 0, -1), rockingOnBack(-ROCK_SHIFT, 0, 0),
    ],
  },
  hurt_wipeout_1: {
    ticksPerFrame: 6, loop: true,
    frames: Array.from({ length: DIZZY_FRAMES }, (_, i) => sitting(i % 4 < 2 ? 0 : 1, (i * 2 * Math.PI) / DIZZY_FRAMES)),
  },

  // Hurt: over the top
  hurt_overTheTop_0: {
    ticksPerFrame: 4, loop: false, arcHeight: 22, airFrames: SPIN_FRAMES.length * SPIN_REVOLUTIONS,
    frames: [
      ...repeat(SPIN_FRAMES, SPIN_REVOLUTIONS),
      lying({ faceUp: true, headLift: -1, footLift: -1 }),
      lying({ faceUp: true }),
    ],
  },
  hurt_overTheTop_1: {
    ticksPerFrame: 10, loop: false, arcHeight: 10, airFrames: 4,
    frames: [
      // flat superman-style flight, face down, limbs flailing
      lying({ faceUp: false, headRight: true, reach: true, legs: flailingLegs(-2, 1) }),
      lying({ faceUp: false, headRight: true, arms: ARMS_FLAILING_A, legs: flailingLegs(1, -2) }),
      lying({ faceUp: false, headRight: true, reach: true, legs: flailingLegs(-1, 2) }),
      lying({ faceUp: false, headRight: true, arms: ARMS_FLAILING_B, legs: flailingLegs(2, -1) }),
      // lands: bounce, then crumpled
      lying({ faceUp: false, headRight: true, footLift: -2, reach: true }),
      crumpled(),
    ],
  },
  hurt_overTheTop_2: {
    ticksPerFrame: 12, loop: false, arcHeight: 30, airFrames: 5, crater: true,
    frames: [
      // thrown up and back
      [...px('skin', [[-3, -5, 2, 2], [2, -5, 2, 2]]), ...px('boot', [[-4, -3, 3, 1], [2, -3, 3, 1]]),
        ...bodyAt(-2, -2), ...px('skin', [[-6, -14, 1, 3], [2, -14, 1, 3]])],
      AIRBORNE_SIDEWAYS,
      AIRBORNE_INVERTED,
      AIRBORNE_SIDEWAYS_REVERSED,
      AIRBORNE_INVERTED,
      // flat on the face
      lying({ faceUp: false, headRight: true, reach: true }),
    ],
  },
};
