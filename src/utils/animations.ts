/**
 * Animation utilities for smooth transitions and effects
 *
 * Provides easing functions, animation helpers, and timing utilities
 * for creating polished visual feedback in the boardroom visualization.
 */

/**
 * Easing functions for smooth animations
 */
export const Easing = {
  /**
   * Linear - no easing, constant speed
   */
  linear: (t: number): number => t,

  /**
   * Ease in quadratic - accelerating from zero velocity
   */
  easeInQuad: (t: number): number => t * t,

  /**
   * Ease out quadratic - decelerating to zero velocity
   */
  easeOutQuad: (t: number): number => t * (2 - t),

  /**
   * Ease in/out quadratic - acceleration until halfway, then deceleration
   */
  easeInOutQuad: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },

  /**
   * Ease in cubic - accelerating from zero velocity
   */
  easeInCubic: (t: number): number => t * t * t,

  /**
   * Ease out cubic - decelerating to zero velocity
   */
  easeOutCubic: (t: number): number => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },

  /**
   * Ease in/out cubic - smooth acceleration and deceleration
   */
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },

  /**
   * Ease out elastic - creates a spring/bounce effect
   */
  easeOutElastic: (t: number): number => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
  },

  /**
   * Ease out back - overshoots then comes back
   */
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/**
 * Animation state for tracking smooth transitions
 */
export interface AnimationState {
  startValue: number;
  targetValue: number;
  startTime: number;
  duration: number;
  easingFunction: (t: number) => number;
  onComplete?: () => void;
}

/**
 * Interpolate between two values using an easing function
 */
export function interpolate(
  startValue: number,
  targetValue: number,
  progress: number,
  easingFunction: (t: number) => number = Easing.linear
): number {
  const easedProgress = easingFunction(Math.max(0, Math.min(1, progress)));
  return startValue + (targetValue - startValue) * easedProgress;
}

/**
 * Calculate animation progress (0 to 1)
 */
export function getAnimationProgress(animation: AnimationState, currentTime: number): number {
  const elapsed = currentTime - animation.startTime;
  return Math.min(1, elapsed / animation.duration);
}

/**
 * Update animation state and return current value
 */
export function updateAnimation(animation: AnimationState, currentTime: number): {
  value: number;
  isComplete: boolean;
} {
  const progress = getAnimationProgress(animation, currentTime);
  const value = interpolate(
    animation.startValue,
    animation.targetValue,
    progress,
    animation.easingFunction
  );

  const isComplete = progress >= 1;
  if (isComplete && animation.onComplete) {
    animation.onComplete();
  }

  return { value, isComplete };
}

/**
 * Create a new animation state
 */
export function createAnimation(
  startValue: number,
  targetValue: number,
  duration: number,
  easingFunction: (t: number) => number = Easing.easeOutCubic,
  onComplete?: () => void
): AnimationState {
  return {
    startValue,
    targetValue,
    startTime: Date.now(),
    duration,
    easingFunction,
    onComplete,
  };
}

/**
 * Pulse animation - oscillate between min and max values
 */
export function pulse(time: number, frequency: number, min: number, max: number): number {
  const normalized = (Math.sin(time * frequency) + 1) / 2; // 0 to 1
  return min + (max - min) * normalized;
}

/**
 * Rotate animation - continuous rotation
 */
export function rotate(time: number, speed: number): number {
  return (time * speed) % (Math.PI * 2);
}

/**
 * Wave animation - sine wave oscillation
 */
export function wave(time: number, frequency: number, amplitude: number, offset: number = 0): number {
  return Math.sin(time * frequency + offset) * amplitude;
}

/**
 * Animation manager for tracking multiple animations
 */
export class AnimationManager {
  private animations = new Map<string, AnimationState>();

  /**
   * Start a new animation
   */
  start(
    key: string,
    startValue: number,
    targetValue: number,
    duration: number,
    easingFunction?: (t: number) => number,
    onComplete?: () => void
  ): void {
    this.animations.set(
      key,
      createAnimation(startValue, targetValue, duration, easingFunction, onComplete)
    );
  }

  /**
   * Update all animations and return current values
   */
  update(currentTime: number): Map<string, number> {
    const values = new Map<string, number>();
    const completedKeys: string[] = [];

    for (const [key, animation] of this.animations) {
      const { value, isComplete } = updateAnimation(animation, currentTime);
      values.set(key, value);

      if (isComplete) {
        completedKeys.push(key);
      }
    }

    // Remove completed animations
    for (const key of completedKeys) {
      this.animations.delete(key);
    }

    return values;
  }

  /**
   * Check if animation is running
   */
  isAnimating(key: string): boolean {
    return this.animations.has(key);
  }

  /**
   * Cancel an animation
   */
  cancel(key: string): void {
    this.animations.delete(key);
  }

  /**
   * Cancel all animations
   */
  cancelAll(): void {
    this.animations.clear();
  }

  /**
   * Get current animation state
   */
  get(key: string): AnimationState | undefined {
    return this.animations.get(key);
  }
}
