# theboardroom

Real-time meeting visualization for theboard multi-agent brainstorming sessions.

## Overview

theboardroom is a PlayCanvas-based 3D visualization that shows:
- Participants seated around a circular table (top-down view)
- Who is currently speaking with visual indicators
- Turn type (response vs turn) with color coding
- Meeting progress and state

## Architecture

```
theboardroom (PlayCanvas/TypeScript)
        │
        │ WebSocket (future)
        ▼
    Bloodbank (RabbitMQ)
        │
        │ Event Bus
        ▼
    theboard (Python CLI)
```

## Events Consumed

- `theboard.meeting.created` - New meeting started
- `theboard.meeting.started` - Meeting begins
- `theboard.participant.added` - New participant joins
- `theboard.participant.turn_started` - Participant begins speaking
- `theboard.participant.turn_completed` - Participant finishes
- `theboard.meeting.round_completed` - Discussion round ends
- `theboard.meeting.converged` - Meeting reaches consensus
- `theboard.meeting.completed` - Meeting ends

## Development

```bash
# Start dev server (opens browser at localhost:3333)
bun run dev

# Type check
bun run typecheck

# Build for production
bun run build
```

## Project Structure

```
src/
├── main.ts                # Entry point, PlayCanvas init
├── scenes/
│   └── BoardroomScene.ts  # Main 3D scene setup
├── entities/
│   └── Participant.ts     # Avatar entity class
├── events/
│   └── MockEventSource.ts # Dev event simulation
└── systems/               # (future) ECS systems
```

## Tech Stack

- **PlayCanvas Engine** - 3D rendering
- **Vite** - Build tooling (needed for PlayCanvas shader loading)
- **TypeScript** - Type safety
- **Bun** - Runtime/package manager

## Package Manager

Default to using Bun instead of Node.js:

- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env files

## Notes

- Vite is used instead of Bun.serve() because PlayCanvas requires specific build handling for shaders
- The MockEventSource simulates Bloodbank events for development
- In production, replace with WebSocket connection to Bloodbank
