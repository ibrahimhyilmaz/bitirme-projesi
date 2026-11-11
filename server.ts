import express from 'express';
import http from 'http';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { spawn } from 'child_process';
import esbuild from 'esbuild';
import {
  AIDrawingError,
  generateCanvasVectorWithRetry,
  generateSvgImageWithRetry,
  getClientQuotaStatus,
  resetClientQuota,
  type QuotaSourceMode,
} from './src/server/aiDrawingService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const p = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(p)) return p;
  }
  if (process.env.NODE_ENV === 'production' && process.env.PORT) {
    return Number(process.env.PORT);
  }
  return 3000;
}
const PORT = getPort();

// Server-wide capacity limits
const MAX_ROOMS = 20;
const MAX_USERS_PER_ROOM = 30;
const MAX_ROOMS_PER_USER = 3;
const DEFAULT_ROOM_MAX_USERS = 12;

// Permissive CORS & COOP middleware so shared/invited clients and OAuth popups never get blocked
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '25mb' }));

// Types for in-memory room management
type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface RoomSettings {
  isLocked: boolean;
  maxUsers: number;
  defaultRole: 'editor' | 'viewer';
  allowGuestDraw: boolean;
  saveChat: boolean;
  ownerId: string;
}

interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  isLocked?: boolean;
  createdBy: string;
  updatedAt: number;
}

interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
  recipientId?: string;
  recipientName?: string;
  isPrivate?: boolean;
  fileAttachment?: {
    name: string;
    url: string;
  };
}

interface UserPresence {
  id: string;
  name: string;
  avatar: string;
  color: string;
  role: UserRole;
  cursor: { x: number; y: number };
  isDrawing: boolean;
  activeTool: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

interface CodeFile {
  id: string;
  name: string;
  language: string;
  content: string;
  lastUpdatedBy: string;
}

interface RoomState {
  id: string;
  codeFiles: CodeFile[];
  name: string;
  createdAt: number;
  ownerName: string;
  ownerKey?: string;
  lastActivityAt: number;
  lockedByIdle?: boolean;
  memberKeys: Set<string>;
  settings: RoomSettings;
  roleAssignments: Map<string, UserRole>;
  elements: Map<string, CanvasElement>;
  elementOrder: string[];
  code: {
    content: string;
    language: string;
    lastUpdatedBy: string;
  };
  notes: {
    content: string;
    lastUpdatedBy: string;
  };
  files: SharedFile[];
  messages: ChatMessage[];
  users: Map<string, { ws: WebSocket; presence: UserPresence }>;
}

// Global rooms map
const rooms = new Map<string, RoomState>();

// Idle policy: a room with no user activity for this long is locked; empty rooms are kept this long
const ROOM_IDLE_LOCK_MS = 60 * 60 * 1000;
const EMPTY_ROOM_RETENTION_MS = 24 * 60 * 60 * 1000;

// ---- Chat history persistence (only when the room owner keeps "save chat" on) ----
const CHAT_DIR = path.join(process.cwd(), 'data', 'chats');
const chatSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function chatFilePath(roomId: string): string {
  return path.join(CHAT_DIR, `${roomId.replace(/[^a-z0-9_-]/g, '')}.json`);
}

function loadSavedChat(roomId: string, ownerKey: string): unknown[] {
  if (roomId === 'ana-oda' || !ownerKey) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(chatFilePath(roomId), 'utf-8'));
    // Only the owner who saved the history gets it back (a reused room code never leaks old chats)
    if (parsed && parsed.ownerKey === ownerKey && Array.isArray(parsed.messages)) {
      return parsed.messages.slice(-200);
    }
  } catch {
    // no saved history
  }
  return [];
}

function scheduleChatSave(room: { id: string; ownerKey?: string; settings: { saveChat: boolean }; messages: ChatMessage[] }) {
  if (room.id === 'ana-oda' || room.settings.saveChat === false) return;
  const existing = chatSaveTimers.get(room.id);
  if (existing) clearTimeout(existing);
  chatSaveTimers.set(
    room.id,
    setTimeout(async () => {
      chatSaveTimers.delete(room.id);
      try {
        await fs.promises.mkdir(CHAT_DIR, { recursive: true });
        const messages = room.messages
          .filter((m) => m.userId !== 'system')
          .map((m) =>
            m.fileAttachment && typeof m.fileAttachment.url === 'string' && m.fileAttachment.url.length > 150000
              ? { ...m, fileAttachment: { ...m.fileAttachment, url: '' } }
              : m
          );
        await fs.promises.writeFile(
          chatFilePath(room.id),
          JSON.stringify({ ownerKey: room.ownerKey, savedAt: Date.now(), messages })
        );
      } catch (err) {
        console.warn('Chat history could not be saved:', (err as Error).message);
      }
    }, 1500)
  );
}

function deleteSavedChat(roomId: string) {
  const timer = chatSaveTimers.get(roomId);
  if (timer) clearTimeout(timer);
  chatSaveTimers.delete(roomId);
  fs.promises.rm(chatFilePath(roomId), { force: true }).catch(() => {});
}

function canEditWorkspace(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

function canManageRoom(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

function sanitizeRoomDisplayName(rawName: string | undefined, roomId: string): string {
  if (!rawName || !rawName.trim()) {
    return roomId === 'ana-oda' ? 'Genel Çalışma Alanı' : 'Çalışma Odası';
  }
  // Strip any accidental (#CODE) or #CODE suffix from room name
  const cleaned = rawName
    .trim()
    .replace(/\s*\(#[a-zA-Z0-9_-]+\)\s*$/g, '')
    .replace(/\s+#[a-zA-Z0-9_-]{3,8}\s*$/g, '')
    .trim();
  return cleaned || (roomId === 'ana-oda' ? 'Genel Çalışma Alanı' : 'Çalışma Odası');
}

function getRoomSummaries() {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    userCount: r.users.size,
    maxUsers: r.settings.maxUsers,
    isLocked: r.settings.isLocked,
    elementCount: r.elements.size,
    createdAt: r.createdAt,
    ownerName: r.ownerName,
    ownerId: r.settings.ownerId,
    ownerKey: r.ownerKey,
    lockedByIdle: Boolean(r.lockedByIdle),
    lastActivityAt: r.lastActivityAt,
  }));
}

function broadcastGlobalRoomsList() {
  const payload = JSON.stringify({
    type: 'rooms-list-updated',
    rooms: getRoomSummaries(),
    limits: {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      maxRoomsPerUser: MAX_ROOMS_PER_USER,
      currentRoomsCount: rooms.size,
    },
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function countUserOwnedRooms(ownerKey?: string, creatorId?: string): RoomState[] {
  const owned: RoomState[] = [];
  for (const r of rooms.values()) {
    if (r.id === 'ana-oda') continue;
    if (
      (ownerKey && r.ownerKey && r.ownerKey === ownerKey) ||
      (creatorId && r.settings.ownerId === creatorId)
    ) {
      owned.push(r);
    }
  }
  return owned;
}

// Helper to create or retrieve a room
function getOrCreateRoom(
  rawRoomId: string,
  roomName?: string,
  creatorId?: string,
  creatorName?: string,
  customMaxUsers?: number,
  allowCreate: boolean = true,
  ownerKey?: string
): { room: RoomState | null; error?: string; code?: string } {
  const cleanRaw = rawRoomId
    ? rawRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    : '';
  if (!cleanRaw) {
    return {
      room: null,
      code: 'INVALID_ROOM_CODE',
      error: 'Geçerli bir 5 haneli oda kodu giriniz.',
    };
  }
  if (cleanRaw !== 'ana-oda' && cleanRaw.length !== 5) {
    return {
      room: null,
      code: 'INVALID_ROOM_CODE',
      error: 'Oda kodu tam 5 karakter olmalıdır.',
    };
  }
  const roomId = cleanRaw;

  if (!rooms.has(roomId)) {
    if (!allowCreate && roomId !== 'ana-oda') {
      return {
        room: null,
        code: 'ROOM_NOT_FOUND',
        error: `"${roomId.toUpperCase()}" kodlu bir çalışma odası bulunamadı. Lütfen oda kodunu kontrol edin veya yeni bir oda oluşturun.`,
      };
    }

    if (roomId !== 'ana-oda' && (ownerKey || creatorId)) {
      const ownedRooms = countUserOwnedRooms(ownerKey, creatorId);
      if (ownedRooms.length >= MAX_ROOMS_PER_USER) {
        const names = ownedRooms.map((r) => `${r.name} (#${r.id.toUpperCase()})`).join(', ');
        return {
          room: null,
          code: 'USER_MAX_ROOMS_REACHED',
          error: `Bir kullanıcı en fazla ${MAX_ROOMS_PER_USER} oda açabilir. Şu anda aktif odalarınız: ${names}. Yeni oda açmak için mevcut 3 odanızdan birini silin veya kapatın.`,
        };
      }
    }

    if (rooms.size >= MAX_ROOMS) {
      return {
        room: null,
        code: 'MAX_ROOMS_REACHED',
        error: `Sunucu maksimum oda sınırına (${MAX_ROOMS} oda) ulaştı. Lütfen mevcut bir odaya katılın.`,
      };
    }

    const displayRoomName = sanitizeRoomDisplayName(roomName, roomId);

    const defaultCode = `// CollabBoard Ortak Kod Editörü — ${displayRoomName}
// Bu odadaki kod alanı yalnızca bu odaya özeldir ve odadaki üyelerle anlık senkronize olur.

function calculateSprintMetrics(tasks) {
  const completed = tasks.filter(t => t.done);
  const totalPoints = completed.reduce((sum, t) => sum + t.points, 0);
  console.log("Oda:", "${displayRoomName}");
  console.log("Tamamlanan Görev:", completed.length, "/", tasks.length);
  console.log("Toplam Puan:", totalPoints);
  return totalPoints;
}

const sampleTasks = [
  { name: "Mimari Şema Tasarımı", points: 8, done: true },
  { name: "WebSocket Oda & Rol Sistemi", points: 13, done: true },
  { name: "AI Tahta Üretici", points: 8, done: true }
];

calculateSprintMetrics(sampleTasks);
`;

    const defaultNotes = `# ${displayRoomName} — Ortak Çalışma Notları

### Gündem Maddeleri
- [x] Sistem mimarisinin beyaz tahta üzerinde görselleştirilmesi
- [x] Oda yetkileri, rol sistemi ve kişi sınırlarının belirlenmesi
- [x] Yapay zeka destekli diyagram ve şekil üretimi
- [ ] Sprint hedeflerinin gözden geçirilmesi

---
*Not: Bu alana yazılan metinler odadaki herkesle eşzamanlı paylaşılır.*
`;

    const ownerId = creatorId || 'system';
    const roleMap = new Map<string, UserRole>();
    if (creatorId) {
      roleMap.set(creatorId, 'owner');
    }

    const clampedMax = Math.min(
      MAX_USERS_PER_ROOM,
      Math.max(2, Number(customMaxUsers) || DEFAULT_ROOM_MAX_USERS)
    );

    rooms.set(roomId, {
      id: roomId,
      name: displayRoomName,
      createdAt: Date.now(),
      ownerName: creatorName || 'Sistem',
      ownerKey: ownerKey || creatorId || 'system',
      lastActivityAt: Date.now(),
      memberKeys: new Set<string>(),
      codeFiles: [],
      settings: {
        isLocked: false,
        maxUsers: clampedMax,
        defaultRole: 'editor',
        allowGuestDraw: true,
        saveChat: true,
        ownerId,
      },
      roleAssignments: roleMap,
      elements: new Map(),
      elementOrder: [],
      code: {
        content: defaultCode,
        language: 'javascript',
        lastUpdatedBy: creatorName || 'Sistem',
      },
      notes: {
        content: defaultNotes,
        lastUpdatedBy: creatorName || 'Sistem',
      },
      files: [],
      messages: [
        ...(loadSavedChat(roomId, ownerKey || creatorId || '') as ChatMessage[]),
        {
          id: `welcome-${Date.now()}`,
          userId: 'system',
          userName: 'CollabBoard',
          userColor: '#2563eb',
          text: `${displayRoomName} odasına hoş geldiniz! Araç çubuğundaki AI Çizim butonuyla istediğiniz şekli/diyagramı üretebilir, ortak kod yazabilir ve oda ayarlarından yetkileri yönetebilirsiniz.`,
          timestamp: Date.now(),
        },
      ],
      users: new Map(),
    });
  }
  return { room: rooms.get(roomId)! };
}

// Initialize default main room
getOrCreateRoom('ana-oda', 'Genel Çalışma Alanı', 'system', 'Sistem', 15, true, 'system');

// Broadcast helper for a room
function broadcastToRoom(roomId: string, message: object, excludeUserId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(message);

  for (const [userId, userObj] of room.users.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    if (userObj.ws.readyState === WebSocket.OPEN) {
      try {
        userObj.ws.send(payload, (err) => {
          if (err) {
            // Ignore transient socket write errors
          }
        });
      } catch {
        // Ignore synchronous socket write errors
      }
    }
  }
}

// Prevent unhandled socket/promise errors from ever terminating the server process
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception (kept alive):', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection (kept alive):', reason);
});

// WebSocket Server initialization
const wss = new WebSocketServer({ server });

wss.on('error', (err) => {
  console.error('[WSS] WebSocketServer error:', err?.message || err);
});

// Heartbeat interval to keep connections alive across proxies
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as WebSocket & { isAlive?: boolean };
    if (extWs.isAlive === false) {
      try {
        return extWs.terminate();
      } catch {
        return;
      }
    }
    extWs.isAlive = false;
    try {
      extWs.ping();
    } catch {
      // Ignore ping error on closing socket
    }
  });
}, 25000);

const idleSweepInterval = setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const room of rooms.values()) {
    if (room.id === 'ana-oda' || room.lockedByIdle) continue;
    if (now - room.lastActivityAt < ROOM_IDLE_LOCK_MS) continue;
    room.settings.isLocked = true;
    room.lockedByIdle = true;
    changed = true;
    for (const [userId, userObj] of Array.from(room.users.entries())) {
      if (userObj.ws.readyState === WebSocket.OPEN) {
        try {
          userObj.ws.send(
            JSON.stringify({
              type: 'session-timeout',
              roomId: room.id,
              roomName: room.name,
            })
          );
        } catch {}
      }
      room.users.delete(userId);
    }
  }
  if (changed) broadcastGlobalRoomsList();
}, 60 * 1000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
  clearInterval(idleSweepInterval);
});

wss.on('connection', (ws: WebSocket) => {
  const extWs = ws as WebSocket & { isAlive?: boolean };
  extWs.isAlive = true;
  ws.on('pong', () => {
    extWs.isAlive = true;
  });
  ws.on('error', (err) => {
    console.warn('[WS] Client socket error:', err?.message || err);
  });

  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (
        currentRoomId &&
        msg.type !== 'ping-keepalive' &&
        msg.type !== 'get-rooms' &&
        msg.type !== 'join-room'
      ) {
        const activeRoom = rooms.get(currentRoomId);
        if (activeRoom) activeRoom.lastActivityAt = Date.now();
      }

      switch (msg.type) {
        case 'ping-keepalive': {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong-keepalive', timestamp: Date.now() }));
          }
          break;
        }

        case 'get-rooms': {
          ws.send(
            JSON.stringify({
              type: 'rooms-list-updated',
              rooms: getRoomSummaries(),
              limits: {
                maxRooms: MAX_ROOMS,
                maxUsersPerRoom: MAX_USERS_PER_ROOM,
                maxRoomsPerUser: MAX_ROOMS_PER_USER,
                currentRoomsCount: rooms.size,
              },
            })
          );
          break;
        }

        case 'leave-room': {
          const targetLeaveRoomId = msg.roomId || currentRoomId;
          const targetLeaveUserId = msg.userId || currentUserId;
          if (targetLeaveRoomId && targetLeaveUserId) {
            const r = rooms.get(targetLeaveRoomId);
            if (r && r.users.has(targetLeaveUserId)) {
              r.users.delete(targetLeaveUserId);
              broadcastToRoom(targetLeaveRoomId, {
                type: 'user-left',
                userId: targetLeaveUserId,
              });
              broadcastGlobalRoomsList();
            }
          }
          if (currentRoomId === targetLeaveRoomId) {
            currentRoomId = null;
          }
          break;
        }

        case 'delete-room': {
          const targetRoomId = String(msg.roomId || '').trim().toLowerCase();
          const reqOwnerKey = String(msg.ownerKey || '');
          const reqUserId = String(msg.userId || currentUserId || '');
          if (!targetRoomId || targetRoomId === 'ana-oda') {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'FORBIDDEN',
                message: 'Genel çalışma alanı silinemez.',
              })
            );
            break;
          }
          const targetRoom = rooms.get(targetRoomId);
          if (!targetRoom) {
            broadcastGlobalRoomsList();
            break;
          }
          const isOwner =
            (reqOwnerKey && targetRoom.ownerKey === reqOwnerKey) ||
            (reqUserId && targetRoom.settings.ownerId === reqUserId);
          if (!isOwner) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'FORBIDDEN',
                message: 'Yalnızca odanın kurucusu bu odayı kapatabilir veya silebilir.',
              })
            );
            break;
          }

          // Notify all active participants in the deleted room
          for (const [, userObj] of targetRoom.users.entries()) {
            if (userObj.ws.readyState === WebSocket.OPEN) {
              userObj.ws.send(
                JSON.stringify({
                  type: 'kicked-from-room',
                  roomId: targetRoom.id,
                  roomName: targetRoom.name,
                  by: `${targetRoom.ownerName} (Oda Kapatıldı)`,
                })
              );
            }
          }
          rooms.delete(targetRoomId);
          deleteSavedChat(targetRoomId);
          broadcastGlobalRoomsList();
          break;
        }

        case 'join-room': {
          const { roomId: rawJoinRoomId, roomName, user, maxUsers, isCreatingRoom, ownerKey } = msg;
          if (!rawJoinRoomId || !user || !user.id) return;

          const normalizedRoomId = String(rawJoinRoomId)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '');

          if (normalizedRoomId !== 'ana-oda' && normalizedRoomId.length !== 5) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'INVALID_ROOM_CODE',
                roomId: normalizedRoomId,
                message: 'Oda kodu tam 5 karakter olmalıdır.',
              })
            );
            return;
          }

          if (isCreatingRoom && normalizedRoomId !== 'ana-oda' && rooms.has(normalizedRoomId)) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'ROOM_CODE_TAKEN',
                roomId: normalizedRoomId,
                message: `#${normalizedRoomId.toUpperCase()} oda kodu zaten kullanılıyor. Lütfen farklı bir oda kodu seçin veya bu koda katılmayı deneyin.`,
              })
            );
            return;
          }

          const { room, error, code } = getOrCreateRoom(
            normalizedRoomId,
            roomName,
            user.id,
            user.name,
            maxUsers,
            Boolean(isCreatingRoom) || Boolean(msg.restoreRoom),
            typeof ownerKey === 'string' && ownerKey ? ownerKey : user.id
          );

          if (!room || error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: code || 'ROOM_NOT_FOUND',
                roomId: normalizedRoomId,
                message: error || 'Böyle bir oda bulunamadı.',
              })
            );
            return;
          }

          // If room has 0 active users and creator is initializing/creating it, apply custom name & maxUsers
          if (room.users.size === 0 && (isCreatingRoom || maxUsers || roomName)) {
            if (typeof roomName === 'string' && roomName.trim()) {
              room.name = sanitizeRoomDisplayName(roomName, room.id);
            }
            if (typeof maxUsers === 'number' && maxUsers >= 2) {
              room.settings.maxUsers = Math.min(
                MAX_USERS_PER_ROOM,
                Math.max(2, Math.round(maxUsers))
              );
            }
            if (typeof ownerKey === 'string' && ownerKey) {
              room.ownerKey = ownerKey;
            }
          }

          const isAlreadyInRoom = room.users.has(user.id);
          const savedRole = room.roleAssignments.get(user.id);
          const isOwnerOrAdmin =
            room.settings.ownerId === user.id ||
            (ownerKey && room.ownerKey === ownerKey) ||
            savedRole === 'owner' ||
            savedRole === 'admin';

          // Anyone who was part of the session when the idle timeout locked the room may resume it
          const isReturningMember =
            typeof ownerKey === 'string' && ownerKey.length > 0 && room.memberKeys.has(ownerKey);
          if (room.settings.isLocked && room.lockedByIdle && (isOwnerOrAdmin || isReturningMember)) {
            room.settings.isLocked = false;
            room.lockedByIdle = false;
          }
          // Check if room is locked
          if (room.settings.isLocked && !isAlreadyInRoom && !isOwnerOrAdmin) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'ROOM_LOCKED',
                roomId: room.id,
                message: `"${room.name}" (#${room.id.toUpperCase()}) odası şu anda kilitli. Oda yöneticisi yeni katılımları kapattı.`,
              })
            );
            return;
          }

          // Strictly enforce room user capacity limit for all new participants
          if (!isAlreadyInRoom && room.users.size >= room.settings.maxUsers) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'ROOM_FULL',
                roomId: room.id,
                message: `"${room.name}" (#${room.id.toUpperCase()}) odası maksimum kapasiteye ulaştı (${room.users.size}/${room.settings.maxUsers} kişi). Bu odaya giriş yapılamaz.`,
              })
            );
            return;
          }

          // Remove this user from ANY other room they were previously connected to (eliminates ghost users on room switch)
          for (const [otherRoomId, otherRoom] of rooms.entries()) {
            if (otherRoomId !== room.id) {
              let removedAny = false;
              if (currentUserId && otherRoom.users.has(currentUserId)) {
                otherRoom.users.delete(currentUserId);
                removedAny = true;
              }
              if (otherRoom.users.has(user.id)) {
                otherRoom.users.delete(user.id);
                removedAny = true;
              }
              if (removedAny) {
                broadcastToRoom(otherRoomId, {
                  type: 'user-left',
                  userId: user.id,
                });
                if (currentUserId && currentUserId !== user.id) {
                  broadcastToRoom(otherRoomId, {
                    type: 'user-left',
                    userId: currentUserId,
                  });
                }
              }
            }
          }

          currentRoomId = room.id;
          currentUserId = user.id;
          room.lastActivityAt = Date.now();
          if (typeof ownerKey === 'string' && ownerKey) room.memberKeys.add(ownerKey);

          // Determine user's role in the room
          let assignedRole: UserRole = savedRole || room.settings.defaultRole;
          if (
            room.settings.ownerId === 'system' ||
            room.settings.ownerId === user.id ||
            (ownerKey && room.ownerKey === ownerKey) ||
            room.users.size === 0
          ) {
            if (room.settings.ownerId === 'system' || room.users.size === 0) {
              room.settings.ownerId = user.id;
              room.ownerName = user.name || 'Kurucu';
              if (typeof ownerKey === 'string' && ownerKey) {
                room.ownerKey = ownerKey;
              }
            }
            if (room.settings.ownerId === user.id || (ownerKey && room.ownerKey === ownerKey)) {
              assignedRole = 'owner';
            }
          }
          room.roleAssignments.set(user.id, assignedRole);

          const existingPresence = room.users.get(user.id)?.presence;
          const presence: UserPresence = {
            id: user.id,
            name: user.name || 'Misafir Kullanıcı',
            avatar: user.avatar || (user.name || 'M').charAt(0).toUpperCase(),
            color: user.color || '#2563eb',
            role: assignedRole,
            cursor: existingPresence?.cursor || { x: 0, y: 0 },
            isDrawing: false,
            activeTool: existingPresence?.activeTool || 'select',
            isMuted: existingPresence?.isMuted ?? true,
            isDeafened: existingPresence?.isDeafened ?? false,
            isSpeaking: false,
            joinedAt: existingPresence?.joinedAt || Date.now(),
          };

          room.users.set(user.id, { ws, presence });

          const elementsArray = room.elementOrder
            .map((id) => room.elements.get(id))
            .filter((el): el is CanvasElement => el !== undefined);

          const activeUsers = Array.from(room.users.values()).map((u) => u.presence);

          // Send full room snapshot to the joining user
          ws.send(
            JSON.stringify({
              type: 'init-room',
              roomId: room.id,
              roomName: room.name,
              settings: room.settings,
              elements: elementsArray,
              code: room.code,
              notes: room.notes,
              files: room.files,
              codeFiles: room.codeFiles,
              messages: room.messages.filter(
                (m) =>
                  !m.isPrivate ||
                  m.userId === currentUserId ||
                  m.recipientId === currentUserId
              ),
              users: activeUsers,
              rooms: getRoomSummaries(),
              limits: {
                maxRooms: MAX_ROOMS,
                maxUsersPerRoom: MAX_USERS_PER_ROOM,
                maxRoomsPerUser: MAX_ROOMS_PER_USER,
                currentRoomsCount: rooms.size,
              },
            })
          );

          // Broadcast user joined to other room members
          broadcastToRoom(
            room.id,
            {
              type: 'user-joined',
              user: presence,
            },
            user.id
          );

          broadcastGlobalRoomsList();
          break;
        }

        case 'room-settings-update': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (!sender || !canManageRoom(sender.presence.role)) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'FORBIDDEN',
                message: 'Oda ayarlarını değiştirmek için Kurucu veya Yönetici yetkisi gereklidir.',
              })
            );
            return;
          }

          const { changes } = msg;
          if (changes) {
            if (typeof changes.isLocked === 'boolean') {
              room.settings.isLocked = changes.isLocked;
              room.lockedByIdle = false;
            }
            if (typeof changes.maxUsers === 'number') {
              room.settings.maxUsers = Math.min(
                MAX_USERS_PER_ROOM,
                Math.max(Math.max(2, room.users.size), Math.round(changes.maxUsers))
              );
            }
            if (changes.defaultRole === 'editor' || changes.defaultRole === 'viewer') {
              room.settings.defaultRole = changes.defaultRole;
            }
            if (typeof changes.roomName === 'string' && changes.roomName.trim()) {
              room.name = sanitizeRoomDisplayName(changes.roomName, room.id);
            }
            if (typeof changes.saveChat === 'boolean' && changes.saveChat !== room.settings.saveChat) {
              room.settings.saveChat = changes.saveChat;
              if (changes.saveChat) {
                scheduleChatSave(room);
              } else {
                // Turning saving off erases what was stored (memory, disk and every client's copy)
                room.messages = room.messages.filter((m) => m.userId === 'system');
                deleteSavedChat(room.id);
                broadcastToRoom(room.id, { type: 'chat-history-cleared' });
              }
            }
          }

          broadcastToRoom(currentRoomId, {
            type: 'room-settings-updated',
            roomName: room.name,
            settings: room.settings,
            updatedBy: sender.presence.name,
          });
          broadcastGlobalRoomsList();
          break;
        }

        case 'user-role-update': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (!sender || !canManageRoom(sender.presence.role)) return;

          const { targetUserId, newRole } = msg as { targetUserId: string; newRole: UserRole };
          if (!targetUserId || !['admin', 'editor', 'viewer'].includes(newRole)) return;

          const target = room.users.get(targetUserId);
          if (!target) return;

          // Admin cannot demote the room owner
          if (target.presence.role === 'owner' && sender.presence.role !== 'owner') return;

          target.presence.role = newRole;
          room.roleAssignments.set(targetUserId, newRole);

          broadcastToRoom(currentRoomId, {
            type: 'user-role-updated',
            userId: targetUserId,
            role: newRole,
            updatedBy: sender.presence.name,
          });
          break;
        }

        case 'user-kick': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (!sender || !canManageRoom(sender.presence.role)) return;

          const { targetUserId } = msg;
          const target = room.users.get(targetUserId);
          if (!target || target.presence.role === 'owner') return;

          if (target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                type: 'kicked-from-room',
                roomId: room.id,
                roomName: room.name,
                by: sender.presence.name,
              })
            );
          }

          room.users.delete(targetUserId);
          broadcastToRoom(currentRoomId, {
            type: 'user-left',
            userId: targetUserId,
          });
          broadcastGlobalRoomsList();
          break;
        }

        case 'user-update': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const userObj = room.users.get(currentUserId);
          if (userObj && msg.user) {
            userObj.presence.name = msg.user.name || userObj.presence.name;
            userObj.presence.color = msg.user.color || userObj.presence.color;
            userObj.presence.avatar =
              msg.user.avatar || userObj.presence.name.charAt(0).toUpperCase();

            if (room.settings.ownerId === currentUserId) {
              room.ownerName = userObj.presence.name;
            }

            broadcastToRoom(currentRoomId, {
              type: 'user-updated',
              user: userObj.presence,
            });
            broadcastGlobalRoomsList();
          }
          break;
        }

        case 'cursor-move': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const userObj = room.users.get(currentUserId);
          if (userObj) {
            userObj.presence.cursor = msg.cursor;
            userObj.presence.isDrawing = !!msg.isDrawing;
            userObj.presence.activeTool = msg.activeTool || userObj.presence.activeTool;

            broadcastToRoom(
              currentRoomId,
              {
                type: 'cursor-moved',
                userId: currentUserId,
                cursor: msg.cursor,
                isDrawing: msg.isDrawing,
                activeTool: msg.activeTool,
              },
              currentUserId
            );
          }
          break;
        }

        case 'laser-move': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const userObj = room.users.get(currentUserId);

          broadcastToRoom(
            currentRoomId,
            {
              type: 'laser-moved',
              userId: currentUserId,
              color: userObj?.presence.color || '#ef4444',
              point: msg.point,
            },
            currentUserId
          );
          break;
        }

        case 'stroke-live': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;
          const liveEl = msg.element;
          if (liveEl && (typeof liveEl.id !== 'string' || (liveEl.points && liveEl.points.length > 4000))) return;
          broadcastToRoom(
            currentRoomId,
            { type: 'stroke-live', userId: currentUserId, element: liveEl || null },
            currentUserId || undefined
          );
          break;
        }

        case 'element-create': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const element: CanvasElement = msg.element;
          if (!element || !element.id) return;

          if (!room.elements.has(element.id)) {
            room.elements.set(element.id, element);
            room.elementOrder.push(element.id);
          } else {
            room.elements.set(element.id, element);
          }

          broadcastToRoom(
            currentRoomId,
            {
              type: 'element-created',
              element,
            },
            currentUserId || undefined
          );
          break;
        }

        case 'element-update': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const { id, changes } = msg;
          const existing = room.elements.get(id);
          if (existing) {
            const updated = { ...existing, ...changes, updatedAt: Date.now() };
            room.elements.set(id, updated);

            broadcastToRoom(
              currentRoomId,
              {
                type: 'element-updated',
                id,
                changes,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'elements-batch-update': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const { updates } = msg;
          if (Array.isArray(updates)) {
            for (const item of updates) {
              const existing = room.elements.get(item.id);
              if (existing) {
                room.elements.set(item.id, {
                  ...existing,
                  ...item.changes,
                  updatedAt: Date.now(),
                });
              }
            }

            broadcastToRoom(
              currentRoomId,
              {
                type: 'elements-batch-updated',
                updates,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'element-delete': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const { ids } = msg;
          if (Array.isArray(ids)) {
            for (const id of ids) {
              room.elements.delete(id);
              room.elementOrder = room.elementOrder.filter((elId) => elId !== id);
            }

            broadcastToRoom(
              currentRoomId,
              {
                type: 'element-deleted',
                ids,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'elements-replace': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const { elements } = msg;
          if (Array.isArray(elements)) {
            room.elements.clear();
            room.elementOrder = [];
            for (const el of elements) {
              if (el && el.id) {
                room.elements.set(el.id, el);
                room.elementOrder.push(el.id);
              }
            }

            broadcastToRoom(
              currentRoomId,
              {
                type: 'elements-replaced',
                elements,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'elements-order-change': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          if (Array.isArray(msg.elementOrder)) {
            room.elementOrder = msg.elementOrder.filter((id: string) => room.elements.has(id));
            const orderedElements = room.elementOrder
              .map((id) => room.elements.get(id))
              .filter((el): el is CanvasElement => el !== undefined);

            broadcastToRoom(
              currentRoomId,
              {
                type: 'elements-replaced',
                elements: orderedElements,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'elements-clear': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          room.elements.clear();
          room.elementOrder = [];

          broadcastToRoom(currentRoomId, {
            type: 'elements-cleared',
            clearedBy: currentUserId,
          });
          break;
        }

        case 'elements-load-template': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const { elements } = msg;
          if (Array.isArray(elements)) {
            for (const el of elements) {
              room.elements.set(el.id, el);
              if (!room.elementOrder.includes(el.id)) {
                room.elementOrder.push(el.id);
              }
            }

            broadcastToRoom(currentRoomId, {
              type: 'elements-template-loaded',
              elements,
            });
          }
          break;
        }

        case 'code-change': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          room.code = {
            content: msg.content,
            language: msg.language || room.code.language,
            lastUpdatedBy: msg.userName || 'Kullanıcı',
          };

          broadcastToRoom(
            currentRoomId,
            {
              type: 'code-updated',
              code: room.code,
              senderId: currentUserId,
            },
            currentUserId || undefined
          );
          break;
        }

        case 'code-file-upsert': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;
          const f = msg.file;
          if (!f || typeof f.id !== 'string' || typeof f.content !== 'string') return;
          if (f.content.length > 400000) return;
          const safe: CodeFile = {
            id: f.id.slice(0, 64),
            name: String(f.name || 'dosya.txt').slice(0, 80),
            language: String(f.language || 'javascript').slice(0, 24),
            content: f.content,
            lastUpdatedBy: String(msg.userName || 'Kullanıcı').slice(0, 80),
          };
          const idx = room.codeFiles.findIndex((x) => x.id === safe.id);
          if (idx >= 0) {
            room.codeFiles[idx] = safe;
          } else {
            if (room.codeFiles.length >= 20) return;
            room.codeFiles.push(safe);
          }
          broadcastToRoom(
            currentRoomId,
            { type: 'code-file-updated', file: safe, senderId: currentUserId },
            currentUserId || undefined
          );
          break;
        }

        case 'code-file-delete': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;
          const fileId = String(msg.fileId || '');
          room.codeFiles = room.codeFiles.filter((x) => x.id !== fileId);
          broadcastToRoom(
            currentRoomId,
            { type: 'code-file-deleted', fileId, senderId: currentUserId },
            currentUserId || undefined
          );
          break;
        }

        case 'code-cursor-move': {
          if (!currentRoomId || !currentUserId) return;
          broadcastToRoom(
            currentRoomId,
            {
              type: 'code-cursor-moved',
              userId: currentUserId,
              userName: msg.userName || 'Kullanıcı',
              userColor: msg.userColor || '#3b82f6',
              line: msg.line,
              column: msg.column,
              selectionStart: msg.selectionStart,
              selectionEnd: msg.selectionEnd,
            },
            currentUserId
          );
          break;
        }

        case 'notes-change': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          room.notes = {
            content: msg.content,
            lastUpdatedBy: msg.userName || 'Kullanıcı',
          };

          broadcastToRoom(
            currentRoomId,
            {
              type: 'notes-updated',
              notes: room.notes,
              senderId: currentUserId,
            },
            currentUserId || undefined
          );
          break;
        }

        case 'chat-message': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const msgId =
            typeof msg.id === 'string' && msg.id.length > 0
              ? msg.id
              : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

          // Deduplicate if already processed
          if (room.messages.some((m) => m.id === msgId)) {
            break;
          }

          const isPrivate = Boolean(msg.isPrivate || msg.recipientId);
          const recipientId = msg.recipientId ? String(msg.recipientId) : undefined;
          const recipientName = msg.recipientName ? String(msg.recipientName) : undefined;

          const chatMessage: ChatMessage = {
            id: msgId,
            userId: currentUserId || msg.userId || 'unknown',
            userName: msg.userName || 'Kullanıcı',
            userColor: msg.userColor || '#2563eb',
            text: msg.text,
            timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
            fileAttachment: msg.fileAttachment,
            recipientId,
            recipientName,
            isPrivate,
          };

          // The owner decides whether this room keeps its chat history
          if (room.settings.saveChat !== false) {
            room.messages.push(chatMessage);
            if (room.messages.length > 200) {
              room.messages.shift();
            }
            scheduleChatSave(room);
          }

          if (isPrivate && recipientId) {
            // Private 1-on-1 direct message: deliver strictly to the recipient
            const recipientUser = room.users.get(recipientId);
            if (recipientUser && recipientUser.ws.readyState === WebSocket.OPEN) {
              recipientUser.ws.send(
                JSON.stringify({
                  type: 'chat-received',
                  message: chatMessage,
                })
              );
            }
          } else {
            // General room broadcast: deliver to everyone else in the room
            broadcastToRoom(
              currentRoomId,
              {
                type: 'chat-received',
                message: chatMessage,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'chat-message-delete': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const messageId = msg.messageId;
          if (!messageId) return;

          const msgIndex = room.messages.findIndex((m) => m.id === messageId);
          if (msgIndex === -1) return;

          const targetMsg = room.messages[msgIndex];
          const sender = room.users.get(currentUserId);
          const isAuthor = targetMsg.userId === currentUserId;
          const isAdmin = sender && (sender.presence.role === 'admin' || sender.presence.role === 'editor');

          // Only message author or room admin/editor can delete
          if (!isAuthor && !isAdmin) return;

          room.messages.splice(msgIndex, 1);
          scheduleChatSave(room);

          if (targetMsg.isPrivate && targetMsg.recipientId) {
            // Notify recipient
            const recipientUser = room.users.get(targetMsg.recipientId);
            if (recipientUser && recipientUser.ws.readyState === WebSocket.OPEN) {
              recipientUser.ws.send(
                JSON.stringify({
                  type: 'chat-message-deleted',
                  messageId,
                })
              );
            }
            // Notify author (for syncing across duplicate tabs if any)
            const authorUser = room.users.get(targetMsg.userId);
            if (authorUser && authorUser.ws.readyState === WebSocket.OPEN) {
              authorUser.ws.send(
                JSON.stringify({
                  type: 'chat-message-deleted',
                  messageId,
                })
              );
            }
          } else {
            // Broadcast deletion to all users in the room
            broadcastToRoom(currentRoomId, {
              type: 'chat-message-deleted',
              messageId,
            });
          }
          break;
        }

        case 'file-upload': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          // Reject forbidden executable files (.exe, .bat, etc.)
          const fileName = String(msg.name || '').toLowerCase();
          const forbiddenExts = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', '.ps1', '.com', '.scr', '.bin', '.jar', '.apk', '.app', '.dll'];
          if (forbiddenExts.some((ext) => fileName.endsWith(ext))) {
            ws.send(
              JSON.stringify({
                type: 'system-error',
                message: 'Güvenlik nedeniyle çalıştırılabilir (.exe vb.) dosyalar yüklenemez.',
              })
            );
            break;
          }

          const fileId =
            typeof msg.id === 'string' && msg.id.length > 0
              ? msg.id
              : `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

          // Deduplicate by ID or file signature
          if (
            room.files.some(
              (f) =>
                f.id === fileId ||
                (f.name === msg.name && f.size === msg.size && f.dataUrl === msg.dataUrl)
            )
          ) {
            break;
          }

          const file: SharedFile = {
            id: fileId,
            name: msg.name,
            size: msg.size,
            type: msg.fileType || msg.type || 'application/octet-stream',
            dataUrl: msg.dataUrl,
            uploadedBy: msg.uploadedBy || 'Kullanıcı',
            uploadedAt: Date.now(),
          };

          room.files.push(file);

          // Broadcast to everyone else in the room (sender already has it)
          broadcastToRoom(
            currentRoomId,
            {
              type: 'file-added',
              file,
            },
            currentUserId || undefined
          );
          break;
        }

        case 'file-delete': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const { fileId } = msg;
          room.files = room.files.filter((f) => f.id !== fileId);

          broadcastToRoom(currentRoomId, {
            type: 'file-deleted',
            fileId,
          });
          break;
        }

        case 'voice-state': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const userObj = room.users.get(currentUserId);
          if (userObj) {
            if (msg.isMuted !== undefined) userObj.presence.isMuted = msg.isMuted;
            if (msg.isDeafened !== undefined) userObj.presence.isDeafened = msg.isDeafened;
            if (msg.isSpeaking !== undefined) userObj.presence.isSpeaking = msg.isSpeaking;

            broadcastToRoom(currentRoomId, {
              type: 'voice-state-updated',
              userId: currentUserId,
              isMuted: userObj.presence.isMuted,
              isDeafened: userObj.presence.isDeafened,
              isSpeaking: userObj.presence.isSpeaking,
            });
          }
          break;
        }

        case 'user-ping': {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, {
            type: 'ping-received',
            x: msg.x,
            y: msg.y,
            userName: msg.userName,
            userColor: msg.userColor,
          });
          break;
        }

        case 'reaction': {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, {
            type: 'reaction-received',
            x: msg.x,
            y: msg.y,
            emoji: msg.emoji,
            userName: msg.userName,
          });
          break;
        }

        // WebRTC Signaling Relay for Voice Mesh
        case 'webrtc-signal': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const targetUser = room.users.get(msg.targetUserId);
          if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
            targetUser.ws.send(
              JSON.stringify({
                type: 'webrtc-signal',
                fromUserId: currentUserId,
                signal: msg.signal,
              })
            );
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentUserId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const existingUser = room.users.get(currentUserId);
        if (existingUser && existingUser.ws === ws) {
          room.users.delete(currentUserId);
          broadcastToRoom(currentRoomId, {
            type: 'user-left',
            userId: currentUserId,
          });

          // If the owner left and other users remain, promote the longest-standing user to admin/owner
          if (room.settings.ownerId === currentUserId && room.users.size > 0) {
            const nextEntry = room.users.entries().next().value;
            if (nextEntry) {
              const [nextUserId, nextUserObj] = nextEntry;
              room.settings.ownerId = nextUserId;
              room.ownerName = nextUserObj.presence.name;
              nextUserObj.presence.role = 'owner';
              room.roleAssignments.set(nextUserId, 'owner');
              broadcastToRoom(currentRoomId, {
                type: 'user-role-updated',
                userId: nextUserId,
                role: 'owner',
                updatedBy: 'Sistem',
              });
              broadcastToRoom(currentRoomId, {
                type: 'room-settings-updated',
                roomName: room.name,
                settings: room.settings,
                updatedBy: 'Sistem',
              });
            }
          }

          broadcastGlobalRoomsList();
        }

        if (room.users.size === 0 && currentRoomId !== 'ana-oda') {
          const targetRoomId = currentRoomId;
          setTimeout(() => {
            const r = rooms.get(targetRoomId);
            if (r && r.users.size === 0 && targetRoomId !== 'ana-oda') {
              rooms.delete(targetRoomId);
              deleteSavedChat(targetRoomId);
              broadcastGlobalRoomsList();
            }
          }, EMPTY_ROOM_RETENTION_MS);
        }
      }
    }
  });
});


// Gemini AI Quota Status & API Key Source Inspector Endpoint
app.get('/api/ai/quota-status', (req, res) => {
  const clientId = String(req.query.clientId || req.headers['x-client-id'] || 'default-client');
  const status = getClientQuotaStatus(clientId);
  res.json(status);
});

app.post('/api/ai/quota-reset', (req, res) => {
  const { clientId = 'default-client' } = req.body || {};
  resetClientQuota(String(clientId));
  const status = getClientQuotaStatus(String(clientId));
  res.json(status);
});

// Gemini AI Canvas Vector Object & Diagram Generator Endpoint (No Starry Fallbacks - Structured Error & Self-Healing Retry)
app.post('/api/ai/generate-canvas', async (req, res) => {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Asistanı',
    thinkingLevel = 'standard',
    targetDuration = 20,
    quotaSource = 'app_default',
    clientId = 'default-client',
    isRetryAttempt = false,
  } = req.body || {};

  const activeQuotaSource: QuotaSourceMode =
    quotaSource === 'user_aistudio' ? 'user_aistudio' : 'app_default';

  try {
    const result = await generateCanvasVectorWithRetry({
      prompt: typeof prompt === 'string' ? prompt : '',
      centerX: Number(centerX) || 500,
      centerY: Number(centerY) || 350,
      author: typeof author === 'string' ? author : 'AI Asistanı',
      thinkingLevel: typeof thinkingLevel === 'string' ? thinkingLevel : 'standard',
      targetDuration: Number(targetDuration) || 20,
      keySource: activeQuotaSource,
      clientId: String(clientId),
      retryAttempt: isRetryAttempt ? 1 : 0,
    });

    res.json({
      elements: result.elements,
      summary: result.summary,
      modelUsed: result.modelUsed,
      attemptsUsed: result.attemptsMade,
      quota: result.quota,
    });
  } catch (err: unknown) {
    if (res.headersSent) return;
    const quota = getClientQuotaStatus(String(clientId), activeQuotaSource);
    if (err instanceof AIDrawingError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        retryable: err.retryable,
        suggestion: err.suggestion,
        attemptsMade: err.attemptsMade,
        quota,
      });
      return;
    }
    res.status(500).json({
      error: (err as Error)?.message || 'Yapay zeka çizim motorunda beklenmeyen bir hata oluştu.',
      code: 'MODEL_GENERATION_FAILED',
      retryable: true,
      suggestion: 'Lütfen "Tekrar Çözmeyi Dene" butonuna tıklayarak işlemi yeniden başlatın.',
      attemptsMade: 1,
      quota,
    });
  }
});

// Gemini AI Visual Illustration & Image Sticker Generator Endpoint (No Starry Fallbacks - Structured Error & Self-Healing Retry)
app.post('/api/ai/generate-image', async (req, res) => {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Görsel',
    thinkingLevel = 'standard',
    targetDuration = 20,
    quotaSource = 'app_default',
    clientId = 'default-client',
    isRetryAttempt = false,
  } = req.body || {};

  const activeQuotaSource: QuotaSourceMode =
    quotaSource === 'user_aistudio' ? 'user_aistudio' : 'app_default';

  try {
    const result = await generateSvgImageWithRetry({
      prompt: typeof prompt === 'string' ? prompt : '',
      centerX: Number(centerX) || 500,
      centerY: Number(centerY) || 350,
      author: typeof author === 'string' ? author : 'AI Görsel',
      thinkingLevel: typeof thinkingLevel === 'string' ? thinkingLevel : 'standard',
      targetDuration: Number(targetDuration) || 20,
      keySource: activeQuotaSource,
      clientId: String(clientId),
      retryAttempt: isRetryAttempt ? 1 : 0,
    });

    res.json({
      element: result.element,
      summary: result.summary,
      modelUsed: result.modelUsed,
      attemptsUsed: result.attemptsMade,
      quota: result.quota,
    });
  } catch (err: unknown) {
    if (res.headersSent) return;
    const quota = getClientQuotaStatus(String(clientId), activeQuotaSource);
    if (err instanceof AIDrawingError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        retryable: err.retryable,
        suggestion: err.suggestion,
        attemptsMade: err.attemptsMade,
        quota,
      });
      return;
    }
    res.status(500).json({
      error: (err as Error)?.message || 'Yapay zeka görsel motorunda beklenmeyen bir hata oluştu.',
      code: 'MODEL_GENERATION_FAILED',
      retryable: true,
      suggestion: 'Lütfen "Tekrar Çözmeyi Dene" butonuna tıklayarak işlemi yeniden başlatın.',
      attemptsMade: 1,
      quota,
    });
  }
});

// Multi-Language Backend Code Compiler & Execution Engine
const WANDBOX_COMPILERS: Record<string, { compiler: string; label: string }> = {
  python: { compiler: 'cpython-3.12.7', label: 'Python 3.12 (Wandbox)' },
  cpp: { compiler: 'gcc-head', label: 'GCC C++20 (Wandbox)' },
  c: { compiler: 'gcc-head-c', label: 'GCC C17 (Wandbox)' },
  csharp: { compiler: 'mono-6.12.0.199', label: 'Mono C# (Wandbox)' },
  java: { compiler: 'openjdk-jdk-22+36', label: 'OpenJDK 22 (Wandbox)' },
  go: { compiler: 'go-1.23.2', label: 'Go 1.23 (Wandbox)' },
  rust: { compiler: 'rust-1.82.0', label: 'Rust 1.82 (Wandbox)' },
  sql: { compiler: 'sqlite-3.46.1', label: 'SQLite 3.46 (Wandbox)' },
};

function runInNodeVm(
  jsCode: string,
  stdinText: string
): { stdout: string; stderr: string; exitCode: number } {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const stdinLines = stdinText.split(/\r?\n/);
  let stdinIdx = 0;

  const formatVal = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  };

  const sandboxConsole = {
    log: (...args: unknown[]) => stdoutLines.push(args.map(formatVal).join(' ')),
    info: (...args: unknown[]) => stdoutLines.push(args.map(formatVal).join(' ')),
    warn: (...args: unknown[]) => stdoutLines.push('⚠️ ' + args.map(formatVal).join(' ')),
    error: (...args: unknown[]) => stderrLines.push(args.map(formatVal).join(' ')),
    table: (data: unknown) => stdoutLines.push(formatVal(data)),
  };

  const sandbox = {
    console: sandboxConsole,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Buffer,
    URL,
    URLSearchParams,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    input: () => (stdinIdx < stdinLines.length ? stdinLines[stdinIdx++] : ''),
    prompt: () => (stdinIdx < stdinLines.length ? stdinLines[stdinIdx++] : ''),
    process: {
      env: { NODE_ENV: 'sandbox' },
      version: process.version,
      platform: process.platform,
      argv: ['node', 'script.js'],
      stdout: {
        write: (str: string) => {
          stdoutLines.push(String(str).replace(/\n$/, ''));
        },
      },
      stderr: {
        write: (str: string) => {
          stderrLines.push(String(str).replace(/\n$/, ''));
        },
      },
    },
  };

  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(jsCode, { filename: 'collabboard-script.js' });
    const result = script.runInContext(context, { timeout: 4000 });
    if (result !== undefined && stdoutLines.length === 0 && stderrLines.length === 0) {
      stdoutLines.push(formatVal(result));
    }
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      exitCode: stderrLines.length > 0 ? 1 : 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    stderrLines.push(message);
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      exitCode: 1,
    };
  }
}

function runNativePython(
  code: string,
  stdinText: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-u', '-c', code], {
      timeout: 5000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      if (stdout.length < 64000) stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length < 64000) stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (codeNum) => {
      resolve({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: codeNum ?? 0,
      });
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

async function runViaWandbox(
  language: string,
  code: string,
  stdinText: string
): Promise<{
  stdout: string;
  stderr: string;
  compileOutput?: string;
  exitCode: number;
  engine: string;
}> {
  const cfg = WANDBOX_COMPILERS[language] || WANDBOX_COMPILERS.python;
  const response = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler: cfg.compiler,
      code,
      stdin: stdinText || '',
      save: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Wandbox compiler HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    status?: string | number;
    program_output?: string;
    program_message?: string;
    program_error?: string;
    compiler_output?: string;
    compiler_error?: string;
    compiler_message?: string;
  };

  const exitCode = Number(data.status ?? 0);
  const compileOutput = (data.compiler_error || data.compiler_output || data.compiler_message || '').trim();
  const stdout = (data.program_output || '').trimEnd();
  const stderr = [compileOutput, (data.program_error || '').trim()].filter(Boolean).join('\n');

  return {
    stdout,
    stderr,
    compileOutput,
    exitCode: isNaN(exitCode) ? 0 : exitCode,
    engine: cfg.label,
  };
}

app.post('/api/code/execute', async (req, res) => {
  const startTime = performance.now();
  const {
    code = '',
    language = 'javascript',
    stdin = '',
    roomId,
    executedBy,
  } = req.body as {
    code?: string;
    language?: string;
    stdin?: string;
    roomId?: string;
    executedBy?: string;
  };

  if (!code || !code.trim()) {
    res.json({
      stdout: '',
      stderr: 'Çalıştırılacak kod boş.',
      exitCode: 1,
      executionTimeMs: 0,
      engine: 'CollabBoard Compiler',
      language,
    });
    return;
  }

  try {
    let result: {
      stdout: string;
      stderr: string;
      compileOutput?: string;
      exitCode: number;
      engine: string;
    };

    if (language === 'javascript') {
      const vmRes = runInNodeVm(code, stdin);
      result = {
        ...vmRes,
        engine: `Node.js ${process.version} VM`,
      };
    } else if (language === 'typescript') {
      try {
        const transformed = await esbuild.transform(code, {
          loader: 'ts',
          target: 'es2022',
          format: 'cjs',
        });
        const vmRes = runInNodeVm(transformed.code, stdin);
        result = {
          ...vmRes,
          compileOutput: transformed.warnings.length
            ? transformed.warnings.map((w) => w.text).join('\n')
            : undefined,
          engine: `esbuild TypeScript + Node.js ${process.version}`,
        };
      } catch (tsErr: unknown) {
        const errMsg = tsErr instanceof Error ? tsErr.message : String(tsErr);
        result = {
          stdout: '',
          stderr: `TypeScript Derleme Hatası:\n${errMsg}`,
          compileOutput: errMsg,
          exitCode: 1,
          engine: 'esbuild TypeScript Compiler',
        };
      }
    } else if (language === 'python') {
      try {
        const pyRes = await runNativePython(code, stdin);
        result = {
          ...pyRes,
          engine: 'Python 3 (Sunucu Native)',
        };
      } catch {
        result = await runViaWandbox('python', code, stdin);
      }
    } else if (language === 'json') {
      try {
        const parsed = JSON.parse(code);
        result = {
          stdout: `✅ Geçerli JSON (${Object.keys(parsed).length} anahtar):\n` + JSON.stringify(parsed, null, 2),
          stderr: '',
          exitCode: 0,
          engine: 'JSON Doğrulayıcı & Biçimlendirici',
        };
      } catch (jsonErr: unknown) {
        result = {
          stdout: '',
          stderr: `❌ JSON Sözdizimi Hatası: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
          exitCode: 1,
          engine: 'JSON Doğrulayıcı',
        };
      }
    } else if (language === 'html') {
      result = {
        stdout: '✅ HTML5 & CSS3 belgesi derlendi ve Canlı Önizleme sekmesinde görüntülendi.',
        stderr: '',
        exitCode: 0,
        engine: 'HTML5 Canlı Render Motoru',
      };
    } else {
      // C, C++, C#, Java, Go, Rust, SQL via Wandbox Compiler API
      result = await runViaWandbox(language, code, stdin);
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    const payload = {
      ...result,
      executionTimeMs,
      language,
      executedBy: executedBy || 'Kullanıcı',
      timestamp: Date.now(),
    };

    if (roomId && rooms.has(roomId)) {
      broadcastToRoom(roomId, {
        type: 'code-execution-result',
        result: payload,
      });
    }

    res.json(payload);
  } catch (err: unknown) {
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    res.json({
      stdout: '',
      stderr: `Derleyici Bağlantı Hatası: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: 1,
      executionTimeMs,
      engine: 'CollabBoard Compiler',
      language,
    });
  }
});

// REST Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    roomsCount: rooms.size,
    maxRooms: MAX_ROOMS,
    maxUsersPerRoom: MAX_USERS_PER_ROOM,
    timestamp: Date.now(),
  });
});

app.get('/api/rtc-config', (_req, res) => {
  const iceServers: Record<string, unknown>[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];
  // Private TURN server (recommended for production): TURN_URL, TURN_USERNAME, TURN_CREDENTIAL
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map((u) => u.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  res.json({ iceServers });
});

app.get('/api/rooms', (_req, res) => {
  res.json({
    rooms: getRoomSummaries(),
    limits: {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      maxRoomsPerUser: MAX_ROOMS_PER_USER,
      currentRoomsCount: rooms.size,
    },
  });
});

app.delete('/api/rooms/:roomId', (req, res) => {
  const targetRoomId = String(req.params.roomId || '').trim().toLowerCase();
  const ownerKey = String(req.query.ownerKey || req.body?.ownerKey || '');
  const userId = String(req.query.userId || req.body?.userId || '');

  if (!targetRoomId || targetRoomId === 'ana-oda') {
    res.status(403).json({ error: 'Genel çalışma alanı silinemez.' });
    return;
  }

  const targetRoom = rooms.get(targetRoomId);
  if (!targetRoom) {
    res.json({ ok: true, rooms: getRoomSummaries() });
    return;
  }

  const isOwner =
    (ownerKey && targetRoom.ownerKey === ownerKey) ||
    (userId && targetRoom.settings.ownerId === userId);
  if (!isOwner) {
    res.status(403).json({ error: 'Yalnızca odanın kurucusu bu odayı kapatabilir veya silebilir.' });
    return;
  }

  for (const [, userObj] of targetRoom.users.entries()) {
    if (userObj.ws.readyState === WebSocket.OPEN) {
      userObj.ws.send(
        JSON.stringify({
          type: 'kicked-from-room',
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          by: `${targetRoom.ownerName} (Oda Kapatıldı)`,
        })
      );
    }
  }
  rooms.delete(targetRoomId);
  deleteSavedChat(targetRoomId);
  broadcastGlobalRoomsList();
  res.json({
    ok: true,
    rooms: getRoomSummaries(),
    limits: {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      maxRoomsPerUser: MAX_ROOMS_PER_USER,
      currentRoomsCount: rooms.size,
    },
  });
});

app.get('/api/rooms/:roomId/status', (req, res) => {
  const roomId = String(req.params.roomId || '').trim().toLowerCase();
  const ownerKey = typeof req.query.ownerKey === 'string' ? req.query.ownerKey : '';
  const room = rooms.get(roomId);
  if (!room) {
    res.json({ exists: false, roomId });
    return;
  }
  res.json({
    exists: true,
    roomId: room.id,
    name: room.name,
    isLocked: room.settings.isLocked,
    lockedByIdle: Boolean(room.lockedByIdle),
    userCount: room.users.size,
    maxUsers: room.settings.maxUsers,
    isOwner: Boolean(ownerKey) && room.ownerKey === ownerKey,
    canResume:
      Boolean(ownerKey) && room.lockedByIdle === true && room.memberKeys.has(ownerKey),
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = (req.params.roomId || 'ana-oda').trim().toLowerCase();
  const roomName = typeof req.query.roomName === 'string' ? req.query.roomName : undefined;
  const allowCreate = req.query.create === 'true' || roomId === 'ana-oda';
  const ownerKey = typeof req.query.ownerKey === 'string' ? req.query.ownerKey : undefined;
  const { room, error, code } = getOrCreateRoom(
    roomId,
    roomName,
    undefined,
    undefined,
    undefined,
    allowCreate,
    ownerKey
  );
  if (!room || error) {
    res.status(404).json({ error: error || 'Böyle bir oda bulunamadı.', code: code || 'ROOM_NOT_FOUND' });
    return;
  }
  const elementsArray = room.elementOrder
    .map((id) => room.elements.get(id))
    .filter((el): el is CanvasElement => el !== undefined);
  const activeUsers = Array.from(room.users.values()).map((u) => u.presence);

  res.json({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    settings: room.settings,
    elementCount: elementsArray.length,
    userCount: room.users.size,
    elements: elementsArray,
    code: room.code,
    notes: room.notes,
    files: room.files,
    messages: room.messages,
    users: activeUsers,
    rooms: getRoomSummaries(),
    limits: {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      maxRoomsPerUser: MAX_ROOMS_PER_USER,
      currentRoomsCount: rooms.size,
    },
  });
});

app.post('/api/rooms/:roomId/sync', (req, res) => {
  const roomId = (req.params.roomId || 'ana-oda').trim().toLowerCase();
  const { roomName, elements, code, notes, chatMessage } = req.body as {
    roomName?: string;
    elements?: CanvasElement[];
    code?: { content: string; language: string; lastUpdatedBy: string };
    notes?: { content: string; lastUpdatedBy: string };
    chatMessage?: { text: string; userName: string; userColor: string; userId?: string };
  };

  const { room, error } = getOrCreateRoom(roomId, roomName, undefined, undefined, undefined, false);
  if (!room || error) {
    res.status(404).json({ error: error || 'Room not found' });
    return;
  }

  if (Array.isArray(elements)) {
    for (const el of elements) {
      if (el && el.id) {
        if (!room.elements.has(el.id)) {
          room.elementOrder.push(el.id);
        }
        room.elements.set(el.id, el);
      }
    }
    const ordered = room.elementOrder
      .map((id) => room.elements.get(id))
      .filter((el): el is CanvasElement => el !== undefined);
    broadcastToRoom(roomId, {
      type: 'elements-replaced',
      elements: ordered,
    });
  }

  if (code && typeof code.content === 'string') {
    room.code = {
      content: code.content,
      language: code.language || room.code.language,
      lastUpdatedBy: code.lastUpdatedBy || 'Kullanıcı',
    };
    broadcastToRoom(roomId, {
      type: 'code-updated',
      code: room.code,
    });
  }

  if (notes && typeof notes.content === 'string') {
    room.notes = {
      content: notes.content,
      lastUpdatedBy: notes.lastUpdatedBy || 'Kullanıcı',
    };
    broadcastToRoom(roomId, {
      type: 'notes-updated',
      notes: room.notes,
    });
  }

  if (chatMessage && chatMessage.text) {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: chatMessage.userId || 'http-user',
      userName: chatMessage.userName || 'Kullanıcı',
      userColor: chatMessage.userColor || '#2563eb',
      text: chatMessage.text,
      timestamp: Date.now(),
    };
    room.messages.push(newMsg);
    broadcastToRoom(roomId, {
      type: 'chat-received',
      message: newMsg,
    });
  }

  const elementsArray = room.elementOrder
    .map((id) => room.elements.get(id))
    .filter((el): el is CanvasElement => el !== undefined);

  res.json({
    ok: true,
    id: room.id,
    name: room.name,
    settings: room.settings,
    elements: elementsArray,
    code: room.code,
    notes: room.notes,
    messages: room.messages.filter((m) => !m.isPrivate),
  });
});

// Google OAuth 2.0 Popup Callback Handler for Firebase signInWithCredential across all environments
app.get('/__/auth/handler', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Google Hesabı Doğrulanıyor...</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .card {
      text-align: center;
      padding: 28px 32px;
      border-radius: 16px;
      background: #1e293b;
      border: 1px solid #334155;
      box-shadow: 0 20px 45px rgba(0,0,0,0.4);
      max-width: 340px;
    }
    .spinner {
      width: 34px;
      height: 34px;
      margin: 0 auto 14px;
      border: 3px solid rgba(59, 130, 246, 0.25);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 6px; font-size: 15px; font-weight: 700; }
    p { margin: 0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2 id="title">Google Hesabı Bağlanıyor...</h2>
    <p id="desc">Lütfen bekleyin, pencere otomatik kapanacak.</p>
  </div>
  <script>
    (function () {
      try {
        var hashParams = new URLSearchParams(window.location.hash ? window.location.hash.substring(1) : '');
        var queryParams = new URLSearchParams(window.location.search || '');
        var idToken = hashParams.get('id_token') || queryParams.get('id_token') || '';
        var accessToken = hashParams.get('access_token') || queryParams.get('access_token') || '';
        var error = hashParams.get('error') || queryParams.get('error') || '';
        var errorDescription = hashParams.get('error_description') || queryParams.get('error_description') || '';
        var rawState = hashParams.get('state') || queryParams.get('state') || '';
        var parsedState = null;
        if (rawState) {
          try {
            parsedState = JSON.parse(rawState);
          } catch (e) {}
        }

        var payload = {
          type: 'COLLAB_GOOGLE_OAUTH_RESULT',
          idToken: idToken,
          accessToken: accessToken,
          error: error,
          errorDescription: errorDescription,
          state: parsedState,
          timestamp: Date.now()
        };

        // 1. Send directly to window.opener (works across any origin including localhost)
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, '*');
          } catch (e) {}
        }

        // 2. BroadcastChannel & localStorage for same-origin tabs
        try {
          var bc = new BroadcastChannel('collab_google_oauth_channel');
          bc.postMessage(payload);
          bc.close();
        } catch (e) {}

        try {
          localStorage.setItem('collab_google_oauth_result', JSON.stringify(payload));
        } catch (e) {}

        // 3. If initiated from a different origin (e.g. localhost) and not yet relayed,
        // also relay to the initiator origin's /__/auth/handler so localStorage/BroadcastChannel fire there too
        var targetOrigin = parsedState && parsedState.origin ? String(parsedState.origin) : '';
        var alreadyRelayed = queryParams.get('relayed') === '1';
        if (targetOrigin && targetOrigin !== window.location.origin && !alreadyRelayed) {
          setTimeout(function () {
            try {
              window.location.replace(
                targetOrigin.replace(/\\/$/, '') +
                  '/__/auth/handler?relayed=1' +
                  (window.location.hash || '')
              );
            } catch (e) {
              window.close();
            }
          }, 120);
          return;
        }

        setTimeout(function () {
          try {
            window.close();
          } catch (e) {}
        }, 150);
      } catch (err) {
        var titleEl = document.getElementById('title');
        var descEl = document.getElementById('desc');
        if (titleEl) titleEl.textContent = 'Giriş Tamamlandı';
        if (descEl) descEl.textContent = 'Bu pencereyi kapatabilirsiniz.';
      }
    })();
  </script>
</body>
</html>`);
});

// Vite dev server middleware or production static files
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Match Cloud Run reverse proxy keep-alive expectations (>60s) to prevent ERR_CONNECTION_CLOSED
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.on('error', (err) => {
    console.error('[HTTP Server] Error:', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CollabBoard Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

