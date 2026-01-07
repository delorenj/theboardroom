/**
 * BoardroomScene - Main scene setup for meeting visualization
 *
 * Creates a top-down view of a circular meeting room with:
 * - Ambient lighting
 * - Circular table
 * - Camera positioned above looking down
 * - Participant seats arranged in a circle
 */

import * as pc from 'playcanvas';
import { Participant, ParticipantConfig } from '../entities/Participant';

export interface MeetingState {
  meetingId: string;
  topic: string;
  status: 'waiting' | 'active' | 'converged' | 'completed' | 'failed';
  currentRound: number;
  maxRounds: number;
  speakingParticipant: string | null;
  turnType: 'response' | 'turn' | null;
}

export class BoardroomScene {
  private app: pc.Application;
  private participants: Map<string, Participant> = new Map();
  private roomEntity: pc.Entity | null = null;
  private tableEntity: pc.Entity | null = null;
  private meetingState: MeetingState = {
    meetingId: '',
    topic: '',
    status: 'waiting',
    currentRound: 0,
    maxRounds: 0,
    speakingParticipant: null,
    turnType: null,
  };

  // Room configuration
  private readonly ROOM_RADIUS = 8;
  private readonly TABLE_RADIUS = 4;
  private readonly CAMERA_HEIGHT = 15;

  constructor(app: pc.Application) {
    this.app = app;
  }

  initialize(): void {
    this.createCamera();
    this.createLighting();
    this.createRoom();
    this.createTable();
  }

  private createCamera(): void {
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.1, 0.15),
      fov: 45,
    });

    // Position camera above the room, looking down
    camera.setPosition(0, this.CAMERA_HEIGHT, 0);
    camera.setEulerAngles(-90, 0, 0);

    this.app.root.addChild(camera);
  }

  private createLighting(): void {
    // Ambient light
    const ambient = new pc.Entity('ambient-light');
    ambient.addComponent('light', {
      type: 'directional',
      color: new pc.Color(0.3, 0.3, 0.4),
      intensity: 0.5,
    });
    ambient.setEulerAngles(45, 30, 0);
    this.app.root.addChild(ambient);

    // Main overhead light
    const overhead = new pc.Entity('overhead-light');
    overhead.addComponent('light', {
      type: 'point',
      color: new pc.Color(1, 0.95, 0.9),
      intensity: 1.5,
      range: 20,
    });
    overhead.setPosition(0, 10, 0);
    this.app.root.addChild(overhead);
  }

  private createRoom(): void {
    this.roomEntity = new pc.Entity('room');

    // Floor
    const floor = new pc.Entity('floor');
    floor.addComponent('render', {
      type: 'cylinder',
      material: this.createMaterial(new pc.Color(0.15, 0.15, 0.2)),
    });
    floor.setLocalScale(this.ROOM_RADIUS * 2, 0.1, this.ROOM_RADIUS * 2);
    floor.setPosition(0, -0.05, 0);
    this.roomEntity.addChild(floor);

    this.app.root.addChild(this.roomEntity);
  }

  private createTable(): void {
    this.tableEntity = new pc.Entity('table');

    // Table surface
    const surface = new pc.Entity('table-surface');
    surface.addComponent('render', {
      type: 'cylinder',
      material: this.createMaterial(new pc.Color(0.3, 0.2, 0.15)),
    });
    surface.setLocalScale(this.TABLE_RADIUS * 2, 0.15, this.TABLE_RADIUS * 2);
    surface.setPosition(0, 0.5, 0);
    this.tableEntity.addChild(surface);

    // Table pedestal
    const pedestal = new pc.Entity('table-pedestal');
    pedestal.addComponent('render', {
      type: 'cylinder',
      material: this.createMaterial(new pc.Color(0.25, 0.15, 0.1)),
    });
    pedestal.setLocalScale(1, 1, 1);
    pedestal.setPosition(0, 0.25, 0);
    this.tableEntity.addChild(pedestal);

    this.app.root.addChild(this.tableEntity);
  }

  private createMaterial(color: pc.Color): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.specular = new pc.Color(0.1, 0.1, 0.1);
    material.shininess = 30;
    material.update();
    return material;
  }

  /**
   * Add a participant to the meeting visualization
   */
  addParticipant(config: ParticipantConfig): void {
    if (this.participants.has(config.name)) {
      console.warn(`Participant ${config.name} already exists`);
      return;
    }

    const participant = new Participant(this.app, config);
    this.participants.set(config.name, participant);
    this.arrangeParticipants();
  }

  /**
   * Remove a participant from the visualization
   */
  removeParticipant(name: string): void {
    const participant = this.participants.get(name);
    if (participant) {
      participant.destroy();
      this.participants.delete(name);
      this.arrangeParticipants();
    }
  }

  /**
   * Arrange participants in a circle around the table
   */
  private arrangeParticipants(): void {
    const count = this.participants.size;
    if (count === 0) return;

    const angleStep = (Math.PI * 2) / count;
    const seatRadius = this.TABLE_RADIUS + 1.5;

    let i = 0;
    for (const [, participant] of this.participants) {
      const angle = angleStep * i - Math.PI / 2; // Start at top
      const x = Math.cos(angle) * seatRadius;
      const z = Math.sin(angle) * seatRadius;

      // Face toward center
      const rotation = (angle * 180) / Math.PI + 90;
      participant.setPosition(x, 0, z);
      participant.setRotation(0, rotation, 0);
      i++;
    }
  }

  /**
   * Set the currently speaking participant
   */
  setSpeaking(name: string | null, turnType: 'response' | 'turn' | null): void {
    this.meetingState.speakingParticipant = name;
    this.meetingState.turnType = turnType;

    for (const [pName, participant] of this.participants) {
      if (pName === name) {
        participant.setSpeaking(true, turnType);
      } else {
        participant.setSpeaking(false, null);
      }
    }

    this.updateHUD();
  }

  /**
   * Update meeting state from event
   */
  updateMeetingState(state: Partial<MeetingState>): void {
    this.meetingState = { ...this.meetingState, ...state };
    this.updateHUD();
  }

  /**
   * Update the HUD overlay
   */
  private updateHUD(): void {
    const hud = document.getElementById('hud');
    if (!hud) return;

    const topicEl = hud.querySelector('.meeting-topic');
    const stateEl = hud.querySelector('.meeting-state');
    const roundEl = hud.querySelector('.round-info');

    if (topicEl) {
      topicEl.textContent = this.meetingState.topic || 'Waiting for meeting...';
    }

    if (stateEl) {
      const statusMap: Record<string, string> = {
        waiting: 'Waiting to start',
        active: this.meetingState.speakingParticipant
          ? `${this.meetingState.speakingParticipant} is ${this.meetingState.turnType === 'response' ? 'responding' : 'speaking'}`
          : 'In progress',
        converged: 'Meeting converged!',
        completed: 'Meeting completed',
        failed: 'Meeting failed',
      };
      stateEl.textContent = statusMap[this.meetingState.status] || this.meetingState.status;
    }

    if (roundEl) {
      if (this.meetingState.maxRounds > 0) {
        roundEl.textContent = `Round ${this.meetingState.currentRound} of ${this.meetingState.maxRounds}`;
      } else {
        roundEl.textContent = '';
      }
    }
  }

  /**
   * Clear all participants
   */
  clearParticipants(): void {
    for (const [, participant] of this.participants) {
      participant.destroy();
    }
    this.participants.clear();
  }

  /**
   * Get all participant names
   */
  getParticipantNames(): string[] {
    return Array.from(this.participants.keys());
  }
}
