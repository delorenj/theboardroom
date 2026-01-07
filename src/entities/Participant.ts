/**
 * Participant - A crude human avatar for meeting visualization
 *
 * Each participant is a simple humanoid figure that can:
 * - Display their name
 * - Show speaking state with visual indicators
 * - Animate when responding vs taking a turn
 */

import * as pc from 'playcanvas';

export interface ParticipantConfig {
  name: string;
  color?: pc.Color;
  role?: string;
}

// Predefined colors for participants
const PARTICIPANT_COLORS = [
  new pc.Color(0.9, 0.4, 0.4),   // Red
  new pc.Color(0.4, 0.7, 0.9),   // Blue
  new pc.Color(0.5, 0.9, 0.5),   // Green
  new pc.Color(0.9, 0.7, 0.3),   // Orange
  new pc.Color(0.7, 0.5, 0.9),   // Purple
  new pc.Color(0.9, 0.5, 0.7),   // Pink
  new pc.Color(0.5, 0.9, 0.8),   // Teal
  new pc.Color(0.9, 0.9, 0.5),   // Yellow
];

let colorIndex = 0;

export class Participant {
  private app: pc.Application;
  private entity: pc.Entity;
  private headEntity: pc.Entity;
  private bodyEntity: pc.Entity;
  private speakingIndicator: pc.Entity;
  private config: ParticipantConfig;
  private isSpeaking: boolean = false;
  private speakingTime: number = 0;
  private color: pc.Color;

  constructor(app: pc.Application, config: ParticipantConfig) {
    this.app = app;
    this.config = config;
    this.color = config.color ?? PARTICIPANT_COLORS[colorIndex++ % PARTICIPANT_COLORS.length]!;

    this.entity = new pc.Entity(`participant-${config.name}`);
    this.headEntity = this.createHead();
    this.bodyEntity = this.createBody();
    this.speakingIndicator = this.createSpeakingIndicator();

    this.entity.addChild(this.headEntity);
    this.entity.addChild(this.bodyEntity);
    this.entity.addChild(this.speakingIndicator);

    this.app.root.addChild(this.entity);

    // Register update
    this.app.on('update', this.update, this);
  }

  private createHead(): pc.Entity {
    const head = new pc.Entity('head');
    head.addComponent('render', {
      type: 'sphere',
      material: this.createMaterial(this.color),
    });
    head.setLocalScale(0.5, 0.5, 0.5);
    head.setLocalPosition(0, 1.6, 0);
    return head;
  }

  private createBody(): pc.Entity {
    const body = new pc.Entity('body');
    const bodyColor = this.color.clone();
    bodyColor.lerp(bodyColor, new pc.Color(0.2, 0.2, 0.2), 0.3);
    body.addComponent('render', {
      type: 'capsule',
      material: this.createMaterial(bodyColor),
    });
    body.setLocalScale(0.6, 1, 0.4);
    body.setLocalPosition(0, 0.8, 0);
    return body;
  }

  private createSpeakingIndicator(): pc.Entity {
    const indicator = new pc.Entity('speaking-indicator');

    // Create a ring around the participant
    const ring = new pc.Entity('ring');
    ring.addComponent('render', {
      type: 'torus',
      material: this.createEmissiveMaterial(new pc.Color(0.3, 0.9, 0.4)),
    });
    ring.setLocalScale(1.2, 0.1, 1.2);
    ring.setLocalPosition(0, 0.05, 0);
    indicator.addChild(ring);

    // Initially hidden
    indicator.enabled = false;

    return indicator;
  }

  private createMaterial(color: pc.Color): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.specular = new pc.Color(0.2, 0.2, 0.2);
    material.gloss = 0.5; // replaces shininess in PlayCanvas 2.x
    material.update();
    return material;
  }

  private createEmissiveMaterial(color: pc.Color): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.emissive = color;
    material.emissiveIntensity = 0.8;
    material.update();
    return material;
  }

  /**
   * Set speaking state
   */
  setSpeaking(speaking: boolean, turnType: 'response' | 'turn' | null): void {
    this.isSpeaking = speaking;
    this.speakingIndicator.enabled = speaking;

    if (speaking && turnType) {
      // Change indicator color based on turn type
      const ring = this.speakingIndicator.findByName('ring') as pc.Entity | null;
      if (ring?.render) {
        const color = turnType === 'response'
          ? new pc.Color(0.3, 0.6, 0.9)  // Blue for responses
          : new pc.Color(0.3, 0.9, 0.4); // Green for turns
        const material = this.createEmissiveMaterial(color);
        ring.render.meshInstances[0]!.material = material;
      }
    }
  }

  /**
   * Update animation
   */
  private update(dt: number): void {
    if (this.isSpeaking) {
      this.speakingTime += dt;

      // Subtle bobbing animation when speaking
      const bobAmount = Math.sin(this.speakingTime * 4) * 0.05;
      this.headEntity.setLocalPosition(0, 1.6 + bobAmount, 0);

      // Pulse the indicator
      const scale = 1.2 + Math.sin(this.speakingTime * 3) * 0.1;
      const ring = this.speakingIndicator.findByName('ring') as pc.Entity | null;
      if (ring) {
        ring.setLocalScale(scale, 0.1, scale);
      }
    } else {
      this.speakingTime = 0;
      this.headEntity.setLocalPosition(0, 1.6, 0);
    }
  }

  /**
   * Set position in world space
   */
  setPosition(x: number, y: number, z: number): void {
    this.entity.setPosition(x, y, z);
  }

  /**
   * Set rotation in degrees
   */
  setRotation(x: number, y: number, z: number): void {
    this.entity.setEulerAngles(x, y, z);
  }

  /**
   * Get the participant's name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Destroy the participant entity
   */
  destroy(): void {
    this.app.off('update', this.update, this);
    this.entity.destroy();
  }
}
