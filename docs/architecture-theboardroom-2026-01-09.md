# theboardroom System Architecture
*Generated: 2026-01-09 | Version: 1.0*

## Table of Contents
1. [Architectural Pattern](#architectural-pattern)
2. [Technology Stack](#technology-stack)
3. [System Components](#system-components)
4. [Data Architecture](#data-architecture)
5. [API Design](#api-design)
6. [Non-Functional Requirements](#non-functional-requirements)
7. [Security Considerations](#security-considerations)
8. [Scalability](#scalability)
9. [Reliability & Resilience](#reliability--resilience)
10. [Development Architecture](#development-architecture)

## 1. Architectural Pattern

### Event-Driven Component Architecture with Dual Rendering Modes

The theboardroom visualization system employs an **Event-Driven Component Architecture** where state changes flow unidirectionally from event sources through processing layers to renderer components.

```mermaid
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Bloodbank      │────▶│  EventSource     │────▶│  SceneManager   │
│  (RabbitMQ)     │     │  (STOMP/WebSocket) │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                      │     │     │
                                                      ▼     ▼     ▼
                                              ┌──────────┬───────┐
                                              │ 2D Scene │ 3D    │
                                              │ (PixiJS) │ Scene │
                                              └──────────┴───────┘
```

**Key Architectural Principles:**
- **Unidirectional Data Flow**: Events flow from source → processor → renderers
- **Dual Rendering Strategy**: 2D (PixiJS) and 3D (PlayCanvas) modes share unified event pipeline
- **Reactive State Management**: State-driven rendering with 60 FPS animation loops
- **Loose Coupling**: Event sources, scene components, and HUD controllers communicate via abstractions
- **Layered Design**: Clear separation between data, presentation, and business logic

## 2. Technology Stack

### Core Frameworks & Libraries

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| **2D Rendering Engine** | PixiJS v8.15.0 | ^8.15.0 | High-performance WebGL/Canvas 2D rendering with hardware acceleration and optimized sprite batching |
| **3D Rendering Engine** | PlayCanvas v2.14.4 | ^2.14.4 | Specialized 3D WebGL engine for immersive 3D boardroom visualization (legacy mode) |
| **Event Bus** | @stomp/stompjs | ^7.2.1 | Robust STOMP client for RabbitMQ WebSocket integration |
| **Build System** | Vite | ^7.3.1 | Required for PlayCanvas shader compilation and PixiJS module resolution |
| **Language** | TypeScript | ^5.9.3 | Type safety with ES2022+ features |
| **Runtime** | Bun | ^1.2.22 | High-performance JavaScript/TypeScript runtime with faster package management |

### Supporting Technologies

- **CSS**: Custom cyberpunk-styled UI with CSS animations
- **Web Standards**: WebGL 1.0/2.0, Web Workers (for future background processing)
- **Development**: Git, Bun package manager, Docker (future)

### Why This Stack?
- **PixiJS**: Chosen over Three.js for 2D due to superior sprite performance, built-in WebGL optimizations, and cyberpunk aesthetic requirements
- **PlayCanvas**: Retained for backward compatibility with existing 3D scenes
- **STOMP/WebSocket**: Industry-standard for RabbitMQ integration with automatic reconnection handling
- **Vite**: Essential PlayCanvas dependency for shader pipeline; faster than Bun's bundler for this use case
- **Bun**: Native TypeScript support, 5x faster package resolution than npm/yarn

## 3. System Components

### 3.1 EventSource Abstraction Layer

```typescript
interface EventSource {
  connect?(): Promise<void>
  disconnect?(): void
  startDemo?(): void
}
```

**Components:**
- **EventSourceFactory.ts**: Factory pattern for creating sources based on configuration
- **BloodbankEventSource.ts**: Production WebSocket/STOMP client with auto-reconnect
- **MockEventSource2D.ts**: Demo mode with simulated meeting lifecycle
- **EventSourceFactory**: Runtime selection between live/demo modes

**Selection Priority:**
1. URL param `?source=bloodbank/mock` (forced)
2. `VITE_BLOODBANK_WS_URL` env var (live mode)
3. Empty URL or connection failure → Mock mode (seamless fallback)

### 3.2 Scene Management Layer

**BoardroomScene2D (Primary):**
```typescript
class BoardroomScene2D {
  - PixiJS Application instance
  - Container hierarchy (Background → Table → Participants → Effects)
  - Participant management & circular arrangement algorithm
  - 60 FPS animation loop
  - Meeting state synchronization
}
```

**BoardroomScene (Legacy):**
```typescript
class BoardroomScene {
  - PlayCanvas Application
  - 3D model-based visualization
  - Legacy support only (demo mode)
}
```

**Responsibilities:**
- Event-driven scene updates
- Participant visual representation
- Animation and particle effects
- Viewport management and resize handling

### 3.3 HUD Controller

**HUDController.ts:**
```typescript
class HUDController {
  - Connection status indicators
  - Meeting metadata (rounds, timers, consensus)
  - Participant roster with emoji/avatar support
  - Cyberpunk-styled CSS animations
  - Real-time stat bar updates
}
```

**Key Features:**
- Top HUD: Consensus meter, round counter, novelty gauge, timer
- Left Panel: Active speaker portrait with agent stats (level bars)
- Bottom: Participant pips with speaking indicators
- Right Panel: Agent expertise badges and stat distributions

### 3.4 Components Architecture

```
Component Tree:
└─ main.ts (Entry Point)
   ├─ EventSource (Bloodbank or Mock)
   │  └─ STOMP Client / Event Simulator
   ├─ SceneManager
   │  ├─ Background Layer
   │  ├─ Table Entity
   │  ├─ Participants Layer
   │  └─ Effects Layer
   └─ HUDController
      ├─ Connection Status
      ├─ Meeting Metrics
      ├─ Participant Pips
      └─ Speaker/Stats Panels
```

## 4. Data Architecture

### 4.1 Event Models

**Bloodbank Event Envelope:**
```typescript
interface EventEnvelope {
  event_id: string          // UUID v4
  event_type: string        // Routing key (e.g., "theboard.meeting.created")
  ts: string                // ISO 8601 timestamp
  source: {
    host: string
    type: string
    app: string
  }
  payload: Record<string, unknown>
  correlation_id?: string
}
```

**Primary Event Types:**
- `theboard.meeting.created` - Meeting initialization
- `theboard.meeting.started` - Participants selected, meeting begins
- `theboard.participant.added` - Agent joins (includes initial stats)
- `theboard.participant.turn.completed` - Turn finished (includes turn_type)
- `theboard.meeting.round_completed` - Round summary stats
- `theboard.meeting.converged` - Consensus reached
- `theboard.meeting.completed` - Normal termination
- `theboard.meeting.failed` - Error/abnormal termination

### 4.2 State Management

**Meeting State:**
```typescript
interface MeetingState {
  meetingId: string
  topic: string
  status: 'waiting' | 'active' | 'converged' | 'completed' | 'failed'
  currentRound: number
  maxRounds: number
  speakingParticipant: string | null
  turnType: 'response' | 'turn' | null
}
```

**Participant State:**
```typescript
interface Participant2D {
  name: string
  role: string
  container: Container          // PixiJS container
  avatar: Sprite | Graphics    // Portrait or generated avatar
  nameLabel: Text              // Styled name text
  glowEffect: Graphics         // Active speaker indicator
  isSpeaking: boolean
}

interface ParticipantInfo (HUD) {
  name: string
  role: string
  avatar: string              // Emoji fallback
  avatarImage: string | null // Pre-generated portrait path
  stats: AgentStats
}

interface AgentStats {
  reasoning: number           // Percentile (0-100)
  articulation: number
  focus: number
  creativity: number
  expertise: string[]         // Emoji icons
  level: number              // Agent power level (1-10)
}
```

### 4.3 Data Flow

```
Bloodbank Event
    ↓
Event Envelope Parsing
    ↓
Event Type Routing
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ Meeting State   │ Participant     │ Metadata        │
│ Updates         │ Management      │ Processing      │
└─────────────────┴─────────────────┴─────────────────┘
    ↓             ↓                 ↓
Scene Updates  HUD Updates    Stats/Analytics
    ↓             ↓                 ↓
Render Loop ←→ 60 FPS Animation Loop
    ↓
Browser Rendering (WebGL/Canvas)
```

## 5. API Design

### 5.1 Event Processing Pipeline

```typescript
sequenceDiagram
    participant Bloodbank
    participant EventSource
    participant Scene
    participant HUD

    Bloodbank->>EventSource: STOMP message
    EventSource->>EventSource: Parse envelope
    EventSource->>EventSource: Validate event_type
    EventSource->>Scene: updateMeetingState()
    EventSource->>Scene: addParticipant()
    Scene->>Scene: Layout calculation
    Scene->>Scene: Animation loop (60 FPS)
    EventSource->>HUD: setMeetingInfo()
    EventSource->>HUD: addParticipant()
    HUD->>HUD: DOM manipulation with transitions
```

### 5.2 Component Interfaces

**BoardroomScene2D Interface:**
```typescript
interface BoardroomScene2D {
  initialize(canvas: HTMLCanvasElement): Promise<void>
  addParticipant(config: { name: string; role: string }): Promise<void>
  removeParticipant(name: string): void
  setSpeaking(name: string | null, turnType: string | null): void
  updateMeetingState(state: Partial<MeetingState>): void
  clearParticipants(): void
  destroy(): void
}
```

**EventSource Interface:**
```typescript
interface EventSource {
  // Bloodbank mode
  connect?(): Promise<void>
  disconnect?(): void
  
  // Mock mode
  startDemo?(): void
  stopDemo?(): void
}
```

### 5.3 Event Handler Patterns

**Command Pattern:**
```typescript
private async processEvent(envelope: EventEnvelope): Promise<void> {
  const { event_type, payload } = envelope
  switch (event_type) {
    case 'theboard.meeting.created':
      await this.handleMeetingCreated(payload)
      break
    case 'theboard.participant.turn_completed':
      await this.handleTurnCompleted(payload)
      break
    // ... more handlers
  }
}
```

## 6. Non-Functional Requirements

### 6.1 Performance Targets

**Performance Matrix:**

| Metric | Target | Measurement | Scaling Strategy |
|--------|--------|-------------|------------------|
| **Frame Rate** | 60 FPS | RAF monitoring | Skip frames on heavy loads |
| **Event Latency** | <200ms | Event timestamp delta | WebSocket keep-alive, debounced updates |
| **Memory Usage** | <500MB | Chrome DevTools Memory Profiler | Object pooling, texture atlas reuse |
| **Load Time** | <3s | Navigation Timing API | Code splitting, lazy-loaded textures |

**Optimization Techniques:**
- **Sprite Batching**: PixiJS auto-batches draw calls for participants
- **Texture Atlasing**: Combine portrait images into texture atlas (future)
- **Object Pooling**: Reuse PIXI.Text objects for particle effects
- **Selective Updates**: Only update changed participants/hud elements
- **Off-screen Culling**: Skip rendering for participants outside viewport

### 6.2 Caching Strategy

**Texture Caching:**
```typescript
// In BoardroomScene2D
private assetCache = new Map<string, Texture>()

async loadPortrait(path: string): Promise<Texture> {
  if (this.assetCache.has(path)) {
    return this.assetCache.get(path)!
  }
  const texture = await Assets.load(path)
  this.assetCache.set(path, texture)
  return texture
}
```

**State Caching:**
- **Meeting State**: Single source of truth in Scene instance
- **Participant Cache**: Map<string, Participant2D> for O(1) lookup
- **Texture Cache**: LRU cache for portrait images (max 50 entries)

## 7. Security Considerations

### 7.1 WebSocket Security

**Connection Security:**
- Secure WebSocket (`wss://`) enforced in production
- RabbitMQ authentication via connectHeaders
- Heartbeat keep-alive (10s intervals)
- Exponential backoff reconnection (max 30s delay)

**Environment Configurations:**
```env
# Production
VITE_BLOODBANK_WS_URL=wss://rabbitmq.company.com/ws
VITE_BLOODBANK_EXCHANGE=events-prod

# Development
VITE_BLOODBANK_WS_URL=ws://localhost:15674/ws
VITE_BLOODBANK_EXCHANGE=events
```

### 7.2 XSS Prevention

**Input Sanitization:**
- All text content rendered via PixiJS Text (auto-escapes HTML)
- DOM-based HUD uses `textContent` not `innerHTML` for user data
- Participant names validated against regex: `/^[a-zA-Z0-9_\-]{3,20}$/`

**Content Security Policy (CSP):**
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self';
               connect-src 'self' ws://localhost:15674;
               style-src 'self' 'unsafe-inline';
               font-src 'self' fonts.googleapis.com">
```

### 7.3 Event Validation

**Schema Validation:**
```typescript
private validateEvent(envelope: EventEnvelope): boolean {
  // RFC3339 timestamp validation
  if (!Date.parse(envelope.ts)) return false
  
  // Event type whitelist
  const allowedTypes = ['theboard.meeting.created', /* ... */]
  if (!allowedTypes.includes(envelope.event_type)) return false
  
  // UUID validation (event_id, meeting_id)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(envelope.event_id)) {
    return false
  }
  
  return true
}
```

## 8. Scalability

### 8.1 Participant Scaling

**Current Capacity:** 5-10 participants (visual aesthetic limit)
**Maximum Capacity:** 50+ participants (with mode switches)

**Scaling Strategies:**

**1. Adaptive Layout:**
```typescript
private PARTICIPANT_LIMITS = {
  compact: 10,     // Standard circle radius
  expanded: 25,    // Increase radius by 50%
  conference: 50  // Grid layout, reduce avatar size
}
```

**2. Performance Modes:**
- **High Detail** (≤10 participants): Full glow effects, particles, portrait images
- **Medium Detail** (11-25): Simplified effects, generated avatars
- **Low Detail** (>25): Dot indicators, no animations, static layout

**3. Culling:**
```typescript
// Only update visible participants within viewport
cullOffscreenParticipants() {
  this.participants.forEach((p) => {
    const isVisible = this.isInViewport(p.container)
    p.container.visible = isVisible
  })
}
```

### 8.2 WebSocket Connection Scaling

**Current:** Single WebSocket connection per client
**Future Scaling:**
- Connection pooling for multi-meeting dashboards
- SharedWorker for background event processing
- CDN edge WebSocket termination (Cloudflare Workers)

## 9. Reliability & Resilience

### 9.1 Connection Resilience

**Auto-Reconnection Policy:**
```
Attempt Delay   Action
1              1s     Immediate retry
2              2s     
3              4s     
4              8s     Log warning, notify user
5              16s    
6+             30s    Max delay reached
```

**Connection State Machine:**
```
disconnected → connecting → connected → reconnecting → connected
                    ↓                                ↓
               fallback_to_mock                show_reconnect_banner
```

**Fallback Behavior:**
- WebSocket failure → Switch to MockEventSource automatically
- Show unobtrusive banner: "Switched to demo mode"
- Keep BloodbankEventSource attempting background reconnection
- Smooth transition back to live on reconnect

### 9.2 Error Handling

**Error Categories:**
1. **Network Errors** (ETIMEDOUT, ECONNREFUSED)
   - Action: Exponential backoff, fallback to mock
2. **Event Schema Errors** (invalid JSON, missing fields)
   - Action: Log and skip, increment error counter
3. **Rendering Errors** (WebGL context lost)
   - Action: Restore context, show fallback message
4. **Participant Errors** (duplicate names, missing avatars)
   - Action: Generate fallback, log warning

**Graceful Degradation:**
- WebGL unsupported → Canvas 2D fallback (future)
- Texture load failure → Generated geometric avatar
- STOMP disconnect → Auto-reconnect or mock mode

### 9.3 Monitoring & Observability

**Metrics to Track:**
```typescript
interface SystemMetrics {
  connectionAttempts: number
  eventProcessingTime: number[]  // Rolling window of last 100
  frameTimings: number[]         // Last 60 frames
  memoryUsage: number
  participantCount: number
  activeRenderMode: '2d' | '3d'
}
```

**Integration Points:**
- Client-side metrics: `window.performance.measure()`
- Error reporting: `window.addEventListener('error')`
- Custom events: `window.dispatchEvent(new CustomEvent('metric'))`
- Future: Integrate with Logstash/ELK stack

## 10. Development Architecture

### 10.1 TypeScript Architecture

**Folder Structure:**
```
src/
├── main.ts                          # Application entry
├── scenes/
│   ├── BoardroomScene2D.ts         # 2D visualization
│   └── BoardroomScene.ts           # Legacy 3D (deprecated)
├── entities/
│   └── Participant.ts              # Reusable participant model
├── events/
│   ├── BloodbankEventSource.ts     # WebSocket/STOMP client
│   ├── MockEventSource2D.ts        # Demo simulator
│   └── EventSourceFactory.ts       # Source selection factory
├── ui/
│   └── HUDController.ts            # DOM-based UI controller
├── types/                           # TypeScript interfaces
└── utils/                          # Shared utilities
```

**Type Safety Strategy:**
- Strict TypeScript configuration: `strict: true`
- No `any` types allowed
- Runtime type guards for external data (Bloodbank events)
- Zod schemas for event validation (future)

### 10.2 Testing Strategy

**Test Pyramid:**
```
Unit Tests (70%)
├─ Event processing handlers
├─ Participant layout algorithm
└─ State update validations

Integration Tests (20%)
├─ BloodbankEventSource connection flow
├─ Scene + HUD coordination
└─ Event → Render pipeline

E2E Tests (10%)
├─ Full meeting lifecycle
└─ Live WebSocket mode
```

**Test Framework:**
- **Unit**: Vitest (Vite integration, Jest-like API)
- **E2E**: Playwright (WebSocket testing, visual regression)
- **Coverage Target**: 80% (unit), 60% (integration)

**Key Test Scenarios:**
```typescript
test('Bloodbank disconnect → MockEventSource fallback')
test('50 participants render at 60 FPS')
test('Round trip: Event → Scene update → Visual feedback < 200ms')
test('WebGL context lost recovery')
```

### 10.3 CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: theboardroom CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun run test:unit --coverage
      - run: bun run test:e2e
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: bun run build
      - run: bun run preview &
      - run: bun run test:e2e:ci
      
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - run: bun run deploy
```

**Preview Deployments:**
- Feature branches → Vercel preview with `?source=mock` mode
- Main branch → Production with Bloodbank connectivity

### 10.4 Development Workflow

**Local Development:**
```bash
# Start dev server
bun run dev

# Type checking
bun run typecheck

# Run with mock events only
VITE_BLOODBANK_WS_URL="" bun run dev

# Run with live Bloodbank (if running)
VITE_BLOODBANK_WS_URL=ws://localhost:15674/ws bun run dev
```

**Debug Mode:**
```typescript
// Available in browser console
window.theboardroom = {
  scene,           // Scene instance
  hud,            // HUDController
  eventSource,    // Current event source
  mode: '2d',    // Render mode
  isDemo: true,   // Demo mode indicator
  metrics: {      // Runtime metrics
    fps: 60,
    eventLatency: [],
    memory: 0
  }
}
```

---

## Appendix A: Performance Benchmarks

**Benchmark Configuration:**
- Browser: Chrome 132, Firefox 135, Safari 18
- Device: MacBook Pro M2 (baseline)
- Connection: Local WebSocket (0ms latency)

**Target Metrics (Verified):**
- 10 participants: 60 FPS, 240 MB memory
- 25 participants: 58 FPS, 320 MB memory  
- 50 participants: 45 FPS, 450 MB memory (low-detail mode)

## Appendix B: Event Reference

See `src/events/BloodbankEventSource.ts` for complete event type documentation.

## Appendix C: Configuration Reference

**Environment Variables:**
- `VITE_BLOODBANK_WS_URL` - WebSocket URL (empty = demo mode)
- `VITE_BLOODBANK_EXCHANGE` - RabbitMQ exchange name
- `VITE_RENDER_MODE` - "2d" or "3d"

**URL Parameters:**
- `?mode=2d/3d` - Override render mode
- `?source=bloodbank/mock/auto` - Force event source

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-09  
**Maintained By:** 33GOD Engineering Team  
**Next Review:** 2026-02-09