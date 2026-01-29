/**
 * ParticipantState - Entity state types and state machine for participant entities
 *
 * Defines the state model for participants in the meeting visualization
 * following ECS (Entity Component System) patterns.
 */

/**
 * Core participant entity data
 */
export interface ParticipantEntity {
  id: string;           // Unique identifier (agent name)
  name: string;         // Display name
  role: string;         // Expertise or role
  color?: string;       // Hex color for visual representation
  joinedAt: number;     // Timestamp when participant joined
}

/**
 * Visual state of participant
 */
export type VisualState = 'idle' | 'speaking' | 'listening' | 'thinking';

/**
 * Turn type when speaking
 */
export type TurnType = 'response' | 'turn' | null;

/**
 * Position component (for layout)
 */
export interface Position {
  angle: number;        // Radial angle around table (radians)
  radius: number;       // Distance from center
  index: number;        // Seat index (for arrangement)
}

/**
 * Participant state component
 */
export interface ParticipantStateComponent {
  visual: VisualState;
  turnType: TurnType;
  lastActiveRound: number;
  isSpeaking: boolean;
}

/**
 * Complete participant with all components
 */
export interface Participant {
  entity: ParticipantEntity;
  state: ParticipantStateComponent;
  position: Position;
}

/**
 * State machine for participant visual states
 */
export class ParticipantStateMachine {
  private currentState: VisualState = 'idle';

  /**
   * Transition to a new state with validation
   */
  transition(newState: VisualState): boolean {
    if (this.isValidTransition(this.currentState, newState)) {
      this.currentState = newState;
      return true;
    }
    console.warn(`Invalid state transition: ${this.currentState} -> ${newState}`);
    return false;
  }

  /**
   * Get current state
   */
  getState(): VisualState {
    return this.currentState;
  }

  /**
   * Validate state transitions
   */
  private isValidTransition(from: VisualState, to: VisualState): boolean {
    // Define valid transitions
    const transitions: Record<VisualState, VisualState[]> = {
      idle: ['speaking', 'listening', 'thinking'],
      speaking: ['idle', 'listening'],
      listening: ['speaking', 'idle'],
      thinking: ['speaking', 'idle'],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    this.currentState = 'idle';
  }
}

/**
 * Factory for creating participant entities
 */
export class ParticipantFactory {
  private static participantCount = 0;
  private static colors = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#e91e63', // Pink
    '#00bcd4', // Cyan
    '#ffeb3b', // Yellow
  ];

  /**
   * Create a new participant entity
   */
  static createParticipant(config: {
    name: string;
    role: string;
    color?: string;
  }): Participant {
    const index = this.participantCount++;
    const color = config.color ?? this.colors[index % this.colors.length]!;

    return {
      entity: {
        id: config.name,
        name: config.name,
        role: config.role,
        color,
        joinedAt: Date.now(),
      },
      state: {
        visual: 'idle',
        turnType: null,
        lastActiveRound: 0,
        isSpeaking: false,
      },
      position: {
        angle: 0,
        radius: 220,
        index,
      },
    };
  }

  /**
   * Reset the factory color counter (useful for tests)
   */
  static reset(): void {
    this.participantCount = 0;
  }
}
