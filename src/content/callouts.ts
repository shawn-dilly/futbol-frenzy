import type { HitType, HurtTier } from '../sim';

/**
 * One announcer line. Add a line by adding an entry: nothing else changes.
 * `tiers` says which hits may trigger it, `hitTypes` (optional) narrows it to those hit kinds,
 * `weight` (default 1) makes it turn up more often, `audio` names a recorded clip to play with it.
 * Text is upper case, uses only glyphs the pixel font has, and wraps to at most two lines at its tier's scale.
 */
export interface Callout { id: string; text: string; tiers: HurtTier[]; hitTypes?: HitType[]; weight?: number; audio?: string }

const KD: HurtTier[] = ['knockdown'];
const WO: HurtTier[] = ['wipeout'];
const OTT: HurtTier[] = ['overTheTop'];
const KD_WO: HurtTier[] = ['knockdown', 'wipeout'];
const WO_OTT: HurtTier[] = ['wipeout', 'overTheTop'];
const ALL: HurtTier[] = ['knockdown', 'wipeout', 'overTheTop'];
const BIG: HitType[] = ['big'];

export const CALLOUTS: Callout[] = [
  // Seed lines from the design.
  { id: 'crunch', text: 'CRUNCH!', tiers: ALL },
  { id: 'leave-a-mark', text: "THAT'S GONNA LEAVE A MARK!", tiers: WO_OTT },
  { id: 'call-his-mom', text: 'SOMEBODY CALL HIS MOM!', tiers: WO_OTT },
  { id: 'what-ref', text: 'REF? WHAT REF?', tiers: ALL },
  { id: 'taxi-no-9', text: 'TAXI FOR NO. 9!', tiers: ALL },
  { id: 'offseason', text: "HE'LL FEEL THAT IN THE OFFSEASON!", tiers: OTT },
  { id: 'aisle-five', text: 'CLEAN UP ON AISLE FIVE!', tiers: WO_OTT },
  { id: 'tweety-birds', text: "HE'S SEEING TWEETY BIRDS!", tiers: WO_OTT },
  // Knockdown: a solid bump.
  { id: 'kd-ouch', text: 'OUCH! THAT WAS RUDE!', tiers: KD },
  { id: 'kd-bumper', text: 'BUMPER CAR RULES APPLY!', tiers: KD },
  { id: 'kd-doormat', text: 'WELCOME TO THE DOORMAT!', tiers: KD },
  { id: 'kd-grass', text: 'TASTE THE GRASS!', tiers: KD },
  { id: 'kd-timber', text: 'TIMBER!', tiers: KD },
  { id: 'kd-sit', text: 'HAVE A SEAT!', tiers: KD },
  { id: 'kd-bonk', text: 'BONK!', tiers: KD },
  { id: 'kd-oof', text: 'OOF! RIGHT IN THE SHORTS!', tiers: KD },
  { id: 'kd-nap', text: 'NAP TIME ON THE TURF!', tiers: KD },
  { id: 'kd-polite', text: 'NOT VERY POLITE!', tiers: KD },
  { id: 'kd-pancake', text: 'PANCAKE FOR BREAKFAST!', tiers: KD },
  { id: 'kd-shoulder', text: 'SHOULDER TO THE RESCUE!', tiers: KD, hitTypes: ['shoulder'] },
  { id: 'kd-slide', text: 'SLIDING INTO HIS DMS!', tiers: KD, hitTypes: ['slide'] },
  { id: 'kd-shake', text: 'SHAKE IT OFF! OR NOT!', tiers: KD_WO },
  // Wipeout: a proper flattening.
  { id: 'wo-flatter', text: 'FLATTER THAN A PANCAKE!', tiers: WO },
  { id: 'wo-wipeout', text: 'WIPEOUT!', tiers: WO },
  { id: 'wo-doorbell', text: 'HE GOT HIS BELL RUNG!', tiers: WO },
  { id: 'wo-dizzy', text: 'EVERYTHING IS SPINNING!', tiers: WO },
  { id: 'wo-trucks', text: "DID ANYONE GET THE TRUCK'S NUMBER?", tiers: WO },
  { id: 'wo-ironing', text: 'FRESHLY IRONED!', tiers: WO },
  { id: 'wo-pinball', text: 'HE PLAYED PINBALL WITH HIM!', tiers: WO },
  { id: 'wo-tilt', text: 'TILT! TILT! TILT!', tiers: WO },
  { id: 'wo-sandwich', text: 'ONE GRASS SANDWICH TO GO!', tiers: WO },
  { id: 'wo-slide', text: 'SLIDE TACKLE OR HOCKEY CHECK?', tiers: WO, hitTypes: ['slide'] },
  // Over the top: absurd, cartoon violence.
  { id: 'ott-orbit', text: 'HE IS IN ORBIT!', tiers: OTT },
  { id: 'ott-moon', text: 'GREETINGS FROM THE MOON!', tiers: OTT },
  { id: 'ott-crater', text: 'MIND THE CRATER!', tiers: OTT },
  { id: 'ott-meteor', text: 'METEOR ALERT ON THE PITCH!', tiers: OTT },
  { id: 'ott-reset', text: 'SOMEONE REBOOT THAT GUY!', tiers: OTT },
  { id: 'ott-pixels', text: 'HE LOST A FEW PIXELS!', tiers: OTT },
  { id: 'ott-seismic', text: 'SEISMOLOGISTS ARE CONFUSED!', tiers: OTT },
  { id: 'ott-record', text: 'NEW WORLD RECORD IN FLATTENING!', tiers: OTT },
  { id: 'ott-bigbang', text: 'THE BIG BANG ALL OVER AGAIN!', tiers: OTT, hitTypes: BIG },
  { id: 'ott-thunder', text: 'THUNDER ON THE LEFT WING!', tiers: OTT, hitTypes: BIG },
  { id: 'ott-wind', text: 'THAT HIT NEEDS A WARNING LABEL!', tiers: OTT, hitTypes: BIG },
  { id: 'big-wound', text: 'THAT WAS A WINDUP AND A HALF!', tiers: WO_OTT, hitTypes: BIG },
  { id: 'big-freight', text: 'ALL ABOARD THE FREIGHT TRAIN!', tiers: WO_OTT, hitTypes: BIG },
  { id: 'big-charged', text: 'FULLY CHARGED AND FULLY DELIVERED!', tiers: WO_OTT, hitTypes: BIG, weight: 2 },
];
