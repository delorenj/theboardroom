/**
 * Unit tests for ParticipantManager
 *
 * Tests the ECS entity management system for participants.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ParticipantManager } from '../src/managers/ParticipantManager';
import { ParticipantFactory } from '../src/entities/ParticipantState';

describe('ParticipantManager', () => {
  let manager: ParticipantManager;

  beforeEach(() => {
    manager = new ParticipantManager();
    ParticipantFactory.reset(); // Reset color counter
  });

  describe('addParticipant', () => {
    it('should add a new participant', () => {
      const participant = manager.addParticipant({
        name: 'Alice',
        role: 'Developer',
      });

      expect(participant.entity.name).toBe('Alice');
      expect(participant.entity.role).toBe('Developer');
      expect(manager.getParticipantCount()).toBe(1);
    });

    it('should return existing participant if already added', () => {
      const first = manager.addParticipant({ name: 'Bob', role: 'Designer' });
      const second = manager.addParticipant({ name: 'Bob', role: 'Designer' });

      expect(first).toBe(second);
      expect(manager.getParticipantCount()).toBe(1);
    });

    it('should assign unique colors to participants', () => {
      const p1 = manager.addParticipant({ name: 'Alice', role: 'Dev' });
      const p2 = manager.addParticipant({ name: 'Bob', role: 'Dev' });

      expect(p1.entity.color).toBeDefined();
      expect(p2.entity.color).toBeDefined();
      expect(p1.entity.color).not.toBe(p2.entity.color);
    });

    it('should notify subscribers when participant is added', () => {
      let notified = false;
      manager.subscribe((event) => {
        if (event.type === 'added') {
          notified = true;
          expect(event.participant?.entity.name).toBe('Charlie');
        }
      });

      manager.addParticipant({ name: 'Charlie', role: 'PM' });
      expect(notified).toBe(true);
    });

    it('should arrange participants in circular positions', () => {
      const p1 = manager.addParticipant({ name: 'A', role: 'Dev' });
      const p2 = manager.addParticipant({ name: 'B', role: 'Dev' });
      const p3 = manager.addParticipant({ name: 'C', role: 'Dev' });

      expect(p1.position.index).toBe(0);
      expect(p2.position.index).toBe(1);
      expect(p3.position.index).toBe(2);

      // Angles should be evenly distributed
      const angleStep = (Math.PI * 2) / 3;
      expect(Math.abs(p2.position.angle - p1.position.angle - angleStep)).toBeLessThan(0.01);
    });
  });

  describe('removeParticipant', () => {
    it('should remove an existing participant', () => {
      manager.addParticipant({ name: 'Diana', role: 'QA' });
      expect(manager.getParticipantCount()).toBe(1);

      const removed = manager.removeParticipant('Diana');
      expect(removed).toBe(true);
      expect(manager.getParticipantCount()).toBe(0);
    });

    it('should return false when removing non-existent participant', () => {
      const removed = manager.removeParticipant('NonExistent');
      expect(removed).toBe(false);
    });

    it('should notify subscribers when participant is removed', () => {
      manager.addParticipant({ name: 'Eve', role: 'Dev' });

      let notified = false;
      manager.subscribe((event) => {
        if (event.type === 'removed') {
          notified = true;
          expect(event.participant?.entity.name).toBe('Eve');
        }
      });

      manager.removeParticipant('Eve');
      expect(notified).toBe(true);
    });

    it('should rearrange remaining participants after removal', () => {
      manager.addParticipant({ name: 'A', role: 'Dev' });
      manager.addParticipant({ name: 'B', role: 'Dev' });
      manager.addParticipant({ name: 'C', role: 'Dev' });

      manager.removeParticipant('B');

      const participants = manager.getAllParticipants();
      expect(participants).toHaveLength(2);
      expect(participants[0]!.position.index).toBe(0);
      expect(participants[1]!.position.index).toBe(1);
    });
  });

  describe('setSpeaking', () => {
    beforeEach(() => {
      manager.addParticipant({ name: 'Alice', role: 'Dev' });
      manager.addParticipant({ name: 'Bob', role: 'Dev' });
      manager.addParticipant({ name: 'Charlie', role: 'Dev' });
    });

    it('should set a participant as speaking', () => {
      manager.setSpeaking('Alice', 'turn', 1);

      const alice = manager.getParticipant('Alice');
      expect(alice?.state.isSpeaking).toBe(true);
      expect(alice?.state.turnType).toBe('turn');
      expect(alice?.state.visual).toBe('speaking');
    });

    it('should clear previous speaker when setting new speaker', () => {
      manager.setSpeaking('Alice', 'turn', 1);
      manager.setSpeaking('Bob', 'response', 2);

      const alice = manager.getParticipant('Alice');
      const bob = manager.getParticipant('Bob');

      expect(alice?.state.isSpeaking).toBe(false);
      expect(bob?.state.isSpeaking).toBe(true);
      expect(bob?.state.turnType).toBe('response');
    });

    it('should clear all speakers when called with null', () => {
      manager.setSpeaking('Alice', 'turn', 1);
      manager.setSpeaking(null, null);

      const participants = manager.getAllParticipants();
      for (const p of participants) {
        expect(p.state.isSpeaking).toBe(false);
        expect(p.state.turnType).toBe(null);
      }
    });

    it('should update lastActiveRound when speaking', () => {
      manager.setSpeaking('Charlie', 'turn', 5);

      const charlie = manager.getParticipant('Charlie');
      expect(charlie?.state.lastActiveRound).toBe(5);
    });

    it('should notify subscribers of state change', () => {
      let notified = false;
      manager.subscribe((event) => {
        if (event.type === 'state_changed') {
          notified = true;
          expect(event.participant?.entity.name).toBe('Bob');
        }
      });

      manager.setSpeaking('Bob', 'turn', 1);
      expect(notified).toBe(true);
    });
  });

  describe('getSpeakingParticipant', () => {
    beforeEach(() => {
      manager.addParticipant({ name: 'Alice', role: 'Dev' });
      manager.addParticipant({ name: 'Bob', role: 'Dev' });
    });

    it('should return the speaking participant', () => {
      manager.setSpeaking('Alice', 'turn', 1);

      const speaking = manager.getSpeakingParticipant();
      expect(speaking?.entity.name).toBe('Alice');
    });

    it('should return null when no one is speaking', () => {
      const speaking = manager.getSpeakingParticipant();
      expect(speaking).toBe(null);
    });
  });

  describe('clearParticipants', () => {
    it('should remove all participants', () => {
      manager.addParticipant({ name: 'A', role: 'Dev' });
      manager.addParticipant({ name: 'B', role: 'Dev' });
      manager.addParticipant({ name: 'C', role: 'Dev' });

      expect(manager.getParticipantCount()).toBe(3);

      manager.clearParticipants();

      expect(manager.getParticipantCount()).toBe(0);
      expect(manager.getAllParticipants()).toEqual([]);
    });

    it('should notify subscribers when cleared', () => {
      manager.addParticipant({ name: 'A', role: 'Dev' });

      let notified = false;
      manager.subscribe((event) => {
        if (event.type === 'cleared') {
          notified = true;
        }
      });

      manager.clearParticipants();
      expect(notified).toBe(true);
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      manager.addParticipant({ name: 'Alice', role: 'Dev' });
      manager.addParticipant({ name: 'Bob', role: 'Dev' });
      manager.addParticipant({ name: 'Charlie', role: 'Dev' });
    });

    it('should return correct statistics', () => {
      manager.setSpeaking('Alice', 'turn', 1);

      const stats = manager.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.speaking).toBe(1);
      // Other participants stay idle (not listening) until they were speaking
      expect(stats.idle).toBe(2);
    });

    it('should update statistics when speakers change', () => {
      manager.setSpeaking('Bob', 'response', 1);
      let stats = manager.getStatistics();
      expect(stats.speaking).toBe(1);

      manager.setSpeaking(null, null);
      stats = manager.getStatistics();
      expect(stats.speaking).toBe(0);
      expect(stats.idle).toBe(3);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should allow subscribing to events', () => {
      let callCount = 0;
      const unsubscribe = manager.subscribe(() => {
        callCount++;
      });

      manager.addParticipant({ name: 'Test', role: 'Dev' });
      expect(callCount).toBeGreaterThan(0);

      unsubscribe();
    });

    it('should allow unsubscribing from events', () => {
      let callCount = 0;
      const unsubscribe = manager.subscribe(() => {
        callCount++;
      });

      manager.addParticipant({ name: 'Test1', role: 'Dev' });
      const countAfterFirst = callCount;

      unsubscribe();

      manager.addParticipant({ name: 'Test2', role: 'Dev' });
      expect(callCount).toBe(countAfterFirst);
    });
  });
});
