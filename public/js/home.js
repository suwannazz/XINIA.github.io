/**
 * Hero Landing Controller (Home Experience)
 * Features:
 * - Dynamic 2D Grounded Logo Stage
 * - Gang Identity Display (Smooth Fade-in to prevent flashing)
 * - Navigation to /members
 * - Expandable YouTube Audio Engine
 */

function getAppBasePath() {
  const p = window.location.pathname;
  const idx = p.lastIndexOf('/');
  if (idx >= 0) {
    return p.substring(0, idx + 1);
  }
  return './';
}

function resolveAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const base = getAppBasePath();
  let cleanUrl = url;
  if (cleanUrl.startsWith('./')) cleanUrl = cleanUrl.slice(2);
  if (cleanUrl.startsWith('/')) {
    if (base !== '/' && !cleanUrl.startsWith(base)) {
      return base + cleanUrl.slice(1);
    }
    return cleanUrl;
  }
  return base + cleanUrl;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    let config = window.__configCache || null;
    if (!config) {
      let res = await fetch('/api/config').catch(() => null);
      if (!res || !res.ok) {
        const base = getAppBasePath();
        const urls = [base + 'data/config.json', './data/config.json', 'data/config.json'];
        for (const u of urls) {
          res = await fetch(u).catch(() => null);
          if (res && res.ok) break;
        }
      }
      config = res && res.ok ? await res.json() : {};
      window.__configCache = config;
    }

    applyHomeConfig(config);
    setupActionButtons(config);
  } catch (err) {
    console.error('Error loading home experience:', err);
  }
});

// ================= SITE BRANDING & 3D/2D LOGO =================
function applyHomeConfig(config) {
  const gang = config.gang || {};
  const theme = config.theme || {};
  const threeD = config.threeD || {};
  const audio = config.audio || {};

  // 1. Document Title
  if (gang.name) {
    document.title = `${gang.name} // ELITE SYNDICATE`;
  }

  // 2. Background
  const bgWrapper = document.getElementById('site-bg');
  const bgUrl = resolveAssetUrl(theme.backgroundImage || '/uploads/bg.jpg');
  if (bgWrapper && bgUrl) {
    bgWrapper.style.backgroundImage = `url('${bgUrl}')`;
  }

  // 3. Gang Name (Smooth fade-in prevents flashing stale data)
  const gangNameEl = document.getElementById('gang-name');
  if (gangNameEl) {
    gangNameEl.textContent = gang.name || 'SYNDICATE';
    gangNameEl.style.opacity = '1';
  }

  // 4. Motto
  const mottoEl = document.getElementById('gang-motto');
  if (mottoEl) {
    const textTarget = mottoEl.querySelector('.motto-text-content') || mottoEl;
    if (gang.motto && gang.motto.trim()) {
      textTarget.textContent = gang.motto;
      mottoEl.style.display = 'inline-block';
      mottoEl.style.opacity = '1';
    } else {
      mottoEl.style.display = 'none';
    }
  }

  // 5. Dynamic Grounded 2D Logo (Parallax tilt, organic float, neon shimmer)
  if (window.ThreeLogoViewer) {
    window.logoViewerInstance = new window.ThreeLogoViewer('three-container', {
      mode: threeD.mode || 'dynamic-2d',
      logoUrl: resolveAssetUrl(theme.logoImage || '/uploads/logo.png'),
      modelUrl: threeD.modelUrl || '',
      autoRotate: threeD.autoRotate !== false,
      rotationSpeed: threeD.rotationSpeed ?? 0.008,
      floatingAnimation: threeD.floatingAnimation !== false,
      floatSpeed: threeD.floatSpeed ?? 1.5,
      floatHeight: threeD.floatHeight ?? 0.18,
      mouseFollow: threeD.mouseFollow !== false,
      mouseSensitivity: threeD.mouseSensitivity ?? 1.5,
      lightColor: threeD.lightColor || '#ffffff',
      lightIntensity: threeD.lightIntensity ?? 2.0,
      metalness: threeD.metalness ?? 0.88,
      roughness: threeD.roughness ?? 0.22,
      scale: threeD.scale ?? 1.05
    });
  }

  // 6. Expandable YouTube Audio Engine
  const alreadyActivated = sessionStorage.getItem('user_music_activated') === 'true';
  if (window.GangAudioPlayer && audio.enabled !== false) {
    window.audioPlayer = new window.GangAudioPlayer({
      enabled: audio.enabled !== false,
      type: audio.type || (audio.youtubeUrl ? 'youtube' : 'mp3'),
      youtubeUrl: audio.youtubeUrl || '',
      startTime: audio.startTime ?? 0,
      endTime: audio.endTime ?? 0,
      loop: audio.loop !== false,
      autoPlay: alreadyActivated, // Auto-plays only if user already activated it previously in session
      volume: audio.volume ?? 0.35,
      title: audio.title || 'Gang Theme',
      artist: audio.artist || 'Audio Stream',
      src: resolveAssetUrl(audio.src || '/uploads/music.mp3'),
      cover: audio.cover ? resolveAssetUrl(audio.cover) : '',
      sfxEnabled: audio.sfxEnabled !== false
    });
  }
}

function setupActionButtons(config) {
  const heroActionBox = document.querySelector('.hero-action-buttons');
  const btnMembers = document.getElementById('btn-enter-database');

  const startMusicPlayback = () => {
    sessionStorage.setItem('user_music_activated', 'true');
    sessionStorage.setItem('play_music_on_load', 'true');

    if (window.audioPlayer) {
      window.audioPlayer.playSFX('click');
      if (!window.audioPlayer.isPlaying) {
        window.audioPlayer.play();
      }
    }
  };

  if (heroActionBox) {
    heroActionBox.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-enter-database')) {
        startMusicPlayback();
      }
    });
  }

  if (btnMembers) {
    btnMembers.addEventListener('click', async (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      startMusicPlayback();
      await transitionToMembersView(true);
    });
  }

  // Handle browser back/forward buttons seamlessly
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    const path = window.location.pathname;
    const isMembers = (state && state.view === 'members') || 
                      path.endsWith('members.html') || 
                      path.endsWith('/members');
    if (isMembers) {
      transitionToMembersView(false);
    } else {
      transitionToHomeView(false);
    }
  });
}

function getHomeUrl() {
  const isGh = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' || window.location.pathname.endsWith('.html');
  const base = getAppBasePath();
  return isGh ? base : '/';
}

function getMembersUrl() {
  const isGh = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' || window.location.pathname.endsWith('.html');
  const base = getAppBasePath();
  return isGh ? (base.endsWith('/') ? base + 'members.html' : base + '/members.html') : '/members';
}

async function transitionToMembersView(pushHistory = true) {
  const heroSection = document.getElementById('hero-section');
  let membersView = document.getElementById('members-spa-container');

  if (!membersView) {
    try {
      const base = getAppBasePath();
      const candidateUrls = [
        base + 'members.html',
        './members.html',
        'members.html',
        '/members'
      ];
      let res = null;
      for (const u of candidateUrls) {
        res = await fetch(u).catch(() => null);
        if (res && res.ok) break;
      }
      if (!res || !res.ok) throw new Error('Could not fetch members view');

      const htmlText = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      membersView = document.createElement('div');
      membersView.id = 'members-spa-container';
      membersView.style.display = 'none';
      membersView.style.opacity = '0';
      membersView.style.transition = 'opacity 0.35s ease';

      const hud = doc.querySelector('.top-hud-bar');
      const main = doc.querySelector('.operatives-container');
      const dialog = doc.querySelector('#member-dossier-dialog');
      const btnBackToTop = doc.querySelector('#btn-back-to-top');

      if (hud) membersView.appendChild(hud);
      if (main) membersView.appendChild(main);
      if (dialog) {
        const oldDialog = document.getElementById('member-dossier-dialog');
        if (oldDialog) oldDialog.remove();
        document.body.appendChild(dialog);
      }
      if (btnBackToTop) membersView.appendChild(btnBackToTop);

      document.body.appendChild(membersView);

      // Bind Return to Base
      const returnBtn = membersView.querySelector('.hud-btn[href="/"], .hud-btn[href="./"], .hud-btn[href="index.html"]');
      if (returnBtn) {
        returnBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (window.audioPlayer) window.audioPlayer.playSFX('click');
          transitionToHomeView(true);
        });
      }

      // Load members.js if not already present
      if (!window.__membersJsLoaded) {
        window.__membersJsLoaded = true;
        const script = document.createElement('script');
        script.src = resolveAssetUrl('js/members.js?v=4.4');
        document.body.appendChild(script);
      } else if (typeof window.initMembersPage === 'function') {
        window.initMembersPage();
      }
    } catch (err) {
      console.error('Seamless transition fallback to full navigation:', err);
      window.location.href = getMembersUrl();
      return;
    }
  } else {
    if (typeof window.initMembersPage === 'function') {
      window.initMembersPage();
    }
  }

  // Smooth visual transition
  if (heroSection) {
    heroSection.style.transition = 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
    heroSection.style.opacity = '0';
    heroSection.style.transform = 'scale(0.97)';
    setTimeout(() => {
      heroSection.style.display = 'none';
      if (membersView) {
        membersView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' });
        requestAnimationFrame(() => {
          membersView.style.opacity = '1';
        });
      }
    }, 280);
  } else if (membersView) {
    membersView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
    membersView.style.opacity = '1';
  }

  if (pushHistory) {
    history.pushState({ view: 'members' }, '', getMembersUrl());
  }

  if (window.logoViewerInstance && typeof window.logoViewerInstance.pause === 'function') {
    window.logoViewerInstance.pause();
  }
}

function transitionToHomeView(pushHistory = true) {
  const heroSection = document.getElementById('hero-section');
  const membersView = document.getElementById('members-spa-container');

  if (membersView) {
    membersView.style.transition = 'opacity 0.25s ease';
    membersView.style.opacity = '0';
    setTimeout(() => {
      membersView.style.display = 'none';
      if (heroSection) {
        heroSection.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'instant' });
        requestAnimationFrame(() => {
          heroSection.style.opacity = '1';
          heroSection.style.transform = 'scale(1)';
        });
      }
    }, 250);
  } else if (heroSection) {
    heroSection.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'instant' });
    heroSection.style.opacity = '1';
    heroSection.style.transform = 'scale(1)';
  }

  if (pushHistory) {
    history.pushState({ view: 'home' }, '', getHomeUrl());
  }

  if (window.logoViewerInstance && typeof window.logoViewerInstance.resume === 'function') {
    window.logoViewerInstance.resume();
  }
}
