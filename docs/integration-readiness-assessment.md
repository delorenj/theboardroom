# Integration Readiness Assessment: theboard ↔ theboardroom

**Date:** 2026-01-16
**Assessment:** Live demo viability for theboard feature verification
**Reviewer:** System Architect

---

## Executive Summary

**Can theboardroom be used for live theboard demo/verification?**
**Status:** ⚠️ **MOSTLY READY** with critical gaps

**TL;DR:**
- Core event flow works (meeting lifecycle, rounds, consensus metrics)
- Speaker indicators require non-existent events
- Real-time turn tracking is fully mocked/simulated
- Backend emits 6/9 events frontend expects
- Demo viable for meeting-level features, NOT for turn-by-turn speaker tracking

---

## Event Schema Alignment

### Backend (theboard v2.1.0) - Events Actually Emitted

| Event | Status | Payload Fields |
|-------|--------|----------------|
| `meeting.created` | ✅ Emitted | topic, strategy, max_rounds, agent_count |
| `meeting.started` | ✅ Emitted | selected_agents[], agent_count |
| `round_completed` | ✅ Emitted | round_num, agent_name, avg_novelty, comment_count, tokens_used, cost |
| `comment_extracted` | ✅ Emitted | round_num, agent_name, comment_text, category, novelty_score |
| `meeting.converged` | ✅ Emitted | round_num, avg_novelty, novelty_threshold, total_comments |
| `meeting.completed` | ✅ Emitted | total_rounds, top_comments[], category_distribution, agent_participation |
| `meeting.failed` | ✅ Emitted | error_message, error_type |

**Total Backend Events:** 7 defined in schemas.py

### Frontend (theboardroom Sprint 1) - Events Consumed

| Event | Handler Status | Integration |
|-------|---------------|-------------|
| `meeting.created` | ✅ Implemented | HUD + Scene update |
| `meeting.started` | ✅ Implemented | Adds participants via manager |
| `participant.added` | ❌ **MISSING** | Hardcoded fallback to meeting.started |
| `participant.turn_started` | ❌ **MISSING** | No backend equivalent |
| `participant.turn_completed` | ❌ **MISSING** | No backend equivalent |
| `round_completed` | ✅ Implemented | Updates round counter + novelty |
| `comment_extracted` | ⚠️ Logged only | Console output, no visualization |
| `meeting.converged` | ✅ Implemented | Consensus = 100%, status announcement |
| `meeting.completed` | ✅ Implemented | Shows insights panel (Phase 3B) |
| `meeting.failed` | ✅ Implemented | Error status display |

**Total Frontend Handlers:** 10 (3 non-existent backend events)

---

## Critical Integration Gaps

### Gap 1: Turn-Level Speaker Tracking (BLOCKING for demos)

**Frontend Expects:**
```typescript
case 'theboard.meeting.participant.turn_started':
  // Animate speaker starting to speak
  participantManager.setSpeaking(agentName, turnType, roundNum)
  hud.setSpeaker(agentName, turnType)

case 'theboard.meeting.participant.turn_completed':
  // Animate speaker finishing
  participantManager.setSpeaking(null, null)
  hud.setSpeaker(null, null)
```

**Backend Reality:**
- **Does NOT emit `participant.turn_started`**
- **Does NOT emit `participant.turn_completed`**
- Only emits `round_completed` AFTER agent finishes full response
- No real-time turn indication during LLM generation

**Impact:**
- ❌ Speaker highlighting animations never trigger from real events
- ❌ "Who is speaking" indicator relies on MockEventSource simulation
- ❌ Turn type differentiation (response vs turn) unavailable in real-time
- ✅ Round-level metrics work (round counter, novelty after completion)

**Workaround Options:**
1. **Frontend polling**: theboardroom could poll theboard API for active speaker (requires API endpoint)
2. **Backend enhancement**: Add turn start/end events to theboard workflow
3. **Demo constraint**: Only demo round-level features, not real-time turn tracking

---

### Gap 2: Participant Addition Events

**Frontend Expects:**
```typescript
case 'theboard.meeting.participant.added':
  participantManager.addParticipant({ name, role })
  hud.addParticipant(name, role)
```

**Backend Reality:**
- **Does NOT emit `participant.added`** as separate events
- Sends all agents in `meeting.started.selected_agents[]` array

**Current Frontend Workaround:**
```typescript
case 'theboard.meeting.started':
  for (const agentName of payload.selected_agents) {
    participantManager.addParticipant({ name: agentName, role: 'Agent' })
  }
```

**Impact:**
- ✅ Works for initial participant load
- ❌ No support for dynamic mid-meeting participant addition (if ever implemented)
- ⚠️ Role information defaults to "Agent" (no expertise mapping)

**Severity:** Low (workaround functional, dynamic addition not in theboard v2.1.0)

---

### Gap 3: Comment Visualization (Minor)

**Frontend Receives:**
```typescript
case 'theboard.meeting.comment_extracted':
  console.log(`[Comment] ${agentName}: ${commentText}`)
  // TODO: Visualize as particles or overlays
```

**Backend Emits:**
- ✅ Full event with agent_name, comment_text, category, novelty_score, round_num

**Impact:**
- ⚠️ Rich comment data available but not visualized
- ✅ Logged to console for debugging
- 📋 Future enhancement opportunity (not blocking)

---

## Event Flow Verification

### Scenario: Standard Multi-Agent Meeting

**Backend Event Sequence:**
```
1. meeting.created        → Frontend: Initialize HUD with topic/max_rounds
2. meeting.started        → Frontend: Add all participants, show round 1
3. round_completed (R1)   → Frontend: Update round counter, novelty meter
4. comment_extracted (×N) → Frontend: Log comments (no viz)
5. round_completed (R2)   → Frontend: Round 2, novelty update
   ... (repeat rounds)
6. meeting.converged      → Frontend: Consensus = 100%, announcement
7. meeting.completed      → Frontend: Show insights panel
```

**What Works:**
- ✅ Meeting lifecycle (created → started → converged/completed)
- ✅ Round progression counter (1/5, 2/5, etc.)
- ✅ Novelty metric updates after each round
- ✅ Consensus calculation (inverse of novelty with trend smoothing)
- ✅ Final insights visualization (top comments, categories, participation)

**What's Mocked/Simulated:**
- ❌ Real-time speaker highlighting during turns
- ❌ Turn start/end animations
- ❌ "Currently Speaking: Alice" indicator
- ❌ Response vs turn differentiation

---

## Sprint 1 Implementation Status

### Completed Features (Working with Backend)

1. **TB-001: Development Environment** ✅
   - Bun + Vite + TypeScript setup
   - Integration: No dependency on backend

2. **TB-002: WebSocket Integration** ✅
   - BloodbankEventSource with STOMP-over-WebSocket
   - Auto-reconnection, fallback to MockEventSource
   - Integration: Consumes all 7 backend events correctly

3. **TB-003: Participant Entity Management** ✅
   - ECS architecture with ParticipantManager
   - State machine for visual states
   - Integration: Handles meeting.started participant list

4. **TB-004: Speaking Indicators** ⚠️ **Partially Working**
   - Smooth animations implemented
   - Turn type color coding ready
   - Integration: **BLOCKED** - no backend events trigger animations

5. **TB-005: Meeting State Visualization** ✅
   - Consensus calculation (inverse novelty)
   - Novelty tracking from round_completed events
   - Progress metrics (rounds, timer)
   - Integration: Fully functional with backend data

### Features Not Usable in Live Demo

- **Real-time speaker tracking**: Requires `turn_started/completed` events
- **Turn type differentiation**: Backend doesn't send turn_type with round events
- **Dynamic participant addition**: Backend sends all at meeting start
- **Comment particle effects**: Not implemented (logged only)

---

## Demo Viability Assessment

### ✅ **VIABLE FOR:**

**Meeting-Level Features:**
- Overall meeting progress visualization
- Round-by-round progression
- Novelty trend analysis
- Consensus emergence over time
- Final insights presentation
- Convergence detection

**Use Cases:**
- "Watch a meeting converge over 5 rounds"
- "See consensus build as novelty drops"
- "View top comments and category distribution"
- "Monitor meeting metrics in real-time (post-round updates)"

### ❌ **NOT VIABLE FOR:**

**Turn-Level Features:**
- Real-time speaker highlighting
- "Who is speaking right now" indicators
- Turn start/end animations
- Response vs turn visual differentiation

**Use Cases:**
- "See Alice start speaking with animated highlight"
- "Watch turn transitions between agents"
- "Differentiate responses from new turns visually"

---

## Recommendations

### Immediate (For Current Demos)

**1. Update Documentation** (Priority: High)
- Remove `participant.turn_started/completed` from CLAUDE.md event list
- Add "Post-round updates only" disclaimer for speaker tracking
- Document MockEventSource as development-only simulation

**2. Demo Script Constraints** (Priority: High)
- Focus on meeting-level convergence, not turn-by-turn play
- Script: "After each round completes, watch metrics update"
- Avoid: "See the active speaker highlighted in real-time"

**3. Environment Setup** (Priority: Medium)
- Ensure Bloodbank + RabbitMQ running (`docker compose up -d rabbitmq`)
- Set `VITE_BLOODBANK_WS_URL=ws://localhost:15674/ws` in `.env`
- Fallback to MockEventSource if Bloodbank unavailable (graceful)

### Short-Term Enhancements (Sprint 2)

**Backend Changes (theboard):**
```python
# Add to multi_agent_meeting.py workflow

# Before agent.run() call:
self.emitter.emit(
    ParticipantTurnStartedEvent(
        meeting_id=self.meeting_id,
        round_num=round_num,
        agent_name=agent.name,
        turn_type='response' if has_context else 'turn'
    )
)

# After agent.run() completes:
self.emitter.emit(
    ParticipantTurnCompletedEvent(
        meeting_id=self.meeting_id,
        round_num=round_num,
        agent_name=agent.name,
        turn_type='response' if has_context else 'turn',
        response_length=len(response.response_text)
    )
)
```

**Estimated Effort:** S (1-2 points)
- Add 2 event schema classes
- Emit at 2 locations in workflow
- No data model changes needed

**Frontend Changes (theboardroom):**
- None required, handlers already exist

### Long-Term Architecture

**Event Granularity Strategy:**
```
meeting.created          → Meeting initialized
meeting.started          → Execution began
participant.turn_started → Agent starts speaking (NEW)
comment.extracted        → Notetaker extracts comment
participant.turn_completed → Agent finishes (NEW)
round.completed          → All agents spoke
meeting.converged        → Stopping criteria met
meeting.completed        → Final state + insights
```

**Benefits:**
- Real-time UI updates during long LLM calls
- Better user engagement (see progress, not just wait)
- Matches user mental model of "turns"
- Enables pause/resume UI controls

---

## Integration Checklist for Live Demo

### Pre-Demo Setup

- [ ] **Infrastructure Running**
  - [ ] RabbitMQ on port 15674 (WebSocket)
  - [ ] theboard backend configured with `event_emitter: rabbitmq`
  - [ ] Bloodbank exchange `events` exists

- [ ] **Frontend Configuration**
  - [ ] `.env` has `VITE_BLOODBANK_WS_URL=ws://localhost:15674/ws`
  - [ ] `bun run dev` starts without errors
  - [ ] Browser console shows `[Bloodbank] Connected`

- [ ] **Backend Configuration**
  - [ ] `~/.config/theboard/config.yml` has `event_emitter: rabbitmq`
  - [ ] Test: `uv run board create --topic "Test" --max-rounds 3`
  - [ ] Verify events visible in RabbitMQ management (port 15673)

### During Demo

**Working Features:**
- ✅ Meeting topic display
- ✅ Round counter (X/Y format)
- ✅ Meeting timer (MM:SS)
- ✅ Participant avatars (static, from meeting.started)
- ✅ Novelty bar updates (post-round)
- ✅ Consensus bar (inverse of novelty)
- ✅ Convergence announcement
- ✅ Insights panel (top comments, categories)

**Avoid Demonstrating:**
- ❌ "Active speaker" highlighting
- ❌ Turn-by-turn progression
- ❌ Real-time animations during agent thinking

**Demo Script Template:**
```
1. "Let's start a 5-round meeting on [topic]"
   → Run: uv run board run <meeting-id>

2. "Watch the frontend initialize with meeting info"
   → Shows topic, 5 participants, round 0/5

3. "After each round completes, metrics update"
   → Round counter increments
   → Novelty bar changes
   → Consensus bar adjusts

4. "As novelty drops, consensus builds"
   → Point to inverse relationship
   → Smooth animations between rounds

5. "Meeting converges when novelty stays low"
   → "CONSENSUS REACHED" announcement
   → Consensus bar hits 100%

6. "Final insights show what was discussed"
   → Top 5 comments by novelty
   → Category distribution
   → Agent participation stats
```

---

## Conclusion

**Integration Status:** 70% Complete

**Demo Readiness:**
- Meeting-level features: **Production Ready**
- Turn-level features: **Not Available** (backend gap)

**Recommended Action:**
1. Use theboardroom for meeting-level theboard feature demos TODAY
2. Add turn start/end events to theboard Sprint 2 (S-sized story)
3. Update both project CLAUDE.md files with accurate event lists

**Next Steps:**
- [ ] Document event schema discrepancies in both repos
- [ ] Create theboard Sprint 2 story: "Emit turn-level events"
- [ ] Update demo script to focus on viable features
- [ ] Test full integration with sample meeting

---

**Assessment Complete**
System Architect - Winston
