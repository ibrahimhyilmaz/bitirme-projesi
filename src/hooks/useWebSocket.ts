import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import {
  CanvasElement,
  ChatMessage,
  CodeCursorPresence,
  LaserStrokePoint,
  Point,
  RoomSettings,
  RoomSummary,
  ServerLimits,
  SharedFile,
  UserPing,
  UserPresence,
  UserReaction,
  UserRole,
  CodeFile,
} from '../types';
import { soundEffects } from '../utils/audio';

interface UseWebSocketOptions {
  roomId: string;
  roomName: string;
  enabled?: boolean;
  customMaxUsers?: number;
  isCreatingRoom?: boolean;
  restoreRoom?: boolean;
  onJoined?: (roomId: string) => void;
  onSessionTimeout?: (roomId: string, roomName: string) => void;
  user: {
    id: string;
    name: string;
    avatar: string;
    color: string;
  };
  onWebRTCSignal?: (fromUserId: string, signal: unknown) => void;
  onKicked?: (roomId: string, roomName: string, by: string) => void;
  onRoomRejected?: (error: { code: string; message: string; roomId?: string }) => void;
}

const PUBLIC_WSS_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt.eclipseprojects.io:443/mqtt',
];

function getDefaultCodeForRoom(roomId: string, displayRoomName: string) {
  return `// CollabBoard Ortak Kod Editörü — ${displayRoomName} (#${roomId})
// Bu odadaki kod alanı odadaki tüm kullanıcılarla gerçek zamanlı senkronize olur.

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
  { name: "WebRTC & Gerçek Zamanlı Oda Sistemi", points: 13, done: true },
  { name: "AI Tahta Üretici", points: 8, done: true }
];

calculateSprintMetrics(sampleTasks);
`;
}

function getDefaultNotesForRoom(roomId: string, displayRoomName: string) {
  return `# ${displayRoomName} — Ortak Çalışma Notları

### Gündem Maddeleri
- [x] Sistem mimarisinin beyaz tahta üzerinde görselleştirilmesi
- [x] Oda yetkileri, rol sistemi ve kişi sınırlarının belirlenmesi
- [x] WebRTC sesli sohbet ve gerçek zamanlı çizim senkronizasyonu
- [ ] Sprint hedeflerinin gözden geçirilmesi

---
*Not: Bu alana yazılan metinler #${roomId} odasındaki herkesle eşzamanlı paylaşılır.*
`;
}

export function getOrCreateOwnerKey(): string {
  try {
    let key = localStorage.getItem('collab_owner_key');
    if (!key) {
      key = `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('collab_owner_key', key);
    }
    return key;
  } catch {
    return 'owner-fallback';
  }
}

export function useWebSocket({
  roomId,
  roomName,
  enabled = true,
  customMaxUsers,
  isCreatingRoom = false,
  restoreRoom = false,
  onJoined,
  onSessionTimeout,
  user,
  onWebRTCSignal,
  onKicked,
  onRoomRejected,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const mqttClientsRef = useRef<MqttClient[]>([]);
  const isMeshModeRef = useRef<boolean>(false);
  const isWsConnectedRef = useRef<boolean>(false);
  const joinedAtRef = useRef<number>(Date.now());
  const peerLastSeenRef = useRef<Map<string, number>>(new Map());
  const seenPacketsRef = useRef<Set<string>>(new Set());
  const packetSeqRef = useRef<number>(0);
  const rejectedRoomRef = useRef<boolean>(false);
  const roomNameRef = useRef<string>(roomName);
  roomNameRef.current = roomName;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(() => ({
    isLocked: false,
    maxUsers: customMaxUsers && customMaxUsers >= 2 ? customMaxUsers : 12,
    defaultRole: 'editor',
    allowGuestDraw: true,
    ownerId: '',
  }));
  const [syncedRoomName, setSyncedRoomName] = useState<string>(roomName);
  const [roomsList, setRoomsList] = useState<RoomSummary[]>([]);
  const [serverLimits, setServerLimits] = useState<ServerLimits>({
    maxRooms: 20,
    maxUsersPerRoom: 30,
    currentRoomsCount: 1,
  });
  const [roomError, setRoomError] = useState<{
    code: string;
    message: string;
    roomId?: string;
  } | null>(null);

  const [code, setCode] = useState<{ content: string; language: string; lastUpdatedBy: string }>(() => ({
    content: getDefaultCodeForRoom(roomId, roomName),
    language: 'javascript',
    lastUpdatedBy: 'Sistem',
  }));
  const [notes, setNotes] = useState<{ content: string; lastUpdatedBy: string }>(() => ({
    content: getDefaultNotesForRoom(roomId, roomName),
    lastUpdatedBy: 'Sistem',
  }));
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  const [liveStrokeMap, setLiveStrokeMap] = useState<Record<string, { el: CanvasElement; at: number }>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pings, setPings] = useState<UserPing[]>([]);
  const [reactions, setReactions] = useState<UserReaction[]>([]);
  const [remoteLaserPoints, setRemoteLaserPoints] = useState<LaserStrokePoint[]>([]);
  const [codeCursors, setCodeCursors] = useState<CodeCursorPresence[]>([]);

  // Refs to latest state so mesh welcome responder always sends fresh room state
  const elementsRef = useRef<CanvasElement[]>(elements);
  elementsRef.current = elements;
  const usersRef = useRef<UserPresence[]>(users);
  usersRef.current = users;
  const roomSettingsRef = useRef<RoomSettings>(roomSettings);
  roomSettingsRef.current = roomSettings;
  const syncedRoomNameRef = useRef<string>(syncedRoomName);
  syncedRoomNameRef.current = syncedRoomName;
  const codeRef = useRef(code);
  codeRef.current = code;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const filesRef = useRef(files);
  filesRef.current = files;
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const localVoiceRef = useRef<{ isMuted: boolean; isDeafened: boolean; isSpeaking: boolean }>({
    isMuted: true,
    isDeafened: false,
    isSpeaking: false,
  });
  const localCursorRef = useRef<{ cursor: Point; isDrawing: boolean; activeTool: string }>({
    cursor: { x: 0, y: 0 },
    isDrawing: false,
    activeTool: 'select',
  });

  const pendingQueue = useRef<string[]>([]);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const keepAliveIntervalRef = useRef<number | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const onWebRTCSignalRef = useRef(onWebRTCSignal);
  onWebRTCSignalRef.current = onWebRTCSignal;
  const onKickedRef = useRef(onKicked);
  onKickedRef.current = onKicked;
  const onRoomRejectedRef = useRef(onRoomRejected);
  onRoomRejectedRef.current = onRoomRejected;
  const customMaxUsersRef = useRef(customMaxUsers);
  customMaxUsersRef.current = customMaxUsers;
  const isCreatingRoomRef = useRef(isCreatingRoom);
  isCreatingRoomRef.current = isCreatingRoom;
  const restoreRoomRef = useRef(restoreRoom);
  restoreRoomRef.current = restoreRoom;
  const onJoinedRef = useRef(onJoined);
  onJoinedRef.current = onJoined;
  const onSessionTimeoutRef = useRef(onSessionTimeout);
  onSessionTimeoutRef.current = onSessionTimeout;

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const httpFallbackBaseRef = useRef<string>('');

  // Publish helper for Serverless WSS Mesh Mode (GitHub Pages / Static Hosts)
  const safeTopicRoomId = useMemo(() => {
    return roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'ana-oda';
  }, [roomId]);

  const publishMeshPacket = useCallback(
    (msg: Record<string, unknown>, targetUserId?: string) => {
      const pktId = `${userRef.current.id}-${Date.now()}-${++packetSeqRef.current}`;
      seenPacketsRef.current.add(pktId);
      if (seenPacketsRef.current.size > 800) {
        const first = seenPacketsRef.current.values().next().value;
        if (first) seenPacketsRef.current.delete(first);
      }

      const envelope = JSON.stringify({
        ...msg,
        _pktId: pktId,
        _senderId: userRef.current.id,
        _roomId: roomId,
        _ts: Date.now(),
      });

      // 1. Broadcast across local browser tabs
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(envelope);
        } catch {}
      }

      // 2. Publish to all connected WSS MQTT brokers
      const safeTarget = targetUserId ? targetUserId.replace(/[^a-zA-Z0-9_-]/g, '_') : undefined;
      const topic = safeTarget
        ? `collabboard/v3/room/${safeTopicRoomId}/peer/${safeTarget}`
        : `collabboard/v3/room/${safeTopicRoomId}/events`;

      for (const client of mqttClientsRef.current) {
        if (client && client.connected) {
          try {
            client.publish(topic, envelope, { qos: 0 });
          } catch {}
        }
      }
    },
    [roomId, safeTopicRoomId]
  );

  // Unified message sender: Always broadcasts to mesh peers (MQTT + BroadcastChannel)
  // and simultaneously notifies local WebSocket if connected.
  const sendMessage = useCallback(
    (msg: Record<string, unknown>) => {
      // 1. Always publish to mesh peers across all containers, preview hosts, and devices
      publishMeshPacket(msg);

      // 2. Also send to local WebSocket server to keep server-side in-memory room state updated
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          const payload = JSON.stringify({
            ...msg,
            _senderId: userRef.current.id,
            _roomId: roomId,
          });
          wsRef.current.send(payload);
        } catch {}
      } else {
        const payload = JSON.stringify(msg);
        pendingQueue.current.push(payload);
        if (pendingQueue.current.length > 100) {
          pendingQueue.current.shift();
        }
      }
    },
    [publishMeshPacket, roomId]
  );

  // Sync user profile changes without dropping connection
  useEffect(() => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              name: user.name,
              color: user.color,
              avatar: user.avatar || user.name.charAt(0).toUpperCase(),
            }
          : u
      )
    );

    if (isMeshModeRef.current) {
      publishMeshPacket({
        type: 'user-update',
        user,
      });
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'user-update',
          user,
        })
      );
    }
  }, [user.name, user.color, user.avatar, user.id, publishMeshPacket]);

  // Process incoming room events (shared by WS, BroadcastChannel, and Serverless WSS Mesh)
  const handleIncomingPacket = useCallback(
    (raw: string) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg || typeof msg !== 'object') return;

        // Ignore packets meant for a different room
        if (
          msg._roomId &&
          String(msg._roomId).trim().toLowerCase() !== roomId.trim().toLowerCase() &&
          msg.type !== 'rooms-list-updated' &&
          msg.type !== 'room-error'
        ) {
          return;
        }

        // Deduplicate packets by _pktId
        if (msg._pktId) {
          if (seenPacketsRef.current.has(msg._pktId)) return;
          seenPacketsRef.current.add(msg._pktId);
          if (seenPacketsRef.current.size > 600) {
            const first = seenPacketsRef.current.values().next().value;
            if (first) seenPacketsRef.current.delete(first);
          }
        }

        const senderId: string | undefined = msg._senderId || msg.userId || msg.fromUserId;
        if (senderId && senderId !== userRef.current.id) {
          peerLastSeenRef.current.set(senderId, Date.now());
        }

        switch (msg.type) {
          // --- Serverless Mesh Discovery & State Handshake ---
          case 'mesh-join': {
            if (!msg.user || msg.user.id === userRef.current.id) break;
            if (rejectedRoomRef.current) break;
            const joiningUser: UserPresence = msg.user;

            const isAlreadyMember = usersRef.current.some((u) => u.id === joiningUser.id);
            const currentOwnerId = roomSettingsRef.current.ownerId || userRef.current.id;
            const weJoinedEarlier =
              typeof joiningUser.joinedAt === 'number'
                ? joinedAtRef.current <= joiningUser.joinedAt
                : true;

            // Enforce room lock & maxUsers capacity in mesh mode when we are already in the room
            if (!isAlreadyMember && weJoinedEarlier) {
              if (roomSettingsRef.current.isLocked && joiningUser.id !== currentOwnerId) {
                publishMeshPacket(
                  {
                    type: 'room-error',
                    code: 'ROOM_LOCKED',
                    roomId,
                    targetUserId: joiningUser.id,
                    message: `"${syncedRoomNameRef.current}" (#${roomId.toUpperCase()}) odası şu anda kilitli. Oda yöneticisi yeni katılımları kapattı.`,
                  },
                  joiningUser.id
                );
                break;
              }

              if (usersRef.current.length >= roomSettingsRef.current.maxUsers) {
                publishMeshPacket(
                  {
                    type: 'room-error',
                    code: 'ROOM_FULL',
                    roomId,
                    targetUserId: joiningUser.id,
                    message: `"${syncedRoomNameRef.current}" (#${roomId.toUpperCase()}) odası maksimum kapasiteye ulaştı (${usersRef.current.length}/${roomSettingsRef.current.maxUsers} kişi). Bu odaya giriş yapılamaz.`,
                  },
                  joiningUser.id
                );
                break;
              }
            }

            peerLastSeenRef.current.set(joiningUser.id, Date.now());

            // Determine role in mesh mode
            const assignedRole: UserRole =
              joiningUser.id === currentOwnerId
                ? 'owner'
                : joiningUser.role === 'owner' && currentOwnerId !== joiningUser.id
                ? roomSettingsRef.current.defaultRole || 'editor'
                : joiningUser.role || roomSettingsRef.current.defaultRole || 'editor';

            const normalizedJoiner: UserPresence = {
              ...joiningUser,
              role: assignedRole,
            };

            setUsers((prev) => {
              const exists = prev.some((u) => u.id === normalizedJoiner.id);
              if (!exists && prev.length >= roomSettingsRef.current.maxUsers) {
                return prev;
              }
              if (!exists) {
                soundEffects.playJoinSound();
              }
              const filtered = prev.filter((u) => u.id !== normalizedJoiner.id);
              return [...filtered, normalizedJoiner];
            });

            // Send welcome packet with our presence and current room state
            const meInList = usersRef.current.find((u) => u.id === userRef.current.id);
            const myPresence: UserPresence = meInList || {
              id: userRef.current.id,
              name: userRef.current.name,
              avatar: userRef.current.avatar,
              color: userRef.current.color,
              role: currentOwnerId === userRef.current.id ? 'owner' : 'editor',
              cursor: localCursorRef.current.cursor,
              isDrawing: localCursorRef.current.isDrawing,
              activeTool: localCursorRef.current.activeTool,
              isMuted: localVoiceRef.current.isMuted,
              isDeafened: localVoiceRef.current.isDeafened,
              isSpeaking: localVoiceRef.current.isSpeaking,
              joinedAt: joinedAtRef.current,
            };

            publishMeshPacket(
              {
                type: 'mesh-welcome',
                fromUser: myPresence,
                joinedAt: joinedAtRef.current,
                roomName: syncedRoomNameRef.current,
                settings: roomSettingsRef.current,
                elements: elementsRef.current,
                code: codeRef.current,
                notes: notesRef.current,
                files: filesRef.current,
                messages: chatMessagesRef.current,
              },
              joiningUser.id
            );
            break;
          }

          case 'mesh-welcome': {
            if (!msg.fromUser || msg.fromUser.id === userRef.current.id) break;
            const remoteUser: UserPresence = msg.fromUser;
            peerLastSeenRef.current.set(remoteUser.id, Date.now());

            // Check if remote peer joined earlier than us (making them the authoritative room host)
            const remoteJoinedEarlier =
              typeof msg.joinedAt === 'number' && msg.joinedAt < joinedAtRef.current;

            setUsers((prev) => {
              const filtered = prev.filter((u) => u.id !== remoteUser.id);
              const updatedList = [...filtered, remoteUser];
              if (remoteJoinedEarlier) {
                return updatedList.map((u) =>
                  u.id === userRef.current.id && u.role === 'owner'
                    ? { ...u, role: msg.settings?.defaultRole || 'editor' }
                    : u
                );
              }
              return updatedList;
            });

            if (remoteJoinedEarlier) {
              if (msg.roomName) setSyncedRoomName(msg.roomName);
              if (msg.settings) setRoomSettings(msg.settings);
            }

            if (Array.isArray(msg.elements) && msg.elements.length > 0) {
              setElements((prev) => {
                const map = new Map(prev.map((e) => [e.id, e]));
                for (const el of msg.elements) {
                  if (el && el.id) map.set(el.id, el);
                }
                return Array.from(map.values());
              });
            }

            if (
              msg.code &&
              typeof msg.code.content === 'string' &&
              (remoteJoinedEarlier || codeRef.current.lastUpdatedBy === 'Sistem')
            ) {
              setCode(msg.code);
            }

            if (
              msg.notes &&
              typeof msg.notes.content === 'string' &&
              (remoteJoinedEarlier || notesRef.current.lastUpdatedBy === 'Sistem')
            ) {
              setNotes(msg.notes);
            }

            if (Array.isArray(msg.messages) && msg.messages.length > 0) {
              setChatMessages((prev) => {
                const map = new Map(prev.map((m) => [m.id, m]));
                for (const m of msg.messages) {
                  if (m && m.id) map.set(m.id, m);
                }
                return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
              });
            }

            if (Array.isArray(msg.files) && msg.files.length > 0) {
              setFiles((prev) => {
                const map = new Map(prev.map((f) => [f.id, f]));
                for (const f of msg.files) {
                  if (f && f.id) map.set(f.id, f);
                }
                return Array.from(map.values());
              });
            }
            break;
          }

          case 'mesh-heartbeat': {
            if (!msg.user || msg.user.id === userRef.current.id) break;
            if (rejectedRoomRef.current) break;
            const hbUser: UserPresence = msg.user;
            const existsInRoom = usersRef.current.some((u) => u.id === hbUser.id);
            if (!existsInRoom) {
              if (
                roomSettingsRef.current.isLocked ||
                usersRef.current.length >= roomSettingsRef.current.maxUsers
              ) {
                break;
              }
            }
            peerLastSeenRef.current.set(hbUser.id, Date.now());
            setUsers((prev) => {
              const exists = prev.some((u) => u.id === hbUser.id);
              if (!exists) {
                if (prev.length >= roomSettingsRef.current.maxUsers) return prev;
                soundEffects.playJoinSound();
                return [...prev, hbUser];
              }
              return prev.map((u) => (u.id === hbUser.id ? { ...u, ...hbUser } : u));
            });
            break;
          }

          case 'mesh-leave': {
            if (!msg.userId || msg.userId === userRef.current.id) break;
            peerLastSeenRef.current.delete(msg.userId);
            setUsers((prev) => prev.filter((u) => u.id !== msg.userId));
            setCodeCursors((prev) => prev.filter((c) => c.userId !== msg.userId));
            break;
          }

          // --- Standard Room & Workspace Events ---
          case 'init-room': {
            setRoomError(null);
            if (onJoinedRef.current) onJoinedRef.current(msg.roomId || roomId);
            setSyncedRoomName(msg.roomName || roomNameRef.current);
            if (msg.settings) {
              setRoomSettings(msg.settings);
            }
            if (Array.isArray(msg.rooms)) {
              setRoomsList(msg.rooms);
            }
            if (msg.limits) {
              setServerLimits(msg.limits);
            }
            if (Array.isArray(msg.elements)) {
              setElements(msg.elements);
            }
            if (msg.code && (msg.code.content || msg.code.language)) {
              setCode(msg.code);
            }
            if (msg.notes && msg.notes.content) {
              setNotes(msg.notes);
            }
            if (Array.isArray(msg.files)) {
              setFiles(msg.files);
            }
            setCodeFiles(Array.isArray(msg.codeFiles) ? msg.codeFiles : []);
            if (Array.isArray(msg.messages)) {
              setChatMessages(
                [...msg.messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
              );
            }
            if (Array.isArray(msg.users)) {
              setUsers(msg.users);
            }
            break;
          }

          case 'rooms-list-updated': {
            if (Array.isArray(msg.rooms)) {
              setRoomsList(msg.rooms);
            }
            if (msg.limits) {
              setServerLimits(msg.limits);
            }
            break;
          }

          case 'room-settings-updated':
          case 'room-settings-update': {
            const changes = msg.settings || msg.changes;
            if (msg.roomName || changes?.roomName) {
              setSyncedRoomName(msg.roomName || changes.roomName);
            }
            if (changes) {
              setRoomSettings((prev) => ({
                ...prev,
                ...changes,
              }));
            }
            break;
          }

          case 'room-error': {
            if (msg.targetUserId && msg.targetUserId !== userRef.current.id) {
              break;
            }
            const errObj = {
              code: msg.code || 'ERROR',
              message: msg.message || 'Oda işlemi sırasında bir hata oluştu.',
              roomId: msg.roomId || roomId,
            };
            setRoomError(errObj);

            if (
              errObj.code === 'ROOM_FULL' ||
              errObj.code === 'ROOM_LOCKED' ||
              errObj.code === 'MAX_ROOMS_REACHED' ||
              errObj.code === 'ROOM_NOT_FOUND' ||
              errObj.code === 'USER_MAX_ROOMS_REACHED' ||
              errObj.code === 'INVALID_ROOM_CODE' ||
              errObj.code === 'ROOM_CODE_TAKEN'
            ) {
              rejectedRoomRef.current = true;
              setIsConnected(false);
              setUsers([]);
              publishMeshPacket({
                type: 'mesh-leave',
                userId: userRef.current.id,
              });
              if (wsRef.current) {
                try {
                  wsRef.current.close();
                } catch {}
              }
              for (const client of mqttClientsRef.current) {
                try {
                  client.end(true);
                } catch {}
              }
              mqttClientsRef.current = [];
              if (onRoomRejectedRef.current) {
                onRoomRejectedRef.current(errObj);
              }
            }
            break;
          }

          case 'user-role-updated':
          case 'user-role-update': {
            const targetId = msg.userId || msg.targetUserId;
            const nextRole = msg.role || msg.newRole;
            if (targetId && nextRole) {
              setUsers((prev) =>
                prev.map((u) => (u.id === targetId ? { ...u, role: nextRole } : u))
              );
            }
            break;
          }

          case 'session-timeout': {
            rejectedRoomRef.current = true;
            if (onSessionTimeoutRef.current) {
              onSessionTimeoutRef.current(msg.roomId || roomId, msg.roomName || syncedRoomNameRef.current);
            }
            break;
          }

          case 'kicked-from-room':
          case 'user-kick': {
            const kickedId = msg.targetUserId;
            if (msg.type === 'kicked-from-room' || kickedId === userRef.current.id) {
              if (onKickedRef.current) {
                onKickedRef.current(
                  msg.roomId || roomId,
                  msg.roomName || syncedRoomNameRef.current,
                  msg.by || 'Yönetici'
                );
              }
            } else if (kickedId) {
              setUsers((prev) => prev.filter((u) => u.id !== kickedId));
            }
            break;
          }

          case 'user-joined': {
            if (rejectedRoomRef.current) break;
            setUsers((prev) => {
              const filtered = prev.filter((u) => u.id !== msg.user.id);
              return [...filtered, msg.user];
            });
            soundEffects.playJoinSound();
            break;
          }

          case 'user-updated':
          case 'user-update': {
            const updatedUser = msg.user;
            const uid = updatedUser?.id || msg._senderId;
            if (uid && updatedUser) {
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === uid
                    ? {
                        ...u,
                        name: updatedUser.name || u.name,
                        color: updatedUser.color || u.color,
                        avatar:
                          updatedUser.avatar ||
                          (updatedUser.name || u.name).charAt(0).toUpperCase(),
                      }
                    : u
                )
              );
            }
            break;
          }

          case 'user-left': {
            setLiveStrokeMap((prev) => {
              if (!(msg.userId in prev)) return prev;
              const { [msg.userId as string]: _gone, ...rest } = prev;
              return rest;
            });
            setUsers((prev) => prev.filter((u) => u.id !== msg.userId));
            setCodeCursors((prev) => prev.filter((c) => c.userId !== msg.userId));
            break;
          }

          case 'cursor-moved':
          case 'cursor-move': {
            const uid = msg.userId || msg._senderId;
            if (!uid || uid === userRef.current.id) break;
            setUsers((prev) =>
              prev.map((u) => {
                if (u.id === uid) {
                  return {
                    ...u,
                    cursor: msg.cursor,
                    isDrawing: !!msg.isDrawing,
                    activeTool: msg.activeTool || u.activeTool,
                  };
                }
                return u;
              })
            );
            break;
          }

          case 'laser-moved':
          case 'laser-move': {
            const uid = msg.userId || msg._senderId;
            if (uid === userRef.current.id) break;
            if (msg.point) {
              const senderUser = usersRef.current.find((u) => u.id === uid);
              setRemoteLaserPoints((prev) => [
                ...prev.slice(-60),
                {
                  x: msg.point.x,
                  y: msg.point.y,
                  time: Date.now(),
                  userId: uid || 'remote',
                  color: msg.color || senderUser?.color || '#ef4444',
                },
              ]);
            }
            break;
          }

          case 'stroke-live': {
            const uid = msg.userId || msg._senderId;
            if (!uid || uid === userRef.current.id) break;
            setLiveStrokeMap((prev) => {
              if (!msg.element) {
                if (!(uid in prev)) return prev;
                const { [uid]: _removed, ...rest } = prev;
                return rest;
              }
              return { ...prev, [uid]: { el: msg.element as CanvasElement, at: Date.now() } };
            });
            break;
          }

          case 'element-created':
          case 'element-create': {
            if (!msg.element) break;
            // The finished stroke replaces its live preview
            setLiveStrokeMap((prev) => {
              const hit = Object.keys(prev).filter((k) => prev[k].el.id === msg.element.id);
              if (hit.length === 0) return prev;
              const next = { ...prev };
              hit.forEach((k) => delete next[k]);
              return next;
            });
            setElements((prev) => {
              if (prev.some((el) => el.id === msg.element.id)) {
                return prev.map((el) => (el.id === msg.element.id ? msg.element : el));
              }
              return [...prev, msg.element];
            });
            break;
          }

          case 'element-updated':
          case 'element-update': {
            setElements((prev) =>
              prev.map((el) =>
                el.id === msg.id ? { ...el, ...msg.changes, updatedAt: Date.now() } : el
              )
            );
            break;
          }

          case 'elements-batch-updated':
          case 'elements-batch-update': {
            if (!Array.isArray(msg.updates)) break;
            const updatesMap = new Map<string, Partial<CanvasElement>>();
            for (const u of msg.updates) {
              updatesMap.set(u.id, u.changes);
            }
            setElements((prev) =>
              prev.map((el) => {
                const ch = updatesMap.get(el.id);
                if (ch) {
                  return { ...el, ...ch, updatedAt: Date.now() };
                }
                return el;
              })
            );
            break;
          }

          case 'element-deleted':
          case 'element-delete': {
            if (!Array.isArray(msg.ids)) break;
            const idSet = new Set(msg.ids);
            setElements((prev) => prev.filter((el) => !idSet.has(el.id)));
            break;
          }

          case 'elements-replaced':
          case 'elements-replace': {
            if (Array.isArray(msg.elements)) {
              setElements(msg.elements);
            }
            break;
          }

          case 'elements-cleared':
          case 'elements-clear': {
            setElements([]);
            break;
          }

          case 'elements-template-loaded':
          case 'elements-load-template': {
            if (!Array.isArray(msg.elements)) break;
            setElements((prev) => {
              const existingMap = new Map(prev.map((el) => [el.id, el]));
              for (const el of msg.elements) {
                existingMap.set(el.id, el);
              }
              return Array.from(existingMap.values());
            });
            break;
          }

          case 'code-updated':
          case 'code-change': {
            if (msg.code) {
              setCode(msg.code);
            } else if (typeof msg.content === 'string') {
              setCode((prev) => ({
                content: msg.content,
                language: msg.language || prev.language,
                lastUpdatedBy: msg.userName || 'Kullanıcı',
              }));
            }
            break;
          }

          case 'code-file-updated': {
            const f = msg.file as CodeFile | undefined;
            if (f && f.id) {
              setCodeFiles((prev) => {
                const idx = prev.findIndex((x) => x.id === f.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = f;
                  return next;
                }
                return [...prev, f];
              });
            }
            break;
          }

          case 'code-file-deleted': {
            if (msg.fileId) {
              setCodeFiles((prev) => prev.filter((x) => x.id !== msg.fileId));
            }
            break;
          }

          case 'code-cursor-moved':
          case 'code-cursor-move': {
            const uid = msg.userId || msg._senderId;
            if (!uid || uid === userRef.current.id) break;
            const cursorEntry: CodeCursorPresence = {
              userId: uid,
              userName: msg.userName || 'Kullanıcı',
              userColor: msg.userColor || '#3b82f6',
              line: typeof msg.line === 'number' ? msg.line : 1,
              column: typeof msg.column === 'number' ? msg.column : 1,
              selectionStart: typeof msg.selectionStart === 'number' ? msg.selectionStart : 0,
              selectionEnd: typeof msg.selectionEnd === 'number' ? msg.selectionEnd : 0,
              updatedAt: Date.now(),
            };
            setCodeCursors((prev) => {
              const others = prev.filter((c) => c.userId !== uid);
              return [...others, cursorEntry];
            });
            break;
          }

          case 'notes-updated':
          case 'notes-change': {
            if (msg.notes) {
              setNotes(msg.notes);
            } else if (typeof msg.content === 'string') {
              setNotes({
                content: msg.content,
                lastUpdatedBy: msg.userName || 'Kullanıcı',
              });
            }
            break;
          }

          case 'chat-received':
          case 'chat-message': {
            const chatMsg: ChatMessage = msg.message || {
              id: msg.id || `msg-${msg._ts || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              userId: msg._senderId || msg.userId || 'remote',
              userName: msg.userName || 'Kullanıcı',
              userColor: msg.userColor || '#2563eb',
              text: msg.text,
              timestamp: msg.timestamp || msg._ts || Date.now(),
              fileAttachment: msg.fileAttachment,
            };
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === chatMsg.id)) return prev;
              // Secondary deduplication: same author & text within 3000ms
              if (
                prev.some(
                  (m) =>
                    m.userId === chatMsg.userId &&
                    m.text === chatMsg.text &&
                    Math.abs((m.timestamp || 0) - (chatMsg.timestamp || 0)) < 3000
                )
              ) {
                return prev;
              }
              return [...prev, chatMsg];
            });
            if (chatMsg.userId !== userRef.current.id) {
              soundEffects.playMessageSound();
            }
            break;
          }

          case 'file-added':
          case 'file-upload': {
            const fileObj: SharedFile = msg.file || {
              id: msg.id || `file-${msg._ts || Date.now()}`,
              name: msg.name,
              size: msg.size,
              type: msg.fileType || msg.type || 'application/octet-stream',
              dataUrl: msg.dataUrl,
              uploadedBy: msg.uploadedBy || 'Kullanıcı',
              uploadedAt: msg._ts || Date.now(),
            };
            setFiles((prev) => {
              if (prev.some((f) => f.id === fileObj.id)) return prev;
              if (
                prev.some(
                  (f) =>
                    f.name === fileObj.name &&
                    f.size === fileObj.size &&
                    f.dataUrl === fileObj.dataUrl
                )
              ) {
                return prev;
              }
              return [...prev, fileObj];
            });
            break;
          }

          case 'file-deleted':
          case 'file-delete': {
            setFiles((prev) => prev.filter((f) => f.id !== msg.fileId));
            break;
          }

          case 'voice-state-updated':
          case 'voice-state': {
            const uid = msg.userId || msg._senderId;
            if (!uid) break;
            setUsers((prev) =>
              prev.map((u) => {
                if (u.id === uid) {
                  return {
                    ...u,
                    isMuted: msg.isMuted ?? u.isMuted,
                    isDeafened: msg.isDeafened ?? u.isDeafened,
                    isSpeaking: msg.isSpeaking ?? u.isSpeaking,
                  };
                }
                return u;
              })
            );
            break;
          }

          case 'ping-received':
          case 'user-ping': {
            if (msg._senderId && msg._senderId === userRef.current.id) {
              break;
            }
            const now = Date.now();
            setPings((prev) => {
              const isDuplicate = prev.some(
                (p) =>
                  p.userName === msg.userName &&
                  Math.abs(now - p.timestamp) < 600 &&
                  Math.hypot(p.x - msg.x, p.y - msg.y) < 5
              );
              if (isDuplicate) return prev;
              soundEffects.playPingSound();
              return [
                ...prev.slice(-10),
                {
                  x: msg.x,
                  y: msg.y,
                  userName: msg.userName,
                  userColor: msg.userColor,
                  timestamp: now,
                },
              ];
            });
            break;
          }

          case 'reaction-received':
          case 'reaction': {
            if (msg._senderId && msg._senderId === userRef.current.id) {
              break;
            }
            const now = Date.now();
            setReactions((prev) => {
              const isDuplicate = prev.some(
                (r) =>
                  r.userName === msg.userName &&
                  r.emoji === msg.emoji &&
                  Math.abs(now - r.timestamp) < 600
              );
              if (isDuplicate) return prev;
              return [
                ...prev.slice(-20),
                {
                  id: `rx-${now}-${Math.random()}`,
                  x: msg.x,
                  y: msg.y,
                  emoji: msg.emoji,
                  userName: msg.userName,
                  timestamp: now,
                },
              ];
            });
            break;
          }

          case 'webrtc-signal': {
            const fromId = msg.fromUserId || msg._senderId;
            if (
              fromId &&
              fromId !== userRef.current.id &&
              (!msg.targetUserId || msg.targetUserId === userRef.current.id)
            ) {
              if (onWebRTCSignalRef.current) {
                onWebRTCSignalRef.current(fromId, msg.signal);
              }
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Packet handling error:', err);
      }
    },
    [roomId, publishMeshPacket]
  );

  // Connect & reconnect logic per roomId
  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      isWsConnectedRef.current = false;
      setUsers([]);
      return;
    }

    let isCancelled = false;
    rejectedRoomRef.current = false;
    isWsConnectedRef.current = false;
    isMeshModeRef.current = false;
    joinedAtRef.current = Date.now();
    peerLastSeenRef.current.clear();

    // Reset room-specific state when entering/switching rooms so stale users/elements never persist
    setUsers([]);
    setElements([]);
    setPings([]);
    setReactions([]);
    setRemoteLaserPoints([]);
    setCodeCursors([]);

    const targetMaxUsers =
      customMaxUsersRef.current && customMaxUsersRef.current >= 2
        ? customMaxUsersRef.current
        : 12;

    const currentDisplayRoomName = roomNameRef.current;
    setSyncedRoomName(currentDisplayRoomName);
    setRoomSettings((prev) => ({
      ...prev,
      isLocked: false,
      maxUsers: targetMaxUsers,
      ownerId: isCreatingRoomRef.current ? userRef.current.id : prev.ownerId,
    }));

    // Setup BroadcastChannel for instant local cross-tab/window sync
    const bcChannelName = `collabboard_room_${roomId.trim().toLowerCase()}`;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(bcChannelName);
        broadcastChannelRef.current = bc;
        bc.onmessage = (ev) => {
          if (typeof ev.data === 'string' && !rejectedRoomRef.current) {
            handleIncomingPacket(ev.data);
          }
        };
      } catch {}
    }

    function resolveWsUrl(): string | null {
      const host = window.location.hostname;
      const isStaticHost =
        host.endsWith('.github.io') ||
        host.endsWith('.web.app') ||
        host.endsWith('.firebaseapp.com') ||
        host.endsWith('.pages.dev') ||
        host.endsWith('.netlify.app') ||
        host.endsWith('.vercel.app');

      if (isStaticHost) {
        return null;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const serverFromQuery = params.get('server');
        if (serverFromQuery) {
          const clean = serverFromQuery.trim().replace(/\/+$/, '');
          if (clean.startsWith('ws://') || clean.startsWith('wss://')) {
            localStorage.setItem('collab_ws_server', clean);
            httpFallbackBaseRef.current = clean
              .replace(/^wss:/, 'https:')
              .replace(/^ws:/, 'http:');
            return clean;
          } else if (clean.startsWith('http://') || clean.startsWith('https://')) {
            const wsConverted = clean.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
            localStorage.setItem('collab_ws_server', wsConverted);
            httpFallbackBaseRef.current = clean;
            return wsConverted;
          }
        }
      } catch {}

      httpFallbackBaseRef.current = '';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }

    let meshHeartbeatTimer: number | null = null;
    let beforeUnloadHandler: (() => void) | null = null;
    let meshStarted = false;

    function initMeshNetwork(serverlessOnly: boolean) {
      if (isCancelled || rejectedRoomRef.current || meshStarted) return;
      meshStarted = true;
      if (serverlessOnly) {
        isMeshModeRef.current = true;
        setIsConnected(true);
      }

      const initialSelfPresence: UserPresence = {
        id: userRef.current.id,
        name: userRef.current.name,
        avatar: userRef.current.avatar || userRef.current.name.charAt(0).toUpperCase(),
        color: userRef.current.color,
        role: isCreatingRoomRef.current ? 'owner' : 'editor',
        cursor: { x: 0, y: 0 },
        isDrawing: false,
        activeTool: 'select',
        isMuted: localVoiceRef.current.isMuted,
        isDeafened: localVoiceRef.current.isDeafened,
        isSpeaking: false,
        joinedAt: joinedAtRef.current,
      };

      if (serverlessOnly) {
        setRoomSettings((prev) => ({
          ...prev,
          maxUsers: targetMaxUsers,
          ownerId: prev.ownerId || userRef.current.id,
        }));

        setUsers((prev) => {
          const others = prev.filter((u) => u.id !== userRef.current.id);
          return [initialSelfPresence, ...others];
        });
      }

      const safeRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'ana-oda';
      const safeUid = userRef.current.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const eventsTopic = `collabboard/v3/room/${safeRoom}/events`;
      const directPeerTopic = `collabboard/v3/room/${safeRoom}/peer/${safeUid}`;

      const clients: MqttClient[] = [];
      for (const brokerUrl of PUBLIC_WSS_BROKERS) {
        try {
          const client = mqtt.connect(brokerUrl, {
            clientId: `cb_${userRef.current.id.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random().toString(36).slice(2, 6)}`,
            clean: true,
            connectTimeout: 5000,
            reconnectPeriod: 3000,
          });

          client.on('connect', () => {
            if (isCancelled || rejectedRoomRef.current) return;
            setIsConnected(true);
            client.subscribe([eventsTopic, directPeerTopic], { qos: 0 }, () => {
              if (rejectedRoomRef.current) return;
              const selfNow =
                usersRef.current.find((u) => u.id === userRef.current.id) || initialSelfPresence;
              publishMeshPacket({
                type: 'mesh-join',
                roomId,
                roomName: syncedRoomNameRef.current || roomNameRef.current,
                maxUsers: targetMaxUsers,
                isCreatingRoom: isCreatingRoomRef.current,
                user: selfNow,
              });
            });
          });

          client.on('message', (_topic, payloadBuffer) => {
            if (isCancelled || rejectedRoomRef.current) return;
            handleIncomingPacket(payloadBuffer.toString());
          });

          clients.push(client);
        } catch {}
      }

      mqttClientsRef.current = clients;

      // Announce on BroadcastChannel immediately too
      publishMeshPacket({
        type: 'mesh-join',
        roomId,
        roomName: syncedRoomNameRef.current || roomNameRef.current,
        maxUsers: targetMaxUsers,
        isCreatingRoom: isCreatingRoomRef.current,
        user: initialSelfPresence,
      });

      // Periodic heartbeat & stale peer cleanup
      meshHeartbeatTimer = window.setInterval(() => {
        if (isCancelled || rejectedRoomRef.current) return;
        const me = usersRef.current.find((u) => u.id === userRef.current.id);
        if (me) {
          publishMeshPacket({
            type: 'mesh-heartbeat',
            user: {
              ...me,
              cursor: localCursorRef.current.cursor,
              isDrawing: localCursorRef.current.isDrawing,
              activeTool: localCursorRef.current.activeTool,
              isMuted: localVoiceRef.current.isMuted,
              isDeafened: localVoiceRef.current.isDeafened,
              isSpeaking: localVoiceRef.current.isSpeaking,
            },
          });
        }

        // Only prune stale peers automatically in serverless mesh mode (when WS server is not managing presence)
        if (!isWsConnectedRef.current) {
          const now = Date.now();
          const staleIds: string[] = [];
          peerLastSeenRef.current.forEach((lastSeen, peerId) => {
            if (now - lastSeen > 15000) {
              staleIds.push(peerId);
            }
          });
          if (staleIds.length > 0) {
            staleIds.forEach((id) => peerLastSeenRef.current.delete(id));
            setUsers((prev) =>
              prev.filter((u) => u.id === userRef.current.id || !staleIds.includes(u.id))
            );
          }
        }
      }, 4000);

      beforeUnloadHandler = () => {
        publishMeshPacket({
          type: 'mesh-leave',
          userId: userRef.current.id,
        });
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(
              JSON.stringify({
                type: 'leave-room',
                roomId,
                userId: userRef.current.id,
              })
            );
          } catch {}
        }
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
    }

    function connectWs() {
      if (isCancelled || rejectedRoomRef.current) return;

      const wsUrl = resolveWsUrl();
      if (!wsUrl) {
        initMeshNetwork(true);
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCancelled || rejectedRoomRef.current) return;
        isWsConnectedRef.current = true;
        isMeshModeRef.current = false;
        setIsConnected(true);

        ws.send(
          JSON.stringify({
            type: 'join-room',
            roomId: roomId.trim().toLowerCase(),
            roomName: roomNameRef.current,
            maxUsers: targetMaxUsers,
            isCreatingRoom: isCreatingRoomRef.current,
            restoreRoom: restoreRoomRef.current,
            ownerKey: getOrCreateOwnerKey(),
            user: userRef.current,
          })
        );

        while (pendingQueue.current.length > 0) {
          const item = pendingQueue.current.shift();
          if (item) ws.send(item);
        }

        // Start secondary mesh network for cross-tab/cross-container sync after WS joins
        initMeshNetwork(false);

        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
        }
        keepAliveIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping-keepalive' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handleIncomingPacket(event.data);
        }
      };

      ws.onclose = () => {
        isWsConnectedRef.current = false;
        if (isCancelled || rejectedRoomRef.current) return;
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
        }
        if (!meshStarted) {
          initMeshNetwork(true);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (!rejectedRoomRef.current && !isCancelled) {
            connectWs();
          }
        }, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      isCancelled = true;
      if (beforeUnloadHandler) {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
      }
      if (!rejectedRoomRef.current) {
        publishMeshPacket({
          type: 'mesh-leave',
          userId: userRef.current.id,
        });
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(
              JSON.stringify({
                type: 'leave-room',
                roomId: roomId.trim().toLowerCase(),
                userId: userRef.current.id,
              })
            );
          } catch {}
        }
      }
      if (meshHeartbeatTimer) {
        clearInterval(meshHeartbeatTimer);
      }
      for (const client of mqttClientsRef.current) {
        try {
          client.end(true);
        } catch {}
      }
      mqttClientsRef.current = [];
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      isWsConnectedRef.current = false;
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.close();
        } catch {}
        broadcastChannelRef.current = null;
      }
    };
  }, [roomId, enabled, handleIncomingPacket, publishMeshPacket]);

  // Keep roomsList summary updated ONLY in pure serverless mesh mode (when WS server is not present)
  useEffect(() => {
    if (!isMeshModeRef.current || isWsConnectedRef.current) return;
    setRoomsList([
      {
        id: roomId,
        name: syncedRoomName,
        userCount: users.length,
        maxUsers: roomSettings.maxUsers,
        isLocked: roomSettings.isLocked,
        elementCount: elements.length,
        createdAt: joinedAtRef.current,
        ownerName:
          users.find((u) => u.role === 'owner')?.name || userRef.current.name,
        ownerKey: getOrCreateOwnerKey(),
      },
    ]);
  }, [roomId, syncedRoomName, users, roomSettings.maxUsers, roomSettings.isLocked, elements.length]);

  // Clean up old pings, reactions, and remote laser points periodically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setPings((prev) => prev.filter((p) => now - p.timestamp < 3600));
      setReactions((prev) => prev.filter((r) => now - r.timestamp < 2600));
      setRemoteLaserPoints((prev) => prev.filter((lp) => now - lp.time < 1300));
      setCodeCursors((prev) => prev.filter((cc) => now - cc.updatedAt < 45000));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Derive current user's role in the room
  const currentUserRole: UserRole = useMemo(() => {
    const me = users.find((u) => u.id === user.id);
    if (me && me.role) return me.role;
    if (roomSettings.ownerId === user.id) return 'owner';
    return roomSettings.defaultRole || 'editor';
  }, [users, user.id, roomSettings.ownerId, roomSettings.defaultRole]);

  const canEdit =
    currentUserRole === 'owner' ||
    currentUserRole === 'admin' ||
    currentUserRole === 'editor';

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Public Actions
  const sendActivity = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'user-activity' }));
      } catch {}
    }
  }, []);

  const requestRoomsList = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'get-rooms' }));
      } catch {}
    }
    fetch('/api/rooms')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rooms)) {
          setRoomsList(data.rooms);
        }
        if (data && data.limits) {
          setServerLimits(data.limits);
        }
      })
      .catch(() => {});
  }, []);

  const deleteRoom = useCallback(async (targetRoomId: string): Promise<boolean> => {
    const cleanTarget = targetRoomId.trim().toLowerCase();
    if (!cleanTarget || cleanTarget === 'ana-oda') return false;
    const ownerKey = getOrCreateOwnerKey();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'delete-room',
            roomId: cleanTarget,
            ownerKey,
            userId: userRef.current.id,
          })
        );
      } catch {}
    }
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(cleanTarget)}?ownerKey=${encodeURIComponent(ownerKey)}&userId=${encodeURIComponent(userRef.current.id)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setRoomsList(data.rooms);
        }
        if (data.limits) {
          setServerLimits(data.limits);
        }
        return true;
      }
    } catch {}
    return true;
  }, []);

  const updateRoomSettings = useCallback(
    (changes: {
      isLocked?: boolean;
      maxUsers?: number;
      defaultRole?: 'editor' | 'viewer';
      roomName?: string;
    }) => {
      if (changes.roomName) {
        setSyncedRoomName(changes.roomName);
      }
      setRoomSettings((prev) => ({
        ...prev,
        ...changes,
      }));
      sendMessage({
        type: 'room-settings-update',
        changes,
      });
    },
    [sendMessage]
  );

  const updateUserRole = useCallback(
    (targetUserId: string, newRole: UserRole) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
      );
      sendMessage({
        type: 'user-role-update',
        targetUserId,
        newRole,
      });
    },
    [sendMessage]
  );

  const kickUser = useCallback(
    (targetUserId: string) => {
      setUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      sendMessage({
        type: 'user-kick',
        targetUserId,
        roomId,
        roomName: syncedRoomNameRef.current,
        by: userRef.current.name,
      });
    },
    [sendMessage, roomId]
  );

  const lastCursorSentAtRef = useRef<number>(0);
  const sendCursor = useCallback(
    (cursor: Point, isDrawing: boolean, activeTool: string) => {
      localCursorRef.current = { cursor, isDrawing, activeTool };
      const now = Date.now();
      // Throttle cursor packets to ~25fps on mesh to keep bandwidth crisp
      if (isMeshModeRef.current && now - lastCursorSentAtRef.current < 40 && !isDrawing) {
        return;
      }
      lastCursorSentAtRef.current = now;
      sendMessage({
        type: 'cursor-move',
        userId: userRef.current.id,
        cursor,
        isDrawing,
        activeTool,
      });
    },
    [sendMessage]
  );

  const sendLiveStroke = useCallback(
    (element: CanvasElement | null) => {
      sendMessage({
        type: 'stroke-live',
        userId: userRef.current.id,
        element,
      });
    },
    [sendMessage]
  );

  // Drop live previews whose author stopped sending (disconnect / lost pointer-up)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveStrokeMap((prev) => {
        const now = Date.now();
        const keys = Object.keys(prev).filter((k) => now - prev[k].at > 6000);
        if (keys.length === 0) return prev;
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const liveStrokes = useMemo(
    () => Object.values(liveStrokeMap).map((v) => v.el),
    [liveStrokeMap]
  );

  const sendLaserPoint = useCallback(
    (point: Point) => {
      sendMessage({
        type: 'laser-move',
        userId: userRef.current.id,
        color: userRef.current.color,
        point,
      });
    },
    [sendMessage]
  );

  const createElement = useCallback(
    (element: CanvasElement) => {
      if (!canEdit) return;
      setElements((prev) => {
        if (prev.some((e) => e.id === element.id)) return prev;
        return [...prev, element];
      });
      sendMessage({
        type: 'element-create',
        element,
      });
    },
    [sendMessage, canEdit]
  );

  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      if (!canEdit) return;
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...changes, updatedAt: Date.now() } : el))
      );
      sendMessage({
        type: 'element-update',
        id,
        changes,
      });
    },
    [sendMessage, canEdit]
  );

  const batchUpdateElements = useCallback(
    (updates: { id: string; changes: Partial<CanvasElement> }[]) => {
      if (!canEdit) return;
      const map = new Map(updates.map((u) => [u.id, u.changes]));
      setElements((prev) =>
        prev.map((el) => {
          const ch = map.get(el.id);
          return ch ? { ...el, ...ch, updatedAt: Date.now() } : el;
        })
      );
      sendMessage({
        type: 'elements-batch-update',
        updates,
      });
    },
    [sendMessage, canEdit]
  );

  const deleteElements = useCallback(
    (ids: string[]) => {
      if (!canEdit) return;
      const set = new Set(ids);
      setElements((prev) => prev.filter((el) => !set.has(el.id)));
      sendMessage({
        type: 'element-delete',
        ids,
      });
    },
    [sendMessage, canEdit]
  );

  const replaceElements = useCallback(
    (newElements: CanvasElement[]) => {
      if (!canEdit) return;
      setElements(newElements);
      sendMessage({
        type: 'elements-replace',
        elements: newElements,
      });
    },
    [sendMessage, canEdit]
  );

  const clearElements = useCallback(() => {
    if (!canEdit) return;
    setElements([]);
    sendMessage({
      type: 'elements-clear',
    });
  }, [sendMessage, canEdit]);

  const loadTemplate = useCallback(
    (templateElements: CanvasElement[]) => {
      if (!canEdit) return;
      setElements((prev) => {
        const m = new Map(prev.map((e) => [e.id, e]));
        for (const el of templateElements) {
          m.set(el.id, el);
        }
        return Array.from(m.values());
      });
      sendMessage({
        type: 'elements-load-template',
        elements: templateElements,
      });
    },
    [sendMessage, canEdit]
  );

  const updateCode = useCallback(
    (newContent: string, newLanguage?: string) => {
      if (!canEdit) return;
      const nextLang = newLanguage || code.language;
      setCode({
        content: newContent,
        language: nextLang,
        lastUpdatedBy: userRef.current.name,
      });
      sendMessage({
        type: 'code-change',
        content: newContent,
        language: nextLang,
        userName: userRef.current.name,
      });
    },
    [sendMessage, code.language, canEdit]
  );

  const upsertCodeFile = useCallback(
    (file: CodeFile) => {
      if (!canEdit) return;
      const withMeta = { ...file, lastUpdatedBy: userRef.current.name };
      setCodeFiles((prev) => {
        const idx = prev.findIndex((x) => x.id === file.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = withMeta;
          return next;
        }
        return [...prev, withMeta];
      });
      sendMessage({ type: 'code-file-upsert', file: withMeta, userName: userRef.current.name });
    },
    [sendMessage, canEdit]
  );

  const deleteCodeFile = useCallback(
    (fileId: string) => {
      if (!canEdit) return;
      setCodeFiles((prev) => prev.filter((x) => x.id !== fileId));
      sendMessage({ type: 'code-file-delete', fileId });
    },
    [sendMessage, canEdit]
  );

  const sendCodeCursor = useCallback(
    (cursor: { line: number; column: number; selectionStart: number; selectionEnd: number }) => {
      sendMessage({
        type: 'code-cursor-move',
        userId: userRef.current.id,
        userName: userRef.current.name,
        userColor: userRef.current.color,
        ...cursor,
      });
    },
    [sendMessage]
  );

  const updateNotes = useCallback(
    (newContent: string) => {
      if (!canEdit) return;
      setNotes({
        content: newContent,
        lastUpdatedBy: userRef.current.name,
      });
      sendMessage({
        type: 'notes-change',
        content: newContent,
        userName: userRef.current.name,
      });
    },
    [sendMessage, canEdit]
  );

  const sendChatMessage = useCallback(
    (text: string, fileAttachment?: { name: string; url: string; type?: string }) => {
      const msgObj: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: userRef.current.id,
        userName: userRef.current.name,
        userColor: userRef.current.color,
        text,
        timestamp: Date.now(),
        fileAttachment,
      };
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msgObj.id)) return prev;
        return [...prev, msgObj];
      });
      sendMessage({
        type: 'chat-message',
        id: msgObj.id,
        userId: msgObj.userId,
        text,
        userName: userRef.current.name,
        userColor: userRef.current.color,
        timestamp: msgObj.timestamp,
        fileAttachment,
      });
    },
    [sendMessage]
  );

  const uploadFile = useCallback(
    (fileData: { name: string; size: number; fileType: string; dataUrl: string }) => {
      if (!canEdit) return;
      const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newFileItem: SharedFile = {
        id: fileId,
        name: fileData.name,
        size: fileData.size,
        type: fileData.fileType,
        dataUrl: fileData.dataUrl,
        uploadedBy: userRef.current.name,
        uploadedAt: Date.now(),
      };
      setFiles((prev) => {
        if (
          prev.some(
            (f) =>
              f.id === fileId ||
              (f.name === newFileItem.name &&
                f.size === newFileItem.size &&
                f.dataUrl === newFileItem.dataUrl)
          )
        ) {
          return prev;
        }
        return [...prev, newFileItem];
      });
      sendMessage({
        type: 'file-upload',
        id: fileId,
        ...fileData,
        uploadedBy: userRef.current.name,
      });
    },
    [sendMessage, canEdit]
  );

  const deleteFile = useCallback(
    (fileId: string) => {
      if (!canEdit) return;
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      sendMessage({
        type: 'file-delete',
        fileId,
      });
    },
    [sendMessage, canEdit]
  );

  const updateVoiceState = useCallback(
    (voiceState: { isMuted?: boolean; isDeafened?: boolean; isSpeaking?: boolean }) => {
      const nextMuted = voiceState.isMuted ?? localVoiceRef.current.isMuted;
      const nextDeafened = voiceState.isDeafened ?? localVoiceRef.current.isDeafened;
      const nextSpeaking = voiceState.isSpeaking ?? localVoiceRef.current.isSpeaking;

      const changed =
        nextMuted !== localVoiceRef.current.isMuted ||
        nextDeafened !== localVoiceRef.current.isDeafened ||
        nextSpeaking !== localVoiceRef.current.isSpeaking;

      localVoiceRef.current = {
        isMuted: nextMuted,
        isDeafened: nextDeafened,
        isSpeaking: nextSpeaking,
      };

      if (!changed) return;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userRef.current.id
            ? {
                ...u,
                isMuted: nextMuted,
                isDeafened: nextDeafened,
                isSpeaking: nextSpeaking,
              }
            : u
        )
      );
      sendMessage({
        type: 'voice-state',
        userId: userRef.current.id,
        isMuted: nextMuted,
        isDeafened: nextDeafened,
        isSpeaking: nextSpeaking,
      });
    },
    [sendMessage]
  );

  const sendPing = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      setPings((prev) => [
        ...prev.slice(-10),
        {
          x,
          y,
          userName: userRef.current.name,
          userColor: userRef.current.color,
          timestamp: now,
        },
      ]);
      soundEffects.playPingSound();
      sendMessage({
        type: 'user-ping',
        x,
        y,
        userName: userRef.current.name,
        userColor: userRef.current.color,
        timestamp: now,
      });
    },
    [sendMessage]
  );

  const sendReaction = useCallback(
    (emoji: string, x: number, y: number) => {
      const rxId = `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setReactions((prev) => [
        ...prev.slice(-20),
        {
          id: rxId,
          x,
          y,
          emoji,
          userName: userRef.current.name,
          timestamp: Date.now(),
        },
      ]);
      sendMessage({
        type: 'reaction',
        id: rxId,
        emoji,
        x,
        y,
        userName: userRef.current.name,
      });
    },
    [sendMessage]
  );

  const sendWebRTCSignal = useCallback(
    (targetUserId: string, signal: unknown) => {
      const wsOpen = !!wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
      // Relay through exactly one channel so peers never process the same offer/answer twice
      if (!wsOpen) {
        publishMeshPacket(
          {
            type: 'webrtc-signal',
            fromUserId: userRef.current.id,
            targetUserId,
            signal,
          },
          targetUserId
        );
      }
      if (wsOpen && wsRef.current) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'webrtc-signal',
              fromUserId: userRef.current.id,
              targetUserId,
              signal,
              _senderId: userRef.current.id,
              _roomId: roomId,
            })
          );
        } catch {}
      }
    },
    [publishMeshPacket, roomId]
  );

  return {
    isConnected,
    syncedRoomName,
    roomSettings,
    roomsList,
    serverLimits,
    roomError,
    clearRoomError: () => setRoomError(null),
    currentUserRole,
    canEdit,
    canManage,
    elements,
    users,
    code,
    notes,
    files,
    chatMessages,
    pings,
    reactions,
    remoteLaserPoints,
    codeCursors,
    liveStrokes,
    sendLiveStroke,
    codeFiles,
    upsertCodeFile,
    deleteCodeFile,
    requestRoomsList,
    sendActivity,
    deleteRoom,
    updateRoomSettings,
    updateUserRole,
    kickUser,
    sendCursor,
    sendLaserPoint,
    createElement,
    updateElement,
    batchUpdateElements,
    deleteElements,
    replaceElements,
    clearElements,
    loadTemplate,
    updateCode,
    sendCodeCursor,
    updateNotes,
    sendChatMessage,
    uploadFile,
    deleteFile,
    updateVoiceState,
    sendPing,
    sendReaction,
    sendWebRTCSignal,
  };
}
