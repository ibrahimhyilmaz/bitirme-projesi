import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { VoiceManager } from './utils/audio';
import { ToolType, Point, CanvasElement } from './types';
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

export default function App() {
  // Derive or initialize room from URL query
  const getInitialRoomId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'ana-oda';
  };

  const [roomId, setRoomId] = useState<string>(getInitialRoomId);
  const roomName = useMemo(() => {
    return roomId === 'ana-oda' ? 'Genel Çalışma Alanı' : `Oda #${roomId}`;
  }, [roomId]);

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

  const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(() => {
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
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Canvas Tools and Styling
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [strokeColor, setStrokeColor] = useState<string>('#0f172a');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
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
  } = useWebSocket({
    roomId,
    roomName,
    user: currentUser,
    onWebRTCSignal: (fromUserId, signal) => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.handleSignal(fromUserId, signal as { type: string });
      }
    },
  });

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

  // Connect WebRTC to newly joined peers
  useEffect(() => {
    if (!voiceManagerRef.current) return;
    for (const u of users) {
      if (u.id !== currentUser.id) {
        const isInitiator = currentUser.id < u.id;
        voiceManagerRef.current.connectToPeer(u.id, isInitiator);
      }
    }
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

  // Keyboard Shortcuts for Voice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (e.key === 'd' || e.key === 'D') {
        handleToggleDeafen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMute, handleToggleDeafen]);

  // Snapshot for Undo before modifying
  const recordUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), elements]);
    setRedoStack([]);
  }, [elements]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevElements = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, elements]);
    loadTemplate(prevElements);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextElements = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, elements]);
    loadTemplate(nextElements);
  };

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
    if (window.confirm('Tüm tahtayı temizlemek istediğinize emin misiniz?')) {
      recordUndo();
      clearElements();
      setSelectedElementId(null);
    }
  };

  // Duplicate Selected Element
  const handleDuplicateSelected = () => {
    if (!selectedElementId) return;
    const el = elements.find((e) => e.id === selectedElementId);
    if (!el) return;

    recordUndo();
    const cloned: CanvasElement = {
      ...el,
      id: `clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: el.x + 30,
      y: el.y + 30,
      updatedAt: Date.now(),
    };
    createElement(cloned);
    setSelectedElementId(cloned.id);
  };

  // Selected element object
  const selectedElement = useMemo(() => {
    return elements.find((e) => e.id === selectedElementId) || null;
  }, [elements, selectedElementId]);

  // Bring to front & send to back
  const handleBringForward = () => {
    if (!selectedElementId) return;
    const reordered = [...elements.filter((e) => e.id !== selectedElementId)];
    const el = elements.find((e) => e.id === selectedElementId);
    if (el) reordered.push(el);
    loadTemplate(reordered);
  };

  const handleSendBackward = () => {
    if (!selectedElementId) return;
    const reordered = [...elements.filter((e) => e.id !== selectedElementId)];
    const el = elements.find((e) => e.id === selectedElementId);
    if (el) reordered.unshift(el);
    loadTemplate(reordered);
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

  // Add Image from File vault directly to canvas center
  const handleAddImageToCanvas = (dataUrl: string) => {
    const canvasCenterX = (window.innerWidth / 2 - pan.x) / zoom - 150;
    const canvasCenterY = (window.innerHeight / 2 - pan.y) / zoom - 150;

    const imgEl: CanvasElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'image',
      x: canvasCenterX,
      y: canvasCenterY,
      width: 300,
      height: 240,
      imageUrl: dataUrl,
      createdBy: currentUser.name,
      updatedAt: Date.now(),
    };

    createElement(imgEl);
    setSelectedElementId(imgEl.id);
    setActivePanel('none');
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-50 select-none font-sans">
      {/* Top Bar Contract */}
      <TopNav
        roomName={roomName}
        roomId={roomId}
        isConnected={isConnected}
        users={users}
        currentUser={currentUser}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        isMuted={isMuted}
        isDeafened={isDeafened}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        unreadChatCount={unreadChatCount}
      />

      {/* Main Workspace Body */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Floating Toolbar */}
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

        {/* Contextual Style Bar (bottom center) */}
        <StyleBar
          selectedElement={selectedElement}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
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
          onChangeFontSize={(fs) => {
            setFontSize(fs);
            if (selectedElementId) updateElement(selectedElementId, { fontSize: fs });
          }}
          onChangeOpacity={(op) => {
            setOpacity(op);
            if (selectedElementId) updateElement(selectedElementId, { opacity: op });
          }}
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

        {/* High-Performance Collaborative Infinite Canvas */}
        <CanvasBoard
          elements={elements}
          users={users}
          currentUser={currentUser}
          activeTool={activeTool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          opacity={opacity}
          pings={pings}
          reactions={reactions}
          onCursorMove={sendCursor}
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
        />

        {/* Collaborative Code Editor Side Panel */}
        {activePanel === 'code' && (
          <CodeEditorPanel
            code={code}
            onUpdateCode={updateCode}
            onClose={() => setActivePanel('none')}
          />
        )}

        {/* Collaborative Notes Side Panel */}
        {activePanel === 'notes' && (
          <NotesPanel
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
            onAddImageToCanvas={handleAddImageToCanvas}
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

      {/* Templates Modal */}
      {isTemplatesOpen && (
        <TemplatesModal
          onLoadTemplate={(tplElements, mode) => {
            if (mode === 'replace') {
              recordUndo();
              clearElements();
              loadTemplate(tplElements);
            } else {
              recordUndo();
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
          roomName={roomName}
          onImportElements={(importedElements) => {
            recordUndo();
            loadTemplate(importedElements);
          }}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* User Onboarding Setup / Room Switcher */}
      {isInitialSetupOpen && (
        <UserSetupModal
          initialName={currentUser.name}
          initialColor={currentUser.color}
          initialRoomId={roomId}
          isInitialSetup={true}
          onJoin={(name, color, newRoomId) => {
            setCurrentUser((prev) => ({
              ...prev,
              name,
              color,
              avatar: name.charAt(0).toUpperCase(),
            }));
            setRoomId(newRoomId);
            setIsInitialSetupOpen(false);
          }}
        />
      )}
    </div>
  );
}
