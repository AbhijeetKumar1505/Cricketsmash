import gsap from 'gsap';

/** GSAP timeline factory for delivery phase — drives camera cues, not ball physics. */
export function createBowlingTimeline(onMidFlight?: () => void) {
  const tl = gsap.timeline({ paused: true });
  tl.add(() => onMidFlight?.(), 0.55);
  return tl;
}
