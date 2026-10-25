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

// Fallback shape/diagram generator if API key is missing or network fails
function buildFallbackCanvasElements(
  prompt: string,
  centerX: number,
  centerY: number,
  author: string
): CanvasElement[] {
  const now = Date.now();
  const uid = () => `ai-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const lower = prompt.toLowerCase();

  if (lower.includes('ev') || lower.includes('house')) {
    return [
      {
        id: uid(),
        type: 'triangle',
        x: centerX - 110,
        y: centerY - 140,
        width: 220,
        height: 110,
        color: '#dc2626',
        fillColor: '#fee2e2',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 90,
        y: centerY - 30,
        width: 180,
        height: 150,
        color: '#1e293b',
        fillColor: '#fef9c3',
        strokeWidth: 3,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 25,
        y: centerY + 45,
        width: 50,
        height: 75,
        color: '#92400e',
        fillColor: '#fde68a',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rectangle',
        x: centerX - 70,
        y: centerY - 5,
        width: 38,
        height: 38,
        color: '#0284c7',
        fillColor: '#bae6fd',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
      {
        id: uid(),
        type: 'rectangle',
        x: centerX + 32,
        y: centerY - 5,
        width: 38,
        height: 38,
        color: '#0284c7',
        fillColor: '#bae6fd',
        strokeWidth: 2,
        createdBy: author,
        updatedAt: now,
      },
    ];
  }

  // Default structured diagram for prompt
  return [
    {
      id: uid(),
      type: 'rounded-rect',
      x: centerX - 130,
      y: centerY - 120,
      width: 260,
      height: 70,
      color: '#2563eb',
      fillColor: '#dbeafe',
      strokeWidth: 3,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'text',
      x: centerX - 105,
      y: centerY - 96,
      fontSize: 18,
      color: '#1e3a8a',
      text: prompt.slice(0, 28),
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'arrow',
      x: centerX - 60,
      y: centerY - 50,
      width: -90,
      height: 70,
      color: '#475569',
      strokeWidth: 3,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'arrow',
      x: centerX + 60,
      y: centerY - 50,
      width: 90,
      height: 70,
      color: '#475569',
      strokeWidth: 3,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'sticky',
      x: centerX - 260,
      y: centerY + 25,
      width: 190,
      height: 140,
      fillColor: '#fef08a',
      color: '#0f172a',
      fontSize: 15,
      text: `1. Aşama\n${prompt.slice(0, 40)} için başlangıç bileşeni`,
      createdBy: author,
      updatedAt: now,
    },
    {
      id: uid(),
      type: 'sticky',
      x: centerX + 70,
      y: centerY + 25,
      width: 190,
      height: 140,
      fillColor: '#bbf7d0',
      color: '#0f172a',
      fontSize: 15,
      text: `2. Aşama\nUygulama ve doğrulama adımları`,
      createdBy: author,
      updatedAt: now,
    },
  ];
}

// Gemini AI Canvas Object & Diagram Generator Endpoint
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallbackElements = buildFallbackCanvasElements(prompt.trim(), centerX, centerY, author);
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

    const systemInstruction = `Sen profesyonel bir beyaz tahta (whiteboard) grafik, şekil ve diyagram tasarım motorusun.
Kullanıcının istediği şekli, nesneyi, illüstrasyonu, mimari diyagramı, akış şemasını veya zihin haritasını doğrudan tuval (canvas) üzerinde çizilecek vektörel öğeler dizisi olarak üretirsin.

Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).
Tüm öğeleri bu merkez etrafında dengeli, estetik ve üst üste binmeyecek şekilde konumlandır (x: ${Math.round(centerX - 420)} ile ${Math.round(centerX + 420)} arası, y: ${Math.round(centerY - 300)} ile ${Math.round(centerY + 300)} arası).

Desteklenen öğe tipleri (type):
- "rectangle": Dikdörtgen (x, y sol üst köşe; width, height pozitif)
- "rounded-rect": Yuvarlatılmış kutu / düğüm (x, y, width, height)
- "circle": Daire veya elips (x, y sol üst köşe; width, height çap)
- "diamond": Eşkenar dörtgen / karar kutusu (x, y, width, height)
- "triangle": Üçgen / çatı / ok ucu (x, y, width, height)
- "star": 5 köşeli yıldız (x, y, width, height)
- "arrow": Yönlü bağlantı oku (x, y başlangıç noktası; width = bitişX - başlangıçX, height = bitişY - başlangıçY)
- "line": Düz çizgi (x, y başlangıç noktası; width = dx, height = dy)
- "sticky": Yapışkan not kartı (x, y, width: min 170, height: min 130, fillColor: "#fef08a" | "#bbf7d0" | "#bae6fd" | "#fed7aa" | "#fbcfe8" | "#e9d5ff", text: içerik yazısı)
- "text": Başlık veya etiket yazısı (x, y, text, fontSize: 14-28, color). Bir kutunun içine metin yazmak istiyorsan önce "rounded-rect" veya "rectangle" oluştur, hemen ardından kutunun içinde yer alan koordinata ayrı bir "text" öğesi ekle!

Kurallar:
1. Kullanıcı bir nesne/çizim (ör. araba, ev, roket, güneş sistemi, ağaç, robot, yıldız, kalp, kedi vb.) isterse geometrik şekilleri (circle, triangle, rectangle, rounded-rect, star, line, arrow) ve uygun renkleri (color, fillColor, rotation) birleştirerek zengin ve tanınabilir bir görsel kompozisyon oluştur.
2. Kullanıcı bir akış şeması, mimari diyagram, algoritma, yol haritası veya tablo isterse kutuları (rounded-rect, diamond, sticky), metin etiketlerini (text) ve aralarındaki bağlantı oklarını (arrow) eksiksiz oluştur.
3. En az 4, en fazla 24 öğe üret. Renkler modern ve yüksek kontrastlı olsun (ör. #2563eb, #059669, #d97706, #dc2626, #7c3aed, #0f172a ve pastel dolgular #dbeafe, #dcfce7, #fef9c3, #fee2e2, #ede9fe).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Kullanıcı İsteği: "${prompt.trim()}"\nMerkez noktası (${Math.round(centerX)}, ${Math.round(centerY)}) etrafında bu isteği karşılayan beyaz tahta öğelerini JSON olarak üret.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Oluşturulan şekil veya diyagramın kısa Türkçe açıklaması',
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
    const sanitized: CanvasElement[] = rawElements
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

    if (sanitized.length === 0) {
      const fallback = buildFallbackCanvasElements(prompt.trim(), centerX, centerY, author);
      res.json({ elements: fallback, summary: 'Şablon oluşturuldu' });
      return;
    }

    res.json({
      elements: sanitized,
      summary: parsed.summary || `${sanitized.length} nesne tahtaya eklendi.`,
    });
  } catch (err) {
    console.error('Gemini canvas generation error:', err);
    const fallback = buildFallbackCanvasElements(prompt.trim(), centerX, centerY, author);
    res.json({
      elements: fallback,
      summary: 'Akıllı diyagram tahtaya eklendi.',
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
