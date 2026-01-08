/**
 * theboardroom - Real-time meeting visualization
 *
 * A cyberpunk visualization of theboard multi-agent meetings.
 * Supports both 2D (PixiJS) and 3D (PlayCanvas) rendering modes.
 * Connects to Bloodbank event bus to receive real-time meeting events.
 */

import { BoardroomScene2D } from './scenes/BoardroomScene2D';
import { MockEventSource2D } from './events/MockEventSource2D';
import { HUDController } from './ui/HUDController';

// Check URL params for mode selection (default to 2D)
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || '2d';

// Initialize HUD controller first (it manages DOM elements)
const hud = new HUDController();

if (mode === '2d') {
  // 2D Mode: Use PixiJS
  const canvas = document.createElement('canvas');
  canvas.id = 'pixi-canvas';
  canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;';
  document.getElementById('app')!.appendChild(canvas);

  const scene = new BoardroomScene2D();
  scene.initialize(canvas).then(() => {
    // Create event source and start demo
    const eventSource = new MockEventSource2D(scene, hud);
    eventSource.startDemo();

    console.log('theboardroom initialized - 2D cyberpunk edition');

    // Export for debugging
    (window as any).theboardroom = {
      scene,
      hud,
      eventSource,
      mode: '2d',
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

    const eventSource = new MockEventSource(scene, hud);
    eventSource.startDemo();

    console.log('theboardroom initialized - 3D mode (legacy)');

    (window as any).theboardroom = {
      scene,
      hud,
      eventSource,
      mode: '3d',
    };
  });
}
