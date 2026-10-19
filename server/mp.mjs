/**
 * Online multiplayer relay (WebSocket at /mp). The server owns no game logic: one player HOSTS the
 * simulation and the others are thin clients. The relay only manages rooms and forwards messages.
 *
 * client → server
 *   { t: 'create', name }                 → { t: 'room', code, you, host: true }
 *   { t: 'join', code, name }             → { t: 'room', code, you, host: false, hostId } | { t: 'error', msg }
 *   { t: 'to', to: id | '*', d }          forward d to one peer or everyone else in the room
 *   { t: 'lock', v }                      host only: closes the room to new joins while a match runs
 * server → client
 *   { t: 'msg', from, d } · { t: 'peer-join', id, name } · { t: 'peer-leave', id } · { t: 'closed', reason }
 */
import { WebSocketServer } from 'ws';

const MAX = 4;
/** testing only: MP_LAG_MS=60 delays every forwarded message (simulates internet latency) */
const LAG = Number(process.env.MP_LAG_MS) || 0;
const later = (fn) => (LAG ? setTimeout(fn, LAG) : fn());
const rooms = new Map(); // code → { host, peers: Map<id, { ws, name }>, locked }
let seq = 0;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}
const send = (ws, o) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(o));
};
const clean = (s) => String(s ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 14) || 'PLAYER';

function handle(ws) {
  const id = 'c' + ++seq;
  let room = null;
  let code = '';
  const leave = () => {
    if (!room) return;
    room.peers.delete(id);
    if (room.host === id) {
      for (const p of room.peers.values()) send(p.ws, { t: 'closed', reason: 'host-left' });
      rooms.delete(code);
    } else for (const p of room.peers.values()) send(p.ws, { t: 'peer-leave', id });
    room = null;
  };
  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'create' && !room) {
      code = newCode();
      room = { host: id, peers: new Map([[id, { ws, name: clean(m.name) }]]), locked: false };
      rooms.set(code, room);
      send(ws, { t: 'room', code, you: id, host: true, hostId: id });
    } else if (m.t === 'join' && !room) {
      const c = String(m.code ?? '').toUpperCase().trim();
      const r = rooms.get(c);
      if (!r) return send(ws, { t: 'error', msg: 'ไม่พบห้องนี้' });
      if (r.locked) return send(ws, { t: 'error', msg: 'ห้องนี้กำลังเล่นอยู่' });
      if (r.peers.size >= MAX) return send(ws, { t: 'error', msg: 'ห้องเต็มแล้ว (4 คน)' });
      room = r;
      code = c;
      const name = clean(m.name);
      for (const p of r.peers.values()) send(p.ws, { t: 'peer-join', id, name });
      r.peers.set(id, { ws, name });
      send(ws, { t: 'room', code, you: id, host: false, hostId: r.host });
    } else if (m.t === 'to' && room) {
      const out = JSON.stringify({ t: 'msg', from: id, d: m.d });
      const r = room;
      later(() => {
        if (m.to === '*') {
          for (const [pid, p] of r.peers) if (pid !== id && p.ws.readyState === 1) p.ws.send(out);
        } else {
          const p = r.peers.get(m.to === 'host' ? r.host : m.to);
          if (p && p.ws.readyState === 1) p.ws.send(out);
        }
      });
    } else if (m.t === 'lock' && room && room.host === id) {
      room.locked = !!m.v;
    } else if (m.t === 'leave') leave();
  });
  ws.on('close', leave);
  ws.on('error', leave);
}

/** attach the relay to an http(s) server (production server and the Vite dev/preview servers) */
export function attachMultiplayer(server) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: { threshold: 512 }, maxPayload: 1 << 20 });
  wss.on('connection', handle);
  server.on('upgrade', (req, socket, head) => {
    if (!(req.url ?? '').startsWith('/mp')) return; // leave Vite HMR & others alone
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  // drop dead connections
  const iv = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 15000);
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
  });
  server.on('close', () => clearInterval(iv));
  return wss;
}

/** for tests */
export const _rooms = rooms;
