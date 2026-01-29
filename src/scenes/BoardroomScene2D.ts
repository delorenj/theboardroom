/**
 * BoardroomScene2D - PixiJS-based 2D meeting visualization
 *
 * A cyberpunk illustrated boardroom scene using PixiJS for
 * sprite-based rendering with particle effects and animations.
 */

import { Application, Container, Graphics, Sprite, Text, TextStyle, BlurFilter, Assets } from 'pixi.js';
import type { ParticipantManager, ParticipantChangeEvent } from '../managers/ParticipantManager';
import { AnimationManager, Easing, pulse, wave } from '../utils/animations';

export interface MeetingState {
  meetingId: string;
  topic: string;
  status: 'waiting' | 'active' | 'converged' | 'completed' | 'failed';
  currentRound: number;
  maxRounds: number;
  speakingParticipant: string | null;
  turnType: 'response' | 'turn' | null;
}

interface Participant2D {
  name: string;
  role: string;
  container: Container;
  avatar: Sprite | Graphics;
  nameLabel: Text;
  glowEffect: Graphics;
  speakingRing?: Graphics;  // Additional ring for speaking indicator
  isSpeaking: boolean;
  animationStartTime?: number;  // Track when speaking animation started
  targetScale?: number;  // Target scale for smooth transitions
}

// Cyberpunk color palette
const COLORS = {
  background: 0x0a0a12,
  tableSurface: 0x1a1a2e,
  tableGlow: 0x00f0ff,
  floorGrid: 0x16213e,
  gridLine: 0x00f0ff,
  participantDefault: 0x2a2a4a,
  participantSpeaking: 0x00f0ff,
  participantResponse: 0xa855f7,
  textPrimary: 0x00f0ff,
  textSecondary: 0x888899,
};

export class BoardroomScene2D {
  private app: Application | null = null;
  private participants: Map<string, Participant2D> = new Map();
  private participantManager: ParticipantManager | null = null;
  private animationManager: AnimationManager = new AnimationManager();
  private tableContainer: Container | null = null;
  private participantsContainer: Container | null = null;
  private effectsContainer: Container | null = null;
  private meetingState: MeetingState = {
    meetingId: '',
    topic: '',
    status: 'waiting',
    currentRound: 0,
    maxRounds: 0,
    speakingParticipant: null,
    turnType: null,
  };

  private readonly TABLE_RADIUS = 150;
  private readonly SEAT_RADIUS = 220;

  /**
   * Set the participant manager and subscribe to changes
   */
  setParticipantManager(manager: ParticipantManager): void {
    this.participantManager = manager;

    // Subscribe to participant changes
    manager.subscribe((event: ParticipantChangeEvent) => {
      this.handleParticipantChange(event);
    });
  }

  /**
   * Handle participant manager events
   */
  private async handleParticipantChange(event: ParticipantChangeEvent): Promise<void> {
    switch (event.type) {
      case 'added':
        if (event.participant) {
          await this.addParticipant({
            name: event.participant.entity.name,
            role: event.participant.entity.role,
          });
        }
        break;

      case 'removed':
        if (event.participant) {
          this.removeParticipant(event.participant.entity.name);
        }
        break;

      case 'state_changed':
        if (event.participant) {
          // Update single participant visual state
          const visual2D = this.participants.get(event.participant.entity.name);
          if (visual2D) {
            this.updateParticipantVisualState(visual2D, event.participant.state.isSpeaking, event.participant.state.turnType);
          }
        } else if (event.participants) {
          // Update all participants
          for (const participant of event.participants) {
            const visual2D = this.participants.get(participant.entity.name);
            if (visual2D) {
              this.updateParticipantVisualState(visual2D, participant.state.isSpeaking, participant.state.turnType);
            }
          }
        }
        break;

      case 'position_changed':
        // Positions are recalculated, but arrangeParticipants() handles this
        break;

      case 'cleared':
        this.clearParticipants();
        break;
    }
  }

  /**
   * Update a single participant's visual state with smooth animations
   */
  private updateParticipantVisualState(
    participant: Participant2D,
    isSpeaking: boolean,
    turnType: 'response' | 'turn' | null
  ): void {
    const wasSpeaking = participant.isSpeaking;
    participant.isSpeaking = isSpeaking;

    if (isSpeaking && !wasSpeaking) {
      // Start speaking - animate in
      participant.animationStartTime = Date.now();
      participant.targetScale = 1.15;

      // Animate scale
      const currentScale = participant.container.scale.x;
      this.animationManager.start(
        `scale-${participant.name}`,
        currentScale,
        1.15,
        300,  // 300ms duration
        Easing.easeOutBack  // Slight overshoot for emphasis
      );

      // Update glow color based on turn type
      const glowColor = turnType === 'response' ? COLORS.participantResponse : COLORS.participantSpeaking;
      participant.glowEffect.clear();
      participant.glowEffect.circle(0, 0, 50);
      participant.glowEffect.fill({ color: glowColor, alpha: 0 });
      participant.glowEffect.visible = true;

      // Animate glow alpha
      this.animationManager.start(
        `glow-alpha-${participant.name}`,
        0,
        0.5,
        300,
        Easing.easeOutQuad
      );

      // Create/update speaking ring
      if (!participant.speakingRing) {
        participant.speakingRing = new Graphics();
        participant.container.addChild(participant.speakingRing);
      }

      // Draw speaking ring with turn type color
      const ringColor = turnType === 'response' ? COLORS.participantResponse : COLORS.participantSpeaking;
      participant.speakingRing.clear();
      participant.speakingRing.circle(0, 0, 45);
      participant.speakingRing.stroke({ width: 3, color: ringColor, alpha: 0 });

      // Animate ring alpha
      this.animationManager.start(
        `ring-alpha-${participant.name}`,
        0,
        0.8,
        300,
        Easing.easeOutQuad
      );

    } else if (!isSpeaking && wasSpeaking) {
      // Stop speaking - animate out
      participant.animationStartTime = undefined;
      participant.targetScale = 1.0;

      // Animate scale back
      const currentScale = participant.container.scale.x;
      this.animationManager.start(
        `scale-${participant.name}`,
        currentScale,
        1.0,
        400,  // Slightly longer for smooth exit
        Easing.easeOutCubic
      );

      // Animate glow alpha out
      this.animationManager.start(
        `glow-alpha-${participant.name}`,
        participant.glowEffect.alpha,
        0,
        400,
        Easing.easeOutQuad,
        () => {
          participant.glowEffect.visible = false;
        }
      );

      // Animate ring alpha out
      if (participant.speakingRing) {
        this.animationManager.start(
          `ring-alpha-${participant.name}`,
          participant.speakingRing.alpha,
          0,
          400,
          Easing.easeOutQuad,
          () => {
            if (participant.speakingRing) {
              participant.speakingRing.visible = false;
            }
          }
        );
      }
    }
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Create PixiJS application
    this.app = new Application();

    await this.app.init({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Create scene layers
    this.createBackground();
    this.createTable();

    this.participantsContainer = new Container();
    this.app.stage.addChild(this.participantsContainer);

    this.effectsContainer = new Container();
    this.app.stage.addChild(this.effectsContainer);

    // Center everything
    this.centerScene();

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());

    // Start animation loop
    this.app.ticker.add(() => this.animate());
  }

  private centerScene(): void {
    if (!this.app) return;

    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;

    if (this.tableContainer) {
      this.tableContainer.x = centerX;
      this.tableContainer.y = centerY;
    }

    if (this.participantsContainer) {
      this.participantsContainer.x = centerX;
      this.participantsContainer.y = centerY;
    }

    if (this.effectsContainer) {
      this.effectsContainer.x = centerX;
      this.effectsContainer.y = centerY;
    }
  }

  private handleResize(): void {
    if (!this.app) return;

    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.centerScene();
  }

  private createBackground(): void {
    if (!this.app) return;

    const bg = new Graphics();

    // Dark gradient background
    bg.rect(0, 0, this.app.screen.width * 2, this.app.screen.height * 2);
    bg.fill(COLORS.background);

    // Grid floor effect
    const gridContainer = new Container();
    const gridSize = 40;
    const gridExtent = 800;

    for (let x = -gridExtent; x <= gridExtent; x += gridSize) {
      const line = new Graphics();
      line.moveTo(x, -gridExtent);
      line.lineTo(x, gridExtent);
      line.stroke({ width: 1, color: COLORS.gridLine, alpha: 0.1 });
      gridContainer.addChild(line);
    }

    for (let y = -gridExtent; y <= gridExtent; y += gridSize) {
      const line = new Graphics();
      line.moveTo(-gridExtent, y);
      line.lineTo(gridExtent, y);
      line.stroke({ width: 1, color: COLORS.gridLine, alpha: 0.1 });
      gridContainer.addChild(line);
    }

    gridContainer.x = this.app.screen.width / 2;
    gridContainer.y = this.app.screen.height / 2;

    this.app.stage.addChild(bg);
    this.app.stage.addChild(gridContainer);
  }

  private createTable(): void {
    if (!this.app) return;

    this.tableContainer = new Container();

    // Outer glow ring
    const outerGlow = new Graphics();
    outerGlow.circle(0, 0, this.TABLE_RADIUS + 20);
    outerGlow.fill({ color: COLORS.tableGlow, alpha: 0.1 });
    outerGlow.filters = [new BlurFilter({ strength: 15 })];
    this.tableContainer.addChild(outerGlow);

    // Table surface
    const table = new Graphics();
    table.circle(0, 0, this.TABLE_RADIUS);
    table.fill(COLORS.tableSurface);
    table.stroke({ width: 2, color: COLORS.tableGlow, alpha: 0.6 });
    this.tableContainer.addChild(table);

    // Inner ring decoration
    const innerRing = new Graphics();
    innerRing.circle(0, 0, this.TABLE_RADIUS - 30);
    innerRing.stroke({ width: 1, color: COLORS.tableGlow, alpha: 0.3 });
    this.tableContainer.addChild(innerRing);

    // Center hologram effect
    const centerGlow = new Graphics();
    centerGlow.circle(0, 0, 40);
    centerGlow.fill({ color: COLORS.tableGlow, alpha: 0.2 });
    centerGlow.filters = [new BlurFilter({ strength: 10 })];
    this.tableContainer.addChild(centerGlow);

    this.app.stage.addChild(this.tableContainer);
  }

  /**
   * Add a participant to the meeting visualization
   */
  async addParticipant(config: { name: string; role: string }): Promise<void> {
    if (!this.app || !this.participantsContainer) return;
    if (this.participants.has(config.name)) return;

    const container = new Container();

    // Glow effect (hidden by default)
    const glowEffect = new Graphics();
    glowEffect.circle(0, 0, 50);
    glowEffect.fill({ color: COLORS.participantSpeaking, alpha: 0.3 });
    glowEffect.filters = [new BlurFilter({ strength: 20 })];
    glowEffect.visible = false;
    container.addChild(glowEffect);

    // Try to load portrait image, fall back to generated avatar
    let avatar: Sprite | Graphics;
    const portraitPath = `/portraits/${config.name.toLowerCase()}.png`;

    try {
      const texture = await Assets.load(portraitPath);
      avatar = new Sprite(texture);
      avatar.anchor.set(0.5);
      avatar.width = 70;
      avatar.height = 70;

      // Create circular mask
      const mask = new Graphics();
      mask.circle(0, 0, 35);
      mask.fill(0xffffff);
      avatar.mask = mask;
      container.addChild(mask);
    } catch {
      // Fallback to generated avatar
      avatar = new Graphics();
      avatar.circle(0, 0, 35);
      avatar.fill(COLORS.participantDefault);
      avatar.stroke({ width: 2, color: COLORS.tableGlow, alpha: 0.5 });
    }
    container.addChild(avatar);

    // Outer ring
    const ring = new Graphics();
    ring.circle(0, 0, 40);
    ring.stroke({ width: 2, color: COLORS.tableGlow, alpha: 0.5 });
    container.addChild(ring);

    // Name label
    const nameStyle = new TextStyle({
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 12,
      fill: COLORS.textPrimary,
      align: 'center',
    });
    const nameLabel = new Text({ text: config.name, style: nameStyle });
    nameLabel.anchor.set(0.5);
    nameLabel.y = 55;
    container.addChild(nameLabel);

    // Role label
    const roleStyle = new TextStyle({
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: 10,
      fill: COLORS.textSecondary,
      align: 'center',
    });
    const roleLabel = new Text({ text: config.role, style: roleStyle });
    roleLabel.anchor.set(0.5);
    roleLabel.y = 70;
    container.addChild(roleLabel);

    this.participantsContainer.addChild(container);

    const participant: Participant2D = {
      name: config.name,
      role: config.role,
      container,
      avatar,
      nameLabel,
      glowEffect,
      isSpeaking: false,
    };

    this.participants.set(config.name, participant);
    this.arrangeParticipants();
  }

  /**
   * Remove a participant from the visualization
   */
  removeParticipant(name: string): void {
    const participant = this.participants.get(name);
    if (participant && this.participantsContainer) {
      this.participantsContainer.removeChild(participant.container);
      participant.container.destroy({ children: true });
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
    let i = 0;

    for (const [, participant] of this.participants) {
      const angle = angleStep * i - Math.PI / 2; // Start at top
      const x = Math.cos(angle) * this.SEAT_RADIUS;
      const y = Math.sin(angle) * this.SEAT_RADIUS;

      participant.container.x = x;
      participant.container.y = y;
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
        participant.isSpeaking = true;
        participant.glowEffect.visible = true;

        // Update glow color based on turn type
        const glowColor = turnType === 'response' ? COLORS.participantResponse : COLORS.participantSpeaking;
        participant.glowEffect.clear();
        participant.glowEffect.circle(0, 0, 50);
        participant.glowEffect.fill({ color: glowColor, alpha: 0.4 });

        // Scale up slightly
        participant.container.scale.set(1.15);
      } else {
        participant.isSpeaking = false;
        participant.glowEffect.visible = false;
        participant.container.scale.set(1.0);
      }
    }
  }

  /**
   * Update meeting state from event
   */
  updateMeetingState(state: Partial<MeetingState>): void {
    this.meetingState = { ...this.meetingState, ...state };
  }

  /**
   * Animation loop
   */
  private animate(): void {
    const currentTime = Date.now();

    // Update all animations
    const animationValues = this.animationManager.update(currentTime);

    // Apply animation values to participants
    for (const [, participant] of this.participants) {
      // Apply scale animation
      const scaleKey = `scale-${participant.name}`;
      if (animationValues.has(scaleKey)) {
        const scale = animationValues.get(scaleKey)!;
        participant.container.scale.set(scale, scale);
      }

      // Apply glow alpha animation
      const glowKey = `glow-alpha-${participant.name}`;
      if (animationValues.has(glowKey)) {
        participant.glowEffect.alpha = animationValues.get(glowKey)!;
      }

      // Apply ring alpha animation
      const ringKey = `ring-alpha-${participant.name}`;
      if (animationValues.has(ringKey) && participant.speakingRing) {
        participant.speakingRing.alpha = animationValues.get(ringKey)!;
      }

      // Add subtle pulse to speaking glow
      if (participant.isSpeaking && participant.glowEffect.visible) {
        const pulseOffset = pulse(currentTime / 1000, 2, -0.1, 0.1);
        participant.glowEffect.alpha = Math.min(1, participant.glowEffect.alpha + pulseOffset);
      }
    }

    // Rotate center glow effect
    if (this.tableContainer && this.tableContainer.children.length > 3) {
      const centerGlow = this.tableContainer.children[3];
      if (centerGlow) {
        centerGlow.rotation += 0.01;
      }
    }
  }

  /**
   * Clear all participants
   */
  clearParticipants(): void {
    for (const [, participant] of this.participants) {
      if (this.participantsContainer) {
        this.participantsContainer.removeChild(participant.container);
      }
      participant.container.destroy({ children: true });
    }
    this.participants.clear();
  }

  /**
   * Get all participant names
   */
  getParticipantNames(): string[] {
    return Array.from(this.participants.keys());
  }

  /**
   * Destroy the scene
   */
  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
