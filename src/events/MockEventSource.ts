/**
 * MockEventSource - Simulates Bloodbank events for development
 *
 * This allows testing the visualization without a running Bloodbank instance.
 * In production, this would be replaced with a WebSocket connection to Bloodbank.
 */

import { BoardroomScene, MeetingState } from '../scenes/BoardroomScene';

interface TheBoardEvent {
  routing_key: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class MockEventSource {
  private scene: BoardroomScene;
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

  constructor(scene: BoardroomScene) {
    this.scene = scene;
  }

  /**
   * Start a demo simulation
   */
  startDemo(): void {
    console.log('Starting demo simulation...');

    // Simulate meeting creation
    setTimeout(() => this.simulateEvent('theboard.meeting.created', {
      meeting_id: 'demo-meeting-001',
      topic: this.DEMO_TOPIC,
      strategy: 'sequential',
      max_rounds: 5,
      agent_count: this.DEMO_PARTICIPANTS.length,
    }), 500);

    // Add participants one by one
    this.DEMO_PARTICIPANTS.forEach((p, i) => {
      setTimeout(() => this.simulateEvent('theboard.participant.added', {
        meeting_id: 'demo-meeting-001',
        agent_name: p.name,
        agent_role: p.role,
      }), 1000 + i * 300);
    });

    // Start the meeting
    setTimeout(() => this.simulateEvent('theboard.meeting.started', {
      meeting_id: 'demo-meeting-001',
      topic: this.DEMO_TOPIC,
      participant_count: this.DEMO_PARTICIPANTS.length,
    }), 2500);

    // Start the speaking rounds
    setTimeout(() => this.startRounds(), 3500);
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

      // Start turn
      this.simulateEvent('theboard.participant.turn_started', {
        meeting_id: 'demo-meeting-001',
        agent_name: participant.name,
        round_num: this.currentRound,
        turn_type: 'turn',
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
            }, 1000);

            // Restart demo after a pause
            setTimeout(() => {
              this.scene.clearParticipants();
              this.scene.updateMeetingState({
                status: 'waiting',
                topic: '',
                currentRound: 0,
              });
              this.startDemo();
            }, 5000);
          }

          if (this.currentRound > 5) {
            this.stopDemo();
            this.simulateEvent('theboard.meeting.completed', {
              meeting_id: 'demo-meeting-001',
              total_rounds: this.currentRound - 1,
            });
          }
        }
      }, 2000 + Math.random() * 1000);

    }, 3500);
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
        break;

      case 'theboard.participant.added':
        this.scene.addParticipant({
          name: event.payload.agent_name as string,
          role: event.payload.agent_role as string,
        });
        break;

      case 'theboard.meeting.started':
        this.scene.updateMeetingState({
          status: 'active',
          currentRound: 1,
        });
        break;

      case 'theboard.participant.turn_started':
        this.scene.setSpeaking(
          event.payload.agent_name as string,
          (event.payload.turn_type as 'response' | 'turn') || 'turn'
        );
        this.scene.updateMeetingState({
          currentRound: event.payload.round_num as number,
        });
        break;

      case 'theboard.participant.turn_completed':
        this.scene.setSpeaking(null, null);
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
        break;

      case 'theboard.meeting.completed':
        this.scene.updateMeetingState({
          status: 'completed',
        });
        this.scene.setSpeaking(null, null);
        break;

      case 'theboard.meeting.failed':
        this.scene.updateMeetingState({
          status: 'failed',
        });
        this.scene.setSpeaking(null, null);
        break;
    }
  }
}
