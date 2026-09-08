import { WithSpringConfig } from 'react-native-reanimated';

/**
 * Impeccable Motion Design Tokens for GG-Tix
 * Purposeful, snappy, and silky-smooth micro-interactions.
 * Avoids dated elastic/bouncy overshoots.
 */
export const MOTION_TOKENS = {
  // Snappy spring for tactile button presses & toggles
  springSnappy: {
    damping: 18,
    stiffness: 240,
    mass: 0.8,
  } satisfies WithSpringConfig,

  // Gentle spring for card reveals, accordion expands
  springGentle: {
    damping: 22,
    stiffness: 180,
    mass: 1,
  } satisfies WithSpringConfig,

  // Responsive spring for stepper counter +/-
  springBrisk: {
    damping: 14,
    stiffness: 300,
    mass: 0.6,
  } satisfies WithSpringConfig,

  // Press Scale Compression Values
  pressScale: {
    card: 0.98,
    button: 0.96,
    iconButton: 0.92,
  },

  // Transition durations (ms)
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 400,
  },
} as const;
