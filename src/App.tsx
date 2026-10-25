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
import { RoomsModal } from './components/RoomsModal';
import { useFirebaseSync } from './hooks/useFirebaseSync';

export default function App() {
  // Derive or initialize room from URL query
  const getInitialRoomId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'ana-oda';
  };

  const [roomId, setRoomId] = useState<string>(getInitialRoomId);
  const [customRoomName, setCustomRoomName] = useState<string>('');
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

  // Update URL search param when roomId changes
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url.toString());
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
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

  // If user becomes a viewer, switch active tool to 'select' if currently on a drawing tool
  useEffect(() => {
    if (!canEdit && activeTool !== 'select' && activeTool !== 'pan' && activeTool !== 'laser') {
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

  // Selected element object
  const selectedElement = useMemo(() => {
    return elements.find((e) => e.id === selectedElementId) || null;
  }, [elements, selectedElementId]);

  // Duplicate Selected Element
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedElementId) return;
    const el = elements.find((e) => e.id === selectedElementId);
    if (!el) return;

    recordUndo();
    const cloned: CanvasElement = {
      ...el,
      id: `clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: el.x + 28,
      y: el.y + 28,
      points: el.points ? el.points.map((p) => ({ x: p.x + 28, y: p.y + 28 })) : undefined,
      isLocked: false,
      updatedAt: Date.now(),
    };
    createElement(cloned);
    setSelectedElementId(cloned.id);
  }, [selectedElementId, elements, recordUndo, createElement]);

  // Rotate & Mirror Selected Element
  const handleRotateBy = useCallback(
    (deltaDegrees: number) => {
      if (!selectedElementId || !selectedElement || selectedElement.isLocked) return;
      recordUndo();
      const nextAngle = (((selectedElement.rotation || 0) + deltaDegrees) % 360 + 360) % 360;
      updateElement(selectedElementId, { rotation: Math.round(nextAngle) });
    },
    [selectedElementId, selectedElement, recordUndo, updateElement]
  );

  const handleSetRotation = useCallback(
    (degrees: number) => {
      if (!selectedElementId || !selectedElement || selectedElement.isLocked) return;
      const nextAngle = ((degrees % 360) + 360) % 360;
      updateElement(selectedElementId, { rotation: Math.round(nextAngle) });
    },
    [selectedElementId, selectedElement, updateElement]
  );

  const handleFlipHorizontal = useCallback(() => {
    if (!selectedElementId || !selectedElement || selectedElement.isLocked) return;
    recordUndo();
    updateElement(selectedElementId, { flipX: !selectedElement.flipX });
  }, [selectedElementId, selectedElement, recordUndo, updateElement]);

  const handleFlipVertical = useCallback(() => {
    if (!selectedElementId || !selectedElement || selectedElement.isLocked) return;
    recordUndo();
    updateElement(selectedElementId, { flipY: !selectedElement.flipY });
  }, [selectedElementId, selectedElement, recordUndo, updateElement]);

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

      // Shift + H / Shift + V for Horizontal / Vertical Mirroring when an element is selected
      if (e.shiftKey && selectedElementId) {
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
      if (e.key === '[' && selectedElementId) {
        e.preventDefault();
        handleRotateBy(-15);
        return;
      }
      if (e.key === ']' && selectedElementId) {
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
          setSelectedElementId(null);
          break;
        case 'p':
          setActiveTool('pencil');
          setSelectedElementId(null);
          break;
        case 'e':
          setActiveTool('eraser');
          setSelectedElementId(null);
          break;
        case 'r':
          setActiveTool('rectangle');
          setSelectedElementId(null);
          break;
        case 'o':
          setActiveTool('circle');
          setSelectedElementId(null);
          break;
        case 'a':
          setActiveTool('arrow');
          setSelectedElementId(null);
          break;
        case 'l':
          setActiveTool('line');
          setSelectedElementId(null);
          break;
        case 'n':
          setActiveTool('sticky');
          setSelectedElementId(null);
          break;
        case 't':
          setActiveTool('text');
          setSelectedElementId(null);
          break;
        case 'k':
          setActiveTool('laser');
          setSelectedElementId(null);
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
    selectedElementId,
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
  };

  const handleClearElements = () => {
    recordUndo();
    clearElements();
    setSelectedElementId(null);
  };

  // Bring to front & send to back
  const handleBringForward = () => {
    if (!selectedElementId) return;
    const el = elements.find((e) => e.id === selectedElementId);
    if (!el) return;
    recordUndo();
    const reordered = [...elements.filter((e) => e.id !== selectedElementId), el];
    replaceElements(reordered);
  };

  const handleSendBackward = () => {
    if (!selectedElementId) return;
    const el = elements.find((e) => e.id === selectedElementId);
    if (!el) return;
    recordUndo();
    const reordered = [el, ...elements.filter((e) => e.id !== selectedElementId)];
    replaceElements(reordered);
  };

  // Toggle Lock
  const handleToggleLock = () => {
    if (!selectedElementId || !selectedElement) return;
    updateElement(selectedElementId, { isLocked: !selectedElement.isLocked });
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
    setSelectedElementId(imgEl.id);
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
            if (tool !== 'select') setSelectedElementId(null);
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
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            strokeStyle={strokeStyle}
            fontSize={fontSize}
            opacity={opacity}
            onChangeStrokeColor={(color) => {
              setStrokeColor(color);
              if (selectedElementId) updateElement(selectedElementId, { color });
            }}
            onChangeFillColor={(fc) => {
              setFillColor(fc);
              if (selectedElementId) updateElement(selectedElementId, { fillColor: fc });
            }}
            onChangeStrokeWidth={(w) => {
              setStrokeWidth(w);
              if (selectedElementId) updateElement(selectedElementId, { strokeWidth: w });
            }}
            onChangeStrokeStyle={(st) => {
              setStrokeStyle(st);
              if (selectedElementId) updateElement(selectedElementId, { strokeStyle: st });
            }}
            onChangeFontSize={(fs) => {
              setFontSize(fs);
              if (selectedElementId) updateElement(selectedElementId, { fontSize: fs });
            }}
            onChangeOpacity={(op) => {
              setOpacity(op);
              if (selectedElementId) updateElement(selectedElementId, { opacity: op });
            }}
            onRotateBy={handleRotateBy}
            onSetRotation={handleSetRotation}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onDuplicate={handleDuplicateSelected}
            onDelete={() => {
              if (selectedElementId) {
                handleDeleteElements([selectedElementId]);
                setSelectedElementId(null);
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
          onSaveHistorySnapshot={recordUndo}
          onCreateElement={handleCreateElement}
          onUpdateElement={handleUpdateElement}
          onBatchUpdateElements={batchUpdateElements}
          onDeleteElements={handleDeleteElements}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
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
          }}
          onClose={() => setIsAIPromptOpen(false)}
        />
      )}

      {/* Rooms, Permissions, Role System & Invite Modal */}
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
