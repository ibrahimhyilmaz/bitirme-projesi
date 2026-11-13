import { Router } from 'express';
import { roomManager, MAX_ROOMS, MAX_USERS_PER_ROOM } from './roomManager';
import { CanvasElement, ChatMessage } from './types';

export const roomRouter = Router();

roomRouter.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    roomsCount: roomManager.rooms.size,
    maxRooms: MAX_ROOMS,
    maxUsersPerRoom: MAX_USERS_PER_ROOM,
    timestamp: Date.now(),
  });
});

roomRouter.get('/api/rtc-config', (_req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  });
});

roomRouter.get('/api/rooms', (_req, res) => {
  res.json({
    rooms: roomManager.getRoomSummaries(),
    limits: roomManager.getServerLimits(),
  });
});

roomRouter.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId || '';
  const roomName = typeof req.query.roomName === 'string' ? req.query.roomName : undefined;
  const { room, error } = roomManager.getOrCreateRoom(roomId, roomName);
  if (!room || error) {
    res.status(404).json({ error: error || 'Room not found' });
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
    rooms: roomManager.getRoomSummaries(),
    limits: roomManager.getServerLimits(),
  });
});

roomRouter.post('/api/rooms/:roomId/sync', (req, res) => {
  const roomId = req.params.roomId || '';
  const { roomName, elements, code, notes, chatMessage } = req.body as {
    roomName?: string;
    elements?: CanvasElement[];
    code?: { content: string; language: string; lastUpdatedBy: string };
    notes?: { content: string; lastUpdatedBy: string };
    chatMessage?: { text: string; userName: string; userColor: string; userId?: string };
  };

  const { room, error } = roomManager.getOrCreateRoom(roomId, roomName);
  if (!room || error) {
    res.status(400).json({ error: error || 'Room could not be synced' });
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
    roomManager.broadcastToRoom(roomId, {
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
    roomManager.broadcastToRoom(roomId, {
      type: 'code-updated',
      code: room.code,
    });
  }

  if (notes && typeof notes.content === 'string') {
    room.notes = {
      content: notes.content,
      lastUpdatedBy: notes.lastUpdatedBy || 'Kullanıcı',
    };
    roomManager.broadcastToRoom(roomId, {
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
    roomManager.broadcastToRoom(roomId, {
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
    messages: room.messages,
  });
});
