import { WebSocket, WebSocketServer } from 'ws';
import { RoomState, UserRole } from './types';

export const MAX_ROOMS = 20;
export const MAX_USERS_PER_ROOM = 30;
export const DEFAULT_ROOM_MAX_USERS = 12;

export class RoomManager {
  public readonly rooms = new Map<string, RoomState>();
  private wss: WebSocketServer | null = null;

  constructor() {}

  public attachWebSocketServer(wss: WebSocketServer): void {
    this.wss = wss;
  }

  public canEditWorkspace(role: UserRole): boolean {
    return role === 'owner' || role === 'admin' || role === 'editor';
  }

  public canManageRoom(role: UserRole): boolean {
    return role === 'owner' || role === 'admin';
  }

  public getRoomSummaries() {
    return Array.from(this.rooms.values()).map((r) => ({
      id: r.id,
      name: r.name,
      userCount: r.users.size,
      maxUsers: r.settings.maxUsers,
      isLocked: r.settings.isLocked,
      elementCount: r.elements.size,
      createdAt: r.createdAt,
      ownerName: r.ownerName,
      activeUsers: Array.from(r.users.values()).map((u) => ({
        id: u.presence.id,
        name: u.presence.name,
        avatar: u.presence.avatar,
        color: u.presence.color,
        role: u.presence.role,
      })),
    }));
  }

  public getServerLimits() {
    return {
      maxRooms: MAX_ROOMS,
      maxUsersPerRoom: MAX_USERS_PER_ROOM,
      currentRoomsCount: this.rooms.size,
    };
  }

  public broadcastGlobalRoomsList(): void {
    if (!this.wss) return;
    const payload = JSON.stringify({
      type: 'rooms-list-updated',
      rooms: this.getRoomSummaries(),
      limits: this.getServerLimits(),
    });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  public broadcastToRoom(roomId: string, message: object, excludeUserId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const payload = JSON.stringify(message);

    for (const [userId, userObj] of room.users.entries()) {
      if (excludeUserId && userId === excludeUserId) continue;
      if (userObj.ws.readyState === WebSocket.OPEN) {
        userObj.ws.send(payload);
      }
    }
  }

  public getOrCreateRoom(
    roomId: string,
    roomName?: string,
    creatorId?: string,
    creatorName?: string,
    customMaxUsers?: number
  ): { room: RoomState | null; error?: string } {
    if (!this.rooms.has(roomId)) {
      if (this.rooms.size >= MAX_ROOMS) {
        return {
          room: null,
          error: `Maksimum oda sınırına (${MAX_ROOMS} oda) ulaşıldı. Lütfen mevcut bir odaya katılın.`,
        };
      }

      const displayRoomName = roomName || `Oda #${roomId}`;

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

      this.rooms.set(roomId, {
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
    return { room: this.rooms.get(roomId)! };
  }
}

export const roomManager = new RoomManager();
