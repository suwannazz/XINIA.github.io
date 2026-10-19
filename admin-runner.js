const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ANSI Color Codes
const C_RESET = '\x1b[0m';
const C_CYAN = '\x1b[36m';
const C_GREEN = '\x1b[32m';
const C_YELLOW = '\x1b[33m';
const C_RED = '\x1b[31m';
const C_BOLD = '\x1b[1m';

function banner() {
  console.clear();
  console.log(`${C_CYAN}${C_BOLD}======================================================================${C_RESET}`);
  console.log(`${C_CYAN}${C_BOLD}             XINIA GANG - ADMIN SYSTEM & CLOUD SYNC                  ${C_RESET}`);
  console.log(`${C_CYAN}${C_BOLD}======================================================================${C_RESET}\n`);
}

function checkServerReady(port = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function findCloudflaredBinary() {
  try {
    const stdout = execSync('where cloudflared', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    const line = stdout.split(/\r?\n/)[0].trim();
    if (line && fs.existsSync(line)) return line;
  } catch (e) {}

  const localBin = path.join(__dirname, 'cloudflared.exe');
  if (fs.existsSync(localBin)) return localBin;

  const defaultWinPath = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
  if (fs.existsSync(defaultWinPath)) return defaultWinPath;

  return null;
}

async function ensureCloudflared() {
  let bin = findCloudflaredBinary();
  if (bin) return bin;

  const localBin = path.join(__dirname, 'cloudflared.exe');
  console.log(`${C_YELLOW}[*] ยังไม่มี Cloudflare Tunnel ในเครื่อง${C_RESET}`);
  console.log(`${C_CYAN}[*] กำลังดาวน์โหลด cloudflared.exe อัตโนมัติ (ครั้งแรกครั้งเดียว ~15MB)...${C_RESET}`);

  try {
    const psCmd = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '${localBin}'`;
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { stdio: 'inherit' });
    if (fs.existsSync(localBin)) {
      console.log(`${C_GREEN}[+] ดาวน์โหลด Cloudflare Tunnel สำเร็จเรียบร้อย!${C_RESET}\n`);
      return localBin;
    }
  } catch (err) {
    console.log(`${C_YELLOW}[!] ไม่สามารถดาวน์โหลด cloudflared.exe ได้: ${err.message}${C_RESET}`);
  }

  return null;
}

async function main() {
  banner();

  // ตรวจสอบ node_modules (กรณีเปิดบนเครื่องใหม่ที่ยังไม่ได้รัน npm install)
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`${C_YELLOW}[*] ตรวจพบว่ายังไม่มีไลบรารี่ (node_modules)${C_RESET}`);
    console.log(`${C_CYAN}[*] กำลังติดตั้งไลบรารี่อัตโนมัติ (npm install) กรุณารอสักครู่...${C_RESET}`);
    try {
      execSync('npm install', { stdio: 'inherit', cwd: __dirname });
      console.log(`${C_GREEN}[+] ติดตั้งไลบรารี่สำเร็จเรียบร้อย!${C_RESET}\n`);
    } catch (e) {
      console.log(`${C_RED}[!] ไม่สามารถรัน npm install อัตโนมัติได้: ${e.message}${C_RESET}\n`);
    }
  }

  console.log(`${C_YELLOW}[*] กำลังตรวจสอบสถานะ Node.js Server...${C_RESET}`);
  const isRunning = await checkServerReady(3000);

  if (!isRunning) {
    console.log(`${C_YELLOW}[*] กำลังเริ่มรันเซิร์ฟเวอร์หลังบ้าน (node server.js)...${C_RESET}`);
    const serverProcess = spawn('node', ['server.js'], {
      detached: true,
      stdio: 'ignore',
      cwd: __dirname
    });
    serverProcess.unref();

    // รอให้เซิร์ฟเวอร์พร้อมทำงาน
    let ready = false;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 600));
      ready = await checkServerReady(3000);
      if (ready) break;
    }
    if (ready) {
      console.log(`${C_GREEN}[+] เซิร์ฟเวอร์เริ่มทำงานเรียบร้อยแล้ว (Port 3000)${C_RESET}`);
    } else {
      console.log(`${C_YELLOW}[!] ไม่สามารถตรวจจับ Port 3000 ได้ในทันที แต่จะลองเปิดหน้าเว็บต่อไป...${C_RESET}`);
    }
  } else {
    console.log(`${C_GREEN}[+] เซิร์ฟเวอร์หลังบ้านกำลังทำงานอยู่แล้ว (Port 3000)${C_RESET}`);
  }

  // เริ่มต้นรัน Cloudflare Tunnel
  let cloudflareProc = null;
  let publicTunnelUrl = null;

  const cfBin = await ensureCloudflared();
  if (cfBin) {
    console.log(`${C_CYAN}[*] กำลังเชื่อมต่อ Cloudflare Tunnel สร้างลิงก์ให้แอดมินคนอื่นเข้าได้จากที่อื่น...${C_RESET}`);
    cloudflareProc = spawn(cfBin, ['tunnel', '--url', 'http://localhost:3000'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const checkOutput = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !publicTunnelUrl) {
        publicTunnelUrl = match[0];
        console.log(`\n${C_GREEN}${C_BOLD}======================================================================${C_RESET}`);
        console.log(`${C_GREEN}${C_BOLD} 🌐 ลิงก์ออนไลน์ Cloudflare Tunnel สำหรับส่งให้แอดมินคนอื่น:${C_RESET}`);
        console.log(`${C_CYAN}${C_BOLD}    👉 ${publicTunnelUrl}/admin.html${C_RESET}`);
        console.log(`${C_YELLOW} (ส่งลิงก์นี้ให้เพื่อน/แอดมินคนอื่นเปิดในคอมหรือมือถือเพื่อเข้ามาแก้ไขได้ทันที!)${C_RESET}`);
        console.log(`${C_GREEN}${C_BOLD}======================================================================${C_RESET}\n`);
      }
    };

    cloudflareProc.stderr.on('data', checkOutput);
    cloudflareProc.stdout.on('data', checkOutput);
  }

  // เปิดเบราว์เซอร์อัตโนมัติสำหรับเครื่องนี้
  console.log(`${C_CYAN}[+] กำลังเปิดหน้าต่างระบบหลังบ้านในเครื่องของคุณ (Local)...${C_RESET}`);
  try {
    execSync('start http://localhost:3000/admin.html', { shell: true });
  } catch (e) {
    console.log(`กรุณาเปิดเบราว์เซอร์ไปที่: http://localhost:3000/admin.html`);
  }

  console.log(`\n${C_CYAN}======================================================================${C_RESET}`);
  console.log(`${C_BOLD} [คำแนะนำขั้นตอนการใช้งาน]${C_RESET}`);
  console.log(` 1. ใส่รหัส PIN เพื่อเข้าใช้งานระบบหลังบ้าน`);
  console.log(` 2. แก้ไขข้อมูลสมาชิก, ธีมแก๊ง, หรือเพลง แล้วกดปุ่ม "บันทึกการตั้งค่า"`);
  console.log(` 3. เมื่อแก้ไขเสร็จแล้ว สามารถส่งข้อมูลขึ้นเว็บจริงได้ 2 วิธี:`);
  console.log(`    - วิธีที่ A: กดปุ่ม "🚀 ส่งขึ้นเว็บจริง (Deploy)" ในหน้าเว็บ Admin`);
  console.log(`    - วิธีที่ B: หรือกลับมาที่หน้าต่างดำนี้แล้วกด [ENTER] เพื่อ Push ทันที`);
  console.log(`${C_CYAN}======================================================================${C_RESET}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const cleanup = () => {
    if (cloudflareProc) {
      try { cloudflareProc.kill(); } catch (e) {}
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  rl.question(`${C_YELLOW}>> กด [ENTER] เพื่อ Push ข้อมูลขึ้น GitHub Pages ทันที (หรือพิมพ์ Q เพื่อออก): ${C_RESET}`, async (ans) => {
    rl.close();
    if (ans.trim().toLowerCase() === 'q') {
      console.log(`\n${C_YELLOW}[*] ปิดโปรแกรมเรียบร้อย (ไม่ได้ส่งข้อมูลขึ้น GitHub)${C_RESET}`);
      cleanup();
      return;
    }

    console.log(`\n${C_CYAN}[*] 1. ซิงค์ข้อมูลล่าสุดจาก data/ ไปยัง public/data/...${C_RESET}`);
    try {
      const dataDir = path.join(__dirname, 'data');
      const publicDataDir = path.join(__dirname, 'public', 'data');
      if (fs.existsSync(dataDir)) {
        copyDirRecursive(dataDir, publicDataDir);
        console.log(`${C_GREEN}    ซิงค์ข้อมูลไฟล์ JSON เรียบร้อยแล้ว${C_RESET}`);
      }
    } catch (err) {
      console.log(`${C_RED}    เตือน: ไม่สามารถคัดลอกโฟลเดอร์ data: ${err.message}${C_RESET}`);
    }

    console.log(`${C_CYAN}[*] 2. บันทึกและเตรียมข้อมูลด้วย Git...${C_RESET}`);
    try {
      execSync('git add -A', { stdio: 'inherit', cwd: __dirname });
      try {
        execSync('git commit -m "update: gang data, members, and settings via admin panel"', { stdio: 'inherit', cwd: __dirname });
      } catch (e) {
        console.log(`${C_YELLOW}    (ไม่มีข้อมูลใหม่ที่ต้อง Commit)${C_RESET}`);
      }

      console.log(`\n${C_CYAN}[*] 3. กำลังส่งข้อมูลขึ้น GitHub (git push origin main)...${C_RESET}`);
      execSync('git push origin main', { stdio: 'inherit', cwd: __dirname });

      console.log(`\n${C_GREEN}${C_BOLD}======================================================================${C_RESET}`);
      console.log(`${C_GREEN}${C_BOLD} [SUCCESS] ส่งข้อมูลขึ้น GitHub Pages เรียบร้อยแล้ว!${C_RESET}`);
      console.log(` GitHub Actions กำลังทำการ Deploy หน้าเว็บจริงให้อัตโนมัติ (รอ ~30-45 วินาที)`);
      console.log(`\n ลิงก์หน้าหลัก : https://suwannazz.github.io/XINIA.github.io/`);
      console.log(` ลิงก์สมาชิก   : https://suwannazz.github.io/XINIA.github.io/members.html`);
      console.log(`${C_GREEN}${C_BOLD}======================================================================${C_RESET}\n`);
    } catch (err) {
      console.log(`\n${C_RED}[ERROR] เกิดข้อผิดพลาดในการ Push ขึ้น GitHub:${C_RESET}`);
      console.log(err.message);
      console.log(`${C_YELLOW}กรุณาตรวจสอบว่ามีอินเทอร์เน็ต และสิทธิ์การเข้าถึง GitHub หรือไม่${C_RESET}\n`);
    }

    cleanup();
    console.log('กดปุ่มใดก็ได้เพื่อปิดหน้าต่างนี้...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(0));
  });
}

main().catch(err => {
  console.error('Fatal Error:', err);
});
