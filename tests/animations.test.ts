/**
 * Unit tests for animation utilities
 *
 * Tests easing functions, interpolation, and AnimationManager
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  Easing,
  interpolate,
  getAnimationProgress,
  updateAnimation,
  createAnimation,
  pulse,
  rotate,
  wave,
  AnimationManager,
  type AnimationState,
} from '../src/utils/animations';

describe('Easing', () => {
  it('linear should return input value', () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(0.5)).toBe(0.5);
    expect(Easing.linear(1)).toBe(1);
  });

  it('easeInQuad should accelerate', () => {
    expect(Easing.easeInQuad(0)).toBe(0);
    expect(Easing.easeInQuad(0.5)).toBe(0.25);
    expect(Easing.easeInQuad(1)).toBe(1);
  });

  it('easeOutQuad should decelerate', () => {
    expect(Easing.easeOutQuad(0)).toBe(0);
    expect(Easing.easeOutQuad(0.5)).toBe(0.75);
    expect(Easing.easeOutQuad(1)).toBe(1);
  });

  it('easeInOutQuad should accelerate then decelerate', () => {
    expect(Easing.easeInOutQuad(0)).toBe(0);
    expect(Easing.easeInOutQuad(0.25)).toBe(0.125);
    expect(Easing.easeInOutQuad(0.75)).toBe(0.875);
    expect(Easing.easeInOutQuad(1)).toBe(1);
  });

  it('easeOutCubic should decelerate smoothly', () => {
    expect(Easing.easeOutCubic(0)).toBe(0);
    expect(Easing.easeOutCubic(1)).toBe(1);
    const midValue = Easing.easeOutCubic(0.5);
    expect(midValue).toBeGreaterThan(0.5); // Should be ahead at halfway
  });

  it('easeOutBack should overshoot', () => {
    const value = Easing.easeOutBack(0.9);
    expect(value).toBeGreaterThan(1); // Should overshoot past target
  });
});

describe('interpolate', () => {
  it('should interpolate between two values', () => {
    expect(interpolate(0, 100, 0, Easing.linear)).toBe(0);
    expect(interpolate(0, 100, 0.5, Easing.linear)).toBe(50);
    expect(interpolate(0, 100, 1, Easing.linear)).toBe(100);
  });

  it('should clamp progress to 0-1 range', () => {
    expect(interpolate(0, 100, -0.5, Easing.linear)).toBe(0);
    expect(interpolate(0, 100, 1.5, Easing.linear)).toBe(100);
  });

  it('should work with negative values', () => {
    expect(interpolate(-50, 50, 0.5, Easing.linear)).toBe(0);
  });

  it('should apply easing function', () => {
    const linear = interpolate(0, 100, 0.5, Easing.linear);
    const easeOut = interpolate(0, 100, 0.5, Easing.easeOutQuad);
    expect(easeOut).toBeGreaterThan(linear);
  });
});

describe('getAnimationProgress', () => {
  it('should calculate progress from 0 to 1', () => {
    const animation: AnimationState = {
      startValue: 0,
      targetValue: 100,
      startTime: 1000,
      duration: 100,
      easingFunction: Easing.linear,
    };

    expect(getAnimationProgress(animation, 1000)).toBe(0);
    expect(getAnimationProgress(animation, 1050)).toBe(0.5);
    expect(getAnimationProgress(animation, 1100)).toBe(1);
  });

  it('should cap progress at 1', () => {
    const animation: AnimationState = {
      startValue: 0,
      targetValue: 100,
      startTime: 1000,
      duration: 100,
      easingFunction: Easing.linear,
    };

    expect(getAnimationProgress(animation, 1200)).toBe(1);
  });
});

describe('updateAnimation', () => {
  it('should update value and return completion status', () => {
    const animation: AnimationState = {
      startValue: 0,
      targetValue: 100,
      startTime: 1000,
      duration: 100,
      easingFunction: Easing.linear,
    };

    const result1 = updateAnimation(animation, 1050);
    expect(result1.value).toBe(50);
    expect(result1.isComplete).toBe(false);

    const result2 = updateAnimation(animation, 1100);
    expect(result2.value).toBe(100);
    expect(result2.isComplete).toBe(true);
  });

  it('should call onComplete when animation finishes', () => {
    let completed = false;
    const animation: AnimationState = {
      startValue: 0,
      targetValue: 100,
      startTime: 1000,
      duration: 100,
      easingFunction: Easing.linear,
      onComplete: () => {
        completed = true;
      },
    };

    updateAnimation(animation, 1050);
    expect(completed).toBe(false);

    updateAnimation(animation, 1100);
    expect(completed).toBe(true);
  });
});

describe('createAnimation', () => {
  it('should create animation with current timestamp', () => {
    const before = Date.now();
    const animation = createAnimation(0, 100, 300);
    const after = Date.now();

    expect(animation.startValue).toBe(0);
    expect(animation.targetValue).toBe(100);
    expect(animation.duration).toBe(300);
    expect(animation.startTime).toBeGreaterThanOrEqual(before);
    expect(animation.startTime).toBeLessThanOrEqual(after);
  });

  it('should use default easing if not provided', () => {
    const animation = createAnimation(0, 100, 300);
    expect(animation.easingFunction).toBe(Easing.easeOutCubic);
  });

  it('should accept custom easing function', () => {
    const animation = createAnimation(0, 100, 300, Easing.linear);
    expect(animation.easingFunction).toBe(Easing.linear);
  });

  it('should accept onComplete callback', () => {
    let called = false;
    const animation = createAnimation(0, 100, 300, Easing.linear, () => {
      called = true;
    });

    updateAnimation(animation, animation.startTime + 300);
    expect(called).toBe(true);
  });
});

describe('pulse', () => {
  it('should oscillate between min and max', () => {
    const value1 = pulse(0, 1, 0, 1);
    const value2 = pulse(Math.PI / 2, 1, 0, 1);
    const value3 = pulse(Math.PI, 1, 0, 1);

    expect(value1).toBeCloseTo(0.5, 1);
    expect(value2).toBeCloseTo(1, 1);
    expect(value3).toBeCloseTo(0.5, 1);
  });

  it('should work with custom ranges', () => {
    const value = pulse(Math.PI / 2, 1, 10, 20);
    expect(value).toBeCloseTo(20, 1);
  });
});

describe('rotate', () => {
  it('should increase rotation over time', () => {
    const rotation1 = rotate(0, 1);
    const rotation2 = rotate(1, 1);

    expect(rotation2).toBeGreaterThan(rotation1);
  });

  it('should wrap around at 2π', () => {
    const rotation = rotate(Math.PI * 3, 1);
    expect(rotation).toBeLessThan(Math.PI * 2);
  });
});

describe('wave', () => {
  it('should oscillate with amplitude', () => {
    const value1 = wave(0, 1, 10);
    const value2 = wave(Math.PI / 2, 1, 10);

    expect(value1).toBeCloseTo(0, 1);
    expect(value2).toBeCloseTo(10, 1);
  });

  it('should apply phase offset', () => {
    const value1 = wave(0, 1, 10, 0);
    const value2 = wave(0, 1, 10, Math.PI / 2);

    expect(value1).toBeCloseTo(0, 1);
    expect(value2).toBeCloseTo(10, 1);
  });
});

describe('AnimationManager', () => {
  let manager: AnimationManager;

  beforeEach(() => {
    manager = new AnimationManager();
  });

  describe('start', () => {
    it('should start a new animation', () => {
      manager.start('test', 0, 100, 100);
      expect(manager.isAnimating('test')).toBe(true);
    });

    it('should replace existing animation with same key', () => {
      manager.start('test', 0, 100, 100);
      manager.start('test', 50, 150, 100);

      const animation = manager.get('test');
      expect(animation?.startValue).toBe(50);
      expect(animation?.targetValue).toBe(150);
    });
  });

  describe('update', () => {
    it('should return current values for all animations', () => {
      const startTime = Date.now();
      manager.start('anim1', 0, 100, 100, Easing.linear);
      manager.start('anim2', 0, 200, 100, Easing.linear);

      const values = manager.update(startTime + 50);

      expect(values.has('anim1')).toBe(true);
      expect(values.has('anim2')).toBe(true);
      expect(values.get('anim1')).toBeCloseTo(50, 0);
      expect(values.get('anim2')).toBeCloseTo(100, 0);
    });

    it('should remove completed animations', () => {
      const startTime = Date.now();
      manager.start('test', 0, 100, 100);

      manager.update(startTime + 50);
      expect(manager.isAnimating('test')).toBe(true);

      manager.update(startTime + 150);
      expect(manager.isAnimating('test')).toBe(false);
    });

    it('should call onComplete for finished animations', () => {
      let completed = false;
      const startTime = Date.now();

      manager.start('test', 0, 100, 100, Easing.linear, () => {
        completed = true;
      });

      manager.update(startTime + 50);
      expect(completed).toBe(false);

      manager.update(startTime + 150);
      expect(completed).toBe(true);
    });
  });

  describe('isAnimating', () => {
    it('should return true for active animations', () => {
      manager.start('test', 0, 100, 100);
      expect(manager.isAnimating('test')).toBe(true);
    });

    it('should return false for non-existent animations', () => {
      expect(manager.isAnimating('missing')).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel an active animation', () => {
      manager.start('test', 0, 100, 100);
      expect(manager.isAnimating('test')).toBe(true);

      manager.cancel('test');
      expect(manager.isAnimating('test')).toBe(false);
    });

    it('should be safe to cancel non-existent animation', () => {
      expect(() => manager.cancel('missing')).not.toThrow();
    });
  });

  describe('cancelAll', () => {
    it('should cancel all animations', () => {
      manager.start('anim1', 0, 100, 100);
      manager.start('anim2', 0, 200, 100);
      manager.start('anim3', 0, 300, 100);

      expect(manager.isAnimating('anim1')).toBe(true);
      expect(manager.isAnimating('anim2')).toBe(true);
      expect(manager.isAnimating('anim3')).toBe(true);

      manager.cancelAll();

      expect(manager.isAnimating('anim1')).toBe(false);
      expect(manager.isAnimating('anim2')).toBe(false);
      expect(manager.isAnimating('anim3')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return animation state', () => {
      manager.start('test', 0, 100, 100);
      const animation = manager.get('test');

      expect(animation).toBeDefined();
      expect(animation?.startValue).toBe(0);
      expect(animation?.targetValue).toBe(100);
      expect(animation?.duration).toBe(100);
    });

    it('should return undefined for non-existent animation', () => {
      const animation = manager.get('missing');
      expect(animation).toBeUndefined();
    });
  });
});
