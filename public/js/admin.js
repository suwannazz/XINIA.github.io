/**
 * Admin Dashboard Logic
 * Full template configuration, 3D logo preview, member CRUD, and preset manager
 * Role-Based Access Control: Founder, Leader, Member
 */

let activeConfig = {};
let membersList = [];
let presetsList = [];
let mini3DViewer = null;
let currentUser = null;

// Auth Fetch Helper (attaches token to all administrative mutation requests)
function authFetch(url, options = {}) {
  const token = sessionStorage.getItem('admin_token');
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Admin-Token', token);
  }
  return fetch(url, { ...options, headers });
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupTabNavigation();
  setupMobileNav();
  setupRangeSliders();
  setupFileUploads();
  setupMemberModal();
  setupMyProfile();
  setupAudioTestPlayer();
});

// ================= AUTHENTICATION & ROLE MANAGEMENT =================
function checkAuth() {
  const token = sessionStorage.getItem('admin_token');
  const userJson = sessionStorage.getItem('admin_user');
  const loginScreen = document.getElementById('login-screen');
  const adminApp = document.getElementById('admin-app');

  if (userJson) {
    try {
      currentUser = JSON.parse(userJson);
    } catch (e) {
      currentUser = null;
    }
  }

  if (token && currentUser) {
    loginScreen.style.display = 'none';
    adminApp.style.display = 'flex';
    applyUserPermissions(currentUser);
    loadInitialData();
  } else {
    loginScreen.style.display = 'flex';
    adminApp.style.display = 'none';
  }

  const ghNotice = document.getElementById('gh-pages-static-notice');
  if (ghNotice && (window.location.hostname.includes('github.io') || window.location.protocol === 'file:')) {
    ghNotice.style.display = 'block';
  }

  // Handle Login Form (Username & Password)
  const btnLogin = document.getElementById('btn-login-submit');
  const usernameInput = document.getElementById('login-username-input');
  const passwordInput = document.getElementById('login-password-input');

  const doLogin = async () => {
    if (window.location.hostname.includes('github.io')) {
      alert('GitHub Pages เป็นระบบโฮสต์เว็บแบบ Static (ไม่มีเซิร์ฟเวอร์ Node.js สำหรับประมวลผลการล็อกอินและบันทึกข้อมูล)\n\nกรุณาเปิดระบบจัดการหลังบ้านผ่านเครื่องของคุณเองที่:\nhttp://localhost:3000/admin.html ครับ');
      return;
    }

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!username || !password) {
      alert('กรุณากรอกทั้ง Username และ Password');
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('admin_token', data.token);
        sessionStorage.setItem('admin_user', JSON.stringify(data.user));
        currentUser = data.user;

        loginScreen.style.display = 'none';
        adminApp.style.display = 'flex';
        applyUserPermissions(currentUser);
        showToast(`ยินดีต้อนรับ ${currentUser.firstname || currentUser.username} [${currentUser.role}]`);
        loadInitialData();
      } else {
        alert(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  if (btnLogin) btnLogin.addEventListener('click', doLogin);
  if (passwordInput) passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
  if (usernameInput) usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });

  // Handle Logout
  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_user');
      window.location.reload();
    });
  }
}

function applyUserPermissions(user) {
  if (!user) return;

  const role = user.role || 'Member';
  const roleBadge = document.getElementById('admin-user-role-badge');
  const fullnameEl = document.getElementById('admin-user-fullname');
  const avatarEl = document.getElementById('admin-user-avatar');

  if (fullnameEl) {
    fullnameEl.textContent = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username;
  }
  if (avatarEl && user.imageurl) {
    avatarEl.src = user.imageurl;
  }

  // Update Role Badge Styling
  if (roleBadge) {
    roleBadge.textContent = role.toUpperCase();
    if (role === 'Founder') {
      roleBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      roleBadge.style.color = '#fbbf24';
      roleBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else if (role === 'Leader') {
      roleBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      roleBadge.style.color = '#f87171';
      roleBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      roleBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      roleBadge.style.color = '#34d399';
      roleBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    }
  }

  // Update mobile role pill
  const mobileRolePill = document.getElementById('mobile-user-role');
  if (mobileRolePill) {
    mobileRolePill.textContent = role.toUpperCase();
    if (role === 'Founder') {
      mobileRolePill.style.background = 'rgba(245, 158, 11, 0.15)';
      mobileRolePill.style.color = '#fbbf24';
      mobileRolePill.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    } else if (role === 'Leader') {
      mobileRolePill.style.background = 'rgba(239, 68, 68, 0.15)';
      mobileRolePill.style.color = '#f87171';
      mobileRolePill.style.borderColor = 'rgba(239, 68, 68, 0.35)';
    } else {
      mobileRolePill.style.background = 'rgba(16, 185, 129, 0.15)';
      mobileRolePill.style.color = '#34d399';
      mobileRolePill.style.borderColor = 'rgba(16, 185, 129, 0.35)';
    }
  }

  // Filter Tabs according to role (both sidebar and mobile quick tabs)
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item, .mobile-quick-nav .mobile-tab-btn');
  let firstAllowedTab = null;

  navItems.forEach(item => {
    const rolesAllowed = (item.getAttribute('data-roles') || 'Founder').split(',').map(r => r.trim());
    const isAllowed = rolesAllowed.includes(role);

    if (isAllowed) {
      item.style.display = 'inline-flex';
      if (!firstAllowedTab && item.classList.contains('nav-item')) {
        firstAllowedTab = item.getAttribute('data-tab');
      }
    } else {
      item.style.display = 'none';
      item.classList.remove('active');
    }
  });

  // Master Save Button & Header visibility according to role
  const masterSaveBtn = document.getElementById('btn-save-master');
  const mobileSaveBtn = document.getElementById('btn-mobile-save');
  const fabSaveBtn = document.getElementById('btn-mobile-fab-save');
  const quickSelectorWrapper = document.querySelector('.gang-quick-switcher');
  const headerTitle = document.querySelector('.header-title-box h1');
  const headerDesc = document.querySelector('.header-title-box p');

  if (role === 'Member') {
    if (masterSaveBtn) masterSaveBtn.style.display = 'none';
    if (mobileSaveBtn) {
      mobileSaveBtn.querySelector('span').textContent = 'บันทึกโปรไฟล์';
    }
    if (fabSaveBtn) {
      fabSaveBtn.querySelector('span').textContent = 'บันทึกโปรไฟล์';
    }
    if (quickSelectorWrapper) quickSelectorWrapper.style.display = 'none';
    if (headerTitle) headerTitle.textContent = 'จัดการโปรไฟล์ส่วนตัว (Member Profile)';
    if (headerDesc) headerDesc.textContent = 'แก้ไขข้อมูลส่วนตัว, รูปประจำตัว, แคปชั่น, ช่องทางโซเชียล และเปลี่ยนรหัสผ่านของคุณ';
    switchTab('tab-my-profile');
  } else {
    // Founders and Leaders can configure everything
    if (masterSaveBtn) masterSaveBtn.style.display = 'inline-flex';
    if (mobileSaveBtn) {
      mobileSaveBtn.querySelector('span').textContent = 'บันทึก';
    }
    if (fabSaveBtn) {
      fabSaveBtn.querySelector('span').textContent = 'บันทึกการตั้งค่า';
    }
    if (quickSelectorWrapper) quickSelectorWrapper.style.display = 'flex';
    if (headerTitle) headerTitle.textContent = 'แผงควบคุมระบบหลังบ้าน (Command Center)';
    if (headerDesc) headerDesc.textContent = 'จัดการสมาชิก, ปรับแต่งโลโก้ 3 มิติ, ระบบเพลง, เทมเพลต และความปลอดภัย';
    switchTab(firstAllowedTab || 'tab-members');
  }
}

function switchTab(tabId) {
  const currentRole = currentUser?.role || 'Member';
  if (currentRole === 'Member' && tabId !== 'tab-my-profile') {
    tabId = 'tab-my-profile';
  }

  const allNavLinks = document.querySelectorAll('.nav-item, .mobile-tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  allNavLinks.forEach(n => {
    if (n.getAttribute('data-tab') === tabId) {
      n.classList.add('active');
      if (n.classList.contains('mobile-tab-btn')) {
        try {
          n.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } catch (e) {}
      }
    } else {
      n.classList.remove('active');
    }
  });

  panes.forEach(p => {
    if (p.id === tabId) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Automatically close mobile drawer when switching tabs
  closeMobileDrawer();

  if (tabId === 'tab-3d') {
    setTimeout(() => initMini3DPreview(), 100);
  }
}

// ================= MOBILE DRAWER & APP BAR CONTROLLER =================
function openMobileDrawer() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function setupMobileNav() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const closeBtn = document.getElementById('btn-close-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const mobileSaveBtn = document.getElementById('btn-mobile-save');
  const fabSaveBtn = document.getElementById('btn-mobile-fab-save');

  if (toggleBtn) toggleBtn.addEventListener('click', openMobileDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileDrawer);
  if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);

  // Mobile Quick Horizontal Tabs Click
  const mobileTabs = document.querySelectorAll('.mobile-tab-btn');
  mobileTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      if (tabTarget) switchTab(tabTarget);
    });
  });

  // Mobile Save Trigger
  const triggerSave = () => {
    const currentRole = currentUser?.role || 'Member';
    if (currentRole === 'Member') {
      const btnProfileSave = document.getElementById('btn-save-my-profile');
      if (btnProfileSave) btnProfileSave.click();
    } else {
      const btnMasterSave = document.getElementById('btn-save-master');
      if (btnMasterSave) btnMasterSave.click();
    }
  };

  if (mobileSaveBtn) mobileSaveBtn.addEventListener('click', triggerSave);
  if (fabSaveBtn) fabSaveBtn.addEventListener('click', triggerSave);
}

// ================= DATA LOADING & POPULATION =================
async function loadInitialData() {
  await Promise.all([
    fetchConfig(),
    fetchMembersData(),
    fetchPresetsData()
  ]);
  populateMyProfile();
  initMini3DPreview();
}

async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    activeConfig = await res.json();
    populateFormWithConfig(activeConfig);
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

function populateFormWithConfig(cfg) {
  const gang = cfg.gang || {};
  const theme = cfg.theme || {};
  const threeD = cfg.threeD || {};
  const audio = cfg.audio || {};

  // Sidebar & Mobile App Bar Info
  const gangName = gang.name || 'GANG PORTAL';
  document.getElementById('sidebar-gang-name').textContent = gangName;
  const mobileGangName = document.getElementById('mobile-gang-name');
  if (mobileGangName) mobileGangName.textContent = gangName;

  if (theme.logoImage) {
    document.getElementById('sidebar-gang-logo').src = theme.logoImage;
    document.getElementById('login-gang-logo').src = theme.logoImage;
    const mobileLogo = document.getElementById('mobile-gang-logo');
    if (mobileLogo) mobileLogo.src = theme.logoImage;
  }

  // Tab 1: Gang Branding
  setValue('gang_name', gang.name);
  setValue('gang_tag', gang.tag);
  setValue('gang_est', gang.est);
  setValue('gang_motto', gang.motto);
  setValue('gang_serverIp', gang.serverIp);
  setValue('gang_discordUrl', gang.discordUrl);
  setValue('gang_databaseTitle', gang.databaseTitle);
  setValue('gang_description', gang.description);
  setValue('gang_footerText', gang.footerText);
  setValue('gang_footerUrl', gang.footerUrl);

  setValue('theme_backgroundImage', theme.backgroundImage);
  setPreview('preview_backgroundImage', theme.backgroundImage);
  setValue('theme_logoImage', theme.logoImage);
  setPreview('preview_logoImage', theme.logoImage);
  setValue('theme_primaryColor', theme.primaryColor || '#ffffff');
  setValue('theme_accentColor', theme.accentColor || '#f59e0b');
  setValue('theme_leaderColor', theme.leaderColor || '#ef4444');

  // Tab 2: 3D Logo
  setValue('three_mode', threeD.mode || 'dynamic-2d');
  setValue('three_modelUrl', threeD.modelUrl || '');
  setCheckbox('three_autoRotate', threeD.autoRotate !== false);
  setSlider('three_rotationSpeed', threeD.rotationSpeed ?? 0.008);
  setCheckbox('three_floatingAnimation', threeD.floatingAnimation !== false);
  setSlider('three_floatSpeed', threeD.floatSpeed ?? 1.5);
  setSlider('three_floatHeight', threeD.floatHeight ?? 0.15);
  setCheckbox('three_mouseFollow', threeD.mouseFollow !== false);
  setSlider('three_mouseSensitivity', threeD.mouseSensitivity ?? 1.5);
  setValue('three_lightColor', threeD.lightColor || '#ffffff');
  setSlider('three_lightIntensity', threeD.lightIntensity ?? 1.8);
  setSlider('three_metalness', threeD.metalness ?? 0.85);
  setSlider('three_roughness', threeD.roughness ?? 0.25);
  setSlider('three_scale', threeD.scale ?? 1.0);

  // Tab 4: MP3 Audio
  setCheckbox('audio_enabled', audio.enabled !== false);
  setCheckbox('audio_autoPlay', audio.autoPlay === true);
  setCheckbox('audio_loop', audio.loop !== false);
  setCheckbox('audio_sfxEnabled', audio.sfxEnabled !== false);
  setSlider('audio_volume', audio.volume ?? 0.35);
  setValue('audio_title', audio.title || '');
  setValue('audio_artist', audio.artist || '');
  setValue('audio_startTime', audio.startTime ?? '0');
  setValue('audio_endTime', audio.endTime ?? '');
  setValue('audio_src', audio.src || '');
  setValue('audio_cover', audio.cover || '');
  setPreview('preview_audioCover', audio.cover);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined ? val : '';
}

function setCheckbox(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = !!checked;
}

function setPreview(id, src) {
  const el = document.getElementById(id);
  if (el && src) el.src = src;
}

function setSlider(id, val) {
  const el = document.getElementById(id);
  const display = document.getElementById(id + '_val');
  if (el) {
    el.value = val;
    if (display) display.textContent = val;
  }
}

// ================= SAVE CONFIGURATION =================
async function saveAllConfig() {
  const coverUrl = (document.getElementById('audio_cover')?.value || '').trim();
  const currentGang = activeConfig.gang || {};
  const currentTheme = activeConfig.theme || {};
  const currentThree = activeConfig.threeD || {};
  const currentAudio = activeConfig.audio || {};

  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : (fallback || '');
  };

  const getCheck = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.checked : (fallback ?? false);
  };

  const getNum = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : fallback;
  };

  const newConfig = {
    gang: {
      name: getVal('gang_name', currentGang.name),
      tag: getVal('gang_tag', currentGang.tag),
      est: getVal('gang_est', currentGang.est),
      motto: getVal('gang_motto', currentGang.motto),
      serverIp: getVal('gang_serverIp', currentGang.serverIp),
      discordUrl: getVal('gang_discordUrl', currentGang.discordUrl),
      databaseTitle: getVal('gang_databaseTitle', currentGang.databaseTitle),
      description: getVal('gang_description', currentGang.description),
      footerText: getVal('gang_footerText', currentGang.footerText),
      footerUrl: getVal('gang_footerUrl', currentGang.footerUrl)
    },
    theme: {
      backgroundImage: getVal('theme_backgroundImage', currentTheme.backgroundImage),
      logoImage: getVal('theme_logoImage', currentTheme.logoImage),
      primaryColor: document.getElementById('theme_primaryColor')?.value || currentTheme.primaryColor || '#ffffff',
      accentColor: document.getElementById('theme_accentColor')?.value || currentTheme.accentColor || '#f59e0b',
      leaderColor: document.getElementById('theme_leaderColor')?.value || currentTheme.leaderColor || '#ef4444'
    },
    threeD: {
      mode: getVal('three_mode', currentThree.mode || 'dynamic-2d'),
      modelUrl: getVal('three_modelUrl', currentThree.modelUrl || ''),
      autoRotate: getCheck('three_autoRotate', currentThree.autoRotate),
      rotationSpeed: getNum('three_rotationSpeed', currentThree.rotationSpeed ?? 0.008),
      floatingAnimation: getCheck('three_floatingAnimation', currentThree.floatingAnimation),
      floatSpeed: getNum('three_floatSpeed', currentThree.floatSpeed ?? 1.5),
      floatHeight: getNum('three_floatHeight', currentThree.floatHeight ?? 0.15),
      mouseFollow: getCheck('three_mouseFollow', currentThree.mouseFollow),
      mouseSensitivity: getNum('three_mouseSensitivity', currentThree.mouseSensitivity ?? 1.5),
      lightColor: getVal('three_lightColor', currentThree.lightColor || '#ffffff'),
      lightIntensity: getNum('three_lightIntensity', currentThree.lightIntensity ?? 1.8),
      metalness: getNum('three_metalness', currentThree.metalness ?? 0.85),
      roughness: getNum('three_roughness', currentThree.roughness ?? 0.25),
      scale: getNum('three_scale', currentThree.scale ?? 1.0)
    },
    audio: {
      enabled: getCheck('audio_enabled', currentAudio.enabled),
      autoPlay: getCheck('audio_autoPlay', currentAudio.autoPlay),
      type: 'mp3',
      youtubeUrl: '',
      startTime: getVal('audio_startTime', currentAudio.startTime || '0'),
      endTime: getVal('audio_endTime', currentAudio.endTime || '0'),
      loop: getCheck('audio_loop', currentAudio.loop),
      sfxEnabled: getCheck('audio_sfxEnabled', currentAudio.sfxEnabled),
      volume: getNum('audio_volume', currentAudio.volume ?? 0.35),
      title: getVal('audio_title', currentAudio.title || ''),
      artist: getVal('audio_artist', currentAudio.artist || ''),
      src: getVal('audio_src', currentAudio.src || '/uploads/music.mp3'),
      cover: coverUrl
    }
  };

  try {
    const res = await authFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    const result = await res.json();

    if (result.success) {
      activeConfig = newConfig;
      showToast('บันทึกการตั้งค่าเรียบร้อย! (Saved Successfully)');
      // Update sidebar
      document.getElementById('sidebar-gang-name').textContent = newConfig.gang.name;
      if (newConfig.theme.logoImage) {
        document.getElementById('sidebar-gang-logo').src = newConfig.theme.logoImage;
      }
      // Update mini 3D
      if (mini3DViewer) {
        mini3DViewer.updateConfig(newConfig.threeD);
      }
    } else {
      showToast(result.error || 'Failed to save', true);
    }
  } catch (err) {
    showToast('Server connection error', true);
  }
}

// Master Save Button
document.getElementById('btn-save-master').addEventListener('click', saveAllConfig);

// ================= 3D MINI PREVIEW IN ADMIN =================
function initMini3DPreview() {
  const container = document.getElementById('admin-mini-3d');
  if (!container || !window.ThreeLogoViewer) return;

  container.innerHTML = '';
  const threeD = activeConfig.threeD || {};
  const currentMode = document.getElementById('three_mode')?.value || threeD.mode || 'dynamic-2d';
  const logo = document.getElementById('theme_logoImage')?.value || (activeConfig.theme && activeConfig.theme.logoImage) || '/uploads/logo.png';
  const modelUrl = document.getElementById('three_modelUrl')?.value || threeD.modelUrl || '';

  mini3DViewer = new window.ThreeLogoViewer('admin-mini-3d', {
    mode: currentMode,
    logoUrl: logo,
    modelUrl: modelUrl,
    autoRotate: document.getElementById('three_autoRotate')?.checked ?? (threeD.autoRotate !== false),
    rotationSpeed: parseFloat(document.getElementById('three_rotationSpeed')?.value) || (threeD.rotationSpeed ?? 0.008),
    floatingAnimation: document.getElementById('three_floatingAnimation')?.checked ?? (threeD.floatingAnimation !== false),
    floatSpeed: parseFloat(document.getElementById('three_floatSpeed')?.value) || (threeD.floatSpeed ?? 1.5),
    floatHeight: parseFloat(document.getElementById('three_floatHeight')?.value) || (threeD.floatHeight ?? 0.15),
    mouseFollow: true,
    mouseSensitivity: parseFloat(document.getElementById('three_mouseSensitivity')?.value) || (threeD.mouseSensitivity ?? 1.5),
    lightColor: document.getElementById('three_lightColor')?.value || threeD.lightColor || '#ffffff',
    lightIntensity: parseFloat(document.getElementById('three_lightIntensity')?.value) || (threeD.lightIntensity ?? 1.8),
    metalness: parseFloat(document.getElementById('three_metalness')?.value) || (threeD.metalness ?? 0.85),
    roughness: parseFloat(document.getElementById('three_roughness')?.value) || (threeD.roughness ?? 0.25),
    scale: parseFloat(document.getElementById('three_scale')?.value) || (threeD.scale ?? 1.0)
  });
}

function updateMini3DOnSliderChange() {
  if (!mini3DViewer) return;
  mini3DViewer.updateConfig({
    mode: document.getElementById('three_mode').value,
    modelUrl: document.getElementById('three_modelUrl').value.trim(),
    autoRotate: document.getElementById('three_autoRotate').checked,
    rotationSpeed: parseFloat(document.getElementById('three_rotationSpeed').value),
    floatingAnimation: document.getElementById('three_floatingAnimation').checked,
    floatSpeed: parseFloat(document.getElementById('three_floatSpeed').value),
    floatHeight: parseFloat(document.getElementById('three_floatHeight').value),
    mouseSensitivity: parseFloat(document.getElementById('three_mouseSensitivity').value),
    lightColor: document.getElementById('three_lightColor').value,
    lightIntensity: parseFloat(document.getElementById('three_lightIntensity').value),
    metalness: parseFloat(document.getElementById('three_metalness').value),
    roughness: parseFloat(document.getElementById('three_roughness').value),
    scale: parseFloat(document.getElementById('three_scale').value)
  });
}

// ================= FILE UPLOADS (MULTER API) =================
function setupFileUploads() {
  bindUploader('upload_bg_file', 'theme_backgroundImage', 'preview_backgroundImage');
  bindUploader('upload_logo_file', 'theme_logoImage', 'preview_logoImage', () => {
    if (mini3DViewer) {
      mini3DViewer.updateConfig({ logoUrl: document.getElementById('theme_logoImage').value });
    }
  });
  bindUploader('upload_audio_file', 'audio_src');
  bindUploader('upload_cover_file', 'audio_cover', 'preview_audioCover');
  bindUploader('upload_glb_file', 'three_modelUrl', null, () => {
    document.getElementById('three_mode').value = 'model';
    updateMini3DOnSliderChange();
  });
  bindUploader('modal_member_file', 'modal_member_image', 'modal_avatar_preview');
  bindUploader('modal_member_banner_file', 'modal_member_banner', 'modal_banner_preview');
  bindUploader('my_profile_file', 'my_profile_image', 'my_profile_avatar_preview');
  bindUploader('my_profile_banner_file', 'my_profile_banner', 'my_profile_banner_preview');
}

function bindUploader(fileInputId, targetInputId, previewImgId, onDone) {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    showToast('กำลังอัปโหลดไฟล์... (Uploading)');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success && data.url) {
        document.getElementById(targetInputId).value = data.url;
        if (previewImgId) {
          document.getElementById(previewImgId).src = data.url;
        }
        showToast('อัปโหลดไฟล์เรียบร้อย! (Upload Complete)');
        if (onDone) onDone(data.url);
      } else {
        showToast(data.error || 'Upload failed', true);
      }
    } catch (err) {
      showToast('Error uploading file', true);
    }
  });
}

// ================= MEMBER MANAGEMENT (CRUD) =================
async function fetchMembersData() {
  try {
    const res = await fetch('/api/members?limit=200');
    const data = await res.json();
    membersList = data.all || [];
    renderMembersTable();
  } catch (err) {
    console.error('Failed to load members:', err);
  }
}

function renderMembersTable(filterCategory = 'All', search = '') {
  const tbody = document.getElementById('members-table-body');
  if (!tbody) return;

  let filtered = [...membersList];
  if (filterCategory !== 'All') {
    filtered = filtered.filter(m => m.category === filterCategory);
  }
  if (search) {
    filtered = filtered.filter(m => {
      const name = `${m.firstname} ${m.lastname}`.toLowerCase();
      return name.includes(search.toLowerCase()) || (m.role && m.role.toLowerCase().includes(search.toLowerCase()));
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#777;">ไม่พบข้อมูลสมาชิก (No members found)</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    let badgeClass = 'badge-member';
    if (m.category === 'Founders' || m.role === 'Founder') badgeClass = 'badge-founder';
    else if (m.category === 'Leaders' || (m.role && m.role.toLowerCase().includes('leader'))) badgeClass = 'badge-leader';

    return `
      <tr>
        <td style="width:60px;">
          <div class="member-td-avatar">
            <img src="${m.imageurl || './uploads/logo.png'}" onerror="this.onerror=null; this.src='./uploads/logo.png';" />
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
            <strong style="color:#fff;font-size:0.95rem;">${m.firstname} ${m.lastname}</strong>
            ${m.username ? `<span style="font-family:var(--font-hud);font-size:0.65rem;color:var(--cyber-cyan);background:rgba(0,240,255,0.12);padding:0.1rem 0.4rem;border-radius:3px;border:1px solid rgba(0,240,255,0.25);">@${m.username}</span>` : ''}
          </div>
          ${m.caption ? `<div style="font-size:0.75rem;color:#94a3b8;font-style:italic;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.2rem;">"${m.caption}"</div>` : ''}
          <div style="font-size:0.7rem;color:#64748b;margin-top:0.1rem;">${m.isGangOnly ? '★ Verified Crew' : ''}</div>
        </td>
        <td>
          <span class="badge-tag ${badgeClass}">${m.role || 'Member'}</span>
        </td>
        <td>${m.category || 'Members'}</td>
        <td>
          ${m.sociallinks && m.sociallinks.facebook ? `<a href="${m.sociallinks.facebook}" target="_blank" style="color:#60a5fa;text-decoration:none;font-size:0.8rem;">FB Profile</a>` : ''}
          ${m.sociallinks && m.sociallinks.discord ? `<span style="display:block;color:#818cf8;font-size:0.75rem;">${m.sociallinks.discord}</span>` : ''}
          ${(!m.sociallinks || (!m.sociallinks.facebook && !m.sociallinks.discord)) ? '<span style="color:#555;">-</span>' : ''}
        </td>
        <td style="text-align:right;">
          <div class="table-actions" style="justify-content:flex-end;">
            <button class="btn-action-sm" onclick="editMember('${m.id}')" title="Edit Member">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-action-sm btn-action-delete" onclick="deleteMember('${m.id}')" title="Delete Member">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupMemberModal() {
  const modal = document.getElementById('member-modal');
  const btnOpen = document.getElementById('btn-add-member');
  const btnClose = document.getElementById('btn-close-member-modal');
  const btnSave = document.getElementById('btn-save-member');

  btnOpen.addEventListener('click', () => {
    document.getElementById('modal-member-id').value = '';
    document.getElementById('modal-member-title').textContent = 'เพิ่มสมาชิกใหม่ (Add New Member)';
    document.getElementById('modal_member_username').value = '';
    document.getElementById('modal_member_password').value = '123456';
    document.getElementById('modal_member_firstname').value = '';
    document.getElementById('modal_member_lastname').value = '';
    document.getElementById('modal_member_role').value = 'Member';
    document.getElementById('modal_member_category').value = 'Members';
    document.getElementById('modal_member_caption').value = '';
    document.getElementById('modal_member_image').value = '/uploads/logo.png';
    document.getElementById('modal_avatar_preview').src = '/uploads/logo.png';
    document.getElementById('modal_member_banner').value = '/uploads/bg.jpg';
    document.getElementById('modal_banner_preview').src = '/uploads/bg.jpg';
    document.getElementById('modal_member_fb').value = '';
    document.getElementById('modal_member_discord').value = '';
    if (document.getElementById('modal_member_ig')) document.getElementById('modal_member_ig').value = '';
    if (document.getElementById('modal_member_tiktok')) document.getElementById('modal_member_tiktok').value = '';
    if (document.getElementById('modal_member_twitter')) document.getElementById('modal_member_twitter').value = '';
    if (document.getElementById('modal_member_youtube')) document.getElementById('modal_member_youtube').value = '';
    if (document.getElementById('modal_member_twitch')) document.getElementById('modal_member_twitch').value = '';
    document.getElementById('modal_member_gangOnly').checked = true;
    modal.classList.add('open');
  });

  btnClose.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  // Tap backdrop to dismiss modal on mobile
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
    }
  });

  btnSave.addEventListener('click', async () => {
    const id = document.getElementById('modal-member-id').value;
    const memberData = {
      firstname: document.getElementById('modal_member_firstname').value.trim(),
      lastname: document.getElementById('modal_member_lastname').value.trim(),
      username: document.getElementById('modal_member_username').value.trim(),
      password: document.getElementById('modal_member_password').value.trim(),
      role: document.getElementById('modal_member_role').value.trim() || 'Member',
      category: document.getElementById('modal_member_category').value,
      caption: document.getElementById('modal_member_caption').value.trim(),
      imageurl: document.getElementById('modal_member_image').value.trim() || '/uploads/logo.png',
      bannerUrl: document.getElementById('modal_member_banner').value.trim() || '/uploads/bg.jpg',
      sociallinks: {
        facebook: document.getElementById('modal_member_fb')?.value.trim() || '',
        discord: document.getElementById('modal_member_discord')?.value.trim() || '',
        ig: document.getElementById('modal_member_ig')?.value.trim() || '',
        tiktok: document.getElementById('modal_member_tiktok')?.value.trim() || '',
        twitter: document.getElementById('modal_member_twitter')?.value.trim() || '',
        youtube: document.getElementById('modal_member_youtube')?.value.trim() || '',
        twitch: document.getElementById('modal_member_twitch')?.value.trim() || ''
      },
      isGangOnly: document.getElementById('modal_member_gangOnly').checked,
      status: 'online'
    };

    if (!memberData.firstname) {
      alert('กรุณากรอกชื่อสมาชิก (Please enter member name)');
      return;
    }

    try {
      const url = id ? `/api/members/${id}` : '/api/members';
      const method = id ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
      const result = await res.json();

      if (result.success) {
        modal.classList.remove('open');
        showToast(id ? 'อัปเดตสมาชิกสำเร็จ!' : 'เพิ่มสมาชิกใหม่สำเร็จ!');
        await fetchMembersData();
      } else {
        alert(result.error || 'Failed to save member');
      }
    } catch (err) {
      alert('Server error saving member');
    }
  });

  // Category filter in table
  const catFilter = document.getElementById('admin-member-filter');
  const searchInput = document.getElementById('admin-member-search');

  if (catFilter) {
    catFilter.addEventListener('change', () => {
      renderMembersTable(catFilter.value, searchInput.value);
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderMembersTable(catFilter.value, searchInput.value);
    });
  }
}

window.editMember = (id) => {
  const member = membersList.find(m => m.id === id);
  if (!member) return;

  document.getElementById('modal-member-id').value = member.id;
  document.getElementById('modal-member-title').textContent = 'แก้ไขสมาชิก (Edit Member)';
  document.getElementById('modal_member_username').value = member.username || '';
  document.getElementById('modal_member_password').value = ''; // leave empty so existing password remains
  document.getElementById('modal_member_firstname').value = member.firstname || '';
  document.getElementById('modal_member_lastname').value = member.lastname || '';
  document.getElementById('modal_member_role').value = member.role || 'Member';
  document.getElementById('modal_member_category').value = member.category || 'Members';
  document.getElementById('modal_member_caption').value = member.caption || '';
  document.getElementById('modal_member_image').value = member.imageurl || '/uploads/logo.png';
  document.getElementById('modal_avatar_preview').src = member.imageurl || '/uploads/logo.png';
  
  const banner = member.bannerUrl || '/uploads/bg.jpg';
  document.getElementById('modal_member_banner').value = banner;
  document.getElementById('modal_banner_preview').src = banner;

  const s = member.sociallinks || {};
  if (document.getElementById('modal_member_fb')) document.getElementById('modal_member_fb').value = s.facebook || '';
  if (document.getElementById('modal_member_discord')) document.getElementById('modal_member_discord').value = s.discord || '';
  if (document.getElementById('modal_member_ig')) document.getElementById('modal_member_ig').value = s.ig || s.instagram || '';
  if (document.getElementById('modal_member_tiktok')) document.getElementById('modal_member_tiktok').value = s.tiktok || '';
  if (document.getElementById('modal_member_twitter')) document.getElementById('modal_member_twitter').value = s.twitter || s.twiter || '';
  if (document.getElementById('modal_member_youtube')) document.getElementById('modal_member_youtube').value = s.youtube || '';
  if (document.getElementById('modal_member_twitch')) document.getElementById('modal_member_twitch').value = s.twitch || s.twit || '';
  if (document.getElementById('modal_member_gangOnly')) document.getElementById('modal_member_gangOnly').checked = member.isGangOnly !== false;

  document.getElementById('member-modal').classList.add('open');
};

// ================= MY PROFILE LOGIC =================
function setupMyProfile() {
  const btnSave = document.getElementById('btn-save-my-profile');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      if (!currentUser || !currentUser.id) return;

      const updatedData = {
        firstname: document.getElementById('my_profile_firstname').value.trim(),
        lastname: document.getElementById('my_profile_lastname').value.trim(),
        caption: document.getElementById('my_profile_caption').value.trim(),
        imageurl: document.getElementById('my_profile_image').value.trim() || '/uploads/logo.png',
        bannerUrl: document.getElementById('my_profile_banner').value.trim() || '/uploads/bg.jpg',
        sociallinks: {
          facebook: document.getElementById('my_profile_fb')?.value.trim() || '',
          discord: document.getElementById('my_profile_discord')?.value.trim() || '',
          ig: document.getElementById('my_profile_ig')?.value.trim() || '',
          tiktok: document.getElementById('my_profile_tiktok')?.value.trim() || '',
          twitter: document.getElementById('my_profile_twitter')?.value.trim() || '',
          youtube: document.getElementById('my_profile_youtube')?.value.trim() || '',
          twitch: document.getElementById('my_profile_twitch')?.value.trim() || ''
        }
      };

      const newPass = document.getElementById('my_profile_new_password').value.trim();
      if (newPass) {
        updatedData.password = newPass;
      }

      try {
        const res = await authFetch(`/api/members/${currentUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
        const result = await res.json();

        if (result.success) {
          currentUser = {
            ...currentUser,
            ...result.member
          };
          sessionStorage.setItem('admin_user', JSON.stringify(currentUser));
          applyUserPermissions(currentUser);
          showToast('บันทึกโปรไฟล์ส่วนตัวเรียบร้อยแล้ว!');
          document.getElementById('my_profile_new_password').value = '';
          await fetchMembersData();
        } else {
          alert(result.error || 'Failed to update profile');
        }
      } catch (err) {
        alert('Server error updating profile');
      }
    });
  }
}

function populateMyProfile() {
  if (!currentUser) return;

  const idEl = document.getElementById('my_profile_id');
  const fnEl = document.getElementById('my_profile_firstname');
  const lnEl = document.getElementById('my_profile_lastname');
  const capEl = document.getElementById('my_profile_caption');
  const imgEl = document.getElementById('my_profile_image');
  const prevEl = document.getElementById('my_profile_avatar_preview');
  const bannerEl = document.getElementById('my_profile_banner');
  const bannerPrevEl = document.getElementById('my_profile_banner_preview');

  if (idEl) idEl.value = currentUser.id || '';
  if (fnEl) fnEl.value = currentUser.firstname || '';
  if (lnEl) lnEl.value = currentUser.lastname || '';
  if (capEl) capEl.value = currentUser.caption || '';
  if (imgEl) imgEl.value = currentUser.imageurl || '/uploads/logo.png';
  if (prevEl) prevEl.src = currentUser.imageurl || '/uploads/logo.png';
  if (bannerEl) bannerEl.value = currentUser.bannerUrl || '/uploads/bg.jpg';
  if (bannerPrevEl) bannerPrevEl.src = currentUser.bannerUrl || '/uploads/bg.jpg';

  const s = currentUser.sociallinks || {};
  if (document.getElementById('my_profile_fb')) document.getElementById('my_profile_fb').value = s.facebook || '';
  if (document.getElementById('my_profile_discord')) document.getElementById('my_profile_discord').value = s.discord || '';
  if (document.getElementById('my_profile_ig')) document.getElementById('my_profile_ig').value = s.ig || s.instagram || '';
  if (document.getElementById('my_profile_tiktok')) document.getElementById('my_profile_tiktok').value = s.tiktok || '';
  if (document.getElementById('my_profile_twitter')) document.getElementById('my_profile_twitter').value = s.twitter || s.twiter || '';
  if (document.getElementById('my_profile_youtube')) document.getElementById('my_profile_youtube').value = s.youtube || '';
  if (document.getElementById('my_profile_twitch')) document.getElementById('my_profile_twitch').value = s.twitch || s.twit || '';
}

window.deleteMember = async (id) => {
  if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิกคนนี้? (Delete this member?)')) return;

  try {
    const res = await authFetch(`/api/members/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('ลบสมาชิกเรียบร้อยแล้ว');
      await fetchMembersData();
    } else {
      alert(result.error || 'Failed to delete');
    }
  } catch (err) {
    alert('Server error deleting member');
  }
};

// ================= PRESETS ENGINE (MULTI-GANG TEMPLATES) =================
async function fetchPresetsData() {
  try {
    const res = await fetch('/api/presets');
    presetsList = await res.json();
    renderPresetsList();
  } catch (err) {
    console.error('Failed to load presets:', err);
  }
}

function renderPresetsList() {
  const container = document.getElementById('presets-cards-container');
  if (!container) return;

  container.innerHTML = presetsList.map(preset => {
    return `
      <div class="admin-card" style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
        <div>
          <h3 style="font-family:var(--font-tech);font-size:1.1rem;color:#ffffff;margin-bottom:0.25rem;">
            ${preset.name}
          </h3>
          <p style="font-size:0.8rem;color:#9ca3af;">${preset.description || 'Custom Gang Preset'}</p>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <button class="btn-login" style="width:auto;padding:0.5rem 1.25rem;font-size:0.75rem;background:#10b981;color:#fff;" onclick="loadPreset('${preset.id}')">
            ใช้งาน Template นี้ (Apply)
          </button>
          <button class="btn-action-sm btn-action-delete" onclick="deletePreset('${preset.id}')" title="Delete Preset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Populate Header Quick Preset Selector
  const quickSelector = document.getElementById('quick-preset-selector');
  if (quickSelector) {
    quickSelector.innerHTML = presetsList.map(p => {
      const isSelected = p.config && p.config.gang && p.config.gang.name === activeConfig.gang?.name;
      return `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${p.name}</option>`;
    }).join('');

    quickSelector.onchange = (e) => {
      const selectedId = e.target.value;
      if (selectedId) loadPreset(selectedId);
    };
  }
}

window.loadPreset = async (presetId) => {
  if (!confirm('ต้องการสลับเว็บเป็น Template นี้หรือไม่? (Switch to this Gang Template?)')) return;

  try {
    const res = await authFetch(`/api/presets/load/${presetId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      activeConfig = data.config;
      populateFormWithConfig(activeConfig);
      if (mini3DViewer) mini3DViewer.updateConfig(activeConfig.threeD);

      // Refresh members data if preset had members
      if (data.members) {
        membersList = data.members;
        renderMembersTable();
      } else {
        await fetchMembersData();
      }

      // Update header quick selector
      const quickSelector = document.getElementById('quick-preset-selector');
      if (quickSelector) quickSelector.value = presetId;

      showToast(`สลับเป็นแก๊ง: ${data.message} สำเร็จ!`);
    } else {
      alert(data.error || 'Failed to load preset');
    }
  } catch (err) {
    alert('Server error loading preset');
  }
};

window.deletePreset = async (presetId) => {
  if (!confirm('ต้องการลบ Preset นี้หรือไม่?')) return;
  try {
    await authFetch(`/api/presets/${presetId}`, { method: 'DELETE' });
    showToast('ลบ Preset เรียบร้อย');
    await fetchPresetsData();
  } catch (err) {
    alert('Error deleting preset');
  }
};

// Save current as preset
const btnSavePreset = document.getElementById('btn-save-as-preset');
if (btnSavePreset) {
  btnSavePreset.addEventListener('click', async () => {
    const name = prompt('กรุณากรอกชื่อ Gang Template ใหม่: (e.g. VAGOS GANG)');
    if (!name) return;
    const description = prompt('คำอธิบายสั้นๆ (Description):', 'FiveM Roleplay Gang Template');

    try {
      const res = await authFetch('/api/presets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          config: activeConfig
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast('บันทึก Preset ใหม่เรียบร้อยแล้ว!');
        await fetchPresetsData();
      }
    } catch (err) {
      alert('Failed to save preset');
    }
  });
}

// Export Config JSON
const btnExportJson = document.getElementById('btn-export-json');
if (btnExportJson) {
  btnExportJson.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(activeConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gang-config-${activeConfig.gang?.name || 'preset'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์ Config เรียบร้อย!');
  });
}

// Import Config JSON
const importJsonFile = document.getElementById('import-json-file');
if (importJsonFile) {
  importJsonFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.gang) {
          activeConfig = imported;
          populateFormWithConfig(imported);
          await saveAllConfig();
          showToast('นำเข้าข้อมูลสำเร็จและบันทึกเรียบร้อย!');
        } else {
          alert('รูปแบบไฟล์ Config ไม่ถูกต้อง');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ JSON');
      }
    };
    reader.readAsText(file);
  });
}

// ================= SECURITY TAB (CHANGE PIN) =================
document.getElementById('btn-change-pin').addEventListener('click', async () => {
  const currentPin = document.getElementById('sec_currentPin').value.trim();
  const newPin = document.getElementById('sec_newPin').value.trim();

  if (!currentPin || !newPin) {
    alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  try {
    const res = await authFetch('/api/admin/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    });
    const result = await res.json();

    if (result.success) {
      showToast('เปลี่ยนรหัส PIN เรียบร้อยแล้ว!');
      document.getElementById('sec_currentPin').value = '';
      document.getElementById('sec_newPin').value = '';
    } else {
      alert(result.error || 'Failed to change PIN');
    }
  } catch (err) {
    alert('Server error changing PIN');
  }
});

// ================= TABS & UI HELPERS =================
function setupTabNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabTarget = item.getAttribute('data-tab');
      if (tabTarget) {
        switchTab(tabTarget);
      }
    });
  });
}

function setupRangeSliders() {
  const sliders = document.querySelectorAll('.range-slider');
  sliders.forEach(slider => {
    const valDisplay = document.getElementById(slider.id + '_val');
    slider.addEventListener('input', () => {
      if (valDisplay) valDisplay.textContent = slider.value;
      if (slider.id.startsWith('three_')) {
        updateMini3DOnSliderChange();
      }
    });
  });

  // Mode and Color change listeners
  const modeSelect = document.getElementById('three_mode');
  if (modeSelect) {
    modeSelect.addEventListener('change', updateMini3DOnSliderChange);
  }
  const lightColorInput = document.getElementById('three_lightColor');
  if (lightColorInput) {
    lightColorInput.addEventListener('input', updateMini3DOnSliderChange);
  }
}

// ================= YOUTUBE METADATA AUTO-FETCH & TEST PLAYER =================
let adminTestAudioPlayer = null;
let isFetchingYT = false;

async function fetchYouTubeInfo(url, isManual = false) {
  if (!url || isFetchingYT) return;
  const statusEl = document.getElementById('yt-fetch-status');
  const btnFetch = document.getElementById('btn-fetch-yt');

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (!match || match[2].length !== 11) {
    if (isManual) {
      showToast('ลิงก์ YouTube ไม่ถูกต้อง', true);
    }
    return;
  }

  isFetchingYT = true;
  if (statusEl) {
    statusEl.style.display = 'inline-block';
    statusEl.textContent = '⚡ กำลังดึงข้อมูล...';
    statusEl.style.color = '#00f0ff';
  }
  if (btnFetch) {
    btnFetch.disabled = true;
    btnFetch.style.opacity = '0.6';
  }

  try {
    const res = await fetch(`/api/youtube-info?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (data.success) {
      // 1. Auto-fill Title & Artist
      const titleInput = document.getElementById('audio_title');
      const artistInput = document.getElementById('audio_artist');
      if (titleInput && data.title) {
        titleInput.value = data.title;
      }
      if (artistInput && data.artist) {
        artistInput.value = data.artist;
      }

      // 2. Auto-fill Cover Artwork
      const coverInput = document.getElementById('audio_cover');
      if (coverInput && data.cover) {
        coverInput.value = data.cover;
        setPreview('preview_audioCover', data.cover);
      }

      // 3. Auto-fill Start Timestamp if present in URL
      const startInput = document.getElementById('audio_startTime');
      if (startInput && data.startTime) {
        startInput.value = data.startTime;
      }

      if (statusEl) {
        statusEl.textContent = `✓ ${data.artist} - ${data.title}`;
        statusEl.style.color = '#10b981';
      }
      showToast(`ดึงข้อมูลสำเร็จ: ${data.artist} - ${data.title}`);
    } else {
      if (statusEl) {
        statusEl.textContent = '✗ ไม่พบข้อมูล';
        statusEl.style.color = '#ef4444';
      }
      if (isManual) {
        showToast(data.error || 'ไม่สามารถดึงข้อมูล YouTube ได้', true);
      }
    }
  } catch (err) {
    console.error('Fetch YT info failed:', err);
    if (statusEl) {
      statusEl.textContent = '✗ ผิดพลาด';
      statusEl.style.color = '#ef4444';
    }
    if (isManual) showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', true);
  } finally {
    isFetchingYT = false;
    if (btnFetch) {
      btnFetch.disabled = false;
      btnFetch.style.opacity = '1';
    }
  }
}

function parseAudioTime(val) {
  if (typeof val === 'number') return Math.max(0, val);
  if (!val) return 0;
  const str = String(val).trim().toLowerCase();
  if (!str) return 0;
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length === 2) {
      return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
    } else if (parts.length === 3) {
      return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseFloat(parts[2]) || 0);
    }
  }
  return parseFloat(str) || 0;
}

function setupAudioTestPlayer() {
  const btnTest = document.getElementById('btn-test-mp3-play');
  if (!btnTest) return;

  btnTest.addEventListener('click', () => {
    const src = (document.getElementById('audio_src')?.value || '').trim();
    const volume = parseFloat(document.getElementById('audio_volume')?.value || '0.35');
    const startStr = (document.getElementById('audio_startTime')?.value || '0').trim();
    const endStr = (document.getElementById('audio_endTime')?.value || '').trim();
    const startSec = parseAudioTime(startStr);
    const endSec = parseAudioTime(endStr);

    if (!src) {
      showToast('กรุณาระบุไฟล์เพลงหรือ URL .mp3 ก่อนทดสอบฟัง', true);
      return;
    }

    if (adminTestAudioPlayer && !adminTestAudioPlayer.paused) {
      adminTestAudioPlayer.pause();
      adminTestAudioPlayer = null;
      btnTest.textContent = '▶ ทดสอบฟังเพลง (Test Play)';
      showToast('หยุดเล่นเพลงทดสอบแล้ว');
      return;
    }

    if (adminTestAudioPlayer) {
      adminTestAudioPlayer.pause();
      adminTestAudioPlayer = null;
    }

    try {
      adminTestAudioPlayer = new Audio(src);
      adminTestAudioPlayer.volume = isNaN(volume) ? 0.35 : Math.max(0, Math.min(1, volume));

      const applySeek = () => {
        if (startSec > 0 && adminTestAudioPlayer) {
          try {
            adminTestAudioPlayer.currentTime = startSec;
          } catch (e) {}
        }
      };

      adminTestAudioPlayer.addEventListener('loadedmetadata', applySeek, { once: true });

      adminTestAudioPlayer.play().then(() => {
        applySeek();
        btnTest.textContent = '⏸ หยุดทดสอบฟัง';
        showToast(`กำลังเล่นเพลงทดสอบ (เริ่มท่อน: ${startStr || '0:00'})...`);
      }).catch(err => {
        showToast('ไม่สามารถเล่นไฟล์เสียงได้ กรุณาตรวจสอบลิงก์หรือไฟล์ .mp3', true);
      });

      if (endSec > startSec) {
        adminTestAudioPlayer.addEventListener('timeupdate', () => {
          if (adminTestAudioPlayer && adminTestAudioPlayer.currentTime >= endSec) {
            adminTestAudioPlayer.pause();
            adminTestAudioPlayer = null;
            btnTest.textContent = '▶ ทดสอบฟังเพลง (Test Play)';
            showToast('เล่นถึงเวลาท่อนจบที่กำหนดแล้ว');
          }
        });
      }

      adminTestAudioPlayer.addEventListener('ended', () => {
        btnTest.textContent = '▶ ทดสอบฟังเพลง (Test Play)';
        adminTestAudioPlayer = null;
      });
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการโหลดไฟล์เสียง', true);
    }
  });
}

function showToast(msg, isError = false) {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = isError ? 'admin-toast show error' : 'admin-toast show';

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
