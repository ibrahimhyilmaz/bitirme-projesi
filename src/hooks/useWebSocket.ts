import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  CanvasElement,
  ChatMessage,
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
} from '../types';
import { soundEffects } from '../utils/audio';

interface UseWebSocketOptions {
  roomId: string;
  roomName: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    color: string;
  };
  onWebRTCSignal?: (fromUserId: string, signal: unknown) => void;
  onKicked?: (roomId: string, roomName: string, by: string) => void;
}

export function useWebSocket({
  roomId,
  roomName,
  user,
  onWebRTCSignal,
  onKicked,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    isLocked: false,
    maxUsers: 12,
    defaultRole: 'editor',
    allowGuestDraw: true,
    ownerId: '',
  });
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

  const [code, setCode] = useState<{ content: string; language: string; lastUpdatedBy: string }>({
    content: '',
    language: 'javascript',
    lastUpdatedBy: '',
  });
  const [notes, setNotes] = useState<{ content: string; lastUpdatedBy: string }>({
    content: '',
    lastUpdatedBy: '',
  });
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pings, setPings] = useState<UserPing[]>([]);
  const [reactions, setReactions] = useState<UserReaction[]>([]);
  const [remoteLaserPoints, setRemoteLaserPoints] = useState<LaserStrokePoint[]>([]);

  const pendingQueue = useRef<string[]>([]);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const keepAliveIntervalRef = useRef<number | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const onWebRTCSignalRef = useRef(onWebRTCSignal);
  onWebRTCSignalRef.current = onWebRTCSignal;
  const onKickedRef = useRef(onKicked);
  onKickedRef.current = onKicked;

  // Safe sender helper
  const sendMessage = useCallback((msg: object) => {
    const payload = JSON.stringify(msg);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    } else {
      pendingQueue.current.push(payload);
    }
  }, []);

  // Sync user profile changes without dropping socket
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'user-update',
          user,
        })
      );
    }
  }, [user.name, user.color, user.avatar]);

  // Connect & reconnect logic per roomId
  useEffect(() => {
    let isCancelled = false;

    function resolveWsUrl(): string | null {
      try {
        const params = new URLSearchParams(window.location.search);
        const serverFromQuery = params.get('server');
        if (serverFromQuery && serverFromQuery.startsWith('ws')) {
          localStorage.setItem('collab_ws_server', serverFromQuery.trim());
          return serverFromQuery.trim();
        }
        const savedServer = localStorage.getItem('collab_ws_server');
        if (savedServer && savedServer.startsWith('ws')) {
          return savedServer.trim();
        }
      } catch {
        // Ignore storage error
      }

      const host = window.location.hostname;
      const isStaticHost =
        host.endsWith('.github.io') ||
        host.endsWith('.web.app') ||
        host.endsWith('.firebaseapp.com') ||
        host.endsWith('.pages.dev') ||
        host.endsWith('.netlify.app') ||
        host.endsWith('.vercel.app');

      if (isStaticHost) {
        // On static hosts without a custom WS backend URL, rely on Firebase Cloud Sync
        return null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }

    function connect() {
      if (isCancelled) return;

      const wsUrl = resolveWsUrl();
      if (!wsUrl) {
        setIsConnected(true);
        setUsers([
          {
            id: userRef.current.id,
            name: userRef.current.name,
            avatar: userRef.current.avatar,
            color: userRef.current.color,
            role: 'owner',
            cursor: { x: 0, y: 0 },
            isDrawing: false,
            activeTool: 'select',
            isMuted: true,
            isDeafened: false,
            isSpeaking: false,
            joinedAt: Date.now(),
          },
        ]);
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCancelled) return;
        setIsConnected(true);

        // Join the room
        ws.send(
          JSON.stringify({
            type: 'join-room',
            roomId,
            roomName,
            user: userRef.current,
          })
        );

        // Flush any pending queue
        while (pendingQueue.current.length > 0) {
          const item = pendingQueue.current.shift();
          if (item) ws.send(item);
        }

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
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'init-room': {
              setRoomError(null);
              setSyncedRoomName(msg.roomName || roomName);
              if (msg.settings) {
                setRoomSettings(msg.settings);
              }
              if (Array.isArray(msg.rooms)) {
                setRoomsList(msg.rooms);
              }
              if (msg.limits) {
                setServerLimits(msg.limits);
              }
              setElements(msg.elements || []);
              setCode(msg.code || { content: '', language: 'javascript', lastUpdatedBy: '' });
              setNotes(msg.notes || { content: '', lastUpdatedBy: '' });
              setFiles(msg.files || []);
              setChatMessages(msg.messages || []);
              setUsers(msg.users || []);
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

            case 'room-settings-updated': {
              if (msg.roomName) {
                setSyncedRoomName(msg.roomName);
              }
              if (msg.settings) {
                setRoomSettings(msg.settings);
              }
              break;
            }

            case 'room-error': {
              setRoomError({
                code: msg.code || 'ERROR',
                message: msg.message || 'Oda işlemi sırasında bir hata oluştu.',
                roomId: msg.roomId,
              });
              break;
            }

            case 'user-role-updated': {
              setUsers((prev) =>
                prev.map((u) => (u.id === msg.userId ? { ...u, role: msg.role } : u))
              );
              break;
            }

            case 'kicked-from-room': {
              if (onKickedRef.current) {
                onKickedRef.current(msg.roomId, msg.roomName, msg.by);
              }
              break;
            }

            case 'user-joined': {
              setUsers((prev) => {
                const filtered = prev.filter((u) => u.id !== msg.user.id);
                return [...filtered, msg.user];
              });
              soundEffects.playJoinSound();
              break;
            }

            case 'user-updated': {
              setUsers((prev) =>
                prev.map((u) => (u.id === msg.user.id ? { ...u, ...msg.user } : u))
              );
              break;
            }

            case 'user-left': {
              setUsers((prev) => prev.filter((u) => u.id !== msg.userId));
              break;
            }

            case 'cursor-moved': {
              setUsers((prev) =>
                prev.map((u) => {
                  if (u.id === msg.userId) {
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

            case 'laser-moved': {
              if (msg.point) {
                setRemoteLaserPoints((prev) => [
                  ...prev.slice(-60),
                  {
                    x: msg.point.x,
                    y: msg.point.y,
                    time: Date.now(),
                    userId: msg.userId,
                    color: msg.color || '#ef4444',
                  },
                ]);
              }
              break;
            }

            case 'element-created': {
              setElements((prev) => {
                if (prev.some((el) => el.id === msg.element.id)) {
                  return prev.map((el) => (el.id === msg.element.id ? msg.element : el));
                }
                return [...prev, msg.element];
              });
              break;
            }

            case 'element-updated': {
              setElements((prev) =>
                prev.map((el) =>
                  el.id === msg.id ? { ...el, ...msg.changes, updatedAt: Date.now() } : el
                )
              );
              break;
            }

            case 'elements-batch-updated': {
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

            case 'element-deleted': {
              const idSet = new Set(msg.ids);
              setElements((prev) => prev.filter((el) => !idSet.has(el.id)));
              break;
            }

            case 'elements-replaced': {
              if (Array.isArray(msg.elements)) {
                setElements(msg.elements);
              }
              break;
            }

            case 'elements-cleared': {
              setElements([]);
              break;
            }

            case 'elements-template-loaded': {
              setElements((prev) => {
                const existingMap = new Map(prev.map((el) => [el.id, el]));
                for (const el of msg.elements) {
                  existingMap.set(el.id, el);
                }
                return Array.from(existingMap.values());
              });
              break;
            }

            case 'code-updated': {
              setCode(msg.code);
              break;
            }

            case 'notes-updated': {
              setNotes(msg.notes);
              break;
            }

            case 'chat-received': {
              setChatMessages((prev) => [...prev, msg.message]);
              if (msg.message.userId !== userRef.current.id) {
                soundEffects.playMessageSound();
              }
              break;
            }

            case 'file-added': {
              setFiles((prev) => [...prev, msg.file]);
              break;
            }

            case 'file-deleted': {
              setFiles((prev) => prev.filter((f) => f.id !== msg.fileId));
              break;
            }

            case 'voice-state-updated': {
              setUsers((prev) =>
                prev.map((u) => {
                  if (u.id === msg.userId) {
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

            case 'ping-received': {
              const newPing: UserPing = {
                x: msg.x,
                y: msg.y,
                userName: msg.userName,
                userColor: msg.userColor,
                timestamp: Date.now(),
              };
              setPings((prev) => [...prev.slice(-10), newPing]);
              soundEffects.playPingSound();
              break;
            }

            case 'reaction-received': {
              const newReaction: UserReaction = {
                id: `rx-${Date.now()}-${Math.random()}`,
                x: msg.x,
                y: msg.y,
                emoji: msg.emoji,
                userName: msg.userName,
                timestamp: Date.now(),
              };
              setReactions((prev) => [...prev.slice(-20), newReaction]);
              break;
            }

            case 'webrtc-signal': {
              if (onWebRTCSignalRef.current) {
                onWebRTCSignalRef.current(msg.fromUserId, msg.signal);
              }
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('Socket message error:', err);
        }
      };

      ws.onclose = () => {
        if (isCancelled) return;
        setIsConnected(false);
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId]);

  // Clean up old pings, reactions, and remote laser points periodically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setPings((prev) => prev.filter((p) => now - p.timestamp < 3600));
      setReactions((prev) => prev.filter((r) => now - r.timestamp < 2600));
      setRemoteLaserPoints((prev) => prev.filter((lp) => now - lp.time < 1300));
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
  const requestRoomsList = useCallback(() => {
    sendMessage({ type: 'get-rooms' });
  }, [sendMessage]);

  const updateRoomSettings = useCallback(
    (changes: {
      isLocked?: boolean;
      maxUsers?: number;
      defaultRole?: 'editor' | 'viewer';
      roomName?: string;
    }) => {
      sendMessage({
        type: 'room-settings-update',
        changes,
      });
    },
    [sendMessage]
  );

  const updateUserRole = useCallback(
    (targetUserId: string, newRole: UserRole) => {
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
      sendMessage({
        type: 'user-kick',
        targetUserId,
      });
    },
    [sendMessage]
  );

  const sendCursor = useCallback(
    (cursor: Point, isDrawing: boolean, activeTool: string) => {
      sendMessage({
        type: 'cursor-move',
        cursor,
        isDrawing,
        activeTool,
      });
    },
    [sendMessage]
  );

  const sendLaserPoint = useCallback(
    (point: Point) => {
      sendMessage({
        type: 'laser-move',
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
      setCode((prev) => ({
        content: newContent,
        language: newLanguage || prev.language,
        lastUpdatedBy: userRef.current.name,
      }));
      sendMessage({
        type: 'code-change',
        content: newContent,
        language: newLanguage || code.language,
        userName: userRef.current.name,
      });
    },
    [sendMessage, code.language, canEdit]
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
    (text: string, fileAttachment?: { name: string; url: string }) => {
      sendMessage({
        type: 'chat-message',
        text,
        userName: userRef.current.name,
        userColor: userRef.current.color,
        fileAttachment,
      });
    },
    [sendMessage]
  );

  const uploadFile = useCallback(
    (fileData: { name: string; size: number; fileType: string; dataUrl: string }) => {
      if (!canEdit) return;
      sendMessage({
        type: 'file-upload',
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
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userRef.current.id
            ? {
                ...u,
                isMuted: voiceState.isMuted ?? u.isMuted,
                isDeafened: voiceState.isDeafened ?? u.isDeafened,
                isSpeaking: voiceState.isSpeaking ?? u.isSpeaking,
              }
            : u
        )
      );
      sendMessage({
        type: 'voice-state',
        ...voiceState,
      });
    },
    [sendMessage]
  );

  const sendPing = useCallback(
    (x: number, y: number) => {
      sendMessage({
        type: 'user-ping',
        x,
        y,
        userName: userRef.current.name,
        userColor: userRef.current.color,
      });
    },
    [sendMessage]
  );

  const sendReaction = useCallback(
    (emoji: string, x: number, y: number) => {
      sendMessage({
        type: 'reaction',
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
      sendMessage({
        type: 'webrtc-signal',
        targetUserId,
        signal,
      });
    },
    [sendMessage]
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
    requestRoomsList,
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
