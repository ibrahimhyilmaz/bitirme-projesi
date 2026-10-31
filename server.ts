import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { spawn } from 'child_process';
import esbuild from 'esbuild';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// Server-wide capacity limits
const MAX_ROOMS = 20;
const MAX_USERS_PER_ROOM = 30;
const DEFAULT_ROOM_MAX_USERS = 12;

// Permissive CORS middleware so shared/invited clients never get blocked by application CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
  ownerId: string;
}

interface CanvasElement {
  id: string;
  type:
    | 'pencil'
    | 'highlighter'
    | 'rectangle'
    | 'rounded-rect'
    | 'circle'
    | 'diamond'
    | 'triangle'
    | 'star'
    | 'arrow'
    | 'line'
    | 'text'
    | 'sticky'
    | 'image';
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

interface RoomState {
  id: string;
  name: string;
  createdAt: number;
  ownerName: string;
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

function canEditWorkspace(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

function canManageRoom(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
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
  }));
}

function broadcastGlobalRoomsList() {
  const payload = JSON.stringify({
    type: 'rooms-list-updated',
    rooms: getRoomSummaries(),
    limits: {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      currentRoomsCount: rooms.size,
    },
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Helper to create or retrieve a room
function getOrCreateRoom(
  roomId: string,
  roomName?: string,
  creatorId?: string,
  creatorName?: string,
  customMaxUsers?: number
): { room: RoomState | null; error?: string } {
  if (!rooms.has(roomId)) {
    if (rooms.size >= MAX_ROOMS) {
      return {
        room: null,
        error: `Maksimum oda sınırına (${MAX_ROOMS} oda) ulaşıldı. Lütfen mevcut bir odaya katılın.`,
      };
    }

    const displayRoomName =
      roomName || (roomId === 'ana-oda' ? 'Genel Çalışma Alanı' : `Oda #${roomId}`);

    const defaultCode = `// CollabBoard Ortak Kod Editörü — ${displayRoomName} (#${roomId})
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
*Not: Bu alana yazılan metinler #${roomId} odasındaki herkesle eşzamanlı paylaşılır.*
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
      settings: {
        isLocked: false,
        maxUsers: clampedMax,
        defaultRole: 'editor',
        allowGuestDraw: true,
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
getOrCreateRoom('ana-oda', 'Genel Çalışma Alanı', 'system', 'Sistem', 15);

// Broadcast helper for a room
function broadcastToRoom(roomId: string, message: object, excludeUserId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(message);

  for (const [userId, userObj] of room.users.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    if (userObj.ws.readyState === WebSocket.OPEN) {
      userObj.ws.send(payload);
    }
  }
}

// WebSocket Server initialization
const wss = new WebSocketServer({ server });

// Heartbeat interval to keep connections alive across proxies
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as WebSocket & { isAlive?: boolean };
    if (extWs.isAlive === false) {
      return extWs.terminate();
    }
    extWs.isAlive = false;
    extWs.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws: WebSocket) => {
  const extWs = ws as WebSocket & { isAlive?: boolean };
  extWs.isAlive = true;
  ws.on('pong', () => {
    extWs.isAlive = true;
  });

  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

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
                currentRoomsCount: rooms.size,
              },
            })
          );
          break;
        }

        case 'join-room': {
          const { roomId, roomName, user, maxUsers } = msg;
          if (!roomId || !user || !user.id) return;

          const { room, error } = getOrCreateRoom(
            roomId,
            roomName,
            user.id,
            user.name,
            maxUsers
          );

          if (!room || error) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'MAX_ROOMS_REACHED',
                message: error || 'Oda oluşturulamadı.',
              })
            );
            return;
          }

          const isAlreadyInRoom = room.users.has(user.id);
          const savedRole = room.roleAssignments.get(user.id);
          const isOwnerOrAdmin =
            room.settings.ownerId === user.id ||
            savedRole === 'owner' ||
            savedRole === 'admin';

          // Check if room is locked
          if (room.settings.isLocked && !isAlreadyInRoom && !isOwnerOrAdmin) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'ROOM_LOCKED',
                roomId: room.id,
                message: `"${room.name}" odası şu anda kilitli. Oda yöneticisi yeni katılımları kapattı.`,
              })
            );
            return;
          }

          // Check room user capacity limit
          if (!isAlreadyInRoom && room.users.size >= room.settings.maxUsers && !isOwnerOrAdmin) {
            ws.send(
              JSON.stringify({
                type: 'room-error',
                code: 'ROOM_FULL',
                roomId: room.id,
                message: `"${room.name}" odası dolu (${room.users.size}/${room.settings.maxUsers} kullanıcı sınırına ulaşıldı).`,
              })
            );
            return;
          }

          // If user was in another room, remove them cleanly from the previous room
          if (currentRoomId && currentRoomId !== roomId && currentUserId) {
            const prevRoom = rooms.get(currentRoomId);
            if (prevRoom) {
              prevRoom.users.delete(currentUserId);
              broadcastToRoom(currentRoomId, {
                type: 'user-left',
                userId: currentUserId,
              });
            }
          }

          currentRoomId = roomId;
          currentUserId = user.id;

          // Determine user's role in the room
          let assignedRole: UserRole = savedRole || room.settings.defaultRole;
          if (room.settings.ownerId === 'system' || room.settings.ownerId === user.id || room.users.size === 0) {
            if (room.settings.ownerId === 'system' || room.users.size === 0) {
              room.settings.ownerId = user.id;
              room.ownerName = user.name || 'Kurucu';
            }
            if (room.settings.ownerId === user.id) {
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
              messages: room.messages,
              users: activeUsers,
              rooms: getRoomSummaries(),
              limits: {
                maxRooms: MAX_ROOMS,
                maxUsersPerRoom: MAX_USERS_PER_ROOM,
                currentRoomsCount: rooms.size,
              },
            })
          );

          // Broadcast user joined to other room members
          broadcastToRoom(
            roomId,
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
              room.name = changes.roomName.trim();
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

          const chatMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            userId: currentUserId || 'unknown',
            userName: msg.userName || 'Kullanıcı',
            userColor: msg.userColor || '#2563eb',
            text: msg.text,
            timestamp: Date.now(),
            fileAttachment: msg.fileAttachment,
          };

          room.messages.push(chatMessage);
          if (room.messages.length > 200) {
            room.messages.shift();
          }

          broadcastToRoom(currentRoomId, {
            type: 'chat-received',
            message: chatMessage,
          });
          break;
        }

        case 'file-upload': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.users.get(currentUserId);
          if (sender && !canEditWorkspace(sender.presence.role)) return;

          const file: SharedFile = {
            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: msg.name,
            size: msg.size,
            type: msg.fileType || 'application/octet-stream',
            dataUrl: msg.dataUrl,
            uploadedBy: msg.uploadedBy || 'Kullanıcı',
            uploadedAt: Date.now(),
          };

          room.files.push(file);

          broadcastToRoom(currentRoomId, {
            type: 'file-added',
            file,
          });
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
              broadcastGlobalRoomsList();
            }
          }, 30 * 60 * 1000);
        }
      }
    }
  });
});

// Smart vector SVG illustration builder for visual objects & stickers
function buildFallbackSvg(prompt: string): string {
  const lower = prompt.toLowerCase().trim();

  // 1. Apple (Elma)
  if (lower.includes('elma') || lower.includes('apple')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="appleGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="60%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </radialGradient>
    <radialGradient id="leafGrad" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="100%" stop-color="#15803d"/>
    </radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <ellipse cx="200" cy="350" rx="100" ry="20" fill="#cbd5e1" opacity="0.6"/>
  <!-- Leaf -->
  <path d="M 200 110 C 230 60, 290 70, 280 115 C 250 140, 210 120, 200 110 Z" fill="url(#leafGrad)" stroke="#166534" stroke-width="3"/>
  <path d="M 202 110 Q 240 95 278 115" stroke="#14532d" stroke-width="2" fill="none"/>
  <!-- Stem -->
  <path d="M 200 135 C 196 90, 220 60, 230 50" stroke="#78350f" stroke-width="12" stroke-linecap="round" fill="none"/>
  <!-- Apple Body (Twin heart lobes) -->
  <path d="M 200 145 C 160 110, 80 125, 80 215 C 80 295, 150 340, 200 340 C 250 340, 320 295, 320 215 C 320 125, 240 110, 200 145 Z" fill="url(#appleGrad)" stroke="#7f1d1d" stroke-width="4" filter="url(#shadow)"/>
  <!-- Apple Top Indent -->
  <ellipse cx="200" cy="148" rx="22" ry="8" fill="#7f1d1d" opacity="0.45"/>
  <!-- Gloss highlight -->
  <ellipse cx="140" cy="190" rx="25" ry="50" transform="rotate(-25 140 190)" fill="#ffffff" opacity="0.45"/>
  <ellipse cx="132" cy="170" rx="10" ry="20" transform="rotate(-25 132 170)" fill="#ffffff" opacity="0.75"/>
</svg>`;
  }

  // 2. Car (Araba / Otomobil)
  if (lower.includes('araba') || lower.includes('otomobil') || lower.includes('araç') || lower.includes('car')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="carBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="60%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="carGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#7dd3fc"/>
    </linearGradient>
    <radialGradient id="wheelRim" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#334155"/>
    </radialGradient>
  </defs>
  <!-- Road shadow -->
  <ellipse cx="200" cy="305" rx="170" ry="16" fill="#64748b" opacity="0.35"/>
  <!-- Car Roof & Cabin -->
  <path d="M 100 200 L 145 135 C 155 125, 170 120, 185 120 L 255 120 C 270 120, 285 125, 295 138 L 335 200 Z" fill="url(#carBody)" stroke="#1e3a8a" stroke-width="4"/>
  <!-- Windows -->
  <path d="M 148 190 L 160 140 L 210 140 L 210 190 Z" fill="url(#carGlass)" stroke="#0284c7" stroke-width="3"/>
  <path d="M 220 190 L 220 140 L 260 140 L 290 190 Z" fill="url(#carGlass)" stroke="#0284c7" stroke-width="3"/>
  <!-- Main Chassis -->
  <rect x="40" y="190" width="320" height="70" rx="24" fill="url(#carBody)" stroke="#1e3a8a" stroke-width="4"/>
  <!-- Headlight (Yellow front) -->
  <path d="M 345 205 C 360 210, 360 225, 345 230 Z" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
  <!-- Tail light (Red rear) -->
  <path d="M 55 205 C 40 210, 40 225, 55 230 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/>
  <!-- Side accent line -->
  <line x1="60" y1="218" x2="330" y2="218" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
  <!-- Left Wheel (Back) -->
  <circle cx="115" cy="265" r="38" fill="#0f172a" stroke="#334155" stroke-width="4"/>
  <circle cx="115" cy="265" r="22" fill="url(#wheelRim)" stroke="#cbd5e1" stroke-width="3"/>
  <circle cx="115" cy="265" r="8" fill="#0f172a"/>
  <!-- Right Wheel (Front) -->
  <circle cx="280" cy="265" r="38" fill="#0f172a" stroke="#334155" stroke-width="4"/>
  <circle cx="280" cy="265" r="22" fill="url(#wheelRim)" stroke="#cbd5e1" stroke-width="3"/>
  <circle cx="280" cy="265" r="8" fill="#0f172a"/>
</svg>`;
  }

  // 3. Cat (Kedi)
  if (lower.includes('kedi') || lower.includes('cat')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="catGrad" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="80%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </radialGradient>
  </defs>
  <!-- Ears -->
  <polygon points="100,180 80,70 180,130" fill="url(#catGrad)" stroke="#9a3412" stroke-width="5"/>
  <polygon points="105,160 95,95 165,135" fill="#fbcfe8"/>
  <polygon points="300,180 320,70 220,130" fill="url(#catGrad)" stroke="#9a3412" stroke-width="5"/>
  <polygon points="295,160 305,95 235,135" fill="#fbcfe8"/>
  <!-- Head -->
  <ellipse cx="200" cy="210" rx="125" ry="105" fill="url(#catGrad)" stroke="#9a3412" stroke-width="5"/>
  <!-- Eyes -->
  <ellipse cx="150" cy="190" rx="18" ry="24" fill="#10b981" stroke="#047857" stroke-width="3"/>
  <ellipse cx="150" cy="190" rx="7" ry="18" fill="#064e3b"/>
  <circle cx="145" cy="182" r="5" fill="#ffffff"/>
  <ellipse cx="250" cy="190" rx="18" ry="24" fill="#10b981" stroke="#047857" stroke-width="3"/>
  <ellipse cx="250" cy="190" rx="7" ry="18" fill="#064e3b"/>
  <circle cx="245" cy="182" r="5" fill="#ffffff"/>
  <!-- Nose & Mouth -->
  <polygon points="200,225 188,212 212,212" fill="#f43f5e"/>
  <path d="M 200 225 Q 185 245 170 238" stroke="#7c2d12" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M 200 225 Q 215 245 230 238" stroke="#7c2d12" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Whiskers -->
  <line x1="160" y1="225" x2="80" y2="215" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="160" y1="235" x2="75" y2="245" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="240" y1="225" x2="320" y2="215" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="240" y1="235" x2="325" y2="245" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;
  }

  // 4. Tree (Ağaç)
  if (lower.includes('ağaç') || lower.includes('agac') || lower.includes('tree') || lower.includes('orman')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="canopy1" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="60%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </radialGradient>
    <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#78350f"/>
      <stop offset="50%" stop-color="#92400e"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>
  </defs>
  <!-- Ground -->
  <ellipse cx="200" cy="355" rx="140" ry="20" fill="#bbf7d0"/>
  <!-- Trunk -->
  <path d="M 175 190 L 170 345 C 160 350, 150 355, 140 355 L 260 355 C 250 355, 240 350, 230 345 L 225 190 Z" fill="url(#trunkGrad)"/>
  <!-- Canopy Clusters -->
  <circle cx="140" cy="180" r="65" fill="url(#canopy1)"/>
  <circle cx="260" cy="180" r="65" fill="url(#canopy1)"/>
  <circle cx="160" cy="120" r="65" fill="url(#canopy1)"/>
  <circle cx="240" cy="120" r="65" fill="url(#canopy1)"/>
  <circle cx="200" cy="150" r="80" fill="url(#canopy1)"/>
  <!-- Apples on tree -->
  <circle cx="160" cy="140" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
  <circle cx="230" cy="150" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
  <circle cx="195" cy="100" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
  <circle cx="210" cy="190" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
</svg>`;
  }

  // 5. Rocket (Roket)
  if (lower.includes('roket') || lower.includes('rocket') || lower.includes('uzay aracı')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="fire" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <!-- Stars in background -->
  <circle cx="80" cy="80" r="3" fill="#fde047"/>
  <circle cx="330" cy="95" r="4" fill="#fde047"/>
  <circle cx="70" cy="220" r="2.5" fill="#fde047"/>
  <circle cx="340" cy="250" r="3" fill="#fde047"/>
  <!-- Exhaust Flame -->
  <polygon points="175,270 200,370 225,270" fill="url(#fire)"/>
  <polygon points="185,270 200,330 215,270" fill="#fef08a"/>
  <!-- Fins -->
  <polygon points="150,230 110,270 160,270" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
  <polygon points="250,230 290,270 240,270" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
  <!-- Fuselage -->
  <path d="M 200 45 C 160 90, 150 200, 155 270 L 245 270 C 250 200, 240 90, 200 45 Z" fill="url(#rocketBody)" stroke="#475569" stroke-width="4"/>
  <!-- Red Nose Cone -->
  <path d="M 200 45 C 180 70, 170 100, 168 115 L 232 115 C 230 100, 220 70, 200 45 Z" fill="#ef4444"/>
  <!-- Porthole Window -->
  <circle cx="200" cy="165" r="26" fill="#38bdf8" stroke="#0284c7" stroke-width="5"/>
  <circle cx="200" cy="165" r="20" fill="#bae6fd"/>
  <circle cx="194" cy="158" r="6" fill="#ffffff"/>
</svg>`;
  }

  // 6. Dog (Köpek)
  if (lower.includes('köpek') || lower.includes('kopek') || lower.includes('dog') || lower.includes('puppy')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="dogFur" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="80%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </radialGradient>
  </defs>
  <!-- Floppy Ears -->
  <ellipse cx="110" cy="180" rx="40" ry="80" transform="rotate(-15 110 180)" fill="#c2410c" stroke="#9a3412" stroke-width="4"/>
  <ellipse cx="290" cy="180" rx="40" ry="80" transform="rotate(15 290 180)" fill="#c2410c" stroke="#9a3412" stroke-width="4"/>
  <!-- Head -->
  <ellipse cx="200" cy="205" rx="115" ry="105" fill="url(#dogFur)" stroke="#9a3412" stroke-width="4"/>
  <!-- Eyes -->
  <ellipse cx="160" cy="185" rx="14" ry="20" fill="#0f172a"/>
  <circle cx="156" cy="178" r="4.5" fill="#ffffff"/>
  <ellipse cx="240" cy="185" rx="14" ry="20" fill="#0f172a"/>
  <circle cx="236" cy="178" r="4.5" fill="#ffffff"/>
  <!-- Snout Muzzle -->
  <ellipse cx="200" cy="235" rx="48" ry="36" fill="#ffedd5" stroke="#ea580c" stroke-width="2"/>
  <!-- Nose -->
  <ellipse cx="200" cy="222" rx="18" ry="13" fill="#0f172a"/>
  <circle cx="196" cy="218" r="3.5" fill="#ffffff" opacity="0.8"/>
  <!-- Mouth & Tongue -->
  <path d="M 200 234 L 200 250" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
  <path d="M 200 250 Q 185 260 175 252" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 200 250 Q 215 260 225 252" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="200" cy="264" rx="14" ry="18" fill="#fb7185" stroke="#e11d48" stroke-width="2"/>
</svg>`;
  }

  // 7. Bird (Kuş)
  if (lower.includes('kuş') || lower.includes('kus') || lower.includes('bird')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="birdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <!-- Tail -->
  <polygon points="90,260 50,300 120,270" fill="#0369a1"/>
  <!-- Body -->
  <ellipse cx="190" cy="220" rx="95" ry="75" fill="url(#birdGrad)" stroke="#075985" stroke-width="4"/>
  <!-- Belly -->
  <path d="M 170 240 Q 220 280 260 240 Q 210 230 170 240 Z" fill="#bae6fd"/>
  <!-- Wing -->
  <path d="M 140 210 C 120 230, 150 270, 210 240 C 220 210, 180 190, 140 210 Z" fill="#0284c7" stroke="#075985" stroke-width="3"/>
  <!-- Head -->
  <circle cx="270" cy="165" r="48" fill="url(#birdGrad)" stroke="#075985" stroke-width="4"/>
  <!-- Beak -->
  <polygon points="310,165 375,178 308,188" fill="#f59e0b" stroke="#d97706" stroke-width="2.5"/>
  <!-- Eye -->
  <circle cx="282" cy="155" r="9" fill="#0f172a"/>
  <circle cx="280" cy="152" r="3" fill="#ffffff"/>
  <!-- Little Feet -->
  <line x1="170" y1="290" x2="160" y2="330" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
  <line x1="210" y1="290" x2="205" y2="330" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
</svg>`;
  }

  // 8. Fish (Balık)
  if (lower.includes('balık') || lower.includes('balik') || lower.includes('fish')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fishGrad" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="50%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <!-- Bubbles -->
  <circle cx="340" cy="120" r="10" fill="#38bdf8" opacity="0.6"/>
  <circle cx="365" cy="85" r="6" fill="#38bdf8" opacity="0.6"/>
  <!-- Tail Fin -->
  <polygon points="120,200 40,120 70,200 40,280" fill="#f97316" stroke="#c2410c" stroke-width="3"/>
  <!-- Dorsal & Ventral Fins -->
  <polygon points="190,130 230,80 270,130" fill="#fb923c" stroke="#c2410c" stroke-width="2.5"/>
  <polygon points="190,270 230,310 260,270" fill="#fb923c" stroke="#c2410c" stroke-width="2.5"/>
  <!-- Fish Body -->
  <ellipse cx="220" cy="200" rx="110" ry="72" fill="url(#fishGrad)" stroke="#c2410c" stroke-width="4"/>
  <!-- White Accent Stripe -->
  <path d="M 215 132 Q 235 200 215 268" stroke="#ffffff" stroke-width="12" fill="none" opacity="0.9"/>
  <!-- Eye -->
  <circle cx="285" cy="185" r="12" fill="#ffffff" stroke="#c2410c" stroke-width="2"/>
  <circle cx="288" cy="185" r="6" fill="#0f172a"/>
  <!-- Smile -->
  <path d="M 315 210 Q 300 220 290 215" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;
  }

  // 9. Coffee / Tea (Kahve / Çay / Fincan)
  if (lower.includes('kahve') || lower.includes('çay') || lower.includes('cay') || lower.includes('fincan') || lower.includes('coffee') || lower.includes('tea')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <!-- Steam curls -->
  <path d="M 160 140 Q 150 100 170 70" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <path d="M 200 130 Q 215 90 195 60" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <path d="M 240 140 Q 230 100 250 70" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <!-- Saucer Plate -->
  <ellipse cx="200" cy="315" rx="135" ry="22" fill="#cbd5e1" stroke="#94a3b8" stroke-width="3.5"/>
  <ellipse cx="200" cy="310" rx="110" ry="16" fill="#f8fafc"/>
  <!-- Cup Handle -->
  <path d="M 260 190 C 340 190, 340 260, 255 260" stroke="#e2e8f0" stroke-width="18" fill="none" stroke-linecap="round"/>
  <path d="M 260 190 C 340 190, 340 260, 255 260" stroke="#94a3b8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Cup Body -->
  <path d="M 120 170 L 135 285 C 138 300, 262 300, 265 285 L 280 170 Z" fill="url(#cupGrad)" stroke="#94a3b8" stroke-width="4"/>
  <!-- Coffee liquid surface -->
  <ellipse cx="200" cy="170" rx="80" ry="18" fill="#78350f" stroke="#451a03" stroke-width="2"/>
  <ellipse cx="200" cy="170" rx="60" ry="12" fill="#92400e"/>
</svg>`;
  }

  // 10. Pizza (Pizza)
  if (lower.includes('pizza')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <!-- Crust -->
  <path d="M 80 90 Q 200 50 320 90 L 200 350 Z" fill="#d97706" stroke="#b45309" stroke-width="4"/>
  <!-- Cheese -->
  <path d="M 95 105 Q 200 70 305 105 L 200 330 Z" fill="#fde047"/>
  <!-- Pepperoni Slices -->
  <circle cx="160" cy="140" r="22" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <circle cx="240" cy="150" r="22" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <circle cx="190" cy="210" r="20" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <circle cx="210" cy="275" r="16" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <!-- Basil Leaves -->
  <ellipse cx="140" cy="190" rx="10" ry="6" transform="rotate(-30 140 190)" fill="#15803d"/>
  <ellipse cx="250" cy="220" rx="10" ry="6" transform="rotate(40 250 220)" fill="#15803d"/>
</svg>`;
  }

  // 11. Generic Aesthetic Vector Sticker for any other prompt (NO Card Background, NO Outer Frame, NO Text Banner!)
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="stickerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <radialGradient id="starShine" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#eab308"/>
    </radialGradient>
  </defs>
  <!-- Background Aura (soft, non-rectangular, seamless) -->
  <circle cx="200" cy="200" r="140" fill="url(#stickerGlow)" opacity="0.18"/>
  <circle cx="200" cy="200" r="105" fill="url(#stickerGlow)" opacity="0.3"/>
  <!-- Central Crystal / Multi-Point Geometry -->
  <polygon points="200,60 235,145 325,150 255,210 280,295 200,245 120,295 145,210 75,150 165,145" fill="url(#starShine)" stroke="#ca8a04" stroke-width="4"/>
  <!-- Inner Core Diamond -->
  <polygon points="200,130 240,200 200,270 160,200" fill="#ffffff" opacity="0.9"/>
  <circle cx="200" cy="200" r="22" fill="url(#stickerGlow)"/>
  <!-- Little Sparkles -->
  <polygon points="100,100 105,115 120,120 105,125 100,140 95,125 80,120 95,115" fill="#fde047"/>
  <polygon points="300,90 304,102 316,106 304,110 300,122 296,110 284,106 296,102" fill="#38bdf8"/>
</svg>`;
}

// Smart procedural canvas vector generator covering physical objects, diagrams & flowcharts
function buildFallbackCanvasElements(
  prompt: string,
  centerX: number,
  centerY: number,
  author: string
): CanvasElement[] {
  const now = Date.now();
  let counter = 0;
  const uid = () => `ai-${now}-${++counter}-${Math.random().toString(36).substring(2, 6)}`;
  const lower = prompt.toLowerCase().trim();

  // 1. Apple (Elma) - Real physical vector drawing of an apple with stem, leaf, highlight and label
  if (lower.includes('elma') || lower.includes('apple')) {
    return [
      // Brown Stem
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 6,
        y: centerY - 95,
        width: 12,
        height: 38,
        color: '#451a03',
        fillColor: '#78350f',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Green Leaf
      {
        id: uid(),
        type: 'triangle',
        x: centerX + 4,
        y: centerY - 95,
        width: 42,
        height: 28,
        color: '#15803d',
        fillColor: '#22c55e',
        strokeWidth: 2.5,
        rotation: 20,
        createdBy: author,
        updatedAt: now,
      },
      // Left Apple Lobe
      {
        id: uid(),
        type: 'circle',
        x: centerX - 80,
        y: centerY - 65,
        width: 105,
        height: 125,
        color: '#991b1b',
        fillColor: '#ef4444',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Right Apple Lobe
      {
        id: uid(),
        type: 'circle',
        x: centerX - 25,
        y: centerY - 65,
        width: 105,
        height: 125,
        color: '#991b1b',
        fillColor: '#ef4444',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // White glossy shine highlight
      {
        id: uid(),
        type: 'circle',
        x: centerX - 55,
        y: centerY - 45,
        width: 25,
        height: 45,
        color: '#fecaca',
        fillColor: '#ffffff',
        opacity: 0.8,
        strokeWidth: 1.5,
        rotation: -25,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 2. Car (Araba / Otomobil) - Real physical vector drawing of a car with chassis, cabin, wheels, headlights
  if (lower.includes('araba') || lower.includes('otomobil') || lower.includes('araç') || lower.includes('car')) {
    return [
      // Cabin / Roof
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 90,
        y: centerY - 70,
        width: 180,
        height: 65,
        color: '#1d4ed8',
        fillColor: '#3b82f6',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Rear Window
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 75,
        y: centerY - 60,
        width: 65,
        height: 45,
        color: '#0284c7',
        fillColor: '#bae6fd',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Front Windshield
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX + 5,
        y: centerY - 60,
        width: 70,
        height: 45,
        color: '#0284c7',
        fillColor: '#bae6fd',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Main Chassis Body
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 160,
        y: centerY - 15,
        width: 320,
        height: 70,
        color: '#1e40af',
        fillColor: '#2563eb',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Front Headlight (Yellow)
      {
        id: uid(),
        type: 'circle',
        x: centerX + 142,
        y: centerY + 8,
        width: 18,
        height: 18,
        color: '#ca8a04',
        fillColor: '#fde047',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Rear Tail Light (Red)
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 160,
        y: centerY + 8,
        width: 12,
        height: 22,
        color: '#991b1b',
        fillColor: '#ef4444',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Left Wheel Outer
      {
        id: uid(),
        type: 'circle',
        x: centerX - 110,
        y: centerY + 28,
        width: 58,
        height: 58,
        color: '#0f172a',
        fillColor: '#1e293b',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Left Wheel Inner Rim
      {
        id: uid(),
        type: 'circle',
        x: centerX - 96,
        y: centerY + 42,
        width: 30,
        height: 30,
        color: '#64748b',
        fillColor: '#cbd5e1',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Right Wheel Outer
      {
        id: uid(),
        type: 'circle',
        x: centerX + 55,
        y: centerY + 28,
        width: 58,
        height: 58,
        color: '#0f172a',
        fillColor: '#1e293b',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Right Wheel Inner Rim
      {
        id: uid(),
        type: 'circle',
        x: centerX + 69,
        y: centerY + 42,
        width: 30,
        height: 30,
        color: '#64748b',
        fillColor: '#cbd5e1',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Road ground line
      {
        id: uid(),
        type: 'line',
        x: centerX - 190,
        y: centerY + 88,
        width: 380,
        height: 0,
        color: '#64748b',
        strokeWidth: 3,
        strokeStyle: 'dashed',
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 3. Cat (Kedi)
  if (lower.includes('kedi') || lower.includes('cat')) {
    return [
      // Left Ear
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 75,
        y: centerY - 100,
        width: 50,
        height: 50,
        color: '#c2410c',
        fillColor: '#fdba74',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Right Ear
      {
        id: uid(),
        type: 'triangle',
        x: centerX + 25,
        y: centerY - 100,
        width: 50,
        height: 50,
        color: '#c2410c',
        fillColor: '#fdba74',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Cat Head
      {
        id: uid(),
        type: 'circle',
        x: centerX - 85,
        y: centerY - 65,
        width: 170,
        height: 140,
        color: '#9a3412',
        fillColor: '#fed7aa',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Left Eye
      {
        id: uid(),
        type: 'circle',
        x: centerX - 50,
        y: centerY - 28,
        width: 24,
        height: 30,
        color: '#065f46',
        fillColor: '#10b981',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Right Eye
      {
        id: uid(),
        type: 'circle',
        x: centerX + 26,
        y: centerY - 28,
        width: 24,
        height: 30,
        color: '#065f46',
        fillColor: '#10b981',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Pink Nose
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 12,
        y: centerY + 12,
        width: 24,
        height: 16,
        color: '#be185d',
        fillColor: '#f472b6',
        strokeWidth: 2,
        rotation: 180,
        createdBy: author,
        updatedAt: now,
      },
      // Whiskers Left
      {
        id: uid(),
        type: 'line',
        x: centerX - 25,
        y: centerY + 18,
        width: -70,
        height: -10,
        color: '#7c2d12',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX - 25,
        y: centerY + 26,
        width: -65,
        height: 12,
        color: '#7c2d12',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Whiskers Right
      {
        id: uid(),
        type: 'line',
        x: centerX + 25,
        y: centerY + 18,
        width: 70,
        height: -10,
        color: '#7c2d12',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX + 25,
        y: centerY + 26,
        width: 65,
        height: 12,
        color: '#7c2d12',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 4. Tree (Ağaç)
  if (lower.includes('ağaç') || lower.includes('agac') || lower.includes('tree') || lower.includes('orman')) {
    return [
      // Brown Trunk
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 24,
        y: centerY - 10,
        width: 48,
        height: 130,
        color: '#78350f',
        fillColor: '#92400e',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Canopy Main Center
      {
        id: uid(),
        type: 'circle',
        x: centerX - 85,
        y: centerY - 150,
        width: 170,
        height: 155,
        color: '#15803d',
        fillColor: '#22c55e',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Canopy Left
      {
        id: uid(),
        type: 'circle',
        x: centerX - 130,
        y: centerY - 105,
        width: 115,
        height: 110,
        color: '#166534',
        fillColor: '#4ade80',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Canopy Right
      {
        id: uid(),
        type: 'circle',
        x: centerX + 15,
        y: centerY - 105,
        width: 115,
        height: 110,
        color: '#166534',
        fillColor: '#4ade80',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Apples in tree
      {
        id: uid(),
        type: 'circle',
        x: centerX - 45,
        y: centerY - 100,
        width: 22,
        height: 22,
        color: '#991b1b',
        fillColor: '#ef4444',
        strokeWidth: 1.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 35,
        y: centerY - 75,
        width: 22,
        height: 22,
        color: '#991b1b',
        fillColor: '#ef4444',
        strokeWidth: 1.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 10,
        y: centerY - 55,
        width: 22,
        height: 22,
        color: '#991b1b',
        fillColor: '#ef4444',
        strokeWidth: 1.5,
        createdBy: author,
        updatedAt: now,
      },
      // Grass mound
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 120,
        y: centerY + 115,
        width: 240,
        height: 25,
        color: '#16a34a',
        fillColor: '#bbf7d0',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 5. Flower (Çiçek)
  if (lower.includes('çiçek') || lower.includes('cicek') || lower.includes('flower') || lower.includes('gül')) {
    return [
      // Green Stem
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY + 20,
        width: 0,
        height: 110,
        color: '#15803d',
        strokeWidth: 5,
        createdBy: author,
        updatedAt: now,
      },
      // Green Leaf Left
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 45,
        y: centerY + 65,
        width: 45,
        height: 25,
        color: '#15803d',
        fillColor: '#4ade80',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Green Leaf Right
      {
        id: uid(),
        type: 'triangle',
        x: centerX,
        y: centerY + 80,
        width: 45,
        height: 25,
        color: '#15803d',
        fillColor: '#4ade80',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Petals
      {
        id: uid(),
        type: 'circle',
        x: centerX - 25,
        y: centerY - 95,
        width: 50,
        height: 50,
        color: '#e11d48',
        fillColor: '#fb7185',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 25,
        y: centerY - 5,
        width: 50,
        height: 50,
        color: '#e11d48',
        fillColor: '#fb7185',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 70,
        y: centerY - 50,
        width: 50,
        height: 50,
        color: '#e11d48',
        fillColor: '#fb7185',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 20,
        y: centerY - 50,
        width: 50,
        height: 50,
        color: '#e11d48',
        fillColor: '#fb7185',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Center Yellow Circle
      {
        id: uid(),
        type: 'circle',
        x: centerX - 25,
        y: centerY - 50,
        width: 50,
        height: 50,
        color: '#d97706',
        fillColor: '#fde047',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 6. Rocket (Roket)
  if (lower.includes('roket') || lower.includes('rocket') || lower.includes('uzay aracı')) {
    return [
      // Nose Cone
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 45,
        y: centerY - 150,
        width: 90,
        height: 65,
        color: '#b91c1c',
        fillColor: '#ef4444',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Fuselage Body
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 45,
        y: centerY - 85,
        width: 90,
        height: 140,
        color: '#334155',
        fillColor: '#f8fafc',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Window Porthole
      {
        id: uid(),
        type: 'circle',
        x: centerX - 25,
        y: centerY - 50,
        width: 50,
        height: 50,
        color: '#0284c7',
        fillColor: '#38bdf8',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Left Fin
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 85,
        y: centerY + 15,
        width: 40,
        height: 55,
        color: '#b91c1c',
        fillColor: '#dc2626',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Right Fin
      {
        id: uid(),
        type: 'triangle',
        x: centerX + 45,
        y: centerY + 15,
        width: 40,
        height: 55,
        color: '#b91c1c',
        fillColor: '#dc2626',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Flame Exhaust
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 30,
        y: centerY + 55,
        width: 60,
        height: 75,
        color: '#ea580c',
        fillColor: '#f97316',
        strokeWidth: 2.5,
        rotation: 180,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 18,
        y: centerY + 55,
        width: 36,
        height: 50,
        color: '#ca8a04',
        fillColor: '#fde047',
        strokeWidth: 2,
        rotation: 180,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 7. House (Ev / Bahçe)
  if (lower.includes('ev') || lower.includes('house') || lower.includes('bahçe') || lower.includes('bina')) {
    return [
      // Chimney
      {
        id: uid(),
        type: 'rectangle',
        x: centerX + 50,
        y: centerY - 130,
        width: 30,
        height: 50,
        color: '#991b1b',
        fillColor: '#b91c1c',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Roof Triangle
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 120,
        y: centerY - 140,
        width: 240,
        height: 110,
        color: '#dc2626',
        fillColor: '#fee2e2',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // House Body
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 100,
        y: centerY - 30,
        width: 200,
        height: 160,
        color: '#1e293b',
        fillColor: '#fef9c3',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Door
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 25,
        y: centerY + 50,
        width: 50,
        height: 80,
        color: '#92400e',
        fillColor: '#fde68a',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      // Window Left
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 80,
        y: centerY - 5,
        width: 40,
        height: 40,
        color: '#0284c7',
        fillColor: '#bae6fd',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Window Right
      {
        id: uid(),
        type: 'rectangle',
        x: centerX + 40,
        y: centerY - 5,
        width: 40,
        height: 40,
        color: '#0284c7',
        fillColor: '#bae6fd',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Sun in sky
      {
        id: uid(),
        type: 'circle',
        x: centerX + 140,
        y: centerY - 150,
        width: 65,
        height: 65,
        color: '#f59e0b',
        fillColor: '#fef08a',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 8. Sun / Solar System (Güneş / Gezegen / Uzay)
  if (lower.includes('güneş') || lower.includes('gezegen') || lower.includes('uzay') || lower.includes('solar') || lower.includes('mars') || lower.includes('dünya')) {
    return [
      {
        id: uid(),
        type: 'circle',
        x: centerX - 240,
        y: centerY - 70,
        width: 140,
        height: 140,
        color: '#d97706',
        fillColor: '#fde047',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 60,
        y: centerY - 25,
        width: 50,
        height: 50,
        color: '#0284c7',
        fillColor: '#38bdf8',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 30,
        y: centerY - 18,
        width: 36,
        height: 36,
        color: '#dc2626',
        fillColor: '#f87171',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 110,
        y: centerY - 50,
        width: 100,
        height: 100,
        color: '#ea580c',
        fillColor: '#fed7aa',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 9. Laptop / Computer (Bilgisayar)
  if (lower.includes('bilgisayar') || lower.includes('laptop') || lower.includes('computer') || lower.includes('kod')) {
    return [
      // Monitor / Display Frame
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 120,
        y: centerY - 110,
        width: 240,
        height: 145,
        color: '#334155',
        fillColor: '#1e293b',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Screen Display Inner
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 105,
        y: centerY - 95,
        width: 210,
        height: 115,
        color: '#0f172a',
        fillColor: '#0f172a',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Code Text
      {
        id: uid(),
        type: 'text',
        x: centerX - 90,
        y: centerY - 78,
        color: '#38bdf8',
        text: 'const canvas = new Whiteboard();',
        fontSize: 13,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 90,
        y: centerY - 54,
        color: '#4ade80',
        text: 'await canvas.renderAI(prompt); 🚀',
        fontSize: 13,
        createdBy: author,
        updatedAt: now,
      },
      // Keyboard Base
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 150,
        y: centerY + 35,
        width: 300,
        height: 25,
        color: '#64748b',
        fillColor: '#cbd5e1',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Trackpad
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 30,
        y: centerY + 40,
        width: 60,
        height: 15,
        color: '#94a3b8',
        fillColor: '#e2e8f0',
        strokeWidth: 1.5,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 10. Airplane (Uçak)
  if (lower.includes('uçak') || lower.includes('ucak') || lower.includes('airplane') || lower.includes('plane')) {
    return [
      // Fuselage Body
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 160,
        y: centerY - 25,
        width: 320,
        height: 52,
        color: '#2563eb',
        fillColor: '#f8fafc',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Cockpit Window
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX + 110,
        y: centerY - 18,
        width: 42,
        height: 36,
        color: '#0284c7',
        fillColor: '#38bdf8',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      // Main Wings
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 40,
        y: centerY - 120,
        width: 80,
        height: 95,
        color: '#1d4ed8',
        fillColor: '#60a5fa',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      // Tail Fin
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 160,
        y: centerY - 80,
        width: 50,
        height: 55,
        color: '#b91c1c',
        fillColor: '#ef4444',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 11. Heart (Kalp)
  if (lower.includes('kalp') || lower.includes('heart') || lower.includes('sevgi')) {
    return [
      {
        id: uid(),
        type: 'circle',
        x: centerX - 75,
        y: centerY - 70,
        width: 85,
        height: 85,
        color: '#be123c',
        fillColor: '#e11d48',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 10,
        y: centerY - 70,
        width: 85,
        height: 85,
        color: '#be123c',
        fillColor: '#e11d48',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 72,
        y: centerY - 15,
        width: 144,
        height: 105,
        color: '#be123c',
        fillColor: '#e11d48',
        strokeWidth: 3,
        rotation: 180,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 12. Star (Yıldız)
  if (lower.includes('yıldız') || lower.includes('yildiz') || lower.includes('star')) {
    return [
      {
        id: uid(),
        type: 'star',
        x: centerX - 90,
        y: centerY - 90,
        width: 180,
        height: 180,
        color: '#d97706',
        fillColor: '#fde047',
        strokeWidth: 4,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'star',
        x: centerX + 95,
        y: centerY - 95,
        width: 50,
        height: 50,
        color: '#ea580c',
        fillColor: '#fef08a',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'star',
        x: centerX - 135,
        y: centerY + 40,
        width: 45,
        height: 45,
        color: '#ea580c',
        fillColor: '#fef08a',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 35,
        y: centerY + 115,
        color: '#b45309',
        text: 'Yıldız ⭐',
        fontSize: 20,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 13. Dog (Köpek) - Puppy face & floppy ears
  if (lower.includes('köpek') || lower.includes('kopek') || lower.includes('dog') || lower.includes('puppy')) {
    return [
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 95,
        y: centerY - 70,
        width: 45,
        height: 90,
        color: '#9a3412',
        fillColor: '#c2410c',
        strokeWidth: 3,
        rotation: -20,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX + 50,
        y: centerY - 70,
        width: 45,
        height: 90,
        color: '#9a3412',
        fillColor: '#c2410c',
        strokeWidth: 3,
        rotation: 20,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 80,
        y: centerY - 60,
        width: 160,
        height: 140,
        color: '#c2410c',
        fillColor: '#fed7aa',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 45,
        y: centerY - 25,
        width: 20,
        height: 24,
        color: '#0f172a',
        fillColor: '#0f172a',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 25,
        y: centerY - 25,
        width: 20,
        height: 24,
        color: '#0f172a',
        fillColor: '#0f172a',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 40,
        y: centerY + 5,
        width: 80,
        height: 60,
        color: '#fb923c',
        fillColor: '#ffedd5',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 16,
        y: centerY + 12,
        width: 32,
        height: 22,
        color: '#0f172a',
        fillColor: '#0f172a',
        strokeWidth: 2,
        rotation: 180,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 12,
        y: centerY + 42,
        width: 24,
        height: 30,
        color: '#e11d48',
        fillColor: '#fb7185',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 14. Bird (Kuş)
  if (lower.includes('kuş') || lower.includes('kus') || lower.includes('bird')) {
    return [
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 110,
        y: centerY + 10,
        width: 45,
        height: 35,
        color: '#0369a1',
        fillColor: '#0284c7',
        strokeWidth: 2.5,
        rotation: -45,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 70,
        y: centerY - 40,
        width: 140,
        height: 100,
        color: '#0369a1',
        fillColor: '#38bdf8',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 30,
        y: centerY - 65,
        width: 60,
        height: 60,
        color: '#0369a1',
        fillColor: '#38bdf8',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'triangle',
        x: centerX + 80,
        y: centerY - 45,
        width: 35,
        height: 22,
        color: '#d97706',
        fillColor: '#f59e0b',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 55,
        y: centerY - 50,
        width: 12,
        height: 12,
        color: '#0f172a',
        fillColor: '#0f172a',
        strokeWidth: 1.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 35,
        y: centerY - 15,
        width: 65,
        height: 45,
        color: '#0284c7',
        fillColor: '#0ea5e9',
        strokeWidth: 2.5,
        rotation: -15,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 15. Fish (Balık)
  if (lower.includes('balık') || lower.includes('balik') || lower.includes('fish')) {
    return [
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 120,
        y: centerY - 35,
        width: 50,
        height: 70,
        color: '#c2410c',
        fillColor: '#f97316',
        strokeWidth: 3,
        rotation: -90,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 80,
        y: centerY - 45,
        width: 160,
        height: 90,
        color: '#ea580c',
        fillColor: '#fb923c',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 15,
        y: centerY - 75,
        width: 40,
        height: 35,
        color: '#c2410c',
        fillColor: '#f97316',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 45,
        y: centerY - 20,
        width: 14,
        height: 14,
        color: '#0f172a',
        fillColor: '#ffffff',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 50,
        y: centerY - 17,
        width: 6,
        height: 6,
        color: '#0f172a',
        fillColor: '#0f172a',
        strokeWidth: 1,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 95,
        y: centerY - 35,
        width: 16,
        height: 16,
        color: '#0284c7',
        fillColor: '#e0f2fe',
        strokeWidth: 1.5,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 16. Bicycle (Bisiklet)
  if (lower.includes('bisiklet') || lower.includes('bicycle') || lower.includes('bike')) {
    return [
      {
        id: uid(),
        type: 'circle',
        x: centerX - 120,
        y: centerY + 10,
        width: 70,
        height: 70,
        color: '#0f172a',
        fillColor: '#f8fafc',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 50,
        y: centerY + 10,
        width: 70,
        height: 70,
        color: '#0f172a',
        fillColor: '#f8fafc',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX - 85,
        y: centerY + 45,
        width: 60,
        height: -55,
        color: '#dc2626',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX - 25,
        y: centerY - 10,
        width: 70,
        height: 0,
        color: '#dc2626',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX + 45,
        y: centerY - 10,
        width: 40,
        height: 55,
        color: '#dc2626',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX - 85,
        y: centerY + 45,
        width: 80,
        height: 0,
        color: '#dc2626',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 40,
        y: centerY - 25,
        width: 32,
        height: 10,
        color: '#0f172a',
        fillColor: '#1e293b',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 17. Coffee / Tea (Kahve / Çay / Fincan)
  if (lower.includes('kahve') || lower.includes('çay') || lower.includes('cay') || lower.includes('fincan') || lower.includes('coffee') || lower.includes('tea')) {
    return [
      {
        id: uid(),
        type: 'circle',
        x: centerX - 90,
        y: centerY + 40,
        width: 180,
        height: 30,
        color: '#94a3b8',
        fillColor: '#e2e8f0',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 40,
        y: centerY - 30,
        width: 50,
        height: 50,
        color: '#64748b',
        fillColor: 'transparent',
        strokeWidth: 5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 60,
        y: centerY - 50,
        width: 120,
        height: 90,
        color: '#64748b',
        fillColor: '#f8fafc',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 54,
        y: centerY - 56,
        width: 108,
        height: 22,
        color: '#451a03',
        fillColor: '#78350f',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX - 20,
        y: centerY - 65,
        width: 5,
        height: -30,
        color: '#94a3b8',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX + 10,
        y: centerY - 65,
        width: -5,
        height: -35,
        color: '#94a3b8',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 18. Pizza (Pizza)
  if (lower.includes('pizza')) {
    return [
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 85,
        y: centerY - 85,
        width: 170,
        height: 170,
        color: '#b45309',
        fillColor: '#fde047',
        strokeWidth: 4,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 30,
        y: centerY - 35,
        width: 26,
        height: 26,
        color: '#991b1b',
        fillColor: '#dc2626',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX + 10,
        y: centerY - 30,
        width: 26,
        height: 26,
        color: '#991b1b',
        fillColor: '#dc2626',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'circle',
        x: centerX - 10,
        y: centerY + 15,
        width: 22,
        height: 22,
        color: '#991b1b',
        fillColor: '#dc2626',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 90,
        y: centerY - 90,
        width: 180,
        height: 18,
        color: '#b45309',
        fillColor: '#d97706',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 19. Person / Stick Figure (İnsan / Çöp adam)
  if (lower.includes('çöp adam') || lower.includes('adam') || lower.includes('insan') || lower.includes('person')) {
    return [
      {
        id: uid(),
        type: 'circle',
        x: centerX - 25,
        y: centerY - 90,
        width: 50,
        height: 50,
        color: '#1e293b',
        fillColor: '#fed7aa',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY - 40,
        width: 0,
        height: 75,
        color: '#1e293b',
        strokeWidth: 4,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY - 20,
        width: -45,
        height: 30,
        color: '#1e293b',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY - 20,
        width: 45,
        height: -30,
        color: '#1e293b',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY + 35,
        width: -35,
        height: 60,
        color: '#1e293b',
        strokeWidth: 4,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY + 35,
        width: 35,
        height: 60,
        color: '#1e293b',
        strokeWidth: 4,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }


  // 13. Person / Stick figure (Çöp Adam / İnsan)
  if (lower.includes('çöp adam') || lower.includes('insan') || lower.includes('adam') || lower.includes('kişi')) {
    return [
      // Head
      {
        id: uid(),
        type: 'circle',
        x: centerX - 35,
        y: centerY - 130,
        width: 70,
        height: 70,
        color: '#1e293b',
        fillColor: '#fed7aa',
        strokeWidth: 3.5,
        createdBy: author,
        updatedAt: now,
      },
      // Body
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY - 60,
        width: 0,
        height: 110,
        color: '#1e293b',
        strokeWidth: 4.5,
        createdBy: author,
        updatedAt: now,
      },
      // Arms
      {
        id: uid(),
        type: 'line',
        x: centerX - 70,
        y: centerY - 20,
        width: 140,
        height: 0,
        color: '#1e293b',
        strokeWidth: 4.5,
        createdBy: author,
        updatedAt: now,
      },
      // Left Leg
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY + 50,
        width: -45,
        height: 90,
        color: '#1e293b',
        strokeWidth: 4.5,
        createdBy: author,
        updatedAt: now,
      },
      // Right Leg
      {
        id: uid(),
        type: 'line',
        x: centerX,
        y: centerY + 50,
        width: 45,
        height: 90,
        color: '#1e293b',
        strokeWidth: 4.5,
        createdBy: author,
        updatedAt: now,
      },
      // Text
      {
        id: uid(),
        type: 'text',
        x: centerX - 45,
        y: centerY + 160,
        color: '#1e293b',
        text: 'İnsan / Figür 🧍',
        fontSize: 20,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 14. User Login & Flowchart
  if (lower.includes('giriş') || lower.includes('login') || lower.includes('akış') || lower.includes('flowchart') || lower.includes('auth')) {
    return [
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 90,
        y: centerY - 160,
        width: 180,
        height: 55,
        color: '#2563eb',
        fillColor: '#dbeafe',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 65,
        y: centerY - 142,
        color: '#1e3a8a',
        text: 'Giriş Ekranı',
        fontSize: 16,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX,
        y: centerY - 105,
        width: 0,
        height: 45,
        color: '#475569',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'diamond',
        x: centerX - 80,
        y: centerY - 60,
        width: 160,
        height: 85,
        color: '#d97706',
        fillColor: '#fef3c7',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 60,
        y: centerY - 25,
        color: '#92400e',
        text: 'Bilgiler Doğru mu?',
        fontSize: 14,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX + 80,
        y: centerY - 18,
        width: 70,
        height: 0,
        color: '#059669',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX + 95,
        y: centerY - 38,
        color: '#059669',
        text: 'Evet',
        fontSize: 13,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX + 155,
        y: centerY - 45,
        width: 160,
        height: 55,
        color: '#059669',
        fillColor: '#d1fae5',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX + 185,
        y: centerY - 28,
        color: '#065f46',
        text: 'Ana Panel (Home)',
        fontSize: 15,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX,
        y: centerY + 25,
        width: 0,
        height: 50,
        color: '#dc2626',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX + 8,
        y: centerY + 45,
        color: '#dc2626',
        text: 'Hayır',
        fontSize: 13,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 90,
        y: centerY + 80,
        width: 180,
        height: 55,
        color: '#dc2626',
        fillColor: '#fee2e2',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 65,
        y: centerY + 98,
        color: '#991b1b',
        text: 'Hata & Şifre Sıfırla',
        fontSize: 15,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 15. Microservices / Cloud Architecture
  if (lower.includes('mikroservis') || lower.includes('mimari') || lower.includes('architecture') || lower.includes('api') || lower.includes('cloud') || lower.includes('servis')) {
    return [
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 240,
        y: centerY - 40,
        width: 130,
        height: 80,
        color: '#2563eb',
        fillColor: '#dbeafe',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 225,
        y: centerY - 5,
        color: '#1e40af',
        text: 'API Gateway',
        fontSize: 15,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX - 110,
        y: centerY - 20,
        width: 80,
        height: -60,
        color: '#475569',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX - 110,
        y: centerY,
        width: 80,
        height: 0,
        color: '#475569',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX - 110,
        y: centerY + 20,
        width: 80,
        height: 60,
        color: '#475569',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 25,
        y: centerY - 110,
        width: 140,
        height: 60,
        color: '#7c3aed',
        fillColor: '#ede9fe',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 10,
        y: centerY - 85,
        color: '#5b21b6',
        text: 'Auth Servisi',
        fontSize: 14,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 25,
        y: centerY - 30,
        width: 140,
        height: 60,
        color: '#059669',
        fillColor: '#d1fae5',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 15,
        y: centerY - 5,
        color: '#065f46',
        text: 'Sipariş Servisi',
        fontSize: 14,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rounded-rect',
        x: centerX - 25,
        y: centerY + 50,
        width: 140,
        height: 60,
        color: '#ea580c',
        fillColor: '#ffedd5',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX - 15,
        y: centerY + 75,
        color: '#9a3412',
        text: 'Ödeme Servisi',
        fontSize: 14,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX + 115,
        y: centerY,
        width: 60,
        height: 0,
        color: '#475569',
        strokeWidth: 2.5,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rectangle',
        x: centerX + 180,
        y: centerY - 50,
        width: 130,
        height: 100,
        color: '#0891b2',
        fillColor: '#cffafe',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'text',
        x: centerX + 200,
        y: centerY - 5,
        color: '#155e75',
        text: 'Veritabanı',
        fontSize: 15,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // 16. Roadmap / Timeline
  if (lower.includes('roadmap') || lower.includes('yol haritası') || lower.includes('sprint') || lower.includes('plan') || lower.includes('aşama')) {
    return [
      {
        id: uid(),
        type: 'sticky',
        x: centerX - 270,
        y: centerY - 80,
        width: 160,
        height: 140,
        fillColor: '#fef08a',
        color: '#0f172a',
        fontSize: 14,
        text: 'Q1: Keşif & Tasarım\n• Pazar araştırması\n• Wireframe & Prototip\n• Mimari tasarım',
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX - 105,
        y: centerY - 10,
        width: 35,
        height: 0,
        color: '#475569',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'sticky',
        x: centerX - 65,
        y: centerY - 80,
        width: 160,
        height: 140,
        fillColor: '#bae6fd',
        color: '#0f172a',
        fontSize: 14,
        text: 'Q2: Geliştirme\n• Backend & API\n• Tuval & Senkronizasyon\n• Birim testleri',
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'arrow',
        x: centerX + 100,
        y: centerY - 10,
        width: 35,
        height: 0,
        color: '#475569',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'sticky',
        x: centerX + 140,
        y: centerY - 80,
        width: 160,
        height: 140,
        fillColor: '#bbf7d0',
        color: '#0f172a',
        fontSize: 14,
        text: 'Q3: Lansman\n• Beta testi\n• Güvenlik denetimi\n• Canlıya geçiş 🎉',
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // Generic Harmonious Geometric Artwork (NO card box, NO outer frame, NO text labels!)
  return [
    {
      id: uid(),
      type: 'diamond',
      x: centerX - 90,
      y: centerY - 90,
      width: 180,
      height: 180,
      color: '#6366f1',
      fillColor: '#e0e7ff',
      strokeWidth: 3,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'circle',
      x: centerX - 60,
      y: centerY - 60,
      width: 120,
      height: 120,
      color: '#0284c7',
      fillColor: '#bae6fd',
      strokeWidth: 2.5,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'star',
      x: centerX - 35,
      y: centerY - 35,
      width: 70,
      height: 70,
      color: '#f59e0b',
      fillColor: '#fef08a',
      strokeWidth: 3,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'star',
      x: centerX - 105,
      y: centerY - 80,
      width: 30,
      height: 30,
      color: '#8b5cf6',
      fillColor: '#ede9fe',
      strokeWidth: 2,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'star',
      x: centerX + 80,
      y: centerY + 55,
      width: 30,
      height: 30,
      color: '#8b5cf6',
      fillColor: '#ede9fe',
      strokeWidth: 2,
      createdBy: author,
      updatedAt: now,
    },
  ];
}

// Gemini AI Canvas Vector Object & Diagram Generator Endpoint
app.post('/api/ai/generate-canvas', async (req, res) => {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Asistanı',
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Lütfen oluşturulacak şekil veya diyagram için bir açıklama girin.' });
    return;
  }

  const trimmedPrompt = prompt.trim();
  const isDiagram =
    /şema|diyagram|akış|flowchart|mimari|architecture|erd|uml|süreç|process|roadmap|tablo|graph/i.test(
      trimmedPrompt
    );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallbackElements = buildFallbackCanvasElements(trimmedPrompt, centerX, centerY, author);
    res.json({ elements: fallbackElements, source: 'fallback' });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = isDiagram
      ? `Sen profesyonel bir beyaz tahta (whiteboard) diyagram ve şema mimarısın.
Kullanıcının isteğini doğrudan tuvalde düzenlenebilir akış şeması öğeleri (rounded-rect, diamond, sticky, arrow, text) olarak tasarla.
Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).`
      : `Sen profesyonel bir beyaz tahta (whiteboard) illüstratör ve vektör grafik motorusun.
Kullanıcının istediği "${trimmedPrompt}" nesnesini, doğrudan tuval (canvas) üzerinde çizilecek vektörel geometrik parçalar dizisi olarak üretirsin.

Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).
Tüm öğeleri bu merkezin etrafında dengeli, orantılı ve simetrik konumlandır (örneğin genişlik 160px ise x koordinatları centerX - 80 civarında başlamalı).

HAYATİ VE KESİN KURALLAR:
1. ETİKET / BAŞLIK / YAZI KESİNLİKLE YASAKTIR: Çizimin altına, üstüne, içine veya kenarına nesnenin adını veya ne olduğunu belirten hiçbir "text" (yazı) öğesi EKLEME! Kullanıcı ne istediğini biliyor (örneğin "Elma", "Araba", "Kedi" yazısı ASLA KOYMA). Yalnızca saf geometrik şekillerden oluşan çizim yap.
2. ÇERÇEVE / KART KUTUSU YASAKTIR: Çizimin etrafına sınır çizgisi, kart kutusu, arka plan kutusu (bounding box) veya çerçeve ÇİZME. Sadece nesnenin kendi parçalarını çiz.
3. GERÇEKÇİ GEOMETRİK PARÇA BİRLEŞİMİ:
   İstenilen nesneyi oluşturan gerçek parçaları hayal et ve orantılı koordinatlarla birleştir:
   - Örneğin Araba: tekerlekler için daireler (dış lastik ve iç jant), şasi için rounded-rect, kabin/tavan için rounded-rect, pencereler için açık mavi kutular, farlar için sarı daireler.
   - Örneğin Kedi/Köpek: kafa ve gövde için daireler, kulaklar için üçgenler/yuvarlatılmış kutular, gözler ve burun için küçük daire/üçgenler, bıyıklar için çizgiler.
   - Örneğin Elma/Meyve: gövde için daire/elips loblar, sap için kahverengi ince kutu, yaprak için yeşil üçgen, parlama için beyaz elips.
   - Örneğin Uçak/Gemi/Tren/Bisiklet/Kahve/Pizza: ana gövde, detaylar, pencereler, parçalar.
4. RENKLER: Her parça için gerçekçi, canlı ve doğal renkler (color: kenar çizgisi, fillColor: iç dolgu rengi) seç.
5. 6 ila 20 adet özenle konumlandırılmış parça üret.`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: isDiagram
        ? `Kullanıcı Şema İsteği: "${trimmedPrompt}"`
        : `Kullanıcı Çizim İsteği: "${trimmedPrompt}". Bu nesnenin kendisini şekillerle çiz. Kesinlikle şema kutusu veya yazı etiketi koyma!`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Oluşturulan çizim veya nesnenin kısa Türkçe açıklaması',
            },
            elements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description:
                      'rectangle, rounded-rect, circle, diamond, triangle, star, arrow, line, sticky, veya text',
                  },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  color: { type: Type.STRING },
                  fillColor: { type: Type.STRING },
                  strokeWidth: { type: Type.NUMBER },
                  strokeStyle: {
                    type: Type.STRING,
                    description: 'solid, dashed, veya dotted',
                  },
                  text: { type: Type.STRING },
                  fontSize: { type: Type.NUMBER },
                  rotation: { type: Type.NUMBER },
                },
                required: ['type', 'x', 'y'],
              },
            },
          },
          required: ['elements'],
        },
      },
    });

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('AI generation timeout'));
      }, 12000);
    });

    let response;
    try {
      response = await Promise.race([generatePromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    const rawElements = Array.isArray(parsed.elements) ? parsed.elements : [];

    const allowedTypes = new Set([
      'rectangle',
      'rounded-rect',
      'circle',
      'diamond',
      'triangle',
      'star',
      'arrow',
      'line',
      'sticky',
      'text',
    ]);

    const now = Date.now();
    let sanitized: CanvasElement[] = rawElements
      .filter((el: Record<string, unknown>) => el && typeof el.type === 'string' && allowedTypes.has(el.type))
      .map((el: Record<string, unknown>, idx: number) => ({
        id: `ai-${now}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        type: el.type as CanvasElement['type'],
        x: Number(el.x) || centerX,
        y: Number(el.y) || centerY,
        width: el.width !== undefined ? Number(el.width) : el.type === 'sticky' ? 180 : 120,
        height: el.height !== undefined ? Number(el.height) : el.type === 'sticky' ? 150 : 80,
        color: typeof el.color === 'string' && el.color ? el.color : '#0f172a',
        fillColor:
          typeof el.fillColor === 'string' && el.fillColor ? el.fillColor : 'transparent',
        strokeWidth: Number(el.strokeWidth) || 3,
        strokeStyle:
          el.strokeStyle === 'dashed' || el.strokeStyle === 'dotted' ? el.strokeStyle : 'solid',
        opacity: 1,
        text: typeof el.text === 'string' ? el.text : undefined,
        fontSize: Number(el.fontSize) || (el.type === 'sticky' ? 15 : 18),
        rotation: Number(el.rotation) || 0,
        flipX: false,
        flipY: false,
        createdBy: author,
        updatedAt: now,
      }));

    // Post-processing: If it's a physical drawing, strip any unwanted text labels or framing cards
    if (!isDiagram) {
      sanitized = sanitized.filter((el) => {
        if (el.type === 'text') {
          const t = (el.text || '').toLowerCase().trim();
          const p = trimmedPrompt.toLowerCase();
          if (
            t.length < 30 ||
            t.includes(p) ||
            p.includes(t) ||
            t.includes('çizim') ||
            t.includes('öğe') ||
            /^[a-zA-ZçğıöşüÇĞİÖŞÜ\s\d🍎🚗🐱🐶🌳🚀🏠⭐❤️✨]+$/.test(t)
          ) {
            return false;
          }
        }
        // Remove large outer card box
        if (
          (el.type === 'rectangle' || el.type === 'rounded-rect') &&
          (el.width || 0) >= 220 &&
          (el.height || 0) >= 180 &&
          (el.fillColor === '#ffffff' ||
            el.fillColor === '#eff6ff' ||
            el.fillColor === '#f8fafc' ||
            el.fillColor === '#f1f5f9')
        ) {
          return false;
        }
        return true;
      });
    }

    if (sanitized.length === 0) {
      const fallback = buildFallbackCanvasElements(trimmedPrompt, centerX, centerY, author);
      res.json({ elements: fallback, summary: `${trimmedPrompt} tuvale çizildi.` });
      return;
    }

    res.json({
      elements: sanitized,
      summary: parsed.summary || `${sanitized.length} parça tahtaya çizildi.`,
    });
  } catch (err: unknown) {
    if (res.headersSent) return;
    console.warn('Gemini canvas generation fallback triggered:', (err as Error)?.message || err);
    const fallback = buildFallbackCanvasElements(trimmedPrompt, centerX, centerY, author);
    res.json({
      elements: fallback,
      summary: `${trimmedPrompt} tuvale çizildi.`,
    });
  }
});

// Gemini AI Visual Illustration & Image Sticker Generator Endpoint
app.post('/api/ai/generate-image', async (req, res) => {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Görsel',
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Lütfen oluşturulacak görsel için bir açıklama girin.' });
    return;
  }

  const trimmedPrompt = prompt.trim();
  const width = 300;
  const height = 300;
  const now = Date.now();
  const elementId = `ai-img-${now}-${Math.random().toString(36).substring(2, 6)}`;

  const createResult = (svgCode: string, summary: string) => ({
    element: {
      id: elementId,
      type: 'image' as const,
      x: Math.round(centerX - width / 2),
      y: Math.round(centerY - height / 2),
      width,
      height,
      strokeWidth: 0,
      color: 'transparent',
      fillColor: 'transparent',
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svgCode)}`,
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: author,
      updatedAt: now,
    },
    summary,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallbackSvg = buildFallbackSvg(trimmedPrompt);
    res.json(createResult(fallbackSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Sen yetenekli bir SVG illüstratörüsün. Kullanıcının istediği "${trimmedPrompt}" nesnesi için modern, temiz, zengin renkli ve gölgeli bir vektörel SVG çizimi oluştur.
HAYATİ VE ZORUNLU KURALLAR:
1. ARKA PLAN TAMAMEN ŞEFFAF OLMALIDIR: Kesinlikle arka planı kaplayan <rect> (dikdörtgen), kart arka planı, kutu veya çerçeve ÇİZMEYİN.
2. DIŞ ÇERÇEVE YASAKTIR: Görselin veya nesnenin etrafında KESİNLİKLE hiçbir dış çerçeve (border/frame/outline kutusu) olmamalıdır.
3. YAZI/METİN YASAKTIR: Görselin içine, altına veya üstüne KESİNLİKLE metin, yazı, etiket veya isim YAZMAYIN.
4. SADECE DOĞRUDAN NESNENİN KENDİSİNİ ÇİZİN: Çizim tamamen nesnenin kendi formundan ve detaylarından oluşmalıdır.
5. SADECE geçerli bir <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">...</svg> XML kodu döndür. Markdown codeblock (\`\`\`xml) veya hiçbir açıklama ekleme.`,
    });

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('AI image generation timeout'));
      }, 12000);
    });

    let response;
    try {
      response = await Promise.race([generatePromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    let rawSvg = (response.text || '').trim();
    // Strip markdown fences if present
    rawSvg = rawSvg.replace(/^```(xml|svg)?/i, '').replace(/```$/i, '').trim();

    if (rawSvg.includes('<svg') && rawSvg.includes('</svg>')) {
      const startIdx = rawSvg.indexOf('<svg');
      const endIdx = rawSvg.lastIndexOf('</svg>') + 6;
      let cleanSvg = rawSvg.slice(startIdx, endIdx);

      // Strip any text elements and any full-width background card rectangles
      cleanSvg = cleanSvg.replace(/<text[\s\S]*?<\/text>/gi, '');
      cleanSvg = cleanSvg.replace(/<rect[^>]*(?:width=["'](?:400|100%)["'][^>]*height=["'](?:400|100%)["']|height=["'](?:400|100%)["'][^>]*width=["'](?:400|100%)["'])[^>]*\/?>/gi, '');

      res.json(createResult(cleanSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
      return;
    }

    const fallbackSvg = buildFallbackSvg(trimmedPrompt);
    res.json(createResult(fallbackSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
  } catch (err: unknown) {
    if (res.headersSent) return;
    console.warn('Gemini image generation fallback triggered:', (err as Error)?.message || err);
    const fallbackSvg = buildFallbackSvg(trimmedPrompt);
    res.json(createResult(fallbackSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
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
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  });
});

app.get('/api/rooms', (_req, res) => {
  res.json({
    rooms: getRoomSummaries(),
    limits: {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      currentRoomsCount: rooms.size,
    },
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const elementsArray = room.elementOrder
    .map((id) => room.elements.get(id))
    .filter((el): el is CanvasElement => el !== undefined);

  res.json({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt,
    settings: room.settings,
    elementCount: elementsArray.length,
    userCount: room.users.size,
    elements: elementsArray,
  });
});

// Vite dev server middleware or production static files
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CollabBoard Server running on port ${PORT}`);
  });
}

startServer();
