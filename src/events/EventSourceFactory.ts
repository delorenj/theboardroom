/**
 * EventSourceFactory - Creates the appropriate event source based on configuration
 *
 * Selection priority:
 * 1. If VITE_BLOODBANK_WS_URL is set and connection succeeds: BloodbankEventSource
 * 2. If connection fails or URL not set: MockEventSource2D (demo mode)
 *
 * This allows seamless switching between live and demo modes.
 */

import { BoardroomScene2D } from '../scenes/BoardroomScene2D';
import { HUDController } from '../ui/HUDController';
import { ParticipantManager } from '../managers/ParticipantManager';
import { BloodbankEventSource } from './BloodbankEventSource';
import { MockEventSource2D } from './MockEventSource2D';

export interface EventSource {
  connect?(): Promise<void>;
  disconnect?(): void;
  startDemo?(): void;
  stopDemo?(): void;
}

export type EventSourceType = 'bloodbank' | 'mock' | 'auto';

export interface EventSourceOptions {
  type?: EventSourceType;
  bloodbankUrl?: string;
  connectionTimeout?: number;
}

const DEFAULT_OPTIONS: Required<EventSourceOptions> = {
  type: 'auto',
  bloodbankUrl: import.meta.env.VITE_BLOODBANK_WS_URL || '',
  connectionTimeout: 5000,
};

/**
 * Create an event source based on configuration and availability
 */
export async function createEventSource(
  scene: BoardroomScene2D,
  hud: HUDController,
  participantManager: ParticipantManager,
  options: EventSourceOptions = {}
): Promise<EventSource> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Force mock mode
  if (config.type === 'mock') {
    console.log('[EventSourceFactory] Using mock event source (forced)');
    return createMockSource(scene, hud, participantManager);
  }

  // Force Bloodbank mode
  if (config.type === 'bloodbank') {
    console.log('[EventSourceFactory] Using Bloodbank event source (forced)');
    return createBloodbankSource(scene, hud, participantManager, config.bloodbankUrl);
  }

  // Auto mode: try Bloodbank, fall back to mock
  if (config.bloodbankUrl) {
    console.log('[EventSourceFactory] Attempting Bloodbank connection...');
    try {
      const source = await createBloodbankSourceWithTimeout(
        scene,
        hud,
        participantManager,
        config.bloodbankUrl,
        config.connectionTimeout
      );
      console.log('[EventSourceFactory] Connected to Bloodbank');
      return source;
    } catch (error) {
      console.warn('[EventSourceFactory] Bloodbank unavailable, falling back to mock:', error);
      return createMockSource(scene, hud, participantManager);
    }
  }

  // No Bloodbank URL configured, use mock
  console.log('[EventSourceFactory] No Bloodbank URL configured, using mock');
  return createMockSource(scene, hud, participantManager);
}

/**
 * Create mock event source
 */
function createMockSource(scene: BoardroomScene2D, hud: HUDController, participantManager: ParticipantManager): EventSource {
  const mock = new MockEventSource2D(scene, hud, participantManager);
  return {
    startDemo: () => mock.startDemo(),
    stopDemo: () => mock.stopDemo(),
  };
}

/**
 * Create Bloodbank event source
 */
function createBloodbankSource(
  scene: BoardroomScene2D,
  hud: HUDController,
  participantManager: ParticipantManager,
  wsUrl: string
): EventSource {
  const bloodbank = new BloodbankEventSource(scene, hud, participantManager, { wsUrl });
  return {
    connect: async () => await bloodbank.connect(),
    disconnect: () => bloodbank.disconnect(),
  };
}

/**
 * Create Bloodbank source with connection timeout
 */
async function createBloodbankSourceWithTimeout(
  scene: BoardroomScene2D,
  hud: HUDController,
  participantManager: ParticipantManager,
  wsUrl: string,
  timeout: number
): Promise<EventSource> {
  const bloodbank = new BloodbankEventSource(scene, hud, participantManager, { wsUrl });

  // Create a promise that resolves when connected or rejects on timeout
  const connectionPromise = new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Connection timeout after ${timeout}ms`));
    }, timeout);

    // Check connection status periodically
    const checkInterval = setInterval(() => {
      if (bloodbank.connected) {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  // Start connection
  bloodbank.connect();

  // Wait for connection or timeout
  await connectionPromise;

  return {
    connect: () => bloodbank.connect(),
    disconnect: () => bloodbank.disconnect(),
  };
}

/**
 * Determine if running in demo mode (no Bloodbank)
 */
export function isDemoMode(): boolean {
  return !import.meta.env.VITE_BLOODBANK_WS_URL;
}
