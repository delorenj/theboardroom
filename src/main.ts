/**
 * theboardroom - Real-time meeting visualization
 *
 * A cyberpunk visualization of theboard multi-agent meetings.
 * Supports both 2D (PixiJS) and 3D (PlayCanvas) rendering modes.
 * Connects to Bloodbank event bus to receive real-time meeting events.
 *
 * Configuration:
 * - VITE_BLOODBANK_WS_URL: WebSocket URL for Bloodbank (leave empty for demo mode)
 * - VITE_RENDER_MODE: "2d" (PixiJS) or "3d" (PlayCanvas)
 * - URL param ?mode=3d: Override to 3D mode
 * - URL param ?source=mock: Force mock event source
 */

import { BoardroomScene2D } from './scenes/BoardroomScene2D';
import { HUDController } from './ui/HUDController';
import { ParticipantManager } from './managers/ParticipantManager';
import { createEventSource, isDemoMode } from './events/EventSourceFactory';
import type { EventSourceType } from './events/EventSourceFactory';

// Check URL params for mode selection
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || import.meta.env.VITE_RENDER_MODE || '2d';
const sourceType = (params.get('source') as EventSourceType) || 'auto';

// Initialize HUD controller first (it manages DOM elements)
const hud = new HUDController();

if (mode === '2d') {
  // 2D Mode: Use PixiJS
  const canvas = document.createElement('canvas');
  canvas.id = 'pixi-canvas';
  canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;';
  document.getElementById('app')!.appendChild(canvas);

  const scene = new BoardroomScene2D();
  const participantManager = new ParticipantManager();

  scene.initialize(canvas).then(async () => {
    // Wire up participant manager to scene
    scene.setParticipantManager(participantManager);

    // Create event source (auto-selects Bloodbank or mock based on config)
    const eventSource = await createEventSource(scene, hud, participantManager, { type: sourceType });

    // Start appropriate source
    if (eventSource.startDemo) {
      // Mock mode - start demo loop
      eventSource.startDemo();
      console.log('theboardroom initialized - 2D cyberpunk edition (demo mode)');
    } else if (eventSource.connect) {
      // Live mode - already connected via factory
      console.log('theboardroom initialized - 2D cyberpunk edition (Bloodbank live)');
    }

    // Show demo badge if in demo mode
    if (isDemoMode()) {
      showDemoBadge();
    }

    // Export for debugging
    (window as any).theboardroom = {
      scene,
      hud,
      participantManager,
      eventSource,
      mode: '2d',
      isDemo: isDemoMode(),
    };
  });
} else {
  // 3D Mode: Use PlayCanvas (legacy)
  import('./scenes/BoardroomScene').then(async ({ BoardroomScene }) => {
    const pc = await import('playcanvas');
    const { MockEventSource } = await import('./events/MockEventSource');

    const canvas = document.createElement('canvas');
    canvas.id = 'playcanvas';
    document.getElementById('app')!.appendChild(canvas);

    const gfxOptions = {
      deviceTypes: ['webgl2', 'webgl1'],
      glslangUrl: '/glslang.js',
      twgslUrl: '/twgsl.js',
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);

    const app = new pc.Application(canvas, {
      graphicsDevice: device,
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
      keyboard: new pc.Keyboard(window),
    });

    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    window.addEventListener('resize', () => app.resizeCanvas());

    app.start();

    const scene = new BoardroomScene(app);
    scene.initialize();

    // 3D mode always uses mock for now
    const eventSource = new MockEventSource(scene, hud);
    eventSource.startDemo();

    console.log('theboardroom initialized - 3D mode (legacy, demo only)');

    (window as any).theboardroom = {
      scene,
      hud,
      eventSource,
      mode: '3d',
      isDemo: true,
    };
  });
}

/**
 * Show demo mode indicator
 */
function showDemoBadge(): void {
  const badge = document.createElement('div');
  badge.id = 'demo-badge';
  badge.innerHTML = 'DEMO MODE';
  badge.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 4px 12px;
    background: rgba(168, 85, 247, 0.8);
    color: white;
    font-family: 'Orbitron', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    border-radius: 2px;
    z-index: 9999;
    pointer-events: none;
  `;
  document.body.appendChild(badge);
}
