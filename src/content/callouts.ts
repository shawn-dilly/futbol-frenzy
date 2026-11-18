import type { HitType, HurtTier } from '../sim';

/**
 * One announcer line. Add a line by adding an entry: nothing else changes.
 * `tiers` says which hits may trigger it, `hitTypes` (optional) narrows it to those hit kinds,
 * `weight` (default 1, at least 1) makes it turn up more often, `audio` names a recorded clip to play with it.
 * Text is upper case, uses only glyphs the pixel font has, and wraps to at most two lines at its tier's scale.
 * The id is the text in lower-case kebab-case.
 */
export interface Callout { id: string; text: string; tiers: HurtTier[]; hitTypes?: HitType[]; late?: boolean; weight?: number; audio?: string }

const KD: HurtTier[] = ['knockdown'];
const WO: HurtTier[] = ['wipeout'];
const OTT: HurtTier[] = ['overTheTop'];
const KD_WO: HurtTier[] = ['knockdown', 'wipeout'];
const WO_OTT: HurtTier[] = ['wipeout', 'overTheTop'];
const ALL: HurtTier[] = ['knockdown', 'wipeout', 'overTheTop'];

export const CALLOUTS: Callout[] = [
  { id: 'wrong-ball', text: 'WRONG BALL!', tiers: ALL, late: true, weight: 5 },
  { id: 'behind-the-play', text: 'BEHIND THE PLAY!', tiers: ALL, late: true, weight: 5 },
  { id: 'ball-jars-loose', text: 'BALL JARS LOOSE!', tiers: ALL, late: false, weight: 5 },
  // Seed lines from the design.
  { id: 'crunch', text: 'CRUNCH!', tiers: ALL },
  { id: 'that-s-gonna-leave-a-mark', text: "THAT'S GONNA LEAVE A MARK!", tiers: WO_OTT },
  { id: 'somebody-call-his-mom', text: 'SOMEBODY CALL HIS MOM!', tiers: WO_OTT },
  { id: 'ref-what-ref', text: 'REF? WHAT REF?', tiers: ALL },
  { id: 'taxi-for-no-9', text: 'TAXI FOR NO. 9!', tiers: ALL },
  { id: 'he-ll-feel-that-in-the-offseason', text: "HE'LL FEEL THAT IN THE OFFSEASON!", tiers: OTT },
  { id: 'clean-up-on-aisle-five', text: 'CLEAN UP ON AISLE FIVE!', tiers: WO_OTT },
  { id: 'he-s-seeing-little-birdies', text: "HE'S SEEING LITTLE BIRDIES!", tiers: WO_OTT },
  // Knockdown: a solid bump.
  { id: 'ouch-that-was-rude', text: 'OUCH! THAT WAS RUDE!', tiers: KD },
  { id: 'bumper-car-rules-apply', text: 'BUMPER CAR RULES APPLY!', tiers: KD },
  { id: 'taste-the-grass', text: 'TASTE THE GRASS!', tiers: KD },
  { id: 'timber', text: 'TIMBER!', tiers: KD },
  { id: 'have-a-seat', text: 'HAVE A SEAT!', tiers: KD },
  { id: 'bonk', text: 'BONK!', tiers: KD },
  { id: 'nap-time-on-the-turf', text: 'NAP TIME ON THE TURF!', tiers: KD },
  { id: 'splat', text: 'SPLAT!', tiers: KD_WO },
  { id: 'boing', text: 'BOING!', tiers: KD },
  { id: 'player-down', text: 'PLAYER DOWN!', tiers: KD },
  { id: 'shake-it-off-or-not', text: 'SHAKE IT OFF! OR NOT!', tiers: KD_WO },
  { id: 'grass-stains-for-everyone', text: 'GRASS STAINS FOR EVERYONE!', tiers: KD_WO, hitTypes: ['slide'] },
  // Wipeout: a proper flattening.
  { id: 'flatter-than-a-pancake', text: 'FLATTER THAN A PANCAKE!', tiers: WO },
  { id: 'wipeout', text: 'WIPEOUT!', tiers: WO },
  { id: 'everything-is-spinning', text: 'EVERYTHING IS SPINNING!', tiers: WO },
  { id: 'did-anyone-get-the-truck-s-number', text: "DID ANYONE GET THE TRUCK'S NUMBER?", tiers: WO },
  { id: 'freshly-ironed', text: 'FRESHLY IRONED!', tiers: WO },
  { id: 'tilt-tilt-tilt', text: 'TILT! TILT! TILT!', tiers: WO },
  { id: 'insert-coin-to-continue', text: 'INSERT COIN TO CONTINUE!', tiers: WO },
  { id: 'game-over', text: 'GAME OVER!', tiers: WO },
  { id: 'k-o', text: 'K.O.!', tiers: WO },
  { id: 'slide-tackle-or-hockey-check', text: 'SLIDE TACKLE OR HOCKEY CHECK?', tiers: WO, hitTypes: ['slide'] },
  // Over the top: absurd cartoon violence.
  { id: 'he-is-in-orbit', text: 'HE IS IN ORBIT!', tiers: OTT },
  { id: 'greetings-from-the-moon', text: 'GREETINGS FROM THE MOON!', tiers: OTT },
  { id: 'mind-the-crater', text: 'MIND THE CRATER!', tiers: OTT },
  { id: 'meteor-alert-on-the-pitch', text: 'METEOR ALERT ON THE PITCH!', tiers: OTT },
  { id: 'someone-reboot-that-guy', text: 'SOMEONE REBOOT THAT GUY!', tiers: OTT },
  { id: 'he-lost-a-few-pixels', text: 'HE LOST A FEW PIXELS!', tiers: OTT },
  { id: 'seismologists-are-confused', text: 'SEISMOLOGISTS ARE CONFUSED!', tiers: OTT },
  { id: 'new-world-record-in-flattening', text: 'NEW WORLD RECORD IN FLATTENING!', tiers: OTT },
  { id: 'error-404-player-not-found', text: 'ERROR 404 PLAYER NOT FOUND!', tiers: OTT },
  { id: 'high-score-for-the-hit', text: 'HIGH SCORE FOR THE HIT!', tiers: OTT },
  { id: 'scientists-are-still-measuring-the-crater', text: 'SCIENTISTS ARE STILL MEASURING THE CRATER!', tiers: OTT },
  { id: 'we-will-now-pause-to-scrape-him-off-the-pitch', text: 'WE WILL NOW PAUSE TO SCRAPE HIM OFF THE PITCH!', tiers: OTT },
  // Big hits only (a charged windup).
  { id: 'the-big-bang-all-over-again', text: 'THE BIG BANG ALL OVER AGAIN!', tiers: OTT, hitTypes: ['big'] },
  { id: 'that-hit-needs-a-warning-label', text: 'THAT HIT NEEDS A WARNING LABEL!', tiers: OTT, hitTypes: ['big'] },
  { id: 'that-was-a-windup-and-a-half', text: 'THAT WAS A WINDUP AND A HALF!', tiers: WO_OTT, hitTypes: ['big'] },
  { id: 'all-aboard-the-freight-train', text: 'ALL ABOARD THE FREIGHT TRAIN!', tiers: WO_OTT, hitTypes: ['big'] },
  { id: 'special-delivery-signature-required', text: 'SPECIAL DELIVERY! SIGNATURE REQUIRED!', tiers: WO_OTT, hitTypes: ['big'] },
];
