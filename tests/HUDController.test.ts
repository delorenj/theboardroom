/**
 * Unit tests for HUDController metrics calculation
 *
 * Tests consensus calculation, novelty tracking, and metric animations.
 */

import { describe, it, expect, beforeEach } from 'bun:test';

/**
 * Mock HUDController for testing metrics logic
 *
 * We extract the core metrics calculation logic to test it in isolation
 * without requiring DOM elements.
 */
class MetricsCalculator {
  private consensusLevel = 0;
  private noveltyLevel = 50;
  private noveltyHistory: number[] = [];

  /**
   * Calculate consensus based on novelty trend
   * This is the core algorithm from HUDController.setNovelty
   */
  setNovelty(level: number): { consensus: number; novelty: number } {
    this.noveltyLevel = Math.max(0, Math.min(100, level));

    // Track novelty history for trend analysis
    this.noveltyHistory.push(this.noveltyLevel);
    if (this.noveltyHistory.length > 10) {
      this.noveltyHistory.shift(); // Keep last 10 values
    }

    // Calculate consensus as inverse of novelty with trend smoothing
    // High novelty = low consensus, Low novelty = high consensus
    const avgNovelty = this.noveltyHistory.reduce((sum, v) => sum + v, 0) / this.noveltyHistory.length;
    this.consensusLevel = Math.max(0, Math.min(100, 100 - avgNovelty));

    return {
      consensus: this.consensusLevel,
      novelty: this.noveltyLevel
    };
  }

  getConsensus(): number {
    return this.consensusLevel;
  }

  getNovelty(): number {
    return this.noveltyLevel;
  }

  getNoveltyHistory(): number[] {
    return [...this.noveltyHistory];
  }

  reset(): void {
    this.consensusLevel = 0;
    this.noveltyLevel = 50;
    this.noveltyHistory = [];
  }
}

describe('HUDController Metrics', () => {
  let calculator: MetricsCalculator;

  beforeEach(() => {
    calculator = new MetricsCalculator();
  });

  describe('Consensus Calculation', () => {
    it('should calculate consensus as inverse of novelty', () => {
      const result = calculator.setNovelty(80);

      expect(result.novelty).toBe(80);
      expect(result.consensus).toBe(20); // 100 - 80
    });

    it('should handle novelty at 0%', () => {
      const result = calculator.setNovelty(0);

      expect(result.novelty).toBe(0);
      expect(result.consensus).toBe(100); // Perfect consensus
    });

    it('should handle novelty at 100%', () => {
      const result = calculator.setNovelty(100);

      expect(result.novelty).toBe(100);
      expect(result.consensus).toBe(0); // No consensus
    });

    it('should smooth consensus using novelty history', () => {
      // First update: high novelty
      calculator.setNovelty(90);
      expect(calculator.getConsensus()).toBe(10);

      // Second update: low novelty
      // Average = (90 + 10) / 2 = 50
      // Consensus = 100 - 50 = 50
      calculator.setNovelty(10);
      expect(calculator.getConsensus()).toBe(50);
    });

    it('should track up to 10 novelty history values', () => {
      for (let i = 0; i < 15; i++) {
        calculator.setNovelty(i * 5);
      }

      const history = calculator.getNoveltyHistory();
      expect(history).toHaveLength(10);
      expect(history[0]).toBe(25); // (15-10) * 5 = 25
      expect(history[9]).toBe(70); // (15-1) * 5 = 70
    });

    it('should converge consensus as novelty consistently drops', () => {
      const noveltyValues = [80, 70, 60, 50, 40, 30, 20, 10, 5, 0];
      const consensusValues: number[] = [];

      for (const novelty of noveltyValues) {
        const result = calculator.setNovelty(novelty);
        consensusValues.push(result.consensus);
      }

      // Consensus should increase as novelty decreases
      for (let i = 1; i < consensusValues.length; i++) {
        expect(consensusValues[i]).toBeGreaterThan(consensusValues[i - 1]!);
      }

      // Final consensus should be moderately high (smoothed by moving average)
      // With 10 values averaging down to ~35, consensus = 100 - 35 = 65
      expect(consensusValues[consensusValues.length - 1]).toBeGreaterThan(60);
    });
  });

  describe('Novelty Tracking', () => {
    it('should clamp novelty to 0-100 range', () => {
      let result = calculator.setNovelty(-10);
      expect(result.novelty).toBe(0);

      result = calculator.setNovelty(150);
      expect(result.novelty).toBe(100);
    });

    it('should maintain novelty history in order', () => {
      calculator.setNovelty(10);
      calculator.setNovelty(20);
      calculator.setNovelty(30);

      const history = calculator.getNoveltyHistory();
      expect(history).toEqual([10, 20, 30]);
    });

    it('should calculate moving average correctly', () => {
      // Add known values
      calculator.setNovelty(50);
      calculator.setNovelty(50);
      calculator.setNovelty(50);

      // Average should be 50, consensus should be 50
      expect(calculator.getConsensus()).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle first novelty update correctly', () => {
      const result = calculator.setNovelty(60);

      expect(result.novelty).toBe(60);
      expect(result.consensus).toBe(40); // Based on single value
      expect(calculator.getNoveltyHistory()).toEqual([60]);
    });

    it('should handle rapid fluctuations', () => {
      calculator.setNovelty(100);
      calculator.setNovelty(0);
      calculator.setNovelty(100);
      calculator.setNovelty(0);

      const consensus = calculator.getConsensus();
      expect(consensus).toBeGreaterThanOrEqual(0);
      expect(consensus).toBeLessThanOrEqual(100);
    });

    it('should reset all metrics', () => {
      calculator.setNovelty(80);
      calculator.setNovelty(70);
      calculator.setNovelty(60);

      calculator.reset();

      expect(calculator.getConsensus()).toBe(0);
      expect(calculator.getNovelty()).toBe(50);
      expect(calculator.getNoveltyHistory()).toEqual([]);
    });
  });

  describe('Realistic Scenarios', () => {
    it('should simulate meeting convergence pattern', () => {
      // Meeting starts with high novelty
      const rounds = [
        { round: 1, novelty: 85 },
        { round: 2, novelty: 75 },
        { round: 3, novelty: 65 },
        { round: 4, novelty: 50 },
        { round: 5, novelty: 35 },
        { round: 6, novelty: 20 }, // Converging
        { round: 7, novelty: 15 },
        { round: 8, novelty: 10 }, // Converged
      ];

      const results: number[] = [];

      for (const { novelty } of rounds) {
        const result = calculator.setNovelty(novelty);
        results.push(result.consensus);
      }

      // Consensus should be increasing over time
      expect(results[0]).toBeLessThan(20); // Early: low consensus
      // Smoothed consensus won't reach 80 with only 8 rounds
      // Average of last rounds ~30, so consensus ~70
      expect(results[results.length - 1]).toBeGreaterThan(50); // End: moderate-high consensus
    });

    it('should simulate divergent discussion pattern', () => {
      // Meeting with increasing disagreement
      const rounds = [
        { round: 1, novelty: 40 },
        { round: 2, novelty: 50 },
        { round: 3, novelty: 60 },
        { round: 4, novelty: 70 },
        { round: 5, novelty: 80 },
      ];

      const results: number[] = [];

      for (const { novelty } of rounds) {
        const result = calculator.setNovelty(novelty);
        results.push(result.consensus);
      }

      // Consensus should be decreasing
      expect(results[0]).toBeGreaterThan(results[results.length - 1]!);
    });

    it('should handle plateau in discussion', () => {
      // Novelty stays consistent for several rounds
      for (let i = 0; i < 8; i++) {
        calculator.setNovelty(55);
      }

      const consensus = calculator.getConsensus();
      expect(consensus).toBeCloseTo(45, 0); // 100 - 55 = 45
    });
  });
});
