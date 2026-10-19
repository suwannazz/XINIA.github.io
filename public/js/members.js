/**
 * Operatives / Members Database Logic
 * Modern Minimalist Cyberpunk Roster with Ranked Dividers & Dossier Modal
 */

let activeCategory = 'All';
let currentSearch = '';
let currentPage = 1;
let debounceTimer = null;
let allMembersData = {};
let isMembersPageInitialized = false;

async function initMembersPage() {
  await loadPageConfig();
  setupEvents();
  setupDossierDialog();
  await fetchOperatives();
  isMembersPageInitialized = true;
}

window.initMembersPage = initMembersPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!isMembersPageInitialized) initMembersPage();
  });
} else {
  initMembersPage();
}

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

function applyConfigToMembersPage(config) {
  const gang = config.gang || {};
  const theme = config.theme || {};
  const audio = config.audio || {};

  if (gang.name) {
    document.title = `${gang.name} // OPERATIVES DATABASE`;
  }

  const titleEl = document.getElementById('operatives-main-title');
  if (titleEl && gang.databaseTitle) {
    titleEl.textContent = gang.databaseTitle;
  }

  const hudGang = document.getElementById('members-hud-gang');
  if (hudGang && gang.name) {
    hudGang.textContent = `${gang.name} ARCHIVE`;
  }

  const footerGang = document.getElementById('dossier-footer-gang-name');
  if (footerGang && gang.name) {
    footerGang.textContent = `${gang.name} ARCHIVE`;
  }

  const bg = document.getElementById('site-bg');
  const bgUrl = resolveAssetUrl(theme.backgroundImage || '/uploads/bg.jpg');
  if (bg && bgUrl) {
    bg.style.backgroundImage = `url('${bgUrl}')`;
  }

  // Audio Player: Auto-play if user initiated playback from hero action button
  const shouldPlayMusic = sessionStorage.getItem('user_music_activated') === 'true' || 
                          sessionStorage.getItem('play_music_on_load') === 'true';

  if (window.GangAudioPlayer && audio.enabled !== false && !window.audioPlayer) {
    window.audioPlayer = new window.GangAudioPlayer({
      enabled: audio.enabled,
      type: audio.type || (audio.youtubeUrl ? 'youtube' : 'mp3'),
      youtubeUrl: audio.youtubeUrl || '',
      startTime: audio.startTime ?? 0,
      endTime: audio.endTime ?? 0,
      loop: audio.loop !== false,
      autoPlay: shouldPlayMusic,
      volume: audio.volume ?? 0.35,
      title: audio.title || 'Gang Theme',
      artist: audio.artist || 'Audio Stream',
      src: audio.src || '',
      cover: resolveAssetUrl(audio.cover || theme.logoImage || '/uploads/logo.png'),
      sfxEnabled: audio.sfxEnabled !== false
    });
  } else if (window.audioPlayer && shouldPlayMusic && !window.audioPlayer.isPlaying) {
    window.audioPlayer.play();
  }
}

async function loadPageConfig() {
  try {
    if (window.__configCache && Object.keys(window.__configCache).length > 0) {
      applyConfigToMembersPage(window.__configCache);
      return;
    }

    let res = await fetch('/api/config').catch(() => null);
    if (!res || !res.ok) {
      const base = getAppBasePath();
      const urls = [base + 'data/config.json', './data/config.json', 'data/config.json'];
      for (const u of urls) {
        res = await fetch(u).catch(() => null);
        if (res && res.ok) break;
      }
    }
    const config = res && res.ok ? await res.json() : {};
    window.__configCache = config;
    applyConfigToMembersPage(config);
  } catch (e) {
    console.error('Failed to load config on members page:', e);
  }
}

function setupEvents() {
  // Search
  const searchInput = document.getElementById('deck-search-input');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        fetchOperatives();
      }, 300);
    });
  }

  // Clear Search
  const clearBtn = document.getElementById('btn-clear-deck-search');
  if (clearBtn && searchInput && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = 'true';
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearch = '';
      currentPage = 1;
      fetchOperatives();
    });
  }

  // Category Filter Pills
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    if (!pill.dataset.bound) {
      pill.dataset.bound = 'true';
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategory = pill.getAttribute('data-category');
        currentPage = 1;
        if (window.audioPlayer) window.audioPlayer.playSFX('click');
        fetchOperatives();
      });
    }
  });

  setupBackToTop();
}

function buildStaticMembersResponse(rawList) {
  const search = (currentSearch || '').trim().toLowerCase();
  const cat = (activeCategory || 'All').trim();

  let filtered = (rawList || []).map(m => {
    const { password, ...safe } = m;
    if (safe.imageurl) safe.imageurl = resolveAssetUrl(safe.imageurl);
    if (safe.bannerUrl) safe.bannerUrl = resolveAssetUrl(safe.bannerUrl);
    return safe;
  });

  if (search) {
    filtered = filtered.filter(m => {
      const fn = `${m.firstname || ''} ${m.lastname || ''}`.toLowerCase();
      const r = (m.role || '').toLowerCase();
      const c = (m.caption || '').toLowerCase();
      return fn.includes(search) || r.includes(search) || c.includes(search);
    });
  }

  if (cat && cat !== 'All') {
    filtered = filtered.filter(m => m.category === cat);
  }

  const founders = filtered.filter(m => m.category === 'Founders' || (m.role && m.role.toLowerCase().includes('founder')));
  const leaders = filtered.filter(m => m.category === 'Leaders' || (m.role && m.role.toLowerCase().includes('leader') && m.category !== 'Founders'));
  const regularMembers = filtered.filter(m => !founders.includes(m) && !leaders.includes(m));

  return {
    founders,
    leaders,
    members: (search || cat !== 'All') ? filtered : regularMembers,
    all: filtered,
    totalCount: filtered.length,
    currentPage: 1,
    totalPages: 1
  };
}

async function fetchOperatives() {
  const container = document.getElementById('operatives-content-area');
  if (!container) return;

  try {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: '100'
    });
    if (currentSearch) params.set('search', currentSearch);
    if (activeCategory && activeCategory !== 'All') params.set('category', activeCategory);

    let data = null;

    // 1. In-memory cached static members list (fastest, zero network delay or failure)
    if (window.__rawMembersCache && Array.isArray(window.__rawMembersCache) && window.__rawMembersCache.length > 0) {
      data = buildStaticMembersResponse(window.__rawMembersCache);
    }

    // 2. Try Node.js server API
    if (!data) {
      try {
        const res = await fetch(`/api/members?${params.toString()}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {}
    }

    // 3. Fallback to static JSON file (for GitHub Pages or static hosting)
    if (!data) {
      const base = getAppBasePath();
      const candidateUrls = [
        base + 'data/members.json',
        './data/members.json',
        'data/members.json',
        '../data/members.json'
      ];

      for (const url of candidateUrls) {
        try {
          const staticRes = await fetch(url);
          if (staticRes && staticRes.ok) {
            const rawMembers = await staticRes.json();
            if (Array.isArray(rawMembers) && rawMembers.length > 0) {
              window.__rawMembersCache = rawMembers;
              data = buildStaticMembersResponse(rawMembers);
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (!data) throw new Error('Could not load operatives data');
    allMembersData = data;

    // Cache all loaded operatives for resilient modal lookup
    const curList = data.all || [...(data.founders || []), ...(data.leaders || []), ...(data.members || [])];
    if (curList && curList.length > 0) {
      if (!window.__allMembersCache) window.__allMembersCache = [];
      curList.forEach(m => {
        const idx = window.__allMembersCache.findIndex(ex => String(ex.id) === String(m.id));
        if (idx >= 0) {
          window.__allMembersCache[idx] = m;
        } else {
          window.__allMembersCache.push(m);
        }
      });
    }

    const countEl = document.getElementById('operatives-total-count');
    if (countEl) countEl.textContent = `TOTAL ROSTER: ${data.totalCount || 0} OPERATIVES`;

    renderOperatives(data);
  } catch (err) {
    console.error('Failed to load operatives:', err);
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 0;color:#ef4444;font-family:var(--font-hud);">
        DATABASE LINK INTERRUPTED. RETRYING...
      </div>
    `;
  }
}

function renderOperatives(data) {
  const container = document.getElementById('operatives-content-area');
  if (!container) return;

  // Search or specific Category view
  if (currentSearch || activeCategory !== 'All') {
    const list = data.members || data.all || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div class="roster-empty-state">
          <p>NO MATCHING OPERATIVE RECORDS IN CURRENT QUERY</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="operatives-section">
        <div class="squad-divider-wrap" style="display:flex;flex-direction:column;gap:0.85rem;width:100%;position:relative;z-index:15;">
          <div class="squad-divider-header" style="display:flex;align-items:center;justify-content:space-between;width:100%;position:relative;z-index:20;">
            <div class="squad-badge" style="display:inline-flex;align-items:center;gap:0.75rem;position:relative;z-index:25;">
              <span class="squad-idx" style="color:#00f0ff;font-family:var(--font-tech),sans-serif;font-weight:800;font-size:0.95rem;letter-spacing:0.15em;">CATEGORY //</span>
              <span class="squad-name" style="color:#ffffff;font-family:var(--font-title),sans-serif;font-weight:900;font-size:1.25rem;letter-spacing:0.18em;">${activeCategory === 'All' ? 'SEARCH RESULTS' : activeCategory.toUpperCase()}</span>
            </div>
            <div class="squad-meta-pill" style="display:inline-flex;align-items:center;gap:0.5rem;color:#94a3b8;font-family:var(--font-hud),sans-serif;font-size:0.75rem;letter-spacing:0.15em;">
              <span class="squad-dot" style="background:#00f0ff;box-shadow:0 0 8px #00f0ff;"></span>
              <span class="squad-count">${list.length} OPERATIVE${list.length > 1 ? 'S' : ''}</span>
            </div>
          </div>
          <div class="squad-divider-track" style="position:relative;width:100%;height:2px;">
            <div class="squad-track-glow"></div>
            <div class="squad-track-node"></div>
          </div>
        </div>
        <div class="operatives-grid">
          ${list.map(m => createOperativeCardHtml(m)).join('')}
        </div>
      </div>
    `;
    bindMemberCardClicks();
    initScrollReveal();
    return;
  }

  // Default Hierarchical Grouping (01 Founders, 02 Leaders, 03 Members)
  const founders = data.founders || [];
  const leaders = data.leaders || [];
  const members = data.members || [];

  let html = '';

  if (founders.length > 0) {
    html += `
      <section class="operatives-section section-founder">
        <div class="squad-divider-wrap founder-divider" style="display:flex;flex-direction:column;gap:0.85rem;width:100%;position:relative;z-index:15;">
          <div class="squad-divider-header" style="display:flex;align-items:center;justify-content:space-between;width:100%;position:relative;z-index:20;">
            <div class="squad-badge" style="display:inline-flex;align-items:center;gap:0.75rem;position:relative;z-index:25;">
              <span class="squad-idx" style="color:#f59e0b;font-family:var(--font-tech),sans-serif;font-weight:800;font-size:0.95rem;letter-spacing:0.15em;">RANK 01 //</span>
              <span class="squad-name" style="color:#ffffff;font-family:var(--font-title),sans-serif;font-weight:900;font-size:1.25rem;letter-spacing:0.18em;text-shadow:0 0 16px rgba(245,158,11,0.4);">FOUNDERS</span>
            </div>
            <div class="squad-meta-pill" style="display:inline-flex;align-items:center;gap:0.5rem;color:#94a3b8;font-family:var(--font-hud),sans-serif;font-size:0.75rem;letter-spacing:0.15em;">
              <span class="squad-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span>
              <span class="squad-count">${founders.length} OPERATIVE${founders.length > 1 ? 'S' : ''}</span>
            </div>
          </div>
          <div class="squad-divider-track" style="position:relative;width:100%;height:1px;">
            <div class="squad-track-glow"></div>
          </div>
        </div>
        <div class="operatives-grid">
          ${founders.map(m => createOperativeCardHtml(m, 'founder')).join('')}
        </div>
      </section>
    `;
  }

  if (leaders.length > 0) {
    html += `
      <section class="operatives-section section-leader">
        <div class="squad-divider-wrap leader-divider" style="display:flex;flex-direction:column;gap:0.85rem;width:100%;position:relative;z-index:15;">
          <div class="squad-divider-header" style="display:flex;align-items:center;justify-content:space-between;width:100%;position:relative;z-index:20;">
            <div class="squad-badge" style="display:inline-flex;align-items:center;gap:0.75rem;position:relative;z-index:25;">
              <span class="squad-idx" style="color:#ef4444;font-family:var(--font-tech),sans-serif;font-weight:800;font-size:0.95rem;letter-spacing:0.15em;">RANK 02 //</span>
              <span class="squad-name" style="color:#ffffff;font-family:var(--font-title),sans-serif;font-weight:900;font-size:1.25rem;letter-spacing:0.18em;text-shadow:0 0 16px rgba(239,68,68,0.4);">LEADERS</span>
            </div>
            <div class="squad-meta-pill" style="display:inline-flex;align-items:center;gap:0.5rem;color:#94a3b8;font-family:var(--font-hud),sans-serif;font-size:0.75rem;letter-spacing:0.15em;">
              <span class="squad-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span>
              <span class="squad-count">${leaders.length} OPERATIVE${leaders.length > 1 ? 'S' : ''}</span>
            </div>
          </div>
          <div class="squad-divider-track" style="position:relative;width:100%;height:1px;">
            <div class="squad-track-glow"></div>
          </div>
        </div>
        <div class="operatives-grid">
          ${leaders.map(m => createOperativeCardHtml(m, 'leader')).join('')}
        </div>
      </section>
    `;
  }

  if (members.length > 0) {
    html += `
      <section class="operatives-section section-member">
        <div class="squad-divider-wrap member-divider" style="display:flex;flex-direction:column;gap:0.85rem;width:100%;position:relative;z-index:15;">
          <div class="squad-divider-header" style="display:flex;align-items:center;justify-content:space-between;width:100%;position:relative;z-index:20;">
            <div class="squad-badge" style="display:inline-flex;align-items:center;gap:0.75rem;position:relative;z-index:25;">
              <span class="squad-idx" style="color:#00f0ff;font-family:var(--font-tech),sans-serif;font-weight:800;font-size:0.95rem;letter-spacing:0.15em;">RANK 03 //</span>
              <span class="squad-name" style="color:#ffffff;font-family:var(--font-title),sans-serif;font-weight:900;font-size:1.25rem;letter-spacing:0.18em;text-shadow:0 0 16px rgba(0,240,255,0.4);">MEMBERS</span>
            </div>
            <div class="squad-meta-pill" style="display:inline-flex;align-items:center;gap:0.5rem;color:#94a3b8;font-family:var(--font-hud),sans-serif;font-size:0.75rem;letter-spacing:0.15em;">
              <span class="squad-dot" style="background:#00f0ff;box-shadow:0 0 8px #00f0ff;"></span>
              <span class="squad-count">${members.length} OPERATIVE${members.length > 1 ? 'S' : ''}</span>
            </div>
          </div>
          <div class="squad-divider-track" style="position:relative;width:100%;height:1px;">
            <div class="squad-track-glow"></div>
          </div>
        </div>
        <div class="operatives-grid">
          ${members.map(m => createOperativeCardHtml(m, 'member')).join('')}
        </div>
      </section>
    `;
  }

  if (!html) {
    html = `
      <div class="roster-empty-state">
        <p>NO OPERATIVE DOSSIERS REGISTERED IN SYSTEM</p>
      </div>
    `;
  }

  container.innerHTML = html;
  bindMemberCardClicks();
  initScrollReveal();
}

function createOperativeCardHtml(m, overrideType) {
  const isFounder = overrideType === 'founder' || m.category === 'Founders' || (m.role && m.role.toLowerCase().includes('founder'));
  const isLeader = overrideType === 'leader' || m.category === 'Leaders' || (m.role && m.role.toLowerCase().includes('leader'));

  let cardClasses = 'operative-card';
  let roleIcon = '';
  let statusBadgeText = 'ACTIVE';

  if (isFounder) {
    cardClasses += ' is-founder';
    roleIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    statusBadgeText = 'FOUNDER';
  } else if (isLeader) {
    cardClasses += ' is-leader';
    roleIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    statusBadgeText = 'COMMAND';
  } else {
    cardClasses += ' is-member';
    roleIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
    statusBadgeText = 'OPERATIVE';
  }

  const avatar = resolveAssetUrl(m.imageurl || '/uploads/logo.png');
  const name = `${m.firstname || ''} ${m.lastname || ''}`.trim() || 'UNREGISTERED';

  return `
    <div class="${cardClasses}" data-member-id="${m.id}" title="คลิกเพื่อเปิดดูแฟ้มประวัติส่วนตัว">
      <!-- Left Side: Profile Picture (รูปโปรไฟล์) -->
      <div class="card-avatar-side">
        <div class="card-avatar-frame">
          <img src="${avatar}" alt="${name}" loading="lazy" onerror="this.onerror=null; this.src=resolveAssetUrl('uploads/logo.png');" />
        </div>
      </div>

      <!-- Right Side: Role, Status & Name -->
      <div class="card-body-side">
        <div class="card-header-row">
          <div class="card-role-title">
            ${roleIcon}
            <span>${m.role || 'GANG OPERATIVE'}</span>
          </div>
          <div class="card-status-badge">
            <span class="status-text">${statusBadgeText}</span>
          </div>
        </div>
        <h3 class="card-name">${name}</h3>
      </div>
    </div>
  `;
}

// ================= MEMBER PERSONAL DOSSIER POPUP DIALOG =================
function closeDossierDialog() {
  const dialog = document.getElementById('member-dossier-dialog');
  if (!dialog) return;
  try {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    }
  } catch (e) {}
  dialog.removeAttribute('open');
  if (window.audioPlayer) window.audioPlayer.playSFX('click');
}

function setupDossierDialog() {
  const dialog = document.getElementById('member-dossier-dialog');
  const closeBtn = document.getElementById('btn-close-dossier');

  if (!dialog) return;

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeDossierDialog();
    };
  }

  // Light dismiss fallback: click on backdrop closes dialog
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      closeDossierDialog();
    }
  };

  // Keyboard Escape listener
  if (!window.__dossierEscBound) {
    window.__dossierEscBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const curDialog = document.getElementById('member-dossier-dialog');
        if (curDialog && (curDialog.open || curDialog.hasAttribute('open'))) {
          closeDossierDialog();
        }
      }
    });
  }
}

function bindMemberCardClicks() {
  const cards = document.querySelectorAll('.operative-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const memberId = card.getAttribute('data-member-id');
      const list = allMembersData.all && allMembersData.all.length > 0 
        ? allMembersData.all 
        : [...(allMembersData.founders || []), ...(allMembersData.leaders || []), ...(allMembersData.members || [])];
      
      let member = list.find(m => String(m.id) === String(memberId));
      if (!member && Array.isArray(window.__allMembersCache)) {
        member = window.__allMembersCache.find(m => String(m.id) === String(memberId));
      }

      if (member) {
        openMemberDossier(member);
      } else {
        console.warn('Operative record not found for id:', memberId);
      }
    });
  });
}

function openMemberDossier(m) {
  const dialog = document.getElementById('member-dossier-dialog');
  if (!dialog) {
    console.error('member-dossier-dialog not found in DOM');
    return;
  }

  if (window.audioPlayer) window.audioPlayer.playSFX('hover');

  // Member Custom Wallpaper Banner
  const bannerImg = document.getElementById('dossier-banner-img');
  if (bannerImg) {
    bannerImg.src = resolveAssetUrl(m.bannerUrl || '/uploads/bg.jpg');
  }

  // Avatar & Identity Elements
  const avatarImg = document.getElementById('dossier-avatar-img');
  const avatarFrame = document.getElementById('dossier-avatar-frame');
  const fullNameEl = document.getElementById('dossier-fullname');
  const roleTextEl = document.getElementById('dossier-role-text');
  const roleBadge = document.getElementById('dossier-role-badge');
  const categoryPill = document.getElementById('dossier-category-pill');
  const usernameTag = document.getElementById('dossier-username-tag');
  const securityBadge = document.getElementById('dossier-security-badge');
  const captionEl = document.getElementById('dossier-caption-text');
  const socialsList = document.getElementById('dossier-socials-list');

  const isFounder = m.category === 'Founders' || (m.role && m.role.toLowerCase().includes('founder'));
  const isLeader = m.category === 'Leaders' || (m.role && m.role.toLowerCase().includes('leader'));

  // Reset theme classes on avatar frame and role badge
  if (avatarFrame) {
    avatarFrame.className = 'dossier-avatar-frame';
    if (isFounder) avatarFrame.classList.add('is-founder');
    else if (isLeader) avatarFrame.classList.add('is-leader');
  }

  if (roleBadge) {
    roleBadge.className = 'dossier-role-badge';
    if (isFounder) roleBadge.classList.add('is-founder');
    else if (isLeader) roleBadge.classList.add('is-leader');
  }

  if (avatarImg) {
    avatarImg.src = resolveAssetUrl(m.imageurl || '/uploads/logo.png');
  }

  const fullName = `${m.firstname || ''} ${m.lastname || ''}`.trim();
  if (fullNameEl) {
    fullNameEl.textContent = fullName || (m.username ? `@${m.username}` : 'GANG OPERATIVE');
  }

  if (roleTextEl) {
    roleTextEl.textContent = m.role || (isFounder ? 'FOUNDER' : (isLeader ? 'COMMAND' : 'OPERATIVE'));
  }

  if (categoryPill) {
    const catName = m.category || (isFounder ? 'Founders' : (isLeader ? 'Leaders' : 'Members'));
    categoryPill.textContent = catName.toUpperCase() + ' // VERIFIED';
  }

  if (usernameTag) {
    usernameTag.textContent = m.username ? `@${m.username}` : '@operative';
  }

  if (securityBadge) {
    securityBadge.textContent = isFounder ? 'SECURITY LEVEL: ALPHA 01' : (isLeader ? 'SECURITY LEVEL: BRAVO 02' : 'SECURITY LEVEL: DELTA 03');
  }

  // Personal Caption / Quote
  if (captionEl) {
    if (m.caption && m.caption.trim()) {
      captionEl.textContent = m.caption.trim();
      captionEl.style.fontStyle = 'normal';
      captionEl.style.color = '#e2e8f0';
    } else {
      captionEl.textContent = 'ไม่มีคำอธิบายส่วนตัวระบุไว้ในฐานข้อมูล (No personal dossier quote recorded)';
      captionEl.style.fontStyle = 'italic';
      captionEl.style.color = '#64748b';
    }
  }

  // Social Channels
  if (socialsList) {
    let sHtml = '';
    const s = m.sociallinks || {};

    const formatSocialUrl = (u) => {
      if (!u) return '';
      u = u.trim();
      return /^https?:\/\//i.test(u) ? u : 'https://' + u;
    };

    // 1. Facebook
    if (s.facebook && s.facebook.trim()) {
      sHtml += `
        <a href="${formatSocialUrl(s.facebook)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn fb" title="Facebook Profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          <span>FACEBOOK</span>
        </a>
      `;
    }

    // 2. Discord (Link or Copy Tag)
    if (s.discord && s.discord.trim()) {
      const discVal = s.discord.trim();
      const isDiscLink = /^https?:\/\//i.test(discVal) || discVal.includes('discord.gg/') || discVal.includes('discord.com/');
      if (isDiscLink) {
        sHtml += `
          <a href="${formatSocialUrl(discVal)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn discord" title="Open Discord Link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>DISCORD</span>
          </a>
        `;
      } else {
        sHtml += `
          <div class="dossier-social-btn discord" title="คลิกเพื่อคัดลอก Discord Tag" onclick="copyDossierDiscord('${escapeHtml(discVal)}', this)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span class="discord-tag-text">${escapeHtml(discVal)}</span>
          </div>
        `;
      }
    }

    // 3. Instagram (IG)
    const igVal = s.ig || s.instagram;
    if (igVal && igVal.trim()) {
      sHtml += `
        <a href="${formatSocialUrl(igVal)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn ig" title="Instagram Profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          <span>INSTAGRAM</span>
        </a>
      `;
    }

    // 4. TikTok
    if (s.tiktok && s.tiktok.trim()) {
      sHtml += `
        <a href="${formatSocialUrl(s.tiktok)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn tiktok" title="TikTok Profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.11V9.4a6.33 6.33 0 0 0-.86-.06A6.34 6.34 0 0 0 3.1 15.68a6.34 6.34 0 0 0 10.82 4.48 6.27 6.27 0 0 0 1.87-4.48V8.75a8.28 8.28 0 0 0 4.77 1.49v-3.48a4.85 4.85 0 0 1-.97-.07z"/></svg>
          <span>TIKTOK</span>
        </a>
      `;
    }

    // 5. Twitter / X
    const twVal = s.twitter || s.twiter || s.x;
    if (twVal && twVal.trim()) {
      sHtml += `
        <a href="${formatSocialUrl(twVal)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn twitter" title="Twitter / X Profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <span>TWITTER / X</span>
        </a>
      `;
    }

    // 6. YouTube
    if (s.youtube && s.youtube.trim()) {
      sHtml += `
        <a href="${formatSocialUrl(s.youtube)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn youtube" title="YouTube Channel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span>YOUTUBE</span>
        </a>
      `;
    }

    // 7. Twitch
    const twitchVal = s.twitch || s.twit;
    if (twitchVal && twitchVal.trim()) {
      sHtml += `
        <a href="${formatSocialUrl(twitchVal)}" target="_blank" rel="noopener noreferrer" class="dossier-social-btn twitch" title="Twitch Stream">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.149 0l-1.612 4.119v16.8h5.688v3.081h3.085l3.084-3.081h4.631l6.975-6.974v-13.945h-21.851zm19.847 13.064l-4.118 4.119h-5.412l-3.084 3.081v-3.081h-3.606v-15.179h16.22v11.06zm-8.777-6.974h-2.584v6.188h2.584v-6.188zm5.166 0h-2.584v6.188h2.584v-6.188z"/></svg>
          <span>TWITCH</span>
        </a>
      `;
    }

    if (!sHtml) {
      sHtml = '<span class="dossier-no-socials">ไม่มีข้อมูลช่องทางติดต่อภายนอก (Encrypted Comms Only)</span>';
    }

    socialsList.innerHTML = sHtml;
  }

  try {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  } catch (err) {
    console.error('Failed to showModal:', err);
    dialog.setAttribute('open', '');
  }
}

window.copyDossierDiscord = (tag, el) => {
  navigator.clipboard.writeText(tag).then(() => {
    const textEl = el.querySelector('.discord-tag-text');
    if (textEl) {
      const orig = textEl.textContent;
      textEl.textContent = 'COPIED!';
      textEl.style.color = '#10b981';
      setTimeout(() => {
        textEl.textContent = orig;
        textEl.style.color = '';
      }, 2000);
    }
  }).catch(() => {
    prompt('Discord User Tag:', tag);
  });
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================= MINIMALIST SCROLL-REVEAL ANIMATION (UP & DOWN) =================
function initScrollReveal() {
  const cards = document.querySelectorAll('.operative-card');
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach(c => c.classList.add('is-revealed'));
    return;
  }

  // Disconnect previous observer to prevent duplicate listeners when filtering/searching
  if (window.__operativeCardObserver) {
    try { window.__operativeCardObserver.disconnect(); } catch (e) {}
  }

  window.__operativeCardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
      } else {
        // Remove class when out of view so it repeats both scrolling down and scrolling back up
        entry.target.classList.remove('is-revealed');
      }
    });
  }, {
    threshold: 0.06,
    rootMargin: '10px 0px -15px 0px'
  });

  const grids = document.querySelectorAll('.operatives-grid');
  grids.forEach(grid => {
    const gridCards = grid.querySelectorAll('.operative-card');
    gridCards.forEach((card, idx) => {
      const stagger = Math.min((idx % 4) * 0.05, 0.20);
      card.style.setProperty('--card-stagger', `${stagger}s`);
      window.__operativeCardObserver.observe(card);
    });
  });
}

// ================= FLOATING TACTICAL BACK TO TOP RADAR BUTTON =================
function setupBackToTop() {
  const btn = document.getElementById('btn-back-to-top');
  const progressCircle = document.getElementById('back-to-top-progress');
  if (!btn || btn.__initialized) return;
  btn.__initialized = true;

  const totalLength = 2 * Math.PI * 22; // r=22 -> ~138.23

  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollTop > 260) {
      btn.classList.add('is-visible');
    } else {
      btn.classList.remove('is-visible');
    }

    if (progressCircle && scrollHeight > 0) {
      const scrollPercent = Math.min(Math.max(scrollTop / scrollHeight, 0), 1);
      const offset = totalLength - (scrollPercent * totalLength);
      progressCircle.style.strokeDashoffset = offset.toFixed(1);
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.audioPlayer) window.audioPlayer.playSFX('whoosh');
  });
}


