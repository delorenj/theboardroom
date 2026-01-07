/**
 * HUDController - Manages all HUD elements and their state
 *
 * Provides a clean interface for updating the cyberpunk UI elements
 * based on meeting events and state changes.
 */

export interface AgentStats {
  reasoning: number;
  articulation: number;
  focus: number;
  creativity: number;
  expertise: string[];
  level: number;
}

export interface ParticipantInfo {
  name: string;
  role: string;
  avatar: string;
  stats: AgentStats;
}

// Predefined avatars for demo
const AVATARS = ['👩‍💻', '👨‍💼', '🧑‍🎨', '👩‍🔬', '🧑‍🔧', '👨‍🏫', '👩‍⚕️', '🧑‍🚀'];

// Predefined stats per role (for demo purposes)
const ROLE_STATS: Record<string, AgentStats> = {
  'Facilitator': {
    reasoning: 85, articulation: 90, focus: 80, creativity: 70,
    expertise: ['⚙️', '📊', '🎯'], level: 5
  },
  'Developer': {
    reasoning: 90, articulation: 65, focus: 95, creativity: 75,
    expertise: ['⚙️', '🗄️', '🔒', '🚀'], level: 4
  },
  'Designer': {
    reasoning: 70, articulation: 80, focus: 75, creativity: 95,
    expertise: ['🎨', '✨', '📱'], level: 3
  },
  'PM': {
    reasoning: 80, articulation: 95, focus: 85, creativity: 60,
    expertise: ['📊', '🎯', '📝', '🤝'], level: 4
  },
  'QA': {
    reasoning: 88, articulation: 75, focus: 92, creativity: 55,
    expertise: ['🔍', '🐛', '✅', '📋'], level: 3
  },
  'default': {
    reasoning: 75, articulation: 70, focus: 75, creativity: 70,
    expertise: ['⚙️', '🎨'], level: 2
  }
};

export class HUDController {
  private participants: Map<string, ParticipantInfo> = new Map();
  private avatarIndex = 0;
  private meetingStartTime: number = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private currentRound = 0;
  private maxRounds = 0;
  private consensusLevel = 0;
  private noveltyLevel = 50;

  constructor() {
    this.startTimer();
  }

  /**
   * Update connection status indicator
   */
  setConnectionStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');

    if (dot) {
      dot.className = `connection-dot ${status}`;
    }
    if (text) {
      const labels: Record<string, string> = {
        connected: 'Online',
        disconnected: 'Offline',
        connecting: 'Connecting...'
      };
      text.textContent = labels[status] ?? status;
    }
  }

  /**
   * Set meeting info
   */
  setMeetingInfo(topic: string, maxRounds: number): void {
    this.maxRounds = maxRounds;
    this.meetingStartTime = Date.now();

    const topicEl = document.getElementById('topic-text');
    if (topicEl) {
      topicEl.textContent = `"${topic}"`;
    }

    this.updateRoundDisplay();
    this.hideWaitingOverlay();
  }

  /**
   * Update round counter
   */
  setRound(round: number): void {
    this.currentRound = round;
    this.updateRoundDisplay();

    // Simulate consensus building over rounds
    this.consensusLevel = Math.min(95, round * 15 + Math.random() * 10);
    this.updateConsensusBar();
  }

  private updateRoundDisplay(): void {
    const roundEl = document.getElementById('round-value');
    if (roundEl) {
      roundEl.textContent = `${this.currentRound}/${this.maxRounds}`;
    }
  }

  /**
   * Update consensus meter
   */
  private updateConsensusBar(): void {
    const bar = document.getElementById('consensus-bar');
    if (bar) {
      bar.style.width = `${this.consensusLevel}%`;
    }
  }

  /**
   * Update novelty meter
   */
  setNovelty(level: number): void {
    this.noveltyLevel = Math.max(0, Math.min(100, level));
    const bar = document.getElementById('novelty-bar');
    if (bar) {
      bar.style.width = `${this.noveltyLevel}%`;
    }
  }

  /**
   * Add a participant
   */
  addParticipant(name: string, role: string): void {
    const avatar = AVATARS[this.avatarIndex++ % AVATARS.length]!;
    const stats = ROLE_STATS[role] ?? ROLE_STATS['default']!;

    this.participants.set(name, { name, role, avatar, stats });
    this.updateParticipantPips();
  }

  /**
   * Remove a participant
   */
  removeParticipant(name: string): void {
    this.participants.delete(name);
    this.updateParticipantPips();
  }

  /**
   * Clear all participants
   */
  clearParticipants(): void {
    this.participants.clear();
    this.avatarIndex = 0;
    this.updateParticipantPips();
  }

  /**
   * Update the bottom participant pips
   */
  private updateParticipantPips(): void {
    const container = document.getElementById('bottom-hud');
    if (!container) return;

    container.innerHTML = '';

    for (const [name, info] of this.participants) {
      const pip = document.createElement('div');
      pip.className = 'participant-pip';
      pip.dataset['name'] = name;
      pip.innerHTML = `
        <div class="avatar">${info.avatar}</div>
        <div class="name">${name}</div>
      `;
      container.appendChild(pip);
    }
  }

  /**
   * Set the currently speaking participant
   */
  setSpeaker(name: string | null, turnType: 'turn' | 'response' | null): void {
    // Update pips
    const pips = document.querySelectorAll('.participant-pip');
    pips.forEach(pip => {
      const pipName = (pip as HTMLElement).dataset['name'];
      if (pipName === name) {
        pip.classList.add('speaking');
      } else {
        pip.classList.remove('speaking');
      }
    });

    // Update speaker panel
    const speakerPanel = document.getElementById('speaker-panel');
    const statsPanel = document.getElementById('stats-panel');

    if (name) {
      const info = this.participants.get(name);
      if (info) {
        this.updateSpeakerPanel(info, turnType);
        this.updateStatsPanel(info);
        speakerPanel?.classList.add('active');
        statsPanel?.classList.add('active');
      }
    } else {
      speakerPanel?.classList.remove('active');
      statsPanel?.classList.remove('active');
    }

    // Update novelty (decreases slightly each turn, big bump on new round)
    if (name) {
      this.noveltyLevel = Math.max(20, this.noveltyLevel - 5 + Math.random() * 3);
      this.setNovelty(this.noveltyLevel);
    }
  }

  /**
   * Update speaker portrait panel
   */
  private updateSpeakerPanel(info: ParticipantInfo, turnType: 'turn' | 'response' | null): void {
    const portraitEl = document.getElementById('portrait-image');
    const nameEl = document.getElementById('speaker-name');
    const roleEl = document.getElementById('speaker-role');
    const badgeEl = document.getElementById('turn-badge');

    if (portraitEl) portraitEl.textContent = info.avatar;
    if (nameEl) nameEl.textContent = info.name;
    if (roleEl) roleEl.textContent = info.role;

    if (badgeEl) {
      badgeEl.className = `turn-type-badge ${turnType ?? 'turn'}`;
      badgeEl.textContent = turnType === 'response' ? 'Responding' : 'Speaking';
    }
  }

  /**
   * Update stats panel with agent info
   */
  private updateStatsPanel(info: ParticipantInfo): void {
    const stats = info.stats;

    // Update level
    const levelEl = document.getElementById('agent-level');
    if (levelEl) levelEl.textContent = `LVL ${stats.level}`;

    // Update stat bars
    this.updateStat('reasoning', stats.reasoning);
    this.updateStat('articulation', stats.articulation);
    this.updateStat('focus', stats.focus);
    this.updateStat('creativity', stats.creativity);

    // Update expertise icons
    const expertiseEl = document.getElementById('expertise-icons');
    if (expertiseEl) {
      expertiseEl.innerHTML = stats.expertise.map(icon =>
        `<div class="expertise-icon active" title="${icon}">${icon}</div>`
      ).join('');
    }
  }

  private updateStat(stat: string, value: number): void {
    const bar = document.getElementById(`stat-${stat}`);
    const valEl = document.getElementById(`stat-${stat}-val`);

    if (bar) bar.style.width = `${value}%`;
    if (valEl) valEl.textContent = String(value);
  }

  /**
   * Hide waiting overlay
   */
  hideWaitingOverlay(): void {
    const overlay = document.getElementById('waiting-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * Show waiting overlay
   */
  showWaitingOverlay(): void {
    const overlay = document.getElementById('waiting-overlay');
    if (overlay) {
      overlay.style.display = 'block';
    }
  }

  /**
   * Set meeting status (converged, completed, failed)
   */
  setMeetingStatus(status: 'converged' | 'completed' | 'failed'): void {
    const topicEl = document.getElementById('topic-text');

    if (topicEl) {
      const messages: Record<string, string> = {
        converged: '✨ CONSENSUS REACHED ✨',
        completed: '✓ MEETING COMPLETED',
        failed: '✗ MEETING FAILED'
      };
      topicEl.textContent = messages[status] ?? status;
    }

    if (status === 'converged') {
      this.consensusLevel = 100;
      this.updateConsensusBar();
    }
  }

  /**
   * Start the meeting timer
   */
  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.meetingStartTime === 0) return;

      const elapsed = Math.floor((Date.now() - this.meetingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;

      const timerEl = document.getElementById('timer');
      if (timerEl) {
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);
  }

  /**
   * Reset for new meeting
   */
  reset(): void {
    this.meetingStartTime = 0;
    this.currentRound = 0;
    this.maxRounds = 0;
    this.consensusLevel = 0;
    this.noveltyLevel = 50;

    this.updateRoundDisplay();
    this.updateConsensusBar();
    this.setNovelty(50);
    this.clearParticipants();
    this.showWaitingOverlay();

    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = '00:00';

    const topicEl = document.getElementById('topic-text');
    if (topicEl) topicEl.textContent = '';
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}
