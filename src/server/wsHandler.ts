import { WebSocket, WebSocketServer } from 'ws';
import { roomManager, MAX_USERS_PER_ROOM } from './roomManager';
import { CanvasElement, ChatMessage, SharedFile, UserPresence, UserRole } from './types';

export function setupWebSocketHandler(wss: WebSocketServer): void {
  roomManager.attachWebSocketServer(wss);

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
                rooms: roomManager.getRoomSummaries(),
                limits: roomManager.getServerLimits(),
              })
            );
            break;
          }

          case 'join-room': {
            const { roomId, roomName, user, maxUsers } = msg;
            if (!roomId || !user || !user.id) return;

            const { room, error } = roomManager.getOrCreateRoom(
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

            if (currentRoomId && currentRoomId !== roomId && currentUserId) {
              const prevRoom = roomManager.rooms.get(currentRoomId);
              if (prevRoom) {
                prevRoom.users.delete(currentUserId);
                roomManager.broadcastToRoom(currentRoomId, {
                  type: 'user-left',
                  userId: currentUserId,
                });
              }
            }

            currentRoomId = roomId;
            currentUserId = user.id;

            let assignedRole: UserRole = savedRole || room.settings.defaultRole;
            if (
              room.settings.ownerId === 'system' ||
              room.settings.ownerId === user.id ||
              room.users.size === 0
            ) {
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
                rooms: roomManager.getRoomSummaries(),
                limits: roomManager.getServerLimits(),
              })
            );

            roomManager.broadcastToRoom(
              roomId,
              {
                type: 'user-joined',
                user: presence,
              },
              user.id
            );

            roomManager.broadcastGlobalRoomsList();
            break;
          }

          case 'room-settings-update': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (!sender || !roomManager.canManageRoom(sender.presence.role)) {
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

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'room-settings-updated',
              roomName: room.name,
              settings: room.settings,
              updatedBy: sender.presence.name,
            });
            roomManager.broadcastGlobalRoomsList();
            break;
          }

          case 'user-role-update': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (!sender || !roomManager.canManageRoom(sender.presence.role)) return;

            const { targetUserId, newRole } = msg as { targetUserId: string; newRole: UserRole };
            if (!targetUserId || !['admin', 'editor', 'viewer'].includes(newRole)) return;

            const target = room.users.get(targetUserId);
            if (!target) return;

            if (target.presence.role === 'owner' && sender.presence.role !== 'owner') return;

            target.presence.role = newRole;
            room.roleAssignments.set(targetUserId, newRole);

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'user-role-updated',
              userId: targetUserId,
              role: newRole,
              updatedBy: sender.presence.name,
            });
            break;
          }

          case 'user-kick': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (!sender || !roomManager.canManageRoom(sender.presence.role)) return;

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
            roomManager.broadcastToRoom(currentRoomId, {
              type: 'user-left',
              userId: targetUserId,
            });
            roomManager.broadcastGlobalRoomsList();
            break;
          }

          case 'user-update': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
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

              roomManager.broadcastToRoom(currentRoomId, {
                type: 'user-updated',
                user: userObj.presence,
              });
              roomManager.broadcastGlobalRoomsList();
            }
            break;
          }

          case 'cursor-move': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const userObj = room.users.get(currentUserId);
            if (userObj) {
              userObj.presence.cursor = msg.cursor;
              userObj.presence.isDrawing = !!msg.isDrawing;
              userObj.presence.activeTool = msg.activeTool || userObj.presence.activeTool;

              roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;
            const userObj = room.users.get(currentUserId);

            roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            const element: CanvasElement = msg.element;
            if (!element || !element.id) return;

            if (!room.elements.has(element.id)) {
              room.elements.set(element.id, element);
              room.elementOrder.push(element.id);
            } else {
              room.elements.set(element.id, element);
            }

            roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            const { id, changes } = msg;
            const existing = room.elements.get(id);
            if (existing) {
              const updated = { ...existing, ...changes, updatedAt: Date.now() };
              room.elements.set(id, updated);

              roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

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

              roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            const { ids } = msg;
            if (Array.isArray(ids)) {
              for (const id of ids) {
                room.elements.delete(id);
                room.elementOrder = room.elementOrder.filter((elId) => elId !== id);
              }

              roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

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

              roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            if (Array.isArray(msg.elementOrder)) {
              room.elementOrder = msg.elementOrder.filter((id: string) => room.elements.has(id));
              const orderedElements = room.elementOrder
                .map((id) => room.elements.get(id))
                .filter((el): el is CanvasElement => el !== undefined);

              roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            room.elements.clear();
            room.elementOrder = [];

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'elements-cleared',
              clearedBy: currentUserId,
            });
            break;
          }

          case 'elements-load-template': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            const { elements } = msg;
            if (Array.isArray(elements)) {
              for (const el of elements) {
                room.elements.set(el.id, el);
                if (!room.elementOrder.includes(el.id)) {
                  room.elementOrder.push(el.id);
                }
              }

              roomManager.broadcastToRoom(currentRoomId, {
                type: 'elements-template-loaded',
                elements,
              });
            }
            break;
          }

          case 'code-change': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            room.code = {
              content: msg.content,
              language: msg.language || room.code.language,
              lastUpdatedBy: msg.userName || 'Kullanıcı',
            };

            roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            room.notes = {
              content: msg.content,
              lastUpdatedBy: msg.userName || 'Kullanıcı',
            };

            roomManager.broadcastToRoom(
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
            const room = roomManager.rooms.get(currentRoomId);
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

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'chat-received',
              message: chatMessage,
            });
            break;
          }

          case 'file-upload': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

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

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'file-added',
              file,
            });
            break;
          }

          case 'file-delete': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const sender = room.users.get(currentUserId);
            if (sender && !roomManager.canEditWorkspace(sender.presence.role)) return;

            const { fileId } = msg;
            room.files = room.files.filter((f) => f.id !== fileId);

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'file-deleted',
              fileId,
            });
            break;
          }

          case 'voice-state': {
            if (!currentRoomId || !currentUserId) return;
            const room = roomManager.rooms.get(currentRoomId);
            if (!room) return;

            const userObj = room.users.get(currentUserId);
            if (userObj) {
              if (msg.isMuted !== undefined) userObj.presence.isMuted = msg.isMuted;
              if (msg.isDeafened !== undefined) userObj.presence.isDeafened = msg.isDeafened;
              if (msg.isSpeaking !== undefined) userObj.presence.isSpeaking = msg.isSpeaking;

              roomManager.broadcastToRoom(currentRoomId, {
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
            roomManager.broadcastToRoom(currentRoomId, {
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
            roomManager.broadcastToRoom(currentRoomId, {
              type: 'reaction-received',
              x: msg.x,
              y: msg.y,
              emoji: msg.emoji,
              userName: msg.userName,
            });
            break;
          }

          case 'webrtc-signal': {
            if (!currentRoomId) return;
            const room = roomManager.rooms.get(currentRoomId);
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
        const room = roomManager.rooms.get(currentRoomId);
        if (room) {
          const existingUser = room.users.get(currentUserId);
          if (existingUser && existingUser.ws === ws) {
            room.users.delete(currentUserId);
            roomManager.broadcastToRoom(currentRoomId, {
              type: 'user-left',
              userId: currentUserId,
            });

            if (room.settings.ownerId === currentUserId && room.users.size > 0) {
              const nextEntry = room.users.entries().next().value;
              if (nextEntry) {
                const [nextUserId, nextUserObj] = nextEntry;
                room.settings.ownerId = nextUserId;
                room.ownerName = nextUserObj.presence.name;
                nextUserObj.presence.role = 'owner';
                room.roleAssignments.set(nextUserId, 'owner');
                roomManager.broadcastToRoom(currentRoomId, {
                  type: 'user-role-updated',
                  userId: nextUserId,
                  role: 'owner',
                  updatedBy: 'Sistem',
                });
                roomManager.broadcastToRoom(currentRoomId, {
                  type: 'room-settings-updated',
                  roomName: room.name,
                  settings: room.settings,
                  updatedBy: 'Sistem',
                });
              }
            }

            roomManager.broadcastGlobalRoomsList();
          }

          if (room.users.size === 0 && currentRoomId !== 'ana-oda') {
            const targetRoomId = currentRoomId;
            setTimeout(() => {
              const r = roomManager.rooms.get(targetRoomId);
              if (r && r.users.size === 0 && targetRoomId !== 'ana-oda') {
                roomManager.rooms.delete(targetRoomId);
                roomManager.broadcastGlobalRoomsList();
              }
            }, 30 * 60 * 1000);
          }
        }
      }
    });
  });
}
