/**
 * theboardroom - Real-time meeting visualization
 *
 * A PlayCanvas-based visualization of theboard multi-agent meetings.
 * Connects to Bloodbank event bus to receive real-time meeting events.
 */

import * as pc from 'playcanvas';
import { BoardroomScene } from './scenes/BoardroomScene';
import { MockEventSource } from './events/MockEventSource';

// Initialize PlayCanvas
const canvas = document.createElement('canvas');
canvas.id = 'playcanvas';
document.getElementById('app')!.appendChild(canvas);

// Create graphics device
const gfxOptions = {
  deviceTypes: ['webgl2', 'webgl1'],
  glslangUrl: '/glslang.js',
  twgslUrl: '/twgsl.js',
};

pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {
  // Create app
  const app = new pc.Application(canvas, {
    graphicsDevice: device,
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
  });

  // Fill window
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  // Resize handler
  window.addEventListener('resize', () => app.resizeCanvas());

  // Start the app
  app.start();

  // Create the boardroom scene
  const scene = new BoardroomScene(app);
  scene.initialize();

  // For development: use mock event source
  // In production: connect to Bloodbank via WebSocket
  const eventSource = new MockEventSource(scene);
  eventSource.startDemo();

  // Update HUD connection status
  updateConnectionStatus('connecting');
  setTimeout(() => updateConnectionStatus('connected'), 1000);

  console.log('theboardroom initialized');
});

function updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting') {
  const el = document.getElementById('connection-status');
  if (el) {
    el.className = status;
    el.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// Export for debugging
(window as any).theboardroom = {
  updateConnectionStatus,
};
