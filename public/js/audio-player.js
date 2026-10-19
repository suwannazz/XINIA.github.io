/**
 * Universal Gang Audio & YouTube Engine with SFX & Expandable HUD
 * Supports:
 * - YouTube Video streaming with custom Start Timestamp & End Timestamp loop
 * - Native MP3 audio streaming
 * - Synthesized Cybernetic SFX (Web Audio API)
 * - Expandable tactical HUD with volume slider, live progress timer, full YouTube song link, and close/stop buttons
 */

class GangAudioPlayer {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: true,
      type: 'youtube', // 'youtube' or 'mp3'
      youtubeUrl: '',
      startTime: 0,
      endTime: 0,
      loop: true,
      autoPlay: false,
      volume: 0.35,
      title: 'Come Through',
      artist: 'The Weeknd',
      src: '',
      cover: '',
      sfxEnabled: true
    }, options);

    this.isPlaying = false;
    this.isExpanded = false;
    this.ytPlayer = null;
    this.ytReady = false;
    this.htmlAudio = null;
    this.loopInterval = null;
    this.progressInterval = null;
    this.audioCtx = null;

    this.init();
  }

  init() {
    this.userInteracted = false;
    this.initSFX();
    this.renderWidget();

    if (this.options.type === 'youtube' && this.options.youtubeUrl) {
      this.initYouTubePlayer();
    } else if (this.options.src) {
      this.initHtmlAudio();
    }

    // Global listener for first user interaction (bypasses browser autoplay restrictions seamlessly)
    const unlockAudio = () => {
      this.userInteracted = true;
      this.hideUnmutePrompt();

      if (this.options.type === 'youtube' && this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.unMute();
          this.setVolume(this.options.volume);
          if (!this.isPlaying) {
            this.ytPlayer.playVideo();
          }
        } catch (e) {}
      } else if (this.htmlAudio) {
        try {
          this.htmlAudio.muted = false;
          this.htmlAudio.volume = this.options.volume;
          if (!this.isPlaying && this.options.autoPlay) {
            this.htmlAudio.play().catch(() => {});
          }
        } catch (e) {}
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // Check if sound is active now
      let isStillMuted = false;
      try {
        if (this.options.type === 'youtube' && this.ytPlayer && typeof this.ytPlayer.isMuted === 'function') {
          isStillMuted = this.ytPlayer.isMuted();
        }
      } catch (e) {}

      // Only detach listeners once player is ready and verified unmuted
      if ((this.ytReady || this.htmlAudio) && !isStillMuted) {
        interactionEvents.forEach(evt => {
          window.removeEventListener(evt, unlockAudio, { capture: true, passive: true });
          document.removeEventListener(evt, unlockAudio, { capture: true, passive: true });
        });
      }
    };

    const interactionEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click', 'scroll', 'wheel'];
    interactionEvents.forEach(evt => {
      window.addEventListener(evt, unlockAudio, { capture: true, passive: true });
      document.addEventListener(evt, unlockAudio, { capture: true, passive: true });
    });
  }

  // ================= YOUTUBE IFRAME PLAYER =================
  initYouTubePlayer() {
    const videoId = this.extractYouTubeId(this.options.youtubeUrl);
    if (!videoId) return;

    this.initialSeekDone = false;

    let ytDiv = document.getElementById('yt-player-hidden');
    if (!ytDiv) {
      ytDiv = document.createElement('div');
      ytDiv.id = 'yt-player-hidden';
      // Non-zero dimensions in active viewport with valid opacity (no clip-path) so browser media engine permits playback
      ytDiv.style.cssText = 'position:fixed;bottom:10px;right:10px;width:160px;height:120px;opacity:0.02;z-index:-1;pointer-events:none;border:none;';
      document.body.appendChild(ytDiv);
    }

    const initYT = () => {
      let parsedStart = this.parseTime(this.options.startTime);
      if (parsedStart <= 0 && this.options.youtubeUrl) {
        parsedStart = this.extractTimeFromUrl(this.options.youtubeUrl);
      }
      const parsedEnd = this.parseTime(this.options.endTime);

      this.ytPlayer = new YT.Player('yt-player-hidden', {
        height: '120',
        width: '160',
        videoId: videoId,
        playerVars: {
          autoplay: this.options.autoPlay ? 1 : 0,
          mute: this.options.autoPlay ? 1 : 0, // Starts muted so Chrome/Safari ALWAYS accepts autoplay on initial load
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          start: Math.floor(parsedStart),
          end: parsedEnd > 0 ? Math.floor(parsedEnd) : undefined
        },
        events: {
          onReady: (event) => {
            this.ytReady = true;
            this.ytPlayer = event.target;

            const iframe = document.getElementById('yt-player-hidden') || document.querySelector('#yt-player-hidden iframe');
            if (iframe && typeof iframe.setAttribute === 'function') {
              iframe.setAttribute('allow', 'autoplay; encrypted-media');
            }

            if (parsedStart > 0) {
              event.target.seekTo(parsedStart, true);
              this.updateProgressUI(parsedStart, 0);
            }

            // Attempt immediate unmute (works if user already interacted or browser MEI allows it)
            try {
              this.ytPlayer.unMute();
              this.setVolume(this.options.volume);
            } catch (e) {}

            if (this.options.autoPlay || this.userInteracted) {
              try {
                this.ytPlayer.playVideo();
              } catch (e) {}
            }
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              let isMuted = false;
              try {
                if (typeof this.ytPlayer.isMuted === 'function') {
                  isMuted = this.ytPlayer.isMuted();
                  if (isMuted) {
                    this.ytPlayer.unMute();
                    this.setVolume(this.options.volume);
                    isMuted = this.ytPlayer.isMuted();
                  }
                }
              } catch (e) {}

              this.setPlayingState(true);

              // If browser restricted sound due to autoplay policy, display helpful HUD prompt
              if (isMuted && !this.userInteracted) {
                this.showUnmutePrompt();
              } else {
                this.hideUnmutePrompt();
              }

              // Guarantee playback jumps to start timestamp if YouTube defaulted to 0
              if (!this.initialSeekDone && parsedStart > 0) {
                const cur = (typeof this.ytPlayer.getCurrentTime === 'function') ? this.ytPlayer.getCurrentTime() : 0;
                if (cur < parsedStart - 1.5) {
                  this.ytPlayer.seekTo(parsedStart, true);
                } else {
                  this.initialSeekDone = true;
                }
              }
              this.startLoopMonitor();
              this.startProgressMonitor();
            } else if (event.data === YT.PlayerState.PAUSED) {
              this.setPlayingState(false);
              this.stopLoopMonitor();
              this.stopProgressMonitor();
            } else if (event.data === YT.PlayerState.ENDED) {
              if (this.options.loop) {
                this.ytPlayer.seekTo(parsedStart, true);
                this.ytPlayer.playVideo();
              } else {
                this.setPlayingState(false);
                this.stopProgressMonitor();
              }
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      const oldCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof oldCallback === 'function') oldCallback();
        initYT();
      };
    }
  }

  startLoopMonitor() {
    this.stopLoopMonitor();
    const end = this.parseTime(this.options.endTime);
    let start = this.parseTime(this.options.startTime);
    if (start <= 0 && this.options.youtubeUrl) {
      start = this.extractTimeFromUrl(this.options.youtubeUrl);
    }

    if (end > 0 && end > start) {
      this.loopInterval = setInterval(() => {
        if (this.options.type === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
          const currentTime = this.ytPlayer.getCurrentTime();
          if (currentTime >= end) {
            this.ytPlayer.seekTo(start, true);
          }
        } else if (this.htmlAudio) {
          const currentTime = this.htmlAudio.currentTime;
          if (currentTime >= end) {
            if (this.options.loop) {
              this.htmlAudio.currentTime = start;
            } else {
              this.htmlAudio.pause();
              this.htmlAudio.currentTime = start;
              this.setPlayingState(false);
            }
          }
        }
      }, 250);
    }
  }

  stopLoopMonitor() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  // ================= HTML5 AUDIO FALLBACK =================
  initHtmlAudio() {
    this.htmlAudio = new Audio();
    this.htmlAudio.src = this.options.src;
    this.htmlAudio.loop = false; // Handled programmatically so it loops back to startTime!
    this.htmlAudio.volume = this.options.volume;

    const start = this.parseTime(this.options.startTime);

    const applyStartTime = () => {
      if (start > 0 && Math.abs(this.htmlAudio.currentTime - start) > 1) {
        try {
          this.htmlAudio.currentTime = start;
          this.initialSeekDone = true;
        } catch (e) {}
      }
      this.updateProgressUI(start, this.htmlAudio.duration || 0);
    };

    this.htmlAudio.addEventListener('loadedmetadata', applyStartTime, { once: true });
    this.htmlAudio.addEventListener('canplay', () => {
      if (!this.initialSeekDone && start > 0) {
        applyStartTime();
      }
    }, { once: true });

    this.htmlAudio.addEventListener('play', () => {
      this.setPlayingState(true);
      this.startLoopMonitor();
      this.startProgressMonitor();
    });

    this.htmlAudio.addEventListener('pause', () => {
      this.setPlayingState(false);
      this.stopLoopMonitor();
      this.stopProgressMonitor();
    });

    this.htmlAudio.addEventListener('ended', () => {
      if (this.options.loop) {
        try {
          this.htmlAudio.currentTime = start;
          this.htmlAudio.play().catch(() => {});
        } catch (e) {}
      } else {
        this.setPlayingState(false);
        this.stopLoopMonitor();
        this.stopProgressMonitor();
      }
    });

    if (this.options.autoPlay) {
      this.play();
    }
  }

  // ================= PLAY / PAUSE CONTROLS =================
  play() {
    this.playSFX('click');
    if (this.options.type === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        let start = this.parseTime(this.options.startTime);
        if (start <= 0 && this.options.youtubeUrl) {
          start = this.extractTimeFromUrl(this.options.youtubeUrl);
        }

        if (start > 0 && !this.initialSeekDone) {
          this.ytPlayer.seekTo(start, true);
          this.initialSeekDone = true;
        }
        this.ytPlayer.unMute();
        this.setVolume(this.options.volume);
        this.ytPlayer.playVideo();
        this.hideUnmutePrompt();
      } catch (e) {
        console.warn('YouTube playback pending user trigger');
      }
    } else if (this.htmlAudio) {
      const start = this.parseTime(this.options.startTime);
      if (!this.initialSeekDone && start > 0) {
        try {
          this.htmlAudio.currentTime = start;
        } catch (e) {}
      }
      this.htmlAudio.muted = false;
      this.htmlAudio.volume = this.options.volume;
      this.htmlAudio.play().then(() => {
        if (!this.initialSeekDone && start > 0) {
          try {
            this.htmlAudio.currentTime = start;
            this.initialSeekDone = true;
          } catch (e) {}
        }
        this.setPlayingState(true);
        this.startLoopMonitor();
        this.startProgressMonitor();
      }).catch(() => {});
    }
  }

  pause() {
    this.playSFX('click');
    if (this.options.type === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch (e) {}
    } else if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.setPlayingState(false);
      this.stopLoopMonitor();
    }
  }

  stop() {
    this.playSFX('click');
    let start = this.parseTime(this.options.startTime);
    if (start <= 0 && this.options.youtubeUrl) {
      start = this.extractTimeFromUrl(this.options.youtubeUrl);
    }

    if (this.options.type === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
        this.ytPlayer.seekTo(start, true);
      } catch (e) {}
    } else if (this.htmlAudio) {
      this.htmlAudio.pause();
      try {
        this.htmlAudio.currentTime = start;
      } catch (e) {}
    }
    this.initialSeekDone = false;
    this.setPlayingState(false);
    this.stopLoopMonitor();
    this.stopProgressMonitor();
    this.updateProgressUI(start, this.htmlAudio ? this.htmlAudio.duration || 0 : 0);
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  setVolume(vol) {
    this.options.volume = Math.max(0, Math.min(1, vol));
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        if (this.options.volume > 0 && typeof this.ytPlayer.unMute === 'function') {
          this.ytPlayer.unMute();
        }
      } catch (e) {}
      this.ytPlayer.setVolume(Math.round(this.options.volume * 100));
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.options.volume;
      if (this.options.volume > 0) this.htmlAudio.muted = false;
    }

    const slider = document.getElementById('audio-vol-slider');
    const valDisplay = document.getElementById('audio-vol-val');
    if (slider) slider.value = this.options.volume;
    if (valDisplay) valDisplay.textContent = `${Math.round(this.options.volume * 100)}%`;
  }

  // ================= UNMUTE HUD PROMPT =================
  showUnmutePrompt() {
    let prompt = document.getElementById('cyber-audio-unmute-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'cyber-audio-unmute-prompt';
      prompt.className = 'cyber-audio-unmute-prompt';
      prompt.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
        <span>TAP ANYWHERE TO UNMUTE AUDIO (คลิกเพื่อเปิดเสียงเพลง)</span>
      `;
      prompt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.userInteracted = true;
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.unMute();
            this.setVolume(this.options.volume);
            this.ytPlayer.playVideo();
          } catch (err) {}
        } else if (this.htmlAudio) {
          this.htmlAudio.muted = false;
          this.htmlAudio.play().catch(() => {});
        }
        this.hideUnmutePrompt();
      });
      document.body.appendChild(prompt);
    }
    prompt.style.display = 'flex';
  }

  hideUnmutePrompt() {
    const prompt = document.getElementById('cyber-audio-unmute-prompt');
    if (prompt) {
      prompt.style.display = 'none';
    }
  }

  // ================= EXPAND / COLLAPSE =================
  toggleExpand(forceState) {
    this.playSFX('click');
    const card = document.getElementById('cyber-audio-card');
    if (!card) return;

    this.isExpanded = forceState !== undefined ? forceState : !this.isExpanded;
    if (this.isExpanded) {
      card.classList.add('is-expanded');
    } else {
      card.classList.remove('is-expanded');
    }
  }

  // ================= PROGRESS & TIMER MONITOR =================
  startProgressMonitor() {
    this.stopProgressMonitor();
    this.progressInterval = setInterval(() => {
      let current = 0;
      let duration = 0;

      if (this.options.type === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        current = this.ytPlayer.getCurrentTime() || 0;
        duration = this.ytPlayer.getDuration() || 0;

        let start = this.parseTime(this.options.startTime);
        if (start <= 0 && this.options.youtubeUrl) {
          start = this.extractTimeFromUrl(this.options.youtubeUrl);
        }

        // Guarantee start seek if YouTube started playback from 0:00
        if (!this.initialSeekDone && start > 0 && current > 0) {
          if (current < start - 1.5) {
            this.ytPlayer.seekTo(start, true);
          } else {
            this.initialSeekDone = true;
          }
        }
      } else if (this.htmlAudio) {
        current = this.htmlAudio.currentTime || 0;
        duration = this.htmlAudio.duration || 0;

        const start = this.parseTime(this.options.startTime);
        if (!this.initialSeekDone && start > 0 && current > 0) {
          if (current < start - 1.5) {
            try {
              this.htmlAudio.currentTime = start;
            } catch (e) {}
          } else {
            this.initialSeekDone = true;
          }
        }
      }

      this.updateProgressUI(current, duration);
    }, 250);
  }

  stopProgressMonitor() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateProgressUI(current, duration) {
    const curEl = document.getElementById('audio-time-current');
    const durEl = document.getElementById('audio-time-total');
    const fillEl = document.getElementById('audio-progress-fill');

    if (curEl) curEl.textContent = this.formatSeconds(current);
    if (durEl) durEl.textContent = duration > 0 ? this.formatSeconds(duration) : '--:--';

    if (fillEl && duration > 0) {
      const pct = Math.min(100, Math.max(0, (current / duration) * 100));
      fillEl.style.width = `${pct}%`;
    }
  }

  // ================= TACTICAL HUD WIDGET =================
  renderWidget() {
    if (!this.options.enabled) return;

    let existing = document.getElementById('gang-audio-player-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'gang-audio-player-wrapper';
    wrapper.className = 'cyber-audio-widget';

    wrapper.innerHTML = `
      <div class="cyber-audio-card" id="cyber-audio-card">
        
        <!-- TOP COMPACT ROW -->
        <div class="cyber-audio-compact-bar" id="audio-compact-bar" title="คลิกเพื่อขยายปรับระดับเสียง / ดูเวลาเพลง">
          <!-- Left Artwork / Equalizer Disc -->
          <div class="cyber-audio-thumb" id="audio-thumb-btn">
            ${this.options.cover ? `<img src="${this.options.cover}" id="audio-cover-img" alt="Artwork" onerror="this.style.display='none';" />` : ''}
            <div class="cyber-audio-overlay ${!this.options.cover ? 'no-cover' : ''}">
              <div class="equalizer-bars" id="audio-equalizer">
                <span class="bar bar-1"></span>
                <span class="bar bar-2"></span>
                <span class="bar bar-3"></span>
                <span class="bar bar-4"></span>
              </div>
            </div>
          </div>

          <!-- Track Info -->
          <div class="cyber-audio-meta">
            <div class="cyber-audio-title-scroll">
              <p class="cyber-audio-title" id="audio-ui-title">${this.options.title || 'Theme Audio'}</p>
            </div>
            <p class="cyber-audio-artist" id="audio-ui-artist">${this.options.artist || 'Gang Audio'}</p>
          </div>

          <!-- Mini Action Controls -->
          <div class="cyber-audio-actions">
            <button type="button" class="btn-cyber-play" id="btn-audio-toggle" title="Play / Pause Audio">
              <svg id="audio-toggle-svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
            <button type="button" class="btn-audio-expand" id="btn-audio-expand" title="ขยายแผงควบคุม / ย่อ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- EXPANDABLE DRAWER (VOLUME, PROGRESS, FULL SONG, CLOSE) -->
        <div class="cyber-audio-drawer" id="cyber-audio-drawer">
          
          <!-- Live Playback Progress Tracker -->
          <div class="audio-progress-track-wrapper">
            <div class="audio-progress-bar">
              <div class="progress-fill" id="audio-progress-fill" style="width:0%;"></div>
            </div>
            <div class="audio-progress-meta">
              <span class="audio-time-label">LIVE PLAYBACK</span>
              <span class="audio-time-digits">
                <span id="audio-time-current">00:00</span> / <span id="audio-time-total">--:--</span>
              </span>
            </div>
          </div>

          <!-- Volume Slider Row -->
          <div class="audio-volume-row">
            <div class="volume-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </div>
            <input type="range" class="cyber-audio-vol-slider" id="audio-vol-slider" min="0" max="1" step="0.05" value="${this.options.volume}">
            <span class="audio-vol-value" id="audio-vol-val">${Math.round(this.options.volume * 100)}%</span>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(wrapper);

    // Event Bindings
    const card = document.getElementById('cyber-audio-card');
    const compactBar = document.getElementById('audio-compact-bar');
    const toggleBtn = document.getElementById('btn-audio-toggle');
    const thumbBtn = document.getElementById('audio-thumb-btn');
    const expandBtn = document.getElementById('btn-audio-expand');
    const volSlider = document.getElementById('audio-vol-slider');
    const stopBtn = document.getElementById('btn-audio-stop');

    // Click bar to expand/collapse (unless clicking toggle play button)
    if (compactBar) {
      compactBar.addEventListener('click', (e) => {
        if (e.target.closest('#btn-audio-toggle') || e.target.closest('#audio-thumb-btn')) return;
        this.toggleExpand();
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleExpand();
      });
    }

    // Play/Pause button
    [toggleBtn, thumbBtn].forEach(el => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle();
        });
      }
    });

    // Volume Slider
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        this.setVolume(parseFloat(e.target.value));
      });
      volSlider.addEventListener('click', (e) => e.stopPropagation());
    }

    // Stop / Close Button
    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stop();
      });
    }

    // Seekable Progress Track
    const progressTrack = document.getElementById('audio-progress-track');
    if (progressTrack) {
      progressTrack.style.cursor = 'pointer';
      progressTrack.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = progressTrack.getBoundingClientRect();
        if (rect.width <= 0) return;
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        if (this.options.type === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
          const duration = this.ytPlayer.getDuration() || 0;
          if (duration > 0) this.ytPlayer.seekTo(pos * duration, true);
        } else if (this.htmlAudio && this.htmlAudio.duration) {
          const duration = this.htmlAudio.duration || 0;
          if (duration > 0) {
            this.htmlAudio.currentTime = pos * duration;
            this.updateProgressUI(this.htmlAudio.currentTime, duration);
          }
        }
      });
    }

    // Sound effect on hover
    card.addEventListener('mouseenter', () => this.playSFX('hover'));
  }

  setPlayingState(playing) {
    this.isPlaying = playing;
    const svg = document.getElementById('audio-toggle-svg');
    const eq = document.getElementById('audio-equalizer');
    const card = document.getElementById('cyber-audio-card');

    if (svg) {
      if (playing) {
        svg.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
        if (eq) eq.classList.add('is-animating');
        if (card) card.classList.add('is-active');
      } else {
        svg.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
        if (eq) eq.classList.remove('is-animating');
        if (card) card.classList.remove('is-active');
      }
    }
  }

  // ================= SYNTHESIZED CYBER SFX =================
  initSFX() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {}
  }

  playSFX(type) {
    if (!this.options.sfxEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (type === 'hover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);
      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  // ================= HELPERS =================
  extractYouTubeId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url.trim();
  }

  extractTimeFromUrl(url) {
    if (!url) return 0;
    try {
      const match = url.match(/[?&](?:t|start)=([0-9hms\.:]+)/i);
      if (match && match[1]) {
        return this.parseTime(match[1]);
      }
    } catch (e) {}
    return 0;
  }

  parseTime(val) {
    if (typeof val === 'number') return Math.max(0, val);
    if (!val) return 0;
    const str = String(val).trim().toLowerCase();
    if (!str) return 0;

    // 1. Time units: e.g. "1h20m30s", "1m30s", "45s"
    if (str.includes('h') || str.includes('m') || str.includes('s')) {
      let total = 0;
      const hMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
      const mMatch = str.match(/(\d+(?:\.\d+)?)\s*m/);
      const sMatch = str.match(/(\d+(?:\.\d+)?)\s*s/);
      if (hMatch) total += parseFloat(hMatch[1]) * 3600;
      if (mMatch) total += parseFloat(mMatch[1]) * 60;
      if (sMatch) total += parseFloat(sMatch[1]);
      if (total > 0) return total;
    }

    // 2. Colon formatted: mm:ss or hh:mm:ss
    if (str.includes(':')) {
      const parts = str.split(':');
      if (parts.length === 2) {
        return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
      } else if (parts.length === 3) {
        return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseFloat(parts[2]) || 0);
      }
    }

    // 3. Dot formatted typing mistake: e.g. "0.45" -> 45s, "1.30" -> 90s (1 min 30 sec)
    if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length === 2 && parts[1].length <= 2) {
        const min = parseInt(parts[0], 10) || 0;
        const sec = parseFloat(parts[1]) || 0;
        if (sec < 60) {
          return (min * 60) + sec;
        }
      }
    }

    // 4. Raw seconds: "45", "90"
    return parseFloat(str) || 0;
  }

  formatSeconds(sec) {
    const sVal = Math.max(0, Math.floor(sec));
    const m = Math.floor(sVal / 60);
    const s = Math.floor(sVal % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

window.GangAudioPlayer = GangAudioPlayer;
