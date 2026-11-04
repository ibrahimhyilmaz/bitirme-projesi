import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, X, DoorOpen } from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { VoiceManager } from './utils/audio';
import { ToolType, Point, CanvasElement, StrokeStyle } from './types';
import { TopNav } from './components/TopNav';
import { Toolbar } from './components/Toolbar';
import { StyleBar } from './components/StyleBar';
import { CanvasBoard } from './components/CanvasBoard';
import { VoiceChatBar } from './components/VoiceChatBar';
import { CodeEditorPanel } from './components/CodeEditorPanel';
import { NotesPanel } from './components/NotesPanel';
import { FileShareModal } from './components/FileShareModal';
import { ChatDrawer } from './components/ChatDrawer';
import { TemplatesModal } from './components/TemplatesModal';
import { ExportModal } from './components/ExportModal';
import { UserSetupModal } from './components/UserSetupModal';
import { AIPromptModal } from './components/AIPromptModal';
import { RoomsModal, decodeRoomSnapshot } from './components/RoomsModal';
import { useFirebaseSync } from './hooks/useFirebaseSync';

function extractRoomInfoFromLocation(): { roomId: string; roomName: string; snapshot?: string } {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    let roomId =
      searchParams.get('room') ||
      searchParams.get('r') ||
      searchParams.get('roomId') ||
      searchParams.get('board') ||
      searchParams.get('oda') ||
      '';
    let roomName = searchParams.get('rname') || searchParams.get('name') || '';
    let snapshot = searchParams.get('snap') || '';

    // If query string didn't contain room, check hash (common when links are routed or shared via chat apps)
    if (!roomId && window.location.hash) {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      const qIndex = rawHash.indexOf('?');
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(rawHash.slice(qIndex + 1));
        roomId =
          hashParams.get('room') ||
          hashParams.get('r') ||
          hashParams.get('roomId') ||
          hashParams.get('board') ||
          hashParams.get('oda') ||
          '';
        if (!roomName) roomName = hashParams.get('rname') || hashParams.get('name') || '';
        if (!snapshot) snapshot = hashParams.get('snap') || '';
      }
      if (!roomId && rawHash.includes('=')) {
        const hashParams = new URLSearchParams(rawHash);
        roomId =
          hashParams.get('room') ||
          hashParams.get('r') ||
          hashParams.get('roomId') ||
          hashParams.get('board') ||
          hashParams.get('oda') ||
          '';
        if (!roomName) roomName = hashParams.get('rname') || hashParams.get('name') || '';
        if (!snapshot) snapshot = hashParams.get('snap') || '';
      }
      if (!roomId) {
        const match = rawHash.match(/^(?:room|oda)\/([^/?#]+)/i);
        if (match) {
          roomId = match[1];
        }
      }
    }

    // Also check path, e.g. /room/xyz
    if (!roomId && window.location.pathname) {
      const match = window.location.pathname.match(/\/(?:room|oda)\/([^/?#]+)/i);
      if (match) {
        roomId = match[1];
      }
    }

    const cleanRoomId = roomId
      ? decodeURIComponent(roomId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
      : '';
    const cleanRoomName = roomName ? decodeURIComponent(roomName).trim() : '';

    return {
      roomId: cleanRoomId || 'ana-oda',
      roomName: cleanRoomName,
      snapshot: snapshot || undefined,
    };
  } catch {
    return { roomId: 'ana-oda', roomName: '' };
  }
}

export default function App() {
  const initialRoomInfo = useMemo(() => extractRoomInfoFromLocation(), []);
  const [roomId, setRoomId] = useState<string>(initialRoomInfo.roomId);
  const [customRoomName, setCustomRoomName] = useState<string>(initialRoomInfo.roomName);
  const fallbackRoomName = useMemo(() => {
    if (customRoomName.trim()) return customRoomName.trim();
    return roomId === 'ana-oda' ? 'Genel Çalışma Alanı' : `Oda #${roomId}`;
  }, [roomId, customRoomName]);

  // User Identity
  const [currentUser, setCurrentUser] = useState(() => {
    const savedName = localStorage.getItem('collab_username');
    const savedColor = localStorage.getItem('collab_usercolor');
    const randomId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const colors = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return {
      id: localStorage.getItem('collab_userid') || randomId,
      name: savedName || `Mimar ${Math.floor(Math.random() * 900 + 100)}`,
      avatar: (savedName || 'M').charAt(0).toUpperCase(),
      color: savedColor || randomColor,
    };
  });

  const [isUserSetupOpen, setIsUserSetupOpen] = useState(() => {
    return !localStorage.getItem('collab_username');
  });
  const [isInitialSetup, setIsInitialSetup] = useState(() => {
    return !localStorage.getItem('collab_username');
  });

  // Sync user profile to localStorage
  useEffect(() => {
    localStorage.setItem('collab_userid', currentUser.id);
    localStorage.setItem('collab_username', currentUser.name);
    localStorage.setItem('collab_usercolor', currentUser.color);
  }, [currentUser]);

  // Keep URL search param synced when roomId changes and listen to popstate/hashchange
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      if (customRoomName.trim()) {
        url.searchParams.set('rname', customRoomName.trim());
      } else {
        url.searchParams.delete('rname');
      }
      if (window.location.hash && (window.location.hash.includes('room=') || window.location.hash.includes('/room/'))) {
        url.hash = '';
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [roomId, customRoomName]);

  useEffect(() => {
    const handleLocationChange = () => {
      const info = extractRoomInfoFromLocation();
      if (info.roomId && info.roomId !== roomId) {
        setRoomId(info.roomId);
        if (info.roomName) {
          setCustomRoomName(info.roomName);
        }
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [roomId]);

  // Voice Chat State
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [localVolume, setLocalVolume] = useState<number>(0);
  const voiceManagerRef = useRef<VoiceManager | null>(null);

  // Panels and Modals
  const [activePanel, setActivePanel] = useState<'none' | 'code' | 'notes' | 'files' | 'chat'>('none');
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState<boolean>(false);
  const [isRoomsModalOpen, setIsRoomsModalOpen] = useState<boolean>(false);
  const [roomsModalTab, setRoomsModalTab] = useState<'rooms' | 'permissions' | 'invite'>('rooms');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Canvas Tools and Styling
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [strokeColor, setStrokeColor] = useState<string>('#0f172a');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [fontSize, setFontSize] = useState<number>(18);
  const [opacity, setOpacity] = useState<number>(1);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasElement[][]>([]);

  // WebSocket Connection
  const {
    isConnected,
    syncedRoomName,
    elements,
    users,
    code,
    notes,
    files,
    chatMessages,
    roomSettings,
    roomsList,
    serverLimits,
    roomError,
    clearRoomError,
    currentUserRole,
    canEdit,
    canManage,
    pings,
    reactions,
    remoteLaserPoints,
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
    requestRoomsList,
    updateRoomSettings,
    updateUserRole,
    kickUser,
    sendWebRTCSignal,
  } = useWebSocket({
    roomId,
    roomName: fallbackRoomName,
    user: currentUser,
    onWebRTCSignal: (fromUserId, signal) => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.handleSignal(fromUserId, signal as { type: string });
      }
    },
    onKicked: () => {
      if (roomId !== 'ana-oda') {
        setRoomId('ana-oda');
      }
    },
  });

  const effectiveRoomName = syncedRoomName || fallbackRoomName;

  // Firebase Cloud Firestore Persistence & Google Auth
  const {
    firebaseUser,
    isSyncingCloud,
    lastCloudSyncAt,
    signInWithGoogle,
    signOutFirebase,
    syncRoomToCloud,
  } = useFirebaseSync({
    roomId,
    roomName: effectiveRoomName,
    roomSettings,
    code,
    notes,
    elements,
    onCloudStateLoaded: useCallback(
      (cloudData) => {
        if (cloudData.codeContent) {
          updateCode(cloudData.codeContent, cloudData.codeLanguage);
        }
        if (cloudData.notesContent) {
          updateNotes(cloudData.notesContent);
        }
        if (cloudData.elements && cloudData.elements.length > 0) {
          loadTemplate(cloudData.elements);
        }
      },
      [updateCode, updateNotes, loadTemplate]
    ),
  });

  // Restore embedded snapshot from invite URL (?snap=...) if present on initial load
  const appliedUrlSnapRef = useRef(false);
  useEffect(() => {
    if (appliedUrlSnapRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const snapParam = params.get('snap');
    if (!snapParam) return;
    appliedUrlSnapRef.current = true;
    const decoded = decodeRoomSnapshot(snapParam);
    if (decoded) {
      if (decoded.elements && decoded.elements.length > 0) {
        loadTemplate(decoded.elements);
      }
      if (decoded.codeContent) {
        updateCode(decoded.codeContent, decoded.codeLanguage);
      }
    }
  }, [loadTemplate, updateCode]);

  // If user becomes a viewer, switch active tool to 'select' if currently on a drawing tool
  useEffect(() => {
    if (
      !canEdit &&
      activeTool !== 'select' &&
      activeTool !== 'pan' &&
      activeTool !== 'laser' &&
      activeTool !== 'ping'
    ) {
      setActiveTool('select');
    }
  }, [canEdit, activeTool]);

  // Track unread chat messages when chat drawer is closed
  const prevChatCountRef = useRef(chatMessages.length);
  useEffect(() => {
    if (activePanel !== 'chat' && chatMessages.length > prevChatCountRef.current) {
      setUnreadChatCount((prev) => prev + (chatMessages.length - prevChatCountRef.current));
    }
    prevChatCountRef.current = chatMessages.length;
  }, [chatMessages, activePanel]);

  // Initialize Voice Manager
  useEffect(() => {
    const vm = new VoiceManager(
      (isSpeaking, volume) => {
        setLocalVolume(volume);
        updateVoiceState({ isSpeaking });
      },
      (targetUserId, signal) => {
        sendWebRTCSignal(targetUserId, signal);
      }
    );

    voiceManagerRef.current = vm;
    vm.initLocalMicrophone();

    return () => {
      vm.cleanup();
    };
  }, [updateVoiceState, sendWebRTCSignal]);

  // Sync WebRTC peers when room user list changes
  useEffect(() => {
    if (!voiceManagerRef.current) return;
    const activeIds = users.map((u) => u.id);
    voiceManagerRef.current.syncPeers(activeIds, currentUser.id);
  }, [users, currentUser.id]);

  // Voice Toggles
  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setMuted(nextMuted);
    }
    updateVoiceState({ isMuted: nextMuted });
  }, [isMuted, updateVoiceState]);

  const handleToggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setDeafened(nextDeafened);
    }
    updateVoiceState({ isDeafened: nextDeafened });
  }, [isDeafened, updateVoiceState]);

  // Voice volume per peer
  const handleGetUserVolume = (userId: string) => {
    return voiceManagerRef.current?.getUserVolume(userId) ?? 100;
  };

  const handleSetUserVolume = (userId: string, volume: number) => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setUserVolume(userId, volume);
    }
  };

  // Snapshot for Undo before modifying
  const recordUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), elements]);
    setRedoStack([]);
  }, [elements]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevElements = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, elements]);
    replaceElements(prevElements);
  }, [undoStack, elements, replaceElements]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextElements = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, elements]);
    replaceElements(nextElements);
  }, [redoStack, elements, replaceElements]);

  // Selected element objects
  const selectedElements = useMemo(() => {
    return elements.filter((e) => selectedElementIds.includes(e.id));
  }, [elements, selectedElementIds]);

  const selectedElement = useMemo(() => {
    return selectedElements.length > 0 ? selectedElements[0] : null;
  }, [selectedElements]);

  const selectedElementId = useMemo(() => {
    return selectedElement ? selectedElement.id : null;
  }, [selectedElement]);

  const handleSelectElement = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedElementIds([]);
    } else {
      setSelectedElementIds([id]);
    }
  }, []);

  const handleSelectElements = useCallback((ids: string[]) => {
    setSelectedElementIds(ids);
  }, []);

  // Duplicate Selected Elements
  const handleDuplicateSelected = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    const toClone = elements.filter((e) => selectedElementIds.includes(e.id));
    if (toClone.length === 0) return;

    recordUndo();
    const newIds: string[] = [];
    toClone.forEach((el, index) => {
      const cloned: CanvasElement = {
        ...el,
        id: `clone-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        x: el.x + 28,
        y: el.y + 28,
        points: el.points ? el.points.map((p) => ({ x: p.x + 28, y: p.y + 28 })) : undefined,
        isLocked: false,
        updatedAt: Date.now(),
      };
      createElement(cloned);
      newIds.push(cloned.id);
    });
    setSelectedElementIds(newIds);
  }, [selectedElementIds, elements, recordUndo, createElement]);

  // Rotate & Mirror Selected Elements
  const handleRotateBy = useCallback(
    (deltaDegrees: number) => {
      if (selectedElementIds.length === 0) return;
      recordUndo();
      const updates = elements
        .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
        .map((el) => {
          const nextAngle = (((el.rotation || 0) + deltaDegrees) % 360 + 360) % 360;
          return { id: el.id, changes: { rotation: Math.round(nextAngle) } };
        });
      if (updates.length > 0) {
        batchUpdateElements(updates);
      }
    },
    [selectedElementIds, elements, recordUndo, batchUpdateElements]
  );

  const handleSetRotation = useCallback(
    (degrees: number) => {
      if (selectedElementIds.length === 0) return;
      const nextAngle = ((degrees % 360) + 360) % 360;
      const updates = elements
        .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
        .map((el) => ({ id: el.id, changes: { rotation: Math.round(nextAngle) } }));
      if (updates.length > 0) {
        batchUpdateElements(updates);
      }
    },
    [selectedElementIds, elements, batchUpdateElements]
  );

  const handleFlipHorizontal = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const updates = elements
      .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
      .map((el) => ({ id: el.id, changes: { flipX: !el.flipX } }));
    if (updates.length > 0) {
      batchUpdateElements(updates);
    }
  }, [selectedElementIds, elements, recordUndo, batchUpdateElements]);

  const handleFlipVertical = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const updates = elements
      .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
      .map((el) => ({ id: el.id, changes: { flipY: !el.flipY } }));
    if (updates.length > 0) {
      batchUpdateElements(updates);
    }
  }, [selectedElementIds, elements, recordUndo, batchUpdateElements]);

  // Global Keyboard Shortcuts (Tools, Voice, Undo/Redo, Duplicate, Rotate, Flip)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Delete / Backspace for selected elements
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          recordUndo();
          deleteElements(selectedElementIds);
          setSelectedElementIds([]);
          return;
        }
      }

      // Ctrl/Cmd Shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          handleDuplicateSelected();
          return;
        }
        return;
      }

      // Shift + H / Shift + V for Horizontal / Vertical Mirroring when elements are selected
      if (e.shiftKey && selectedElementIds.length > 0) {
        if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          handleFlipHorizontal();
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          handleFlipVertical();
          return;
        }
      }

      // [ and ] for quick rotation
      if (e.key === '[' && selectedElementIds.length > 0) {
        e.preventDefault();
        handleRotateBy(-15);
        return;
      }
      if (e.key === ']' && selectedElementIds.length > 0) {
        e.preventDefault();
        handleRotateBy(15);
        return;
      }

      // Single-key tool & voice shortcuts
      switch (e.key.toLowerCase()) {
        case 'm':
          handleToggleMute();
          break;
        case 'd':
          handleToggleDeafen();
          break;
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('pan');
          setSelectedElementIds([]);
          break;
        case 'p':
          setActiveTool('pencil');
          setSelectedElementIds([]);
          break;
        case 'e':
          if (e.shiftKey) {
            setActiveTool('point-eraser');
            try {
              localStorage.setItem('collab_last_eraser', 'point-eraser');
            } catch {}
          } else {
            const savedEraser = (localStorage.getItem('collab_last_eraser') as ToolType) || 'eraser';
            setActiveTool(savedEraser === 'point-eraser' ? 'point-eraser' : 'eraser');
          }
          setSelectedElementIds([]);
          break;
        case 'r':
          setActiveTool('rectangle');
          setSelectedElementIds([]);
          break;
        case 'o':
          setActiveTool('circle');
          setSelectedElementIds([]);
          break;
        case 'a':
          setActiveTool('arrow');
          setSelectedElementIds([]);
          break;
        case 'l':
          setActiveTool('line');
          setSelectedElementIds([]);
          break;
        case 'n':
          setActiveTool('sticky');
          setSelectedElementIds([]);
          break;
        case 't':
          setActiveTool('text');
          setSelectedElementIds([]);
          break;
        case 'k':
          setActiveTool('laser');
          setSelectedElementIds([]);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleToggleMute,
    handleToggleDeafen,
    handleUndo,
    handleRedo,
    handleDuplicateSelected,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotateBy,
    selectedElementIds,
    recordUndo,
    deleteElements,
  ]);

  // Element Actions
  const handleCreateElement = (el: CanvasElement) => {
    recordUndo();
    createElement(el);
  };

  const handleUpdateElement = (id: string, changes: Partial<CanvasElement>) => {
    updateElement(id, changes);
  };

  const handleDeleteElements = (ids: string[]) => {
    recordUndo();
    deleteElements(ids);
    setSelectedElementIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleClearElements = () => {
    recordUndo();
    clearElements();
    setSelectedElementIds([]);
  };

  // Bring to front & send to back
  const handleBringForward = () => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const toBring = elements.filter((e) => selectedElementIds.includes(e.id));
    const remaining = elements.filter((e) => !selectedElementIds.includes(e.id));
    replaceElements([...remaining, ...toBring]);
  };

  const handleSendBackward = () => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const toSend = elements.filter((e) => selectedElementIds.includes(e.id));
    const remaining = elements.filter((e) => !selectedElementIds.includes(e.id));
    replaceElements([...toSend, ...remaining]);
  };

  // Toggle Lock
  const handleToggleLock = () => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const anyUnlocked = elements.some((el) => selectedElementIds.includes(el.id) && !el.isLocked);
    const updates = elements
      .filter((el) => selectedElementIds.includes(el.id))
      .map((el) => ({ id: el.id, changes: { isLocked: anyUnlocked } }));
    if (updates.length > 0) {
      batchUpdateElements(updates);
    }
  };

  // Send Ping at center screen
  const handlePingCenter = () => {
    const canvasCenterX = (window.innerWidth / 2 - pan.x) / zoom;
    const canvasCenterY = (window.innerHeight / 2 - pan.y) / zoom;
    sendPing(canvasCenterX, canvasCenterY);
  };

  // Panel Toggle
  const handleTogglePanel = (panel: 'code' | 'notes' | 'files' | 'chat') => {
    if (panel === 'chat') {
      setUnreadChatCount(0);
    }
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  // Add Image from File vault or Toolbar directly to canvas center
  const handleAddImageToCanvas = (dataUrl: string, width = 300, height = 240) => {
    const canvasCenterX = (window.innerWidth / 2 - pan.x) / zoom - width / 2;
    const canvasCenterY = (window.innerHeight / 2 - pan.y) / zoom - height / 2;

    recordUndo();
    const imgEl: CanvasElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'image',
      x: canvasCenterX,
      y: canvasCenterY,
      width,
      height,
      imageUrl: dataUrl,
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: currentUser.name,
      updatedAt: Date.now(),
    };

    createElement(imgEl);
    setSelectedElementIds([imgEl.id]);
    setActiveTool('select');
    if (activePanel === 'files') {
      setActivePanel('none');
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-50 select-none font-sans">
      {/* Top Bar Contract */}
      <TopNav
        roomName={effectiveRoomName}
        roomId={roomId}
        roomSettings={roomSettings}
        currentUserRole={currentUserRole}
        isConnected={isConnected}
        users={users}
        currentUser={currentUser}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenAIPrompt={() => setIsAIPromptOpen(true)}
        onOpenRoomsModal={(tab) => {
          setRoomsModalTab(tab || 'rooms');
          setIsRoomsModalOpen(true);
        }}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenUserSetup={() => {
          setIsInitialSetup(false);
          setIsUserSetupOpen(true);
        }}
        isMuted={isMuted}
        isDeafened={isDeafened}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        unreadChatCount={unreadChatCount}
      />

      {/* Room Error / Capacity / Lock Banner */}
      {roomError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-900 z-30">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{roomError.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setRoomsModalTab('rooms');
                setIsRoomsModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white font-semibold rounded-md hover:bg-amber-700 transition-colors"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>Başka Odaya Geç</span>
            </button>
            <button
              onClick={clearRoomError}
              className="p-1 rounded hover:bg-amber-200/60 text-amber-700"
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Draggable Floating Toolbar */}
        <Toolbar
          activeTool={activeTool}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            if (tool !== 'select') setSelectedElementIds([]);
          }}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClearElements}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(3, z * 1.15))}
          onZoomOut={() => setZoom((z) => Math.max(0.2, z * 0.85))}
          onResetZoom={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          onPingClick={handlePingCenter}
          onAddImageFile={(dataUrl, w, h) => handleAddImageToCanvas(dataUrl, w, h)}
          onOpenAIPrompt={() => setIsAIPromptOpen(true)}
          canEdit={canEdit}
        />

        {/* Floating Voice Indicator & Channel Bar */}
        <VoiceChatBar
          users={users}
          currentUser={currentUser}
          isMuted={isMuted}
          isDeafened={isDeafened}
          localVolume={localVolume}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          getUserVolume={handleGetUserVolume}
          onSetUserVolume={handleSetUserVolume}
        />

        {/* Contextual Style & Transform Bar (Draggable, Bottom Center by default) */}
        {canEdit && (
          <StyleBar
            selectedElement={selectedElement}
            selectedElements={selectedElements}
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            strokeStyle={strokeStyle}
            fontSize={fontSize}
            opacity={opacity}
            onChangeStrokeColor={(color) => {
              setStrokeColor(color);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { color } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeFillColor={(fc) => {
              setFillColor(fc);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { fillColor: fc } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeStrokeWidth={(w) => {
              setStrokeWidth(w);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { strokeWidth: w } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeStrokeStyle={(st) => {
              setStrokeStyle(st);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { strokeStyle: st } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeFontSize={(fs) => {
              setFontSize(fs);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { fontSize: fs } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeOpacity={(op) => {
              setOpacity(op);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { opacity: op } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onRotateBy={handleRotateBy}
            onSetRotation={handleSetRotation}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onDuplicate={handleDuplicateSelected}
            onDelete={() => {
              if (selectedElementIds.length > 0) {
                handleDeleteElements(selectedElementIds);
                setSelectedElementIds([]);
              }
            }}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onToggleLock={handleToggleLock}
          />
        )}

        {/* High-Performance Collaborative Infinite Canvas */}
        <CanvasBoard
          elements={elements}
          users={users}
          currentUser={currentUser}
          activeTool={activeTool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
          strokeStyle={strokeStyle}
          fontSize={fontSize}
          opacity={opacity}
          pings={pings}
          reactions={reactions}
          remoteLaserPoints={remoteLaserPoints}
          onCursorMove={sendCursor}
          onLaserMove={sendLaserPoint}
          onPing={(pt) => sendPing(pt.x, pt.y)}
          onSaveHistorySnapshot={recordUndo}
          onCreateElement={handleCreateElement}
          onUpdateElement={handleUpdateElement}
          onBatchUpdateElements={batchUpdateElements}
          onDeleteElements={handleDeleteElements}
          selectedElementId={selectedElementId}
          selectedElementIds={selectedElementIds}
          onSelectElement={handleSelectElement}
          onSelectElements={handleSelectElements}
          onSelectTool={setActiveTool}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
          canEdit={canEdit}
        />

        {/* Collaborative Code Editor Side Panel (Room-Scoped) */}
        {activePanel === 'code' && (
          <CodeEditorPanel
            roomName={effectiveRoomName}
            roomId={roomId}
            canEdit={canEdit}
            code={code}
            onUpdateCode={updateCode}
            onClose={() => setActivePanel('none')}
          />
        )}

        {/* Collaborative Notes Side Panel (Room-Scoped) */}
        {activePanel === 'notes' && (
          <NotesPanel
            roomName={effectiveRoomName}
            canEdit={canEdit}
            notes={notes}
            onUpdateNotes={updateNotes}
            onClose={() => setActivePanel('none')}
          />
        )}

        {/* File Vault Modal / Drawer */}
        {activePanel === 'files' && (
          <FileShareModal
            files={files}
            onUploadFile={uploadFile}
            onDeleteFile={deleteFile}
            onAddImageToCanvas={(dataUrl) => handleAddImageToCanvas(dataUrl)}
            onClose={() => setActivePanel('none')}
          />
        )}

        {/* Real-Time Chat Drawer */}
        {activePanel === 'chat' && (
          <ChatDrawer
            messages={chatMessages}
            currentUserId={currentUser.id}
            onSendMessage={sendChatMessage}
            onSendReaction={(emoji) => {
              const canvasCenterX = (window.innerWidth / 2 - pan.x) / zoom;
              const canvasCenterY = (window.innerHeight / 2 - pan.y) / zoom;
              sendReaction(emoji, canvasCenterX, canvasCenterY);
            }}
            onClose={() => setActivePanel('none')}
          />
        )}
      </div>

      {/* AI Prompt Instant Canvas Generator Modal */}
      {isAIPromptOpen && (
        <AIPromptModal
          centerX={Math.round((window.innerWidth / 2 - pan.x) / zoom)}
          centerY={Math.round((window.innerHeight / 2 - pan.y) / zoom)}
          authorName={currentUser.name}
          onElementsGenerated={(aiElements) => {
            recordUndo();
            loadTemplate(aiElements);
            if (aiElements.length > 0) {
              setSelectedElementIds([aiElements[0].id]);
              setActiveTool('select');
            }
          }}
          onClose={() => setIsAIPromptOpen(false)}
        />
      )}

      {/* Rooms, Permissions, Role System, QR Code & Invite Modal */}
      {isRoomsModalOpen && (
        <RoomsModal
          currentRoomId={roomId}
          currentRoomName={effectiveRoomName}
          roomSettings={roomSettings}
          roomsList={roomsList}
          serverLimits={serverLimits}
          users={users}
          currentUserId={currentUser.id}
          currentUserRole={currentUserRole}
          canManage={canManage}
          initialTab={roomsModalTab}
          elements={elements}
          code={code}
          firebaseUserEmail={firebaseUser?.email}
          isSyncingCloud={isSyncingCloud}
          lastCloudSyncAt={lastCloudSyncAt}
          onSignInGoogle={async () => {
            const u = await signInWithGoogle();
            if (u && u.displayName) {
              setCurrentUser((prev) => ({
                ...prev,
                name: u.displayName || prev.name,
                avatar: (u.displayName || prev.name).charAt(0).toUpperCase(),
              }));
            }
          }}
          onSignOutFirebase={signOutFirebase}
          onSyncToCloud={() => {
            syncRoomToCloud();
          }}
          onAddQrToCanvas={(qrDataUrl) => {
            handleAddImageToCanvas(qrDataUrl, 220, 220);
          }}
          onRefreshRooms={requestRoomsList}
          onSelectRoom={(targetRoomId, targetRoomName) => {
            clearRoomError();
            if (targetRoomName) setCustomRoomName(targetRoomName);
            setRoomId(targetRoomId);
          }}
          onUpdateRoomSettings={updateRoomSettings}
          onUpdateUserRole={updateUserRole}
          onKickUser={kickUser}
          onClose={() => setIsRoomsModalOpen(false)}
        />
      )}

      {/* Templates Modal */}
      {isTemplatesOpen && (
        <TemplatesModal
          onLoadTemplate={(tplElements, mode) => {
            recordUndo();
            if (mode === 'replace') {
              replaceElements(tplElements);
            } else {
              loadTemplate(tplElements);
            }
          }}
          onClose={() => setIsTemplatesOpen(false)}
        />
      )}

      {/* Export / Backup Modal */}
      {isExportOpen && (
        <ExportModal
          elements={elements}
          roomName={effectiveRoomName}
          onImportElements={(importedElements) => {
            recordUndo();
            loadTemplate(importedElements);
          }}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* User Onboarding Setup / Room Switcher */}
      {isUserSetupOpen && (
        <UserSetupModal
          initialName={currentUser.name}
          initialColor={currentUser.color}
          initialRoomId={roomId}
          isInitialSetup={isInitialSetup}
          onClose={!isInitialSetup ? () => setIsUserSetupOpen(false) : undefined}
          onJoin={(name, color, newRoomId) => {
            setCurrentUser((prev) => ({
              ...prev,
              name,
              color,
              avatar: name.charAt(0).toUpperCase(),
            }));
            setRoomId(newRoomId);
            setIsUserSetupOpen(false);
            setIsInitialSetup(false);
          }}
        />
      )}
    </div>
  );
}
