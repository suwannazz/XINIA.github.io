const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Dynamic SSR Page Routes with Social Media Meta Embeds (Discord, Facebook, Line, Twitter)
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(injectDynamicMeta(html, req, 'home'));
  });
});

app.get('/index.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(injectDynamicMeta(html, req, 'home'));
  });
});

app.get('/members', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'members.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(injectDynamicMeta(html, req, 'members'));
  });
});

app.get('/members.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'members.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(injectDynamicMeta(html, req, 'members'));
  });
});

app.get('/admin', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'admin.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(injectDynamicMeta(html, req, 'admin'));
  });
});

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for File Uploads (Images, Audio, 3D Models)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp3', '.ogg', '.wav', '.glb', '.gltf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  }
});

// Helper functions for reading/writing JSON
function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    const fileName = path.basename(filePath);
    const publicDataDir = path.join(__dirname, 'public', 'data');
    if (!fs.existsSync(publicDataDir)) {
      fs.mkdirSync(publicDataDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDataDir, fileName), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Dynamic Open Graph / Discord / Social Embed Injector
function injectDynamicMeta(html, req, pageType = 'home') {
  const config = readJson(CONFIG_FILE, {});
  const gang = config.gang || {};
  const theme = config.theme || {};

  const gangName = (gang.name || 'GANG').trim();
  const gangTag = (gang.tag || 'ELITE SYNDICATE').trim();
  const gangMotto = (gang.motto || '').trim();
  const gangDesc = (gang.description || `${gangName} Official FiveM Community`).trim();
  const accentColor = theme.accentColor || '#f59e0b';

  // Support reverse proxies (Cloudflare tunnels, nginx, ngrok, etc.)
  const proto = (req && req.headers && req.headers['x-forwarded-proto']) || (req && req.protocol) || 'https';
  const host = (req && req.headers && req.headers['x-forwarded-host']) || (req && req.get && req.get('host')) || 'localhost:3000';
  const baseUrl = `${proto}://${host}`;

  let logoImage = theme.logoImage || '/uploads/logo.png';
  let ogImage = logoImage.startsWith('http') ? logoImage : `${baseUrl}${logoImage.startsWith('/') ? '' : '/'}${logoImage}`;

  let pageTitle = '';
  let metaDesc = '';

  if (pageType === 'members') {
    pageTitle = `${gangName} // OPERATIVES DATABASE`;
    metaDesc = gangDesc || gangMotto || `Official Operatives Roster & Database of ${gangName}`;
  } else if (pageType === 'admin') {
    pageTitle = `${gangName} // COMMAND CENTER`;
    metaDesc = `Control panel & database management for ${gangName}`;
  } else {
    pageTitle = gangTag ? `${gangName} // ${gangTag}` : `${gangName} // FIVE-M COMMUNITY`;
    metaDesc = gangMotto || gangDesc || `${gangName} Official FiveM Community`;
  }

  const currentUrl = req ? `${baseUrl}${req.originalUrl || '/'}` : baseUrl;

  // Clean out any existing title, meta tags, and open graph/twitter comment headers
  html = html.replace(/<title[\s\S]*?<\/title>/gi, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']theme-color["'][^>]*>/gi, '');
  html = html.replace(/<!--\s*(Open Graph|Twitter Card)[\s\S]*?-->/gi, '');

  const metaBlock = `
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">

  <!-- Open Graph / Discord / Facebook / Line Embeds -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(gangName)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${currentUrl}">
  <meta name="theme-color" content="${accentColor}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}">
  <meta name="twitter:image" content="${ogImage}">
`;

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${metaBlock}`);
  }
  return metaBlock + html;
}

// Synchronize static HTML files on disk as baseline fallback
function syncStaticHtmlFiles() {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    const membersPath = path.join(__dirname, 'public', 'members.html');

    if (fs.existsSync(indexPath)) {
      let indexHtml = fs.readFileSync(indexPath, 'utf-8');
      indexHtml = injectDynamicMeta(indexHtml, null, 'home');
      fs.writeFileSync(indexPath, indexHtml, 'utf-8');
    }

    if (fs.existsSync(membersPath)) {
      let membersHtml = fs.readFileSync(membersPath, 'utf-8');
      membersHtml = injectDynamicMeta(membersHtml, null, 'members');
      fs.writeFileSync(membersPath, membersHtml, 'utf-8');
    }
  } catch (err) {
    console.error('Error syncing static HTML meta tags:', err);
  }
}

// ================= SESSION & ROLE-BASED ACCESS CONTROL =================
const activeSessions = new Map();

function createSession(user) {
  const token = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  activeSessions.set(token, user);
  return token;
}

function getAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.headers['x-admin-token'] || req.query.token;
  if (!token) return null;
  return activeSessions.get(token) || null;
}

// Middleware: Require Founder or Leader role (Blocks Member from gang-wide configs)
function requireAdminRole(req, res, next) {
  const user = getAuthUser(req);
  if (user && user.role === 'Member') {
    return res.status(403).json({ error: 'สิทธิ์เฉพาะระดับ Founder และ Leader เท่านั้น (Member ไม่สามารถแก้ไขส่วนนี้ได้)' });
  }
  next();
}

// ================= API ROUTES =================

// 1. Get Site Config
app.get('/api/config', (req, res) => {
  const config = readJson(CONFIG_FILE, {});
  // Do not expose admin PIN in public config response
  const publicConfig = { ...config };
  if (publicConfig.security) {
    const { adminPin, ...safeSec } = publicConfig.security;
    publicConfig.security = safeSec;
  }
  res.json(publicConfig);
});

// 2. Update Site Config (Founders & Leaders Only)
app.post('/api/config', requireAdminRole, (req, res) => {
  const currentConfig = readJson(CONFIG_FILE, {});
  const newConfig = req.body;
  
  // Preserve security PIN if not provided
  if (!newConfig.security || !newConfig.security.adminPin) {
    newConfig.security = currentConfig.security || { adminPin: 'admin123' };
  }

  const success = writeJson(CONFIG_FILE, newConfig);
  if (success) {
    syncStaticHtmlFiles();
    res.json({ success: true, message: 'Configuration saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// 3. Admin Authentication Check (Username & Password with Role-based access)
app.post('/api/admin/login', (req, res) => {
  const { username, password, pin } = req.body;
  const config = readJson(CONFIG_FILE, {});
  const expectedPin = (config.security && config.security.adminPin) ? config.security.adminPin : 'admin123';
  const members = readJson(MEMBERS_FILE, []);

  // Backward-compatibility: if PIN is supplied without username
  if (pin && !username) {
    if (pin === expectedPin) {
      const user = {
        id: 'root-admin',
        firstname: 'System',
        lastname: 'Founder',
        username: 'admin',
        role: 'Founder',
        category: 'Founders',
        imageurl: '/uploads/logo.png'
      };
      const token = createSession(user);
      return res.json({
        success: true,
        token: token,
        user: user
      });
    } else {
      return res.status(401).json({ success: false, error: 'รหัส PIN ไม่ถูกต้อง (Incorrect PIN)' });
    }
  }

  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanUser || !cleanPass) {
    return res.status(400).json({ success: false, error: 'กรุณากรอก Username และ Password' });
  }

  // 1. Check against members list
  const member = members.find(m => (m.username || '').trim().toLowerCase() === cleanUser);
  if (member && member.password === cleanPass) {
    let role = 'Member';
    const cat = (member.category || '').toLowerCase();
    const rTitle = (member.role || '').toLowerCase();

    if (cat === 'founders' || rTitle.includes('founder') || cleanUser === 'admin') {
      role = 'Founder';
    } else if (cat === 'leaders' || rTitle.includes('leader')) {
      role = 'Leader';
    }

    const safeUser = {
      ...sanitizeMember(member),
      role: role
    };
    const token = createSession(safeUser);

    return res.json({
      success: true,
      token: token,
      user: safeUser
    });
  }

  // 2. Fallback check for master admin account
  if (cleanUser === 'admin' && cleanPass === expectedPin) {
    const safeUser = {
      id: 'root-admin',
      firstname: 'System',
      lastname: 'Founder',
      username: 'admin',
      role: 'Founder',
      category: 'Founders',
      caption: 'Master Administrator',
      imageurl: '/uploads/logo.png'
    };
    const token = createSession(safeUser);
    return res.json({
      success: true,
      token: token,
      user: safeUser
    });
  }

  return res.status(401).json({
    success: false,
    error: 'ชื่อผู้ใช้ (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง'
  });
});

// 4. Update Admin PIN (Founders & Leaders Only)
app.post('/api/admin/change-pin', requireAdminRole, (req, res) => {
  const { currentPin, newPin } = req.body;
  const config = readJson(CONFIG_FILE, {});
  const expectedPin = (config.security && config.security.adminPin) ? config.security.adminPin : 'admin123';

  if (currentPin !== expectedPin) {
    return res.status(401).json({ success: false, error: 'รหัส PIN ปัจจุบันไม่ถูกต้อง' });
  }
  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ success: false, error: 'รหัสใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' });
  }

  config.security = { adminPin: newPin };
  writeJson(CONFIG_FILE, config);
  res.json({ success: true, message: 'เปลี่ยนรหัส PIN เรียบร้อยแล้ว' });
});

// Helper to sanitize members for public consumption (hide passwords)
function sanitizeMember(m) {
  if (!m) return m;
  const { password, ...safe } = m;
  return safe;
}

// 5. Get Members (Search, Filter, Pagination)
app.get('/api/members', (req, res) => {
  const members = readJson(MEMBERS_FILE, []);
  const search = (req.query.search || '').trim().toLowerCase();
  const category = (req.query.category || '').trim();
  const gangOnly = req.query.gangOnly === 'true' || req.query.JAGUARXOnly === 'true';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 24;

  let filtered = members.map(sanitizeMember);

  // Search filter
  if (search) {
    filtered = filtered.filter(m => {
      const fullname = `${m.firstname || ''} ${m.lastname || ''}`.toLowerCase();
      const role = (m.role || '').toLowerCase();
      const caption = (m.caption || '').toLowerCase();
      return fullname.includes(search) || role.includes(search) || caption.includes(search);
    });
  }

  // Gang Only filter
  if (gangOnly) {
    filtered = filtered.filter(m => m.isGangOnly === true);
  }

  // Category filter
  if (category && category !== 'All') {
    filtered = filtered.filter(m => m.category === category);
  }

  // Categorized breakdown for Jaguarx format
  const founders = filtered.filter(m => m.category === 'Founders' || (m.role && m.role.toLowerCase().includes('founder')));
  const leaders = filtered.filter(m => m.category === 'Leaders' || (m.role && m.role.toLowerCase().includes('leader') && m.category !== 'Founders'));
  const regularMembers = filtered.filter(m => !founders.includes(m) && !leaders.includes(m));

  // Pagination for members list
  const totalPages = Math.ceil(filtered.length / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedMembers = filtered.slice(startIndex, startIndex + limit);

  res.json({
    founders,
    leaders,
    members: search || gangOnly || category ? paginatedMembers : regularMembers,
    all: filtered,
    totalCount: filtered.length,
    currentPage: page,
    totalPages: totalPages
  });
});

// 6. Add Member (Founders & Leaders Only)
app.post('/api/members', requireAdminRole, (req, res) => {
  const members = readJson(MEMBERS_FILE, []);
  const newMember = {
    id: Date.now().toString(),
    firstname: req.body.firstname || '',
    lastname: req.body.lastname || '',
    username: (req.body.username || '').trim(),
    password: req.body.password || '123456',
    role: req.body.role || 'Member',
    category: req.body.category || 'Members',
    caption: req.body.caption || '',
    imageurl: req.body.imageurl || '/uploads/logo.png',
    bannerUrl: req.body.bannerUrl || '',
    primaryWeapon: req.body.primaryWeapon || 'WEAPON_UNARMED',
    primaryWeaponLevel: parseInt(req.body.primaryWeaponLevel, 10) || 85,
    secondaryWeapon: req.body.secondaryWeapon || '',
    secondaryWeaponLevel: parseInt(req.body.secondaryWeaponLevel, 10) || 70,
    sociallinks: req.body.sociallinks || {},
    isGangOnly: req.body.isGangOnly !== false,
    status: req.body.status || 'online',
    createdAt: new Date().toISOString()
  };

  members.push(newMember);
  writeJson(MEMBERS_FILE, members);
  res.json({ success: true, member: sanitizeMember(newMember) });
});

// 7. Update Member (Founders & Leaders full access; Members own profile only)
app.put('/api/members/:id', (req, res) => {
  const authUser = getAuthUser(req);
  if (authUser && authUser.role === 'Member') {
    if (authUser.id !== req.params.id) {
      return res.status(403).json({ error: 'สมาชิกสามารถแก้ไขได้เฉพาะโปรไฟล์ของตนเองเท่านั้น' });
    }
  }

  const members = readJson(MEMBERS_FILE, []);
  const index = members.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const existing = members[index];

  // If role is Member, prevent changing role, category, or gang verification
  let newRole = req.body.role !== undefined ? req.body.role : existing.role;
  let newCategory = req.body.category !== undefined ? req.body.category : existing.category;
  let newGangOnly = req.body.isGangOnly !== undefined ? req.body.isGangOnly : existing.isGangOnly;

  if (authUser && authUser.role === 'Member') {
    newRole = existing.role;
    newCategory = existing.category;
    newGangOnly = existing.isGangOnly;
  }

  const updatedMember = {
    ...existing,
    ...req.body,
    role: newRole,
    category: newCategory,
    isGangOnly: newGangOnly,
    id: req.params.id, // preserve ID
    // Keep existing password if new one not provided or empty
    password: req.body.password && req.body.password.trim() ? req.body.password.trim() : existing.password
  };

  members[index] = updatedMember;
  writeJson(MEMBERS_FILE, members);
  res.json({ success: true, member: sanitizeMember(updatedMember) });
});

// 8. Delete Member (Founders & Leaders Only)
app.delete('/api/members/:id', requireAdminRole, (req, res) => {
  let members = readJson(MEMBERS_FILE, []);
  const initialLength = members.length;
  members = members.filter(m => m.id !== req.params.id);

  if (members.length === initialLength) {
    return res.status(404).json({ error: 'Member not found' });
  }

  writeJson(MEMBERS_FILE, members);
  res.json({ success: true, message: 'Member deleted' });
});

// 9. Upload File Endpoint (Images, Music, 3D Models)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    size: req.file.size
  });
});

// 10. Presets Management (Multi-Gang Template Support - Founders & Leaders Only)
app.get('/api/presets', (req, res) => {
  const presets = readJson(PRESETS_FILE, []);
  res.json(presets);
});

app.post('/api/presets/save', requireAdminRole, (req, res) => {
  const presets = readJson(PRESETS_FILE, []);
  const { name, description, config, members } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Preset name is required' });
  }

  const newPreset = {
    id: 'preset-' + Date.now(),
    name: name,
    description: description || '',
    config: config || readJson(CONFIG_FILE, {}),
    members: members || readJson(MEMBERS_FILE, [])
  };

  presets.push(newPreset);
  writeJson(PRESETS_FILE, presets);
  res.json({ success: true, preset: newPreset });
});

app.post('/api/presets/load/:id', requireAdminRole, (req, res) => {
  const presets = readJson(PRESETS_FILE, []);
  const target = presets.find(p => p.id === req.params.id);

  if (!target) {
    return res.status(404).json({ error: 'Preset not found' });
  }

  // Keep existing security pin intact
  const currentConfig = readJson(CONFIG_FILE, {});
  const updatedConfig = {
    ...target.config,
    security: currentConfig.security || { adminPin: 'admin123' }
  };

  writeJson(CONFIG_FILE, updatedConfig);
  syncStaticHtmlFiles();

  // If preset has saved members, restore that gang's members list too
  if (target.members && Array.isArray(target.members)) {
    writeJson(MEMBERS_FILE, target.members);
  }

  res.json({
    success: true,
    message: `Loaded preset: ${target.name}`,
    config: updatedConfig,
    members: target.members || null
  });
});

app.delete('/api/presets/:id', requireAdminRole, (req, res) => {
  let presets = readJson(PRESETS_FILE, []);
  presets = presets.filter(p => p.id !== req.params.id);
  writeJson(PRESETS_FILE, presets);
  res.json({ success: true });
});

// 11. YouTube Video Metadata & Title Parser (Auto-Fill Artist & Title)
app.get('/api/youtube-info', async (req, res) => {
  const videoUrl = (req.query.url || '').trim();
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Extract Video ID (supports standard watch, share youtu.be, embed, shorts)
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = videoUrl.match(regExp);
  const videoId = (match && match[2].length === 11) ? match[2] : null;

  if (!videoId) {
    return res.status(400).json({ error: 'ลิงก์ YouTube ไม่ถูกต้อง (Invalid YouTube URL)' });
  }

  // Extract Start Timestamp from URL if present (e.g. ?t=45, &t=1m25s, ?start=45)
  let extractedStart = '';
  const tMatch = videoUrl.match(/[?&](?:t|start)=([0-9hms]+)/i);
  if (tMatch) {
    const raw = tMatch[1];
    let totalSec = 0;
    const h = raw.match(/(\d+)h/i);
    const m = raw.match(/(\d+)m/i);
    const s = raw.match(/(\d+)s/i);
    if (h || m || s) {
      if (h) totalSec += parseInt(h[1], 10) * 3600;
      if (m) totalSec += parseInt(m[1], 10) * 60;
      if (s) totalSec += parseInt(s[1], 10);
    } else {
      totalSec = parseInt(raw, 10) || 0;
    }
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    extractedStart = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : totalSec.toString();
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      return res.status(404).json({ error: 'ไม่พบวิดีโอนี้บน YouTube' });
    }
    const data = await response.json();
    const rawTitle = data.title || '';
    const authorName = data.author_name || '';

    // Smartly parse Title and Artist
    let cleaned = rawTitle
      .replace(/\s*[\(\[](official\s*(music\s*)?video|official\s*audio|lyrics?|lyric\s*video|visualizer|mv|m\/v|audio|unreleased|official|hd|4k|extended|music\s*video)[\)\]]/gi, '')
      .trim();

    let artist = '';
    let songTitle = '';

    const delims = [' - ', ' – ', ' — ', ' // ', ' : '];
    const matchedDelim = delims.find(d => cleaned.includes(d));

    if (matchedDelim) {
      const parts = cleaned.split(matchedDelim);
      artist = parts[0].trim();
      songTitle = parts.slice(1).join(matchedDelim).trim();
    } else {
      songTitle = cleaned;
      artist = (authorName || '')
        .replace(/\s*-\s*topic$/i, '')
        .replace(/vevo$/i, '')
        .trim();
    }

    const coverUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    res.json({
      success: true,
      videoId,
      title: songTitle || rawTitle,
      artist: artist || 'YouTube Audio',
      cover: coverUrl,
      startTime: extractedStart,
      rawTitle
    });
  } catch (err) {
    console.error('Error fetching YouTube info:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลจาก YouTube ได้' });
  }
});

// Deploy to GitHub Pages API (accessible by local or Cloudflare remote admin)
app.post('/api/deploy-to-github', (req, res) => {
  const pin = req.headers['x-admin-pin'] || req.body?.pin;
  const config = readJson(CONFIG_FILE, {});
  const correctPin = config.security?.adminPin || 'admin123';

  if (!pin || pin !== correctPin) {
    return res.status(401).json({ success: false, error: 'รหัส PIN ไม่ถูกต้อง (Unauthorized)' });
  }

  try {
    const { execSync } = require('child_process');

    // 1. Sync data folder to public/data
    const dataDir = path.join(__dirname, 'data');
    const publicDataDir = path.join(__dirname, 'public', 'data');
    if (fs.existsSync(dataDir)) {
      if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
      const entries = fs.readdirSync(dataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          fs.copyFileSync(path.join(dataDir, entry.name), path.join(publicDataDir, entry.name));
        }
      }
    }

    // 2. Commit and Push
    execSync('git add -A', { cwd: __dirname });
    try {
      execSync('git commit -m "update: gang data via admin panel"', { cwd: __dirname });
    } catch (e) {
      // Nothing to commit is fine
    }
    execSync('git push origin main', { cwd: __dirname });

    res.json({
      success: true,
      message: 'ส่งข้อมูลขึ้น GitHub Pages เรียบร้อยแล้ว! หน้าเว็บจริงจะอัปเดตใน ~30-45 วินาที'
    });
  } catch (err) {
    console.error('Error during git deploy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for client routing
app.use((req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(filePath, 'utf-8', (err, html) => {
    if (err) return res.status(500).send('Error loading page');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(injectDynamicMeta(html, req, 'home'));
  });
});

// Start Server
app.listen(PORT, () => {
  // Sync static HTML meta tags on startup
  syncStaticHtmlFiles();

  console.log(`===============================================`);
  console.log(`🚀 FiveM Gang Web Server running on:`);
  console.log(`   👉 Website:  http://localhost:${PORT}`);
  console.log(`   👉 Members:  http://localhost:${PORT}/members`);
  console.log(`   👉 Admin:    http://localhost:${PORT}/admin`);
  console.log(`   🔑 Default Admin PIN: admin123`);
  console.log(`===============================================`);
});
