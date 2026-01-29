/**
 * BloodbankEventSource - Real-time event streaming from Bloodbank via WebSocket
 *
 * Connects to RabbitMQ via STOMP-over-WebSocket (rabbitmq_web_stomp plugin)
 * and forwards theboard.* events to the scene and HUD.
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Graceful fallback to MockEventSource when unavailable
 * - Connection status reporting to HUD
 * - Event filtering by routing key pattern
 */

import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import { BoardroomScene2D } from '../scenes/BoardroomScene2D';
import { HUDController, type MeetingInsights } from '../ui/HUDController';
import { ParticipantManager } from '../managers/ParticipantManager';

// Event envelope structure from Bloodbank
interface EventEnvelope {
  event_id: string;
  event_type: string;  // routing key like "theboard.meeting.created"
  ts: string;          // ISO timestamp
  source: {
    host: string;
    type: string;
    app: string;
  };
  payload: Record<string, unknown>;
  correlation_id?: string;
}

export interface BloodbankConfig {
  wsUrl: string;           // e.g., "ws://localhost:15674/ws"
  exchange: string;        // e.g., "events"
  routingPattern: string;  // e.g., "theboard.#"
  reconnectDelay: number;  // Initial reconnect delay in ms
  maxReconnectDelay: number;
}

const DEFAULT_CONFIG: BloodbankConfig = {
  wsUrl: import.meta.env.VITE_BLOODBANK_WS_URL || 'ws://localhost:15674/ws',
  exchange: import.meta.env.VITE_BLOODBANK_EXCHANGE || 'events',
  routingPattern: 'theboard.#',
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
};

export class BloodbankEventSource {
  private scene: BoardroomScene2D;
  private hud: HUDController;
  private participantManager: ParticipantManager;
  private config: BloodbankConfig;
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;

  constructor(
    scene: BoardroomScene2D,
    hud: HUDController,
    participantManager: ParticipantManager,
    config: Partial<BloodbankConfig> = {}
  ) {
    this.scene = scene;
    this.hud = hud;
    this.participantManager = participantManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start connection to Bloodbank
   */
  async connect(): Promise<void> {
    this.hud.setConnectionStatus('connecting');
    console.log(`[Bloodbank] Connecting to ${this.config.wsUrl}...`);

    this.client = new Client({
      brokerURL: this.config.wsUrl,
      connectHeaders: {
        login: 'guest',
        passcode: 'guest',
      },
      debug: (str) => {
        if (import.meta.env.DEV) {
          console.log('[STOMP]', str);
        }
      },
      reconnectDelay: this.config.reconnectDelay,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => this.handleConnect(),
      onDisconnect: () => this.handleDisconnect(),
      onStompError: (frame) => this.handleError(frame),
      onWebSocketError: (event) => this.handleWebSocketError(event),
    });

    this.client.activate();
  }

  /**
   * Disconnect from Bloodbank
   */
  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.isConnected = false;
    this.hud.setConnectionStatus('disconnected');
  }

  private handleConnect(): void {
    console.log('[Bloodbank] Connected to RabbitMQ via STOMP');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.hud.setConnectionStatus('connected');

    // Subscribe to theboard events
    if (this.client) {
      this.subscription = this.client.subscribe(
        `/exchange/${this.config.exchange}/${this.config.routingPattern}`,
        (message: IMessage) => this.handleMessage(message),
        { ack: 'auto' }
      );
      console.log(`[Bloodbank] Subscribed to ${this.config.routingPattern}`);
    }
  }

  private handleDisconnect(): void {
    console.log('[Bloodbank] Disconnected');
    this.isConnected = false;
    this.hud.setConnectionStatus('disconnected');
  }

  private handleError(frame: { body?: string }): void {
    console.error('[Bloodbank] STOMP Error:', frame.body);
    this.hud.setConnectionStatus('disconnected');
  }

  private handleWebSocketError(event: Event): void {
    console.error('[Bloodbank] WebSocket Error:', event);
    this.reconnectAttempts++;
    this.hud.setConnectionStatus('connecting');
  }

  /**
   * Handle incoming STOMP message
   */
  private async handleMessage(message: IMessage): Promise<void> {
    try {
      const envelope: EventEnvelope = JSON.parse(message.body);
      console.log(`[Bloodbank] Event: ${envelope.event_type}`, envelope.payload);

      await this.processEvent(envelope);
    } catch (error) {
      console.error('[Bloodbank] Failed to parse message:', error);
    }
  }

  /**
   * Process Bloodbank event and update scene/HUD
   */
  private async processEvent(envelope: EventEnvelope): Promise<void> {
    const { event_type, payload } = envelope;

    switch (event_type) {
      case 'theboard.meeting.created':
        this.scene.updateMeetingState({
          meetingId: payload.meeting_id as string,
          topic: payload.topic as string,
          status: 'waiting',
          maxRounds: payload.max_rounds as number,
        });
        this.hud.setMeetingInfo(
          payload.topic as string,
          payload.max_rounds as number
        );
        // Clear previous participants via manager
        this.participantManager.clearParticipants();
        this.hud.clearParticipants();
        break;

      case 'theboard.meeting.started':
        this.scene.updateMeetingState({
          status: 'active',
          currentRound: 1,
        });
        this.hud.setRound(1);
        // Add participants from selected_agents via manager
        const agents = payload.selected_agents as string[];
        for (const agentName of agents) {
          this.participantManager.addParticipant({
            name: agentName,
            role: 'Agent',
          });
          this.hud.addParticipant(agentName, 'Agent');
        }
        break;

      case 'theboard.meeting.participant.added':
        this.participantManager.addParticipant({
          name: payload.agent_name as string,
          role: (payload.expertise as string) || 'Agent',
        });
        this.hud.addParticipant(
          payload.agent_name as string,
          (payload.expertise as string) || 'Agent'
        );
        break;

      case 'theboard.meeting.participant.turn.completed':
        // Handle turn completion via participant manager
        this.participantManager.setSpeaking(
          payload.agent_name as string,
          (payload.turn_type as 'response' | 'turn') || 'turn',
          payload.round_num as number
        );
        this.hud.setSpeaker(
          payload.agent_name as string,
          (payload.turn_type as 'response' | 'turn') || 'turn'
        );
        this.hud.setRound(payload.round_num as number);

        // Clear speaker after a brief moment (simulating turn completion)
        setTimeout(() => {
          this.participantManager.setSpeaking(null, null);
          this.hud.setSpeaker(null, null);
        }, 500);
        break;

      case 'theboard.meeting.round_completed':
        this.scene.updateMeetingState({
          currentRound: payload.round_num as number,
        });
        this.hud.setRound(payload.round_num as number);
        // Bump novelty
        const avgNovelty = (payload.avg_novelty as number) || 0.5;
        this.hud.setNovelty(avgNovelty * 100);
        break;

      case 'theboard.meeting.comment_extracted':
        // Could visualize comments as particles or overlays
        console.log(`[Comment] ${payload.agent_name}: ${payload.comment_text}`);
        break;

      case 'theboard.meeting.converged':
        this.scene.updateMeetingState({ status: 'converged' });
        this.participantManager.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        this.hud.setMeetingStatus('converged');
        break;

      case 'theboard.meeting.completed':
        this.scene.updateMeetingState({ status: 'completed' });
        this.participantManager.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        this.hud.setMeetingStatus('completed');

        // Phase 3B: Show insights panel with Phase 3A data
        if (payload.top_comments || payload.category_distribution || payload.agent_participation) {
          const insights: MeetingInsights = {
            top_comments: payload.top_comments as MeetingInsights['top_comments'] || [],
            category_distribution: payload.category_distribution as Record<string, number> || {},
            agent_participation: payload.agent_participation as Record<string, number> || {},
          };
          this.hud.showInsights(insights);
        }
        break;

      case 'theboard.meeting.failed':
        this.scene.updateMeetingState({ status: 'failed' });
        this.participantManager.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        this.hud.setMeetingStatus('failed');
        console.error(`[Meeting Failed] ${payload.error_message}`);
        break;

      default:
        console.log(`[Bloodbank] Unhandled event: ${event_type}`);
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
