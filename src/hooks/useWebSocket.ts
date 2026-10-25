import { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasElement, ChatMessage, Point, SharedFile, UserPing, UserPresence, UserReaction } from '../types';
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
}

export function useWebSocket({ roomId, roomName, user, onWebRTCSignal }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [users, setUsers] = useState<UserPresence[]>([]);
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

  const pendingQueue = useRef<string[]>([]);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onWebRTCSignalRef = useRef(onWebRTCSignal);
  onWebRTCSignalRef.current = onWebRTCSignal;

  // Safe sender helper
  const sendMessage = useCallback((msg: object) => {
    const payload = JSON.stringify(msg);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    } else {
      pendingQueue.current.push(payload);
    }
  }, []);

  // Connect & reconnect logic
  useEffect(() => {
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

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
            user,
          })
        );

        // Flush any pending queue
        while (pendingQueue.current.length > 0) {
          const item = pendingQueue.current.shift();
          if (item) ws.send(item);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'init-room': {
              setElements(msg.elements || []);
              setCode(msg.code || { content: '', language: 'javascript', lastUpdatedBy: '' });
              setNotes(msg.notes || { content: '', lastUpdatedBy: '' });
              setFiles(msg.files || []);
              setChatMessages(msg.messages || []);
              setUsers(msg.users || []);
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

            case 'element-created': {
              setElements((prev) => {
                // Idempotent guard
                if (prev.some((el) => el.id === msg.element.id)) {
                  return prev.map((el) => (el.id === msg.element.id ? msg.element : el));
                }
                return [...prev, msg.element];
              });
              break;
            }

            case 'element-updated': {
              setElements((prev) =>
                prev.map((el) => (el.id === msg.id ? { ...el, ...msg.changes, updatedAt: Date.now() } : el))
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
              if (msg.message.userId !== user.id) {
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
        // Exponential reconnect
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, roomName, user]);

  // Clean up old pings and reactions periodically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setPings((prev) => prev.filter((p) => now - p.timestamp < 3600));
      setReactions((prev) => prev.filter((r) => now - r.timestamp < 2600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Public Actions
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

  const createElement = useCallback(
    (element: CanvasElement) => {
      // Optimistic update
      setElements((prev) => {
        if (prev.some((e) => e.id === element.id)) return prev;
        return [...prev, element];
      });
      sendMessage({
        type: 'element-create',
        element,
      });
    },
    [sendMessage]
  );

  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      // Optimistic update
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...changes, updatedAt: Date.now() } : el))
      );
      sendMessage({
        type: 'element-update',
        id,
        changes,
      });
    },
    [sendMessage]
  );

  const batchUpdateElements = useCallback(
    (updates: { id: string; changes: Partial<CanvasElement> }[]) => {
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
    [sendMessage]
  );

  const deleteElements = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      setElements((prev) => prev.filter((el) => !set.has(el.id)));
      sendMessage({
        type: 'element-delete',
        ids,
      });
    },
    [sendMessage]
  );

  const clearElements = useCallback(() => {
    setElements([]);
    sendMessage({
      type: 'elements-clear',
    });
  }, [sendMessage]);

  const loadTemplate = useCallback(
    (templateElements: CanvasElement[]) => {
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
    [sendMessage]
  );

  const updateCode = useCallback(
    (newContent: string, newLanguage?: string) => {
      setCode((prev) => ({
        content: newContent,
        language: newLanguage || prev.language,
        lastUpdatedBy: user.name,
      }));
      sendMessage({
        type: 'code-change',
        content: newContent,
        language: newLanguage || code.language,
        userName: user.name,
      });
    },
    [sendMessage, user.name, code.language]
  );

  const updateNotes = useCallback(
    (newContent: string) => {
      setNotes({
        content: newContent,
        lastUpdatedBy: user.name,
      });
      sendMessage({
        type: 'notes-change',
        content: newContent,
        userName: user.name,
      });
    },
    [sendMessage, user.name]
  );

  const sendChatMessage = useCallback(
    (text: string, fileAttachment?: { name: string; url: string }) => {
      sendMessage({
        type: 'chat-message',
        text,
        userName: user.name,
        userColor: user.color,
        fileAttachment,
      });
    },
    [sendMessage, user.name, user.color]
  );

  const uploadFile = useCallback(
    (fileData: { name: string; size: number; fileType: string; dataUrl: string }) => {
      sendMessage({
        type: 'file-upload',
        ...fileData,
        uploadedBy: user.name,
      });
    },
    [sendMessage, user.name]
  );

  const deleteFile = useCallback(
    (fileId: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      sendMessage({
        type: 'file-delete',
        fileId,
      });
    },
    [sendMessage]
  );

  const updateVoiceState = useCallback(
    (voiceState: { isMuted?: boolean; isDeafened?: boolean; isSpeaking?: boolean }) => {
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
        userName: user.name,
        userColor: user.color,
      });
    },
    [sendMessage, user.name, user.color]
  );

  const sendReaction = useCallback(
    (emoji: string, x: number, y: number) => {
      sendMessage({
        type: 'reaction',
        emoji,
        x,
        y,
        userName: user.name,
      });
    },
    [sendMessage, user.name]
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
    elements,
    users,
    code,
    notes,
    files,
    chatMessages,
    pings,
    reactions,
    sendCursor,
    createElement,
    updateElement,
    batchUpdateElements,
    deleteElements,
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
