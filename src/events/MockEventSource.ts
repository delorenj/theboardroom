/**
 * MockEventSource - Simulates Bloodbank events for development
 *
 * This allows testing the visualization without a running Bloodbank instance.
 * In production, this would be replaced with a WebSocket connection to Bloodbank.
 */

import { BoardroomScene } from '../scenes/BoardroomScene';
import { HUDController } from '../ui/HUDController';

interface TheBoardEvent {
  routing_key: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class MockEventSource {
  private scene: BoardroomScene;
  private hud: HUDController;
  private demoInterval: ReturnType<typeof setInterval> | null = null;
  private currentRound = 0;
  private participantIndex = 0;

  private readonly DEMO_PARTICIPANTS = [
    { name: 'Alice', role: 'Facilitator' },
    { name: 'Bob', role: 'Developer' },
    { name: 'Charlie', role: 'Designer' },
    { name: 'Diana', role: 'PM' },
    { name: 'Eve', role: 'QA' },
  ];

  private readonly DEMO_TOPIC = 'How should we implement the new authentication system?';

  constructor(scene: BoardroomScene, hud: HUDController) {
    this.scene = scene;
    this.hud = hud;
  }

  /**
   * Start a demo simulation
   */
  startDemo(): void {
    console.log('Starting demo simulation...');
    this.hud.setConnectionStatus('connecting');

    // Simulate connection
    setTimeout(() => {
      this.hud.setConnectionStatus('connected');
    }, 800);

    // Simulate meeting creation
    setTimeout(() => this.simulateEvent('theboard.meeting.created', {
      meeting_id: 'demo-meeting-001',
      topic: this.DEMO_TOPIC,
      strategy: 'sequential',
      max_rounds: 5,
      agent_count: this.DEMO_PARTICIPANTS.length,
    }), 1500);

    // Add participants one by one
    this.DEMO_PARTICIPANTS.forEach((p, i) => {
      setTimeout(() => this.simulateEvent('theboard.participant.added', {
        meeting_id: 'demo-meeting-001',
        agent_name: p.name,
        agent_role: p.role,
      }), 2000 + i * 400);
    });

    // Start the meeting
    setTimeout(() => this.simulateEvent('theboard.meeting.started', {
      meeting_id: 'demo-meeting-001',
      topic: this.DEMO_TOPIC,
      participant_count: this.DEMO_PARTICIPANTS.length,
    }), 4500);

    // Start the speaking rounds
    setTimeout(() => this.startRounds(), 5500);
  }

  /**
   * Stop the demo
   */
  stopDemo(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
  }

  private startRounds(): void {
    this.currentRound = 1;
    this.participantIndex = 0;

    // Simulate speaking turns
    this.demoInterval = setInterval(() => {
      const participant = this.DEMO_PARTICIPANTS[this.participantIndex];
      if (!participant) return;

      // Determine turn type (first person each round is a "turn", others are "responses")
      const turnType = this.participantIndex === 0 ? 'turn' : 'response';

      // Start turn
      this.simulateEvent('theboard.participant.turn_started', {
        meeting_id: 'demo-meeting-001',
        agent_name: participant.name,
        round_num: this.currentRound,
        turn_type: turnType,
      });

      // End turn after a delay
      setTimeout(() => {
        this.simulateEvent('theboard.participant.turn_completed', {
          meeting_id: 'demo-meeting-001',
          agent_name: participant.name,
          round_num: this.currentRound,
          response_length: Math.floor(Math.random() * 500) + 100,
        });

        this.participantIndex++;

        // Check if round is complete
        if (this.participantIndex >= this.DEMO_PARTICIPANTS.length) {
          this.simulateEvent('theboard.meeting.round_completed', {
            meeting_id: 'demo-meeting-001',
            round_num: this.currentRound,
            agent_name: participant.name,
            comment_count: Math.floor(Math.random() * 5) + 1,
            avg_novelty: Math.random() * 0.5 + 0.3,
          });

          this.currentRound++;
          this.participantIndex = 0;

          // Bump novelty at start of new round
          this.hud.setNovelty(60 + Math.random() * 30);

          // Check if meeting should converge
          if (this.currentRound > 3 && Math.random() > 0.5) {
            this.stopDemo();
            this.simulateEvent('theboard.meeting.converged', {
              meeting_id: 'demo-meeting-001',
              round_num: this.currentRound - 1,
              reason: 'High consensus reached',
            });

            setTimeout(() => {
              this.simulateEvent('theboard.meeting.completed', {
                meeting_id: 'demo-meeting-001',
                total_rounds: this.currentRound - 1,
                total_comments: Math.floor(Math.random() * 20) + 10,
              });
            }, 2000);

            // Restart demo after a pause
            setTimeout(() => {
              this.resetAndRestart();
            }, 6000);
          }

          if (this.currentRound > 5) {
            this.stopDemo();
            this.simulateEvent('theboard.meeting.completed', {
              meeting_id: 'demo-meeting-001',
              total_rounds: this.currentRound - 1,
            });

            // Restart demo after a pause
            setTimeout(() => {
              this.resetAndRestart();
            }, 5000);
          }
        }
      }, 2500 + Math.random() * 1000);

    }, 4000);
  }

  private resetAndRestart(): void {
    this.scene.clearParticipants();
    this.hud.reset();
    this.scene.updateMeetingState({
      status: 'waiting',
      topic: '',
      currentRound: 0,
    });
    this.currentRound = 0;
    this.participantIndex = 0;
    this.startDemo();
  }

  /**
   * Simulate receiving an event from Bloodbank
   */
  private simulateEvent(routingKey: string, payload: Record<string, unknown>): void {
    const event: TheBoardEvent = {
      routing_key: routingKey,
      payload,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Event] ${routingKey}`, payload);
    this.handleEvent(event);
  }

  /**
   * Handle incoming events
   */
  private handleEvent(event: TheBoardEvent): void {
    switch (event.routing_key) {
      case 'theboard.meeting.created':
        this.scene.updateMeetingState({
          meetingId: event.payload.meeting_id as string,
          topic: event.payload.topic as string,
          status: 'waiting',
          maxRounds: event.payload.max_rounds as number,
        });
        this.hud.setMeetingInfo(
          event.payload.topic as string,
          event.payload.max_rounds as number
        );
        break;

      case 'theboard.participant.added':
        this.scene.addParticipant({
          name: event.payload.agent_name as string,
          role: event.payload.agent_role as string,
        });
        this.hud.addParticipant(
          event.payload.agent_name as string,
          event.payload.agent_role as string
        );
        break;

      case 'theboard.meeting.started':
        this.scene.updateMeetingState({
          status: 'active',
          currentRound: 1,
        });
        this.hud.setRound(1);
        break;

      case 'theboard.participant.turn_started':
        this.scene.setSpeaking(
          event.payload.agent_name as string,
          (event.payload.turn_type as 'response' | 'turn') || 'turn'
        );
        this.scene.updateMeetingState({
          currentRound: event.payload.round_num as number,
        });
        this.hud.setSpeaker(
          event.payload.agent_name as string,
          (event.payload.turn_type as 'response' | 'turn') || 'turn'
        );
        this.hud.setRound(event.payload.round_num as number);
        break;

      case 'theboard.participant.turn_completed':
        this.scene.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        break;

      case 'theboard.meeting.round_completed':
        this.scene.updateMeetingState({
          currentRound: event.payload.round_num as number,
        });
        break;

      case 'theboard.meeting.converged':
        this.scene.updateMeetingState({
          status: 'converged',
        });
        this.scene.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        this.hud.setMeetingStatus('converged');
        break;

      case 'theboard.meeting.completed':
        this.scene.updateMeetingState({
          status: 'completed',
        });
        this.scene.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        this.hud.setMeetingStatus('completed');
        break;

      case 'theboard.meeting.failed':
        this.scene.updateMeetingState({
          status: 'failed',
        });
        this.scene.setSpeaking(null, null);
        this.hud.setSpeaker(null, null);
        this.hud.setMeetingStatus('failed');
        break;
    }
  }
}
