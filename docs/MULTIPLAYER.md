# Multiplayer — สถาปัตยกรรม

## ภาพรวม
| ส่วน | ไฟล์ |
|---|---|
| ตัวควบคุมต่อผู้เล่น (คีย์บอร์ด/เมาส์, จอย, เครือข่าย) | `src/core/controls.ts` |
| ผู้เล่นหลายคนในโลกเกม (เป้าหมายศัตรู, เครดิตการตี, PVP) | `src/game/world.ts`, `src/game/enemies.ts`, `src/game/player.ts` |
| โหมด co-op / duel, ชุบเพื่อน, การเลือกการ์ดรายคน | `src/game/run.ts` |
| เมนูด้วยจอย | `src/ui/padnav.ts` |
| Lobby (LOCAL) | `src/ui/lobby.ts` |
| ออนไลน์ (lobby, host, client) | `src/net/mp.ts` |
| WebSocket relay (ห้อง) | `server/mp.mjs` |

## ออนไลน์แบบ Host-authoritative
- เบราว์เซอร์ของ **HOST** รันเกมทั้งหมดเหมือนเล่นในเครื่อง ผู้เล่นคนอื่นถูกควบคุมผ่าน `RemoteControls` ที่รับ input จากเครือข่าย
- ทุก 2 tick (≈30 ครั้ง/วินาที) host ส่ง **snapshot** ให้ทุกคน:
  - draw-list ของตัวละครแต่ละตัว (บันทึกผ่าน canvas ปลอม — client วาดตามได้ทันทีโดยไม่ต้องรู้ logic ของบอส)
  - เส้นเตือนการโจมตี (telegraph), กระสุน, สถานะ HUD, และ event เอฟเฟกต์/เสียง/ข้อความที่เกิดขึ้น
- **Client** ส่งเฉพาะ input (≈40 ครั้ง/วินาที) และการเลือกการ์ด/สาย — ไม่จำลองเกมเอง จึงไม่มีทางหลุดซิงก์
- ขนาด snapshot ราว 4–15 KB (บีบอัด permessage-deflate ที่ server)
- ข้อจำกัดของ v1: ตัวละครของ client ตอบสนองช้ากว่า host ตาม ping (ไม่มี client-side prediction) — เล่นได้ดีเมื่อ ping < 80ms

## Relay server
- `server/mp.mjs` เปิด WebSocket ที่ path `/mp` — จัดการเฉพาะห้อง (รหัส 4 ตัว, สูงสุด 4 คน, ล็อกห้องระหว่างเล่น) และส่งต่อข้อความ ไม่มี logic เกม
- ต่อเข้ากับ dev server (`npm run dev`), `npm run preview` และ production (`npm start`) อัตโนมัติ
- dev server เปิด `host: true` เพื่อให้เครื่องอื่นในวง LAN เข้า `http://<IP เครื่องนี้>:5173` มาทดสอบออนไลน์ได้

## Deploy ให้เล่นออนไลน์ข้ามเน็ต
ต้องรัน `npm run build && npm start` บนโฮสต์ที่รองรับ **Node + WebSocket ค้างการเชื่อมต่อ** (เช่น Render, Fly.io, Railway, VPS)
ถ้าใช้ HTTPS เกมจะต่อ `wss://` เองอัตโนมัติ
