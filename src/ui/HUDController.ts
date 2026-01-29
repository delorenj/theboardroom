/**
 * HUDController - Manages all HUD elements and their state
 *
 * Provides a clean interface for updating the cyberpunk UI elements
 * based on meeting events and state changes.
 */

import { AnimationManager, Easing } from '../utils/animations';

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
  avatar: string;      // emoji fallback
  avatarImage: string | null;  // image path if available
  stats: AgentStats;
}

// Predefined avatar images (AI-generated portraits)
const AVATAR_IMAGES: Record<string, string> = {
  'Alice': '/portraits/alice.png',
  'Bob': '/portraits/bob.png',
  'Charlie': '/portraits/charlie.png',
  'Diana': '/portraits/diana.png',
  'Eve': '/portraits/eve.png',
};

// Fallback emoji avatars
const EMOJI_AVATARS = ['👩‍💻', '👨‍💼', '🧑‍🎨', '👩‍🔬', '🧑‍🔧', '👨‍🏫', '👩‍⚕️', '🧑‍🚀'];

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
  private animationManager: AnimationManager = new AnimationManager();
  private animationFrameId: number | null = null;
  private currentRound = 0;
  private maxRounds = 0;
  private consensusLevel = 0;
  private noveltyLevel = 50;
  private noveltyHistory: number[] = [];

  constructor() {
    this.startTimer();
    this.startAnimationLoop();
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

    // Consensus calculation is now based on novelty trend (see setNovelty)
    // No longer simulated here
  }

  private updateRoundDisplay(): void {
    const roundEl = document.getElementById('round-value');
    if (roundEl) {
      roundEl.textContent = `${this.currentRound}/${this.maxRounds}`;
    }
  }

  /**
   * Update consensus meter with smooth animation
   */
  private updateConsensusBar(): void {
    const currentWidth = this.getCurrentBarWidth('consensus-bar');

    this.animationManager.start(
      'consensus',
      currentWidth,
      this.consensusLevel,
      600,
      Easing.easeOutCubic
    );
  }

  /**
   * Update novelty meter with smooth animation
   * Also calculates consensus based on novelty trend
   */
  setNovelty(level: number): void {
    this.noveltyLevel = Math.max(0, Math.min(100, level));

    // Track novelty history for trend analysis
    this.noveltyHistory.push(this.noveltyLevel);
    if (this.noveltyHistory.length > 10) {
      this.noveltyHistory.shift(); // Keep last 10 values
    }

    // Calculate consensus as inverse of novelty with trend smoothing
    // High novelty = low consensus, Low novelty = high consensus
    const avgNovelty = this.noveltyHistory.reduce((sum, v) => sum + v, 0) / this.noveltyHistory.length;
    this.consensusLevel = Math.max(0, Math.min(100, 100 - avgNovelty));

    // Animate novelty bar
    const currentNoveltyWidth = this.getCurrentBarWidth('novelty-bar');
    this.animationManager.start(
      'novelty',
      currentNoveltyWidth,
      this.noveltyLevel,
      600,
      Easing.easeOutCubic
    );

    // Update consensus bar
    this.updateConsensusBar();
  }

  /**
   * Get current width percentage of a bar element
   */
  private getCurrentBarWidth(barId: string): number {
    const bar = document.getElementById(barId);
    if (!bar) return 0;

    const currentWidth = bar.style.width;
    return parseFloat(currentWidth) || 0;
  }

  /**
   * Add a participant
   */
  addParticipant(name: string, role: string): void {
    const avatar = EMOJI_AVATARS[this.avatarIndex++ % EMOJI_AVATARS.length]!;
    const avatarImage = AVATAR_IMAGES[name] ?? null;
    const stats = ROLE_STATS[role] ?? ROLE_STATS['default']!;

    this.participants.set(name, { name, role, avatar, avatarImage, stats });
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

      const avatarContent = info.avatarImage
        ? `<img src="${info.avatarImage}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
        : info.avatar;

      pip.innerHTML = `
        <div class="avatar">${avatarContent}</div>
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

    if (portraitEl) {
      if (info.avatarImage) {
        portraitEl.innerHTML = `<img src="${info.avatarImage}" alt="${info.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        portraitEl.innerHTML = '';
        portraitEl.textContent = info.avatar;
      }
    }
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
   * Start animation loop for smooth metric transitions
   */
  private startAnimationLoop(): void {
    const animate = () => {
      const currentTime = Date.now();
      const values = this.animationManager.update(currentTime);

      // Apply animated values to DOM elements
      for (const [key, value] of values) {
        if (key === 'consensus') {
          const bar = document.getElementById('consensus-bar');
          if (bar) {
            bar.style.width = `${value}%`;
          }
        } else if (key === 'novelty') {
          const bar = document.getElementById('novelty-bar');
          if (bar) {
            bar.style.width = `${value}%`;
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
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
    this.noveltyHistory = [];

    // Cancel any running animations
    this.animationManager.cancelAll();

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
   * Show insights panel with Phase 3A data
   */
  showInsights(insights: MeetingInsights): void {
    const panel = document.getElementById('insights-panel');
    if (!panel) return;

    // Populate top comments
    const commentsContainer = document.getElementById('insights-comments');
    if (commentsContainer) {
      commentsContainer.innerHTML = insights.top_comments.map((comment, idx) =>
        `<div class="insight-comment">
          <div class="comment-header">
            <span class="comment-rank">#${idx + 1}</span>
            <span class="comment-novelty">${(comment.novelty_score * 100).toFixed(0)}%</span>
            <span class="comment-category">${comment.category}</span>
          </div>
          <div class="comment-text">${comment.text}</div>
          <div class="comment-meta">
            <span class="comment-agent">${comment.agent_name}</span>
            <span class="comment-round">Round ${comment.round_num}</span>
          </div>
        </div>`
      ).join('');
    }

    // Populate category distribution
    const categoriesContainer = document.getElementById('insights-categories');
    if (categoriesContainer) {
      const total = Object.values(insights.category_distribution).reduce((sum, count) => sum + count, 0);
      categoriesContainer.innerHTML = Object.entries(insights.category_distribution)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => {
          const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0.0';
          return `<div class="category-bar">
            <div class="category-label">${category}</div>
            <div class="category-progress">
              <div class="category-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="category-count">${count} (${percentage}%)</div>
          </div>`;
        }).join('');
    }

    // Populate agent participation
    const participationContainer = document.getElementById('insights-participation');
    if (participationContainer) {
      participationContainer.innerHTML = Object.entries(insights.agent_participation)
        .sort(([, a], [, b]) => b - a)
        .map(([agent, count], idx) =>
          `<div class="participation-row">
            <span class="participation-rank">${idx + 1}.</span>
            <span class="participation-agent">${agent}</span>
            <span class="participation-count">${count} responses</span>
          </div>`
        ).join('');
    }

    // Show panel with fade-in animation
    panel.classList.add('active');
  }

  /**
   * Hide insights panel
   */
  hideInsights(): void {
    const panel = document.getElementById('insights-panel');
    if (panel) {
      panel.classList.remove('active');
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationManager.cancelAll();
  }
}

// Type definitions for Phase 3A insights
export interface TopComment {
  text: string;
  category: string;
  novelty_score: number;
  agent_name: string;
  round_num: number;
}

export interface MeetingInsights {
  top_comments: TopComment[];
  category_distribution: Record<string, number>;
  agent_participation: Record<string, number>;
}
