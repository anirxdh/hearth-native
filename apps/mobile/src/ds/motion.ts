import { FadeIn, FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';

/**
 * The motion system. Editorial motion: quiet, quick, always earning its
 * place. Rules that keep it calm:
 * - 200-350ms, ease-out; entrances travel at most 14px
 * - stagger children by 40-60ms so lists breathe instead of popping
 * - respect Reduce Motion at the system level on every preset
 * - nothing loops or bounces except the threshold sphere's slow rotation
 */

export const duration = {
  fast: 200,
  base: 260,
  slow: 340,
} as const;

/** Entrance for a screen's lead block (title, hero card). */
export const enterLead = FadeInDown.duration(duration.slow)
  .springify()
  .damping(24)
  .stiffness(220)
  .reduceMotion(ReduceMotion.System);

/** Entrance for list rows / cards; pass the row index for a gentle stagger. */
export const enterRow = (index = 0) =>
  FadeInDown.duration(duration.base)
    .delay(Math.min(index, 8) * 50)
    .springify()
    .damping(26)
    .stiffness(240)
    .reduceMotion(ReduceMotion.System);

/** Quiet fade for secondary content (hints, footnotes). */
export const enterQuiet = FadeIn.duration(duration.slow).reduceMotion(ReduceMotion.System);

/** Layout transition for lists that insert/remove rows. */
export const layoutSettle = LinearTransition.duration(duration.fast).reduceMotion(
  ReduceMotion.System,
);
