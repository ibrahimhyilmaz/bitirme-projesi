import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

// Types for in-memory room management
interface CanvasElement {
  id: string;
  type: 'pencil' | 'highlighter' | 'rectangle' | 'rounded-rect' | 'circle' | 'diamond' | 'triangle' | 'star' | 'arrow' | 'line' | 'text' | 'sticky' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  imageUrl?: string;
  rotation?: number;
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

// Helper to get or create room
function getOrCreateRoom(roomId: string, roomName?: string): RoomState {
  if (!rooms.has(roomId)) {
    const defaultCode = `// 🚀 CollabBoard Gerçek Zamanlı Kod Alanı
// Buraya yazdığınız kod odadaki tüm kullanıcılarla anlık senkronize olur.

function calculateTeamVelocity(storyPoints, completedWeeks) {
  const average = storyPoints.reduce((a, b) => a + b, 0) / completedWeeks;
  console.log("⚡ Ortalama Takım Hızı:", average.toFixed(2), "puan/hafta");
  return average;
}

// Örnek Çalıştırma
const sprintPoints = [34, 42, 38, 45, 50];
const velocity = calculateTeamVelocity(sprintPoints, sprintPoints.length);

console.log("✅ Beyaz tahta ve kod senkronizasyonu aktif!");
`;

    const defaultNotes = `# 📝 Ortak Çalışma Alanı & Toplantı Notları

### 🎯 Gündem Maddeleri
- [x] Sistem mimarisinin beyaz tahta üzerinde görselleştirilmesi
- [x] Gerçek zamanlı WebSocket protokolünün doğrulanması
- [ ] Sesli iletişim ve WebRTC peer bağlantı testi
- [ ] Sprint hedeflerinin belirlenmesi

---
*Not: Bu alana yazılan metinler odadaki herkesle eşzamanlı olarak paylaşılır.*
`;

    rooms.set(roomId, {
      id: roomId,
      name: roomName || `Oda #${roomId}`,
      createdAt: Date.now(),
      elements: new Map(),
      elementOrder: [],
      code: {
        content: defaultCode,
        language: 'javascript',
        lastUpdatedBy: 'Sistem',
      },
      notes: {
        content: defaultNotes,
        lastUpdatedBy: 'Sistem',
      },
      files: [],
      messages: [
        {
          id: 'welcome-msg',
          userId: 'system',
          userName: 'CollabBoard Asistanı',
          userColor: '#3b82f6',
          text: '🎉 Odaya hoş geldiniz! Beyaz tahtada çizim yapabilir, ortak kod yazabilir, dosya yükleyebilir ve sesli sohbete katılabilirsiniz.',
          timestamp: Date.now(),
        },
      ],
      users: new Map(),
    });
  }
  return rooms.get(roomId)!;
}

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

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join-room': {
          const { roomId, roomName, user } = msg;
          currentRoomId = roomId;
          currentUserId = user.id;

          const room = getOrCreateRoom(roomId, roomName);

          // Register user presence
          const presence: UserPresence = {
            id: user.id,
            name: user.name || 'Misafir Kullanıcı',
            avatar: user.avatar || '',
            color: user.color || '#3b82f6',
            cursor: { x: 0, y: 0 },
            isDrawing: false,
            activeTool: 'select',
            isMuted: true,
            isDeafened: false,
            isSpeaking: false,
            joinedAt: Date.now(),
          };

          room.users.set(user.id, { ws, presence });

          // Prepare full state snapshot for the new user
          const elementsArray = room.elementOrder
            .map((id) => room.elements.get(id))
            .filter((el): el is CanvasElement => el !== undefined);

          const activeUsers = Array.from(room.users.values()).map((u) => u.presence);

          // Send init payload to joined user
          ws.send(
            JSON.stringify({
              type: 'init-room',
              roomId: room.id,
              roomName: room.name,
              elements: elementsArray,
              code: room.code,
              notes: room.notes,
              files: room.files,
              messages: room.messages,
              users: activeUsers,
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

        case 'element-create': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const element: CanvasElement = msg.element;
          if (!element || !element.id) return;

          // Idempotent check
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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const { updates } = msg; // array of { id, changes }
          if (Array.isArray(updates)) {
            for (const item of updates) {
              const existing = room.elements.get(item.id);
              if (existing) {
                room.elements.set(item.id, { ...existing, ...item.changes, updatedAt: Date.now() });
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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const { ids } = msg; // array of IDs
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

        case 'elements-order-change': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          if (Array.isArray(msg.elementOrder)) {
            room.elementOrder = msg.elementOrder;
            broadcastToRoom(
              currentRoomId,
              {
                type: 'elements-order-changed',
                elementOrder: room.elementOrder,
              },
              currentUserId || undefined
            );
          }
          break;
        }

        case 'elements-clear': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          room.elements.clear();
          room.elementOrder = [];

          broadcastToRoom(currentRoomId, {
            type: 'elements-cleared',
            clearedBy: currentUserId,
          });
          break;
        }

        case 'elements-load-template': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

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
            userColor: msg.userColor || '#3b82f6',
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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

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
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

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
        room.users.delete(currentUserId);
        broadcastToRoom(currentRoomId, {
          type: 'user-left',
          userId: currentUserId,
        });

        if (room.users.size === 0) {
          // Keep room for 30 minutes in memory
          setTimeout(() => {
            const r = rooms.get(currentRoomId!);
            if (r && r.users.size === 0) {
              rooms.delete(currentRoomId!);
            }
          }, 30 * 60 * 1000);
        }
      }
    }
  });
});

// REST Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    roomsCount: rooms.size,
    timestamp: Date.now(),
  });
});

app.get('/api/rooms', (_req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    userCount: r.users.size,
    elementCount: r.elements.size,
    createdAt: r.createdAt,
  }));
  res.json(roomList);
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

  server.listen(PORT, () => {
    console.log(`🚀 CollabBoard Server running on port ${PORT}`);
  });
}

startServer();
