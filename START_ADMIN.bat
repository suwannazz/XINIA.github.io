@echo off
chcp 65001 >nul
title XINIA GANG - ADMIN SYSTEM & CLOUD SYNC
color 0B
cd /d "%~dp0"

echo ======================================================================
echo             ⚔️ XINIA GANG - ADMIN CONTROL & CLOUD SYNC ⚔️
echo ======================================================================
echo.

:: 1. ตรวจสอบ Node.js Server
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo  [*] กำลังเริ่มรันเซิร์ฟเวอร์หลังบ้าน (Node.js)...
    start "XINIA Server" /min node server.js
    timeout /t 2 /nobreak >nul
) else (
    echo  [+] เซิร์ฟเวอร์หลังบ้านกำลังทำงานอยู่แล้ว (Port 3000)
)

:: 2. เปิดหน้าเว็บหลังบ้าน Admin ในเบราว์เซอร์
echo  [+] กำลังเปิดหน้าต่างระบบหลังบ้านในเบราว์เซอร์...
start "" "http://localhost:3000/admin.html"

echo.
echo ======================================================================
echo  [คำแนะนำการใช้งาน]
echo  1. ล็อกอินและทำการแก้ไขข้อมูลสมาชิก / ธีม / เพลง ในหน้าเบราว์เซอร์
echo  2. เมื่อแก้ไขและกดบันทึกในหน้าเว็บเสร็จเรียบร้อยแล้ว
echo  3. กลับมาที่หน้าต่างนี้ แล้วกดปุ่ม [ENTER] เพื่อซิงค์ขึ้นเว็บจริง!
echo ======================================================================
echo.

set "userchoice="
set /p userchoice=">> กด [ENTER] เพื่อ Push อัปเดตขึ้น GitHub Pages ทันที (หรือพิมพ์ Q เพื่อออก): "
if /i "%userchoice%"=="Q" goto end

echo.
echo  [*] กำลังเตรียมข้อมูลและไฟล์ระบบ...
xcopy /y /e /i "data\*" "public\data\" >nul 2>&1

echo  [*] บันทึกสถานะ Git...
git add -A
git commit -m "update: gang data, members, and settings via admin panel"

echo  [*] กำลังส่งข้อมูลขึ้น GitHub Pages (git push)...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  [SUCCESS] ส่งข้อมูลขึ้น GitHub Pages เรียบร้อยแล้ว!
    echo  GitHub Actions กำลังอัปเดตหน้าเว็บจริงให้คุณโดยอัตโนมัติ (รอ ~30-60 วิ)
    echo.
    echo  ลิงก์หน้าหลัก : https://suwannazz.github.io/XINIA.github.io/
    echo  ลิงก์สมาชิก   : https://suwannazz.github.io/XINIA.github.io/members.html
    echo ======================================================================
) else (
    echo.
    echo  [!] เกิดข้อผิดพลาดในการ Push กรุณาตรวจสอบอินเทอร์เน็ตหรือสิทธิ์ GitHub
)

echo.
pause
:end
