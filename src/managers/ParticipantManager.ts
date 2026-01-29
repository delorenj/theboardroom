/**
 * ParticipantManager - Central ECS system for managing participant entities
 *
 * Responsibilities:
 * - Participant lifecycle (add, remove, clear)
 * - State management (speaking, idle, turn types)
 * - Position calculation (circular arrangement)
 * - Event subscription (notify renderers of state changes)
 *
 * Design Pattern: Observer + Entity Manager
 * - Scenes subscribe to participant changes
 * - Manager maintains single source of truth for participant state
 * - Decouples event handling from rendering logic
 */

import type {
  Participant,
  TurnType,
} from '../entities/ParticipantState';
import { ParticipantFactory, ParticipantStateMachine } from '../entities/ParticipantState';

/**
 * Participant change event types
 */
export type ParticipantChangeType =
  | 'added'
  | 'removed'
  | 'state_changed'
  | 'position_changed'
  | 'cleared';

/**
 * Participant change event
 */
export interface ParticipantChangeEvent {
  type: ParticipantChangeType;
  participant?: Participant;
  participants?: Participant[];
}

/**
 * Subscriber callback for participant changes
 */
export type ParticipantChangeHandler = (event: ParticipantChangeEvent) => void;

/**
 * Central manager for all participant entities
 */
export class ParticipantManager {
  private participants: Map<string, Participant> = new Map();
  private stateMachines: Map<string, ParticipantStateMachine> = new Map();
  private subscribers: Set<ParticipantChangeHandler> = new Set();
  private tableRadius: number = 220;

  /**
   * Subscribe to participant changes
   */
  subscribe(handler: ParticipantChangeHandler): () => void {
    this.subscribers.add(handler);
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Notify all subscribers of a change
   */
  private notify(event: ParticipantChangeEvent): void {
    for (const handler of this.subscribers) {
      handler(event);
    }
  }

  /**
   * Add a new participant to the meeting
   */
  addParticipant(config: {
    name: string;
    role: string;
    color?: string;
  }): Participant {
    // Check if already exists
    if (this.participants.has(config.name)) {
      return this.participants.get(config.name)!;
    }

    // Create new participant entity
    const participant = ParticipantFactory.createParticipant(config);
    const stateMachine = new ParticipantStateMachine();

    // Store
    this.participants.set(config.name, participant);
    this.stateMachines.set(config.name, stateMachine);

    // Recalculate positions for all participants
    this.arrangeParticipants();

    // Notify subscribers
    this.notify({
      type: 'added',
      participant,
    });

    return participant;
  }

  /**
   * Remove a participant from the meeting
   */
  removeParticipant(name: string): boolean {
    const participant = this.participants.get(name);
    if (!participant) return false;

    this.participants.delete(name);
    this.stateMachines.delete(name);

    // Recalculate positions
    this.arrangeParticipants();

    this.notify({
      type: 'removed',
      participant,
    });

    return true;
  }

  /**
   * Get a participant by name
   */
  getParticipant(name: string): Participant | undefined {
    return this.participants.get(name);
  }

  /**
   * Get all participants
   */
  getAllParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get participant count
   */
  getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Set participant speaking state
   */
  setSpeaking(name: string | null, turnType: TurnType, roundNum?: number): void {
    // Clear all participants speaking state first
    for (const [pName, participant] of this.participants) {
      const wasSpeaking = participant.state.isSpeaking;
      participant.state.isSpeaking = false;
      participant.state.turnType = null;

      // Transition to listening if was speaking
      if (wasSpeaking) {
        const stateMachine = this.stateMachines.get(pName);
        stateMachine?.transition('listening');
        participant.state.visual = stateMachine?.getState() ?? 'idle';
      }
    }

    // Set the specified participant as speaking
    if (name) {
      const participant = this.participants.get(name);
      if (participant) {
        participant.state.isSpeaking = true;
        participant.state.turnType = turnType;
        if (roundNum !== undefined) {
          participant.state.lastActiveRound = roundNum;
        }

        // Transition to speaking state
        const stateMachine = this.stateMachines.get(name);
        stateMachine?.transition('speaking');
        participant.state.visual = stateMachine?.getState() ?? 'speaking';

        this.notify({
          type: 'state_changed',
          participant,
        });
      }
    } else {
      // No one speaking, transition all to idle (only if not already idle)
      for (const [pName, participant] of this.participants) {
        if (participant.state.visual !== 'idle') {
          const stateMachine = this.stateMachines.get(pName);
          stateMachine?.transition('idle');
          participant.state.visual = stateMachine?.getState() ?? 'idle';
        }
      }

      this.notify({
        type: 'state_changed',
        participants: this.getAllParticipants(),
      });
    }
  }

  /**
   * Get the currently speaking participant
   */
  getSpeakingParticipant(): Participant | null {
    for (const participant of this.participants.values()) {
      if (participant.state.isSpeaking) {
        return participant;
      }
    }
    return null;
  }

  /**
   * Clear all participants
   */
  clearParticipants(): void {
    this.participants.clear();
    this.stateMachines.clear();
    ParticipantFactory.reset();

    this.notify({
      type: 'cleared',
    });
  }

  /**
   * Arrange participants in a circle around the table
   * Updates position components for all participants
   */
  private arrangeParticipants(): void {
    const count = this.participants.size;
    if (count === 0) return;

    const angleStep = (Math.PI * 2) / count;
    let index = 0;

    for (const participant of this.participants.values()) {
      const angle = angleStep * index - Math.PI / 2; // Start at top
      participant.position.angle = angle;
      participant.position.radius = this.tableRadius;
      participant.position.index = index;
      index++;
    }

    this.notify({
      type: 'position_changed',
      participants: this.getAllParticipants(),
    });
  }

  /**
   * Set the table radius for participant positioning
   */
  setTableRadius(radius: number): void {
    this.tableRadius = radius;
    this.arrangeParticipants();
  }

  /**
   * Get participant names in seating order
   */
  getParticipantNamesInOrder(): string[] {
    return Array.from(this.participants.values())
      .sort((a, b) => a.position.index - b.position.index)
      .map((p) => p.entity.name);
  }

  /**
   * Update participant state for a round
   */
  updateRoundActivity(name: string, roundNum: number): void {
    const participant = this.participants.get(name);
    if (participant) {
      participant.state.lastActiveRound = roundNum;
    }
  }

  /**
   * Get statistics about participants
   */
  getStatistics(): {
    total: number;
    speaking: number;
    listening: number;
    idle: number;
  } {
    const stats = {
      total: this.participants.size,
      speaking: 0,
      listening: 0,
      idle: 0,
    };

    for (const participant of this.participants.values()) {
      switch (participant.state.visual) {
        case 'speaking':
          stats.speaking++;
          break;
        case 'listening':
          stats.listening++;
          break;
        case 'idle':
          stats.idle++;
          break;
      }
    }

    return stats;
  }
}
