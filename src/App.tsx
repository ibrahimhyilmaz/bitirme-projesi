import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, X, DoorOpen } from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { VoiceManager } from './utils/audio';
import {
  ToolType,
  Point,
  CanvasElement,
  StrokeStyle,
  AppSettings,
  ThemeMode,
  EditorSettings,
  DEFAULT_EDITOR_SETTINGS,
} from './types';
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
import { UserSetupModal, generateRoomCodeSeed, RoomJoinPayload } from './components/UserSetupModal';
import { AIPromptModal } from './components/AIPromptModal';
import { RoomsModal, decodeRoomSnapshot } from './components/RoomsModal';
import { OnboardingTour } from './components/OnboardingTour';
import { SettingsModal } from './components/SettingsModal';
import { ClockWidget } from './components/ClockWidget';
import { FolderWidget } from './components/FolderWidget';
import { getLanguage, translate, useI18n } from './i18n';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { getPdfInfo, renderPdfPage } from './utils/pdfRenderer';

function extractRoomInfoFromLocation(): {
  roomId: string;
  roomName: string;
  hasUrlRoomParam: boolean;
  snapshot?: string;
} {
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
      roomId: cleanRoomId || generateRoomCodeSeed(5).toLowerCase(),
      roomName: cleanRoomName,
      hasUrlRoomParam: Boolean(cleanRoomId),
      snapshot: snapshot || undefined,
    };
  } catch {
    return {
      roomId: generateRoomCodeSeed(5).toLowerCase(),
      roomName: '',
      hasUrlRoomParam: false,
    };
  }
}

const SESSION_KEY = 'collab_session_v1';
const SESSION_IDLE_MS = 60 * 60 * 1000;

interface SavedSession {
  roomId: string;
  roomName: string;
  maxUsers?: number;
  wasOwner: boolean;
  lastActivityAt: number;
}

function readSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      typeof p.roomId === 'string' &&
      /^[a-z0-9_-]{1,32}$/.test(p.roomId) &&
      typeof p.lastActivityAt === 'number'
    ) {
      return {
        roomId: p.roomId,
        roomName: typeof p.roomName === 'string' ? p.roomName : '',
        maxUsers: typeof p.maxUsers === 'number' ? p.maxUsers : undefined,
        wasOwner: Boolean(p.wasOwner),
        lastActivityAt: p.lastActivityAt,
      };
    }
  } catch {}
  return null;
}

function writeSavedSession(session: SavedSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function clearSavedSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export default function App() {
  const { t } = useI18n();
  const initialRoomInfo = useMemo(() => extractRoomInfoFromLocation(), []);

  // Restore the previous workspace after a page refresh (unless it was idle for over an hour,
  // or the URL explicitly points to a different room).
  const sessionBootstrap = useMemo(() => {
    const saved = readSavedSession();
    const hasName = Boolean(localStorage.getItem('collab_username'));
    if (!saved) return { session: null as SavedSession | null, expired: false };
    const urlConflict = initialRoomInfo.hasUrlRoomParam && initialRoomInfo.roomId !== saved.roomId;
    if (urlConflict || !hasName) return { session: null, expired: false };
    if (Date.now() - saved.lastActivityAt >= SESSION_IDLE_MS) {
      clearSavedSession();
      return { session: null, expired: true };
    }
    return { session: saved, expired: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const savedSession = sessionBootstrap.session;
  const [roomId, setRoomId] = useState<string>(savedSession?.roomId ?? initialRoomInfo.roomId);
  const [customRoomName, setCustomRoomName] = useState<string>(
    savedSession ? savedSession.roomName : initialRoomInfo.roomName
  );
  const [customMaxUsers, setCustomMaxUsers] = useState<number | undefined>(savedSession?.maxUsers);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [restoreRoom, setRestoreRoom] = useState<boolean>(Boolean(savedSession?.wasOwner));
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState<boolean>(Boolean(savedSession));
  const [joinGateError, setJoinGateError] = useState<string | null>(
    sessionBootstrap.expired ? translate(getLanguage(), 'session.timeout') : null
  );
  const lastActivityRef = useRef<number>(savedSession?.lastActivityAt ?? Date.now());
  const lastValidRoomRef = useRef<{
    roomId: string;
    roomName: string;
    maxUsers?: number;
  } | null>(null);

  const fallbackRoomName = useMemo(() => {
    const clean = customRoomName
      .trim()
      .replace(/\s*\(#[A-Za-z0-9_-]{3,10}\)\s*$/g, '')
      .replace(/\s+#[A-Za-z0-9_-]{3,10}\s*$/g, '')
      .trim();
    if (clean) return clean;
    return roomId === 'ana-oda' ? 'Genel Çalışma Alanı' : 'Çalışma Alanı';
  }, [roomId, customRoomName]);

  // User Identity (Unique per browser tab via sessionStorage so multi-tab testing enforces maxUsers accurately)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (localStorage.getItem('collab_google_fallback_user')) {
        localStorage.removeItem('collab_google_fallback_user');
        if (localStorage.getItem('collab_username') === 'Ahmet Yılmaz') {
          localStorage.removeItem('collab_username');
        }
      }
    } catch {}
    const savedName = localStorage.getItem('collab_username');
    const savedColor = localStorage.getItem('collab_usercolor');
    const colors = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    let sessionUserId = '';
    try {
      sessionUserId = sessionStorage.getItem('collab_tab_userid') || '';
      if (!sessionUserId) {
        sessionUserId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        sessionStorage.setItem('collab_tab_userid', sessionUserId);
      }
    } catch {
      sessionUserId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    }

    return {
      id: sessionUserId,
      name: savedName || '',
      avatar: (savedName || 'M').charAt(0).toUpperCase(),
      color: savedColor || randomColor,
    };
  });

  const [isUserSetupOpen, setIsUserSetupOpen] = useState<boolean>(!savedSession);
  const [isInitialSetup, setIsInitialSetup] = useState<boolean>(!savedSession);

  // Sync user profile to localStorage
  useEffect(() => {
    if (currentUser.name) {
      localStorage.setItem('collab_username', currentUser.name);
    }
    localStorage.setItem('collab_usercolor', currentUser.color);
  }, [currentUser]);

  // Keep URL search param synced when roomId changes (only after entering workspace)
  useEffect(() => {
    if (!hasEnteredWorkspace) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId.toUpperCase());
      if (customRoomName.trim()) {
        url.searchParams.set('rname', customRoomName.trim());
      } else {
        url.searchParams.delete('rname');
      }
      if (
        window.location.hash &&
        (window.location.hash.includes('room=') || window.location.hash.includes('/room/'))
      ) {
        url.hash = '';
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [roomId, customRoomName, hasEnteredWorkspace]);

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
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // Workspace Widget Visibility & Layout States (Synced across TopNav Kutucuklar, Toolbar, StyleBar, VoiceBar, Minimap)
  const [showToolbar, setShowToolbar] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_toolbar') !== 'true';
    } catch {
      return true;
    }
  });
  const [showStyleBar, setShowStyleBar] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_stylebar') !== 'true';
    } catch {
      return true;
    }
  });
  const [showVoiceBar, setShowVoiceBar] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_voicebar') !== 'true';
    } catch {
      return true;
    }
  });
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_hide_minimap') !== 'true';
    } catch {
      return true;
    }
  });
  const [layoutResetCounter, setLayoutResetCounter] = useState<number>(0);

  // Code editor preferences (console colors/size, fonts, tab width ...)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    try {
      const raw = localStorage.getItem('collab_editor_settings');
      if (raw) return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_EDITOR_SETTINGS;
  });
  const handleChangeEditorSettings = useCallback((partial: Partial<EditorSettings>) => {
    setEditorSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('collab_editor_settings', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Settings & Theme State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('collab_app_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      theme: (localStorage.getItem('collab_theme') as ThemeMode) || 'light',
      gridStyle: 'dots',
      selectionMode: 'intersect',
      showToolbar: true,
      showStyleBar: true,
      showVoiceBar: true,
      soundEffectsEnabled: true,
      showRemoteCursors: true,
      autoSmoothFreehand: true,
    };
  });

  const uiHidden = Boolean(settings.uiHidden);
  const showClock = settings.showClock !== false;
  const showFolder = settings.showFolder !== false;

  // Sync theme class to document element for Tailwind dark: variants
  useEffect(() => {
    const isDark = settings.theme === 'dark' || settings.theme === 'midnight';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Floating widget z-index stacking management (bring-to-front on click/drag)
  const [widgetZIndexes, setWidgetZIndexes] = useState<{ toolbar: number; voice: number; style: number }>({
    toolbar: 22,
    voice: 21,
    style: 20,
  });

  const bringWidgetToFront = useCallback((widget: 'toolbar' | 'voice' | 'style') => {
    setWidgetZIndexes((prev) => {
      const maxZ = Math.max(prev.toolbar, prev.voice, prev.style, 22);
      if (prev[widget] === maxZ) return prev;
      return {
        ...prev,
        [widget]: maxZ + 1,
      };
    });
  }, []);

  // Central updater used by SettingsModal and the widgets' own "hide" buttons
  const updateAppSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('collab_app_settings', JSON.stringify(updated));
        if (partial.theme) {
          localStorage.setItem('collab_theme', partial.theme);
        }
      } catch {}
      return updated;
    });
    const persistHide = (key: string, visible: boolean) => {
      try {
        localStorage.setItem(key, String(!visible));
      } catch {}
    };
    if (partial.showToolbar !== undefined) {
      setShowToolbar(partial.showToolbar);
      persistHide('collab_hide_toolbar', partial.showToolbar);
    }
    if (partial.showStyleBar !== undefined) {
      setShowStyleBar(partial.showStyleBar);
      persistHide('collab_hide_stylebar', partial.showStyleBar);
    }
    if (partial.showVoiceBar !== undefined) {
      setShowVoiceBar(partial.showVoiceBar);
      persistHide('collab_hide_voicebar', partial.showVoiceBar);
    }
    if (partial.showMinimap !== undefined) {
      setShowMinimap(partial.showMinimap);
      persistHide('collab_hide_minimap', partial.showMinimap);
    }
  }, []);

  const handleToggleToolbar = useCallback(() => {
    setShowToolbar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('collab_hide_toolbar', String(!next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleStyleBar = useCallback(() => {
    setShowStyleBar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('collab_hide_stylebar', String(!next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleVoiceBar = useCallback(() => {
    setShowVoiceBar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('collab_hide_voicebar', String(!next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('collab_hide_minimap', String(!next));
      } catch {}
      return next;
    });
  }, []);

  const handleResetWidgetLayout = useCallback(() => {
    try {
      localStorage.removeItem('collab_toolbar_pos');
      localStorage.removeItem('collab_toolbar_vertical');
      localStorage.removeItem('collab_stylebar_pos');
      localStorage.removeItem('collab_voicebar_pos');
      localStorage.setItem('collab_hide_toolbar', 'false');
      localStorage.setItem('collab_hide_stylebar', 'false');
      localStorage.setItem('collab_hide_voicebar', 'false');
      localStorage.setItem('collab_hide_minimap', 'false');
    } catch {}
    setShowToolbar(true);
    setShowStyleBar(true);
    setShowVoiceBar(true);
    setShowMinimap(true);
    setWidgetZIndexes({ toolbar: 22, voice: 21, style: 20 });
    setLayoutResetCounter((c) => c + 1);
  }, []);

  // Fullscreen State and Controller
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        const root = document.documentElement;
        if (root.requestFullscreen) {
          root.requestFullscreen().catch(() => {});
        } else if ((root as any).webkitRequestFullscreen) {
          (root as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch {}
  }, []);

  // Canvas Tools and Styling
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [strokeColor, setStrokeColor] = useState<string>('#0f172a');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [fontSize, setFontSize] = useState<number>(20);
  const [fontFamily, setFontFamily] = useState<string>('Plus Jakarta Sans');
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [opacity, setOpacity] = useState<number>(1);
  const [eraserShape, setEraserShape] = useState<'circle' | 'square'>('circle');
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
    codeCursors,
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
    requestRoomsList,
    updateRoomSettings,
    updateUserRole,
    kickUser,
    deleteRoom,
    sendWebRTCSignal,
    codeFiles,
    upsertCodeFile,
    deleteCodeFile,
    sendActivity,
    liveStrokes,
    sendLiveStroke,
  } = useWebSocket({
    roomId,
    roomName: fallbackRoomName,
    enabled: hasEnteredWorkspace,
    customMaxUsers,
    isCreatingRoom,
    restoreRoom,
    onJoined: () => {
      // Joined successfully: from now on reconnects must never be treated as a "create" request
      setIsCreatingRoom(false);
      setRestoreRoom(false);
    },
    onSessionTimeout: () => {
      clearSavedSession();
      lastValidRoomRef.current = null;
      setJoinGateError(translate(getLanguage(), 'session.timeout'));
      setHasEnteredWorkspace(false);
      setIsInitialSetup(true);
      setIsUserSetupOpen(true);
    },
    user: {
      ...currentUser,
      name: currentUser.name || 'Misafir Kullanıcı',
    },
    onWebRTCSignal: (fromUserId, signal) => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.handleSignal(fromUserId, signal as { type: string });
      }
    },
    onKicked: (_kickedRoomId, kickedRoomName, by) => {
      setJoinGateError(
        `"${kickedRoomName}" odasından ${by} tarafından çıkarıldınız. Lütfen başka bir odaya katılın veya yeni oda oluşturun.`
      );
      lastValidRoomRef.current = null;
      clearSavedSession();
      setHasEnteredWorkspace(false);
      setIsInitialSetup(true);
      setIsUserSetupOpen(true);
    },
    onRoomRejected: (err) => {
      setJoinGateError(err.message);
      const prevValid = lastValidRoomRef.current;
      if (prevValid && prevValid.roomId && prevValid.roomId !== err.roomId) {
        // Revert to the user's current active room while keeping the warning banner visible
        setIsCreatingRoom(false);
        setCustomMaxUsers(prevValid.maxUsers);
        setCustomRoomName(prevValid.roomName);
        setRoomId(prevValid.roomId);
      } else {
        // Block entry and keep the user on the Pre-Welcome Gate Screen
        clearSavedSession();
        setHasEnteredWorkspace(false);
        setIsInitialSetup(true);
        setIsUserSetupOpen(true);
      }
    },
  });

  // Record last valid room after joining without errors so rejected room switches can revert cleanly
  useEffect(() => {
    if (!hasEnteredWorkspace || roomError) return;
    const timer = window.setTimeout(() => {
      if (hasEnteredWorkspace && !roomError) {
        lastValidRoomRef.current = {
          roomId,
          roomName: customRoomName,
          maxUsers: roomSettings.maxUsers,
        };
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [hasEnteredWorkspace, roomError, roomId, customRoomName, roomSettings.maxUsers]);

  const effectiveRoomName = syncedRoomName || fallbackRoomName;

  const handleSelectOrSwitchRoom = useCallback(
    (
      targetRoomId: string,
      targetRoomName?: string,
      targetMaxUsers?: number,
      creating?: boolean
    ) => {
      const cleanTarget = targetRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!cleanTarget) return;
      clearRoomError();
      setJoinGateError(null);
      setIsCreatingRoom(Boolean(creating));
      setRestoreRoom(false);
      setCustomMaxUsers(targetMaxUsers);
      setCustomRoomName(targetRoomName || '');
      setRoomId(cleanTarget);
    },
    [clearRoomError]
  );

  // Firebase Cloud Firestore Persistence & Google Auth
  const {
    firebaseUser,
    authError,
    clearAuthError,
    isSyncingCloud,
    lastCloudSyncAt,
    signInWithGoogle,
    signOutFirebase,
    syncRoomToCloud,
    cloudRooms,
  } = useFirebaseSync({
    roomId,
    roomName: effectiveRoomName,
    enabled: hasEnteredWorkspace,
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

  // ---- Activity tracking: 1 hour without any interaction ends the session ----
  const handleSessionTimeoutLocal = useCallback(() => {
    clearSavedSession();
    lastValidRoomRef.current = null;
    setJoinGateError(translate(getLanguage(), 'session.timeout'));
    setHasEnteredWorkspace(false);
    setIsInitialSetup(true);
    setIsUserSetupOpen(true);
  }, []);

  const sendActivityRef = useRef(sendActivity);
  sendActivityRef.current = sendActivity;

  useEffect(() => {
    if (!hasEnteredWorkspace) return;
    let lastSentToServer = 0;
    let dirtySinceSent = false;

    const mark = () => {
      lastActivityRef.current = Date.now();
      dirtySinceSent = true;
    };
    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ];
    events.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current >= SESSION_IDLE_MS) {
        handleSessionTimeoutLocal();
        return;
      }
      // Keep the stored timestamp fresh so a refresh knows how long the user was idle
      const stored = readSavedSession();
      if (stored) writeSavedSession({ ...stored, lastActivityAt: lastActivityRef.current });
      if (dirtySinceSent && now - lastSentToServer >= 60 * 1000) {
        sendActivityRef.current();
        lastSentToServer = now;
        dirtySinceSent = false;
      }
    }, 15 * 1000);

    const persistOnLeave = () => {
      const stored = readSavedSession();
      if (stored) writeSavedSession({ ...stored, lastActivityAt: lastActivityRef.current });
    };
    window.addEventListener('pagehide', persistOnLeave);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, mark));
      window.clearInterval(tick);
      window.removeEventListener('pagehide', persistOnLeave);
    };
  }, [hasEnteredWorkspace, handleSessionTimeoutLocal]);

  // Remember the active room so a page refresh lands back in the same workspace
  useEffect(() => {
    if (!hasEnteredWorkspace || roomError) return;
    writeSavedSession({
      roomId,
      roomName: syncedRoomName || customRoomName,
      maxUsers: roomSettings.maxUsers,
      wasOwner: currentUserRole === 'owner' || isCreatingRoom || restoreRoom,
      lastActivityAt: lastActivityRef.current,
    });
  }, [
    hasEnteredWorkspace,
    roomError,
    roomId,
    syncedRoomName,
    customRoomName,
    roomSettings.maxUsers,
    currentUserRole,
    isCreatingRoom,
    restoreRoom,
  ]);

  // Keep a Firestore record of every room this signed-in owner runs (debounced)
  useEffect(() => {
    if (!hasEnteredWorkspace || !firebaseUser || roomError) return;
    if (currentUserRole !== 'owner' || roomId === 'ana-oda') return;
    const timer = window.setTimeout(() => {
      Promise.resolve(syncRoomToCloud({ includeElements: false })).catch(() => {});
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [
    hasEnteredWorkspace,
    firebaseUser,
    roomError,
    currentUserRole,
    roomId,
    syncRoomToCloud,
    effectiveRoomName,
    roomSettings.isLocked,
    roomSettings.maxUsers,
    roomSettings.defaultRole,
  ]);

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

  // Track unread chat messages when chat drawer is closed (only actual user messages, ignore system announcements)
  const prevChatCountRef = useRef(
    chatMessages.filter((m) => m.userId !== 'system' && m.userColor !== 'system').length
  );
  useEffect(() => {
    const userMsgsCount = chatMessages.filter(
      (m) => m.userId !== 'system' && m.userColor !== 'system'
    ).length;
    if (activePanel !== 'chat' && userMsgsCount > prevChatCountRef.current) {
      setUnreadChatCount((prev) => prev + (userMsgsCount - prevChatCountRef.current));
    }
    prevChatCountRef.current = userMsgsCount;
  }, [chatMessages, activePanel]);

  // Initialize Voice Manager
  // The VoiceManager must live for the whole session: re-creating it (because a callback identity
  // changed) tears down every peer connection and silently kills the audio. Callbacks go through refs.
  const updateVoiceStateRef = useRef(updateVoiceState);
  updateVoiceStateRef.current = updateVoiceState;
  const sendWebRTCSignalRef = useRef(sendWebRTCSignal);
  sendWebRTCSignalRef.current = sendWebRTCSignal;

  useEffect(() => {
    const vm = new VoiceManager(
      (isSpeaking, volume) => {
        setLocalVolume(volume);
        updateVoiceStateRef.current({ isSpeaking });
      },
      (targetUserId, signal) => {
        sendWebRTCSignalRef.current(targetUserId, signal);
      }
    );

    voiceManagerRef.current = vm;
    vm.initLocalMicrophone();

    return () => {
      vm.cleanup();
      voiceManagerRef.current = null;
    };
  }, []);

  // Sync WebRTC peers when room user list changes
  const usersForVoiceRef = useRef(users);
  usersForVoiceRef.current = users;
  useEffect(() => {
    if (!voiceManagerRef.current) return;
    const activeIds = users.map((u) => u.id);
    voiceManagerRef.current.syncPeers(activeIds, currentUser.id);
  }, [users, currentUser.id]);

  // Periodically re-establish peers whose connection failed or was closed
  useEffect(() => {
    const timer = window.setInterval(() => {
      voiceManagerRef.current?.syncPeers(
        usersForVoiceRef.current.map((u) => u.id),
        currentUser.id
      );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [currentUser.id]);

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

  // Voice volume per peer (reactive state persisted to localStorage)
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('collab_peer_volumes');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore storage error
    }
    return {};
  });

  const handleGetUserVolume = useCallback((userId: string) => {
    if (typeof peerVolumes[userId] === 'number') {
      return peerVolumes[userId];
    }
    return voiceManagerRef.current?.getUserVolume(userId) ?? 100;
  }, [peerVolumes]);

  const handleSetUserVolume = useCallback((userId: string, volume: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    setPeerVolumes((prev) => {
      const next = { ...prev, [userId]: clamped };
      try {
        localStorage.setItem('collab_peer_volumes', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setUserVolume(userId, clamped);
    }
  }, []);

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

  // Bring to front (En Öne Getir) & send to back (En Arkaya Gönder)
  const handleBringForward = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const toBring = elements.filter((e) => selectedElementIds.includes(e.id));
    const remaining = elements.filter((e) => !selectedElementIds.includes(e.id));
    replaceElements([...remaining, ...toBring]);
  }, [selectedElementIds, elements, recordUndo, replaceElements]);

  const handleSendBackward = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    recordUndo();
    const toSend = elements.filter((e) => selectedElementIds.includes(e.id));
    const remaining = elements.filter((e) => !selectedElementIds.includes(e.id));
    replaceElements([...toSend, ...remaining]);
  }, [selectedElementIds, elements, recordUndo, replaceElements]);

  // Step-by-step layer ordering: Bring 1 layer forward / Send 1 layer backward
  const handleBringStepForward = useCallback(() => {
    if (selectedElementIds.length === 0 || elements.length <= 1) return;
    const selectedSet = new Set(selectedElementIds);
    const next = [...elements];
    let changed = false;

    for (let i = next.length - 2; i >= 0; i--) {
      if (selectedSet.has(next[i].id) && !selectedSet.has(next[i + 1].id)) {
        const temp = next[i];
        next[i] = next[i + 1];
        next[i + 1] = temp;
        changed = true;
      }
    }

    if (changed) {
      recordUndo();
      replaceElements(next);
    }
  }, [selectedElementIds, elements, recordUndo, replaceElements]);

  const handleSendStepBackward = useCallback(() => {
    if (selectedElementIds.length === 0 || elements.length <= 1) return;
    const selectedSet = new Set(selectedElementIds);
    const next = [...elements];
    let changed = false;

    for (let i = 1; i < next.length; i++) {
      if (selectedSet.has(next[i].id) && !selectedSet.has(next[i - 1].id)) {
        const temp = next[i];
        next[i] = next[i - 1];
        next[i - 1] = temp;
        changed = true;
      }
    }

    if (changed) {
      recordUndo();
      replaceElements(next);
    }
  }, [selectedElementIds, elements, recordUndo, replaceElements]);

  // Global Keyboard Shortcuts (Tools, Voice, Undo/Redo, Duplicate, Rotate, Flip, Layer Order, Select All)
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
        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          if (elements.length > 0) {
            setActiveTool('select');
            setSelectedElementIds(elements.map((el) => el.id));
          }
          return;
        }
        if (e.key === ']') {
          e.preventDefault();
          if (e.shiftKey) {
            handleBringForward();
          } else {
            handleBringStepForward();
          }
          return;
        }
        if (e.key === '[') {
          e.preventDefault();
          if (e.shiftKey) {
            handleSendBackward();
          } else {
            handleSendStepBackward();
          }
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

      // F11 Fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
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
    handleBringForward,
    handleSendBackward,
    handleBringStepForward,
    handleSendStepBackward,
    selectedElementIds,
    elements,
    recordUndo,
    deleteElements,
    handleToggleFullscreen,
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

  // Add Image or Document/Markdown Card from File vault or Toolbar directly to canvas center
  const handleAddImageToCanvas = (
    dataUrl: string,
    widthOrName?: number | string,
    heightOrWidth = 240,
    explicitHeight?: number
  ) => {
    const width =
      typeof widthOrName === 'number'
        ? widthOrName
        : typeof heightOrWidth === 'number' && explicitHeight !== undefined
        ? heightOrWidth
        : 320;
    const height =
      typeof widthOrName === 'number'
        ? heightOrWidth
        : typeof explicitHeight === 'number'
        ? explicitHeight
        : 240;
    const fileName = typeof widthOrName === 'string' ? widthOrName : undefined;

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
      fileName,
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

  // Add PDF from File vault or drop directly to canvas center
  const handleAddPdfToCanvas = async (pdfUrl: string, name?: string) => {
    try {
      const { totalPages, defaultWidth, defaultHeight } = await getPdfInfo(pdfUrl);
      const page1ImageUrl = await renderPdfPage(pdfUrl, 1);

      const canvasCenterX = (window.innerWidth / 2 - pan.x) / zoom - defaultWidth / 2;
      const canvasCenterY = (window.innerHeight / 2 - pan.y) / zoom - defaultHeight / 2;

      recordUndo();
      const pdfEl: CanvasElement = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'pdf',
        x: canvasCenterX,
        y: canvasCenterY,
        width: defaultWidth,
        height: defaultHeight,
        imageUrl: page1ImageUrl,
        pdfUrl: pdfUrl,
        currentPage: 1,
        totalPages: totalPages || 1,
        fileName: name || 'Belge.pdf',
        rotation: 0,
        flipX: false,
        flipY: false,
        createdBy: currentUser.name,
        updatedAt: Date.now(),
      };

      createElement(pdfEl);
      setSelectedElementIds([pdfEl.id]);
      setActiveTool('select');
      if (activePanel === 'files') {
        setActivePanel('none');
      }
    } catch (err) {
      console.error('Failed to add PDF to canvas:', err);
    }
  };

  // Add Video from File vault or drop directly to canvas center
  const handleAddVideoToCanvas = (videoUrl: string, name?: string) => {
    const defaultW = 480;
    const defaultH = 270;
    const canvasCenterX = (window.innerWidth / 2 - pan.x) / zoom - defaultW / 2;
    const canvasCenterY = (window.innerHeight / 2 - pan.y) / zoom - defaultH / 2;

    recordUndo();
    const videoEl: CanvasElement = {
      id: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'video',
      x: canvasCenterX,
      y: canvasCenterY,
      width: defaultW,
      height: defaultH,
      videoUrl,
      fileName: name || 'Video.mp4',
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: currentUser.name,
      updatedAt: Date.now(),
    };

    createElement(videoEl);
    setSelectedElementIds([videoEl.id]);
    setActiveTool('select');
    if (activePanel === 'files') {
      setActivePanel('none');
    }
  };

  const handleWelcomeOrProfileJoin = useCallback(
    (payload: RoomJoinPayload) => {
      clearRoomError();
      setJoinGateError(null);
      setCurrentUser((prev) => ({
        ...prev,
        name: payload.name,
        color: payload.color,
        avatar: payload.name.charAt(0).toUpperCase(),
      }));
      lastActivityRef.current = Date.now();
      setIsCreatingRoom(Boolean(payload.isCreatingRoom));
      setRestoreRoom(false);
      setCustomMaxUsers(payload.maxUsers);
      setCustomRoomName(payload.roomName || '');
      setRoomId(payload.roomId);
      setHasEnteredWorkspace(true);
      setIsUserSetupOpen(false);
      setIsInitialSetup(false);
      if (localStorage.getItem('collabboard_onboarding_v2_done') !== 'true') {
        setIsOnboardingOpen(true);
      }
    },
    [clearRoomError]
  );

  // Strict Pre-Welcome Gate: Do NOT render the whiteboard or any workspace UI until the user completes the Welcome Screen
  if (!hasEnteredWorkspace) {
    return (
      <UserSetupModal
        initialName={currentUser.name}
        initialColor={currentUser.color}
        initialRoomId={roomId}
        initialRoomName={customRoomName}
        hasUrlRoomParam={initialRoomInfo.hasUrlRoomParam}
        isInitialSetup={true}
        joinError={joinGateError || authError || roomError?.message || null}
        onClearJoinError={() => {
          setJoinGateError(null);
          clearAuthError();
          clearRoomError();
        }}
        roomsList={roomsList}
        currentUserId={currentUser.id}
        onDeleteRoom={deleteRoom}
        firebaseUser={firebaseUser}
        onSignInGoogle={async () => {
          const u = await signInWithGoogle(currentUser.name);
          if (u && u.displayName) {
            setCurrentUser((prev) => ({
              ...prev,
              name: u.displayName || prev.name,
              avatar: (u.displayName || prev.name || 'G').charAt(0).toUpperCase(),
            }));
          }
        }}
        onSignOutGoogle={signOutFirebase}
        onJoin={handleWelcomeOrProfileJoin}
      />
    );
  }

  return (
    <div
      data-theme={settings.theme}
      className="relative w-full h-full flex flex-col overflow-hidden bg-slate-50 select-none font-sans"
    >
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
        onStartOnboardingTour={() => setIsOnboardingOpen(true)}
        isMuted={isMuted}
        isDeafened={isDeafened}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        unreadChatCount={unreadChatCount}
        showToolbar={showToolbar}
        showStyleBar={showStyleBar}
        showVoiceBar={showVoiceBar}
        showMinimap={showMinimap}
        onToggleToolbar={handleToggleToolbar}
        onToggleStyleBar={handleToggleStyleBar}
        onToggleVoiceBar={handleToggleVoiceBar}
        onToggleMinimap={handleToggleMinimap}
        onResetWidgetLayout={handleResetWidgetLayout}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onSwitchRoomByCode={(codeStr) => handleSelectOrSwitchRoom(codeStr, undefined, undefined, false)}
        theme={settings.theme}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Room Error / Capacity / Lock Banner */}
      {(roomError || joinGateError) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-900 z-30">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{joinGateError || roomError?.message}</span>
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
              onClick={() => {
                setJoinGateError(null);
                clearRoomError();
              }}
              className="p-1 rounded hover:bg-amber-200/60 text-amber-700"
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div
        data-workspace-root="true"
        className="relative flex-1 w-full h-full overflow-hidden"
      >
        {/* Main Floating Toolbar (Top Center by default, freely draggable anywhere) */}
        {!uiHidden && (
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
          isHidden={!showToolbar}
          onToggleHidden={handleToggleToolbar}
          layoutResetCounter={layoutResetCounter}
          zIndex={widgetZIndexes.toolbar}
          onFocus={() => bringWidgetToFront('toolbar')}
        />
        )}

        {/* Voice Chat Floating Bar (Top Right by default, freely draggable anywhere) */}
        {!uiHidden && (
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
          isHidden={!showVoiceBar}
          onToggleHidden={handleToggleVoiceBar}
          layoutResetCounter={layoutResetCounter}
          zIndex={widgetZIndexes.voice}
          onFocus={() => bringWidgetToFront('voice')}
        />
        )}

        {/* Floating Clock (draggable + resizable) */}
        {!uiHidden && showClock && (
          <ClockWidget
            onHide={() => updateAppSettings({ showClock: false })}
            layoutResetCounter={layoutResetCounter}
            zIndex={23}
          />
        )}

        {/* Folder tool: parks files and lets you drag them onto the board */}
        {!uiHidden && showFolder && (
          <FolderWidget
            onHide={() => updateAppSettings({ showFolder: false })}
            layoutResetCounter={layoutResetCounter}
            zIndex={24}
          />
        )}

        {/* Contextual Style & Transform Bar (Draggable, Bottom Center by default) */}
        {canEdit && !uiHidden && (
          <StyleBar
            selectedElement={selectedElement}
            selectedElements={selectedElements}
            activeTool={activeTool}
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            strokeStyle={strokeStyle}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fontWeight={fontWeight}
            fontStyle={fontStyle}
            textAlign={textAlign}
            opacity={opacity}
            eraserShape={eraserShape}
            onChangeEraserShape={setEraserShape}
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
            onChangeFontFamily={(ff) => {
              setFontFamily(ff);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { fontFamily: ff } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeFontWeight={(fw) => {
              setFontWeight(fw);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { fontWeight: fw } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeFontStyle={(fst) => {
              setFontStyle(fst);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { fontStyle: fst } }));
                if (updates.length > 0) batchUpdateElements(updates);
              }
            }}
            onChangeTextAlign={(ta) => {
              setTextAlign(ta);
              if (selectedElementIds.length > 0) {
                const updates = elements
                  .filter((el) => selectedElementIds.includes(el.id) && !el.isLocked)
                  .map((el) => ({ id: el.id, changes: { textAlign: ta } }));
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
            onBringStepForward={handleBringStepForward}
            onSendStepBackward={handleSendStepBackward}
            onToggleLock={handleToggleLock}
            isHidden={!showStyleBar}
            onToggleHidden={handleToggleStyleBar}
            layoutResetCounter={layoutResetCounter}
            zIndex={widgetZIndexes.style}
            onFocus={() => bringWidgetToFront('style')}
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
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          fontStyle={fontStyle}
          textAlign={textAlign}
          onChangeFontSize={setFontSize}
          onChangeFontFamily={setFontFamily}
          onChangeFontWeight={setFontWeight}
          onChangeFontStyle={setFontStyle}
          onChangeTextAlign={setTextAlign}
          onChangeStrokeColor={setStrokeColor}
          onChangeFillColor={setFillColor}
          onOpenAIPrompt={() => setIsAIPromptOpen(true)}
          opacity={opacity}
          eraserShape={eraserShape}
          pings={pings}
          reactions={reactions}
          remoteLaserPoints={remoteLaserPoints}
          liveStrokes={liveStrokes}
          onLiveStroke={sendLiveStroke}
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
          onBringToFront={handleBringForward}
          onSendToBack={handleSendBackward}
          onBringStepForward={handleBringStepForward}
          onSendStepBackward={handleSendStepBackward}
          onDuplicate={handleDuplicateSelected}
          onRotateBy={handleRotateBy}
          onFlipHorizontal={handleFlipHorizontal}
          onFlipVertical={handleFlipVertical}
          onToggleLock={handleToggleLock}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
          canEdit={canEdit}
          showMinimap={showMinimap && !uiHidden}
          onToggleMinimap={handleToggleMinimap}
          onResetWidgetLayout={handleResetWidgetLayout}
          theme={settings.theme}
          gridStyle={settings.gridStyle}
          onChangeGridStyle={(style) => {
            setSettings((prev) => {
              const updated = { ...prev, gridStyle: style };
              try {
                localStorage.setItem('collab_app_settings', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }}
          selectionMode={settings.selectionMode}
        />

        {/* Collaborative Code Editor Side Panel (Room-Scoped) */}
        {activePanel === 'code' && (
          <CodeEditorPanel
            roomName={effectiveRoomName}
            roomId={roomId}
            canEdit={canEdit}
            code={code}
            codeCursors={codeCursors}
            currentUserId={currentUser.id}
            onUpdateCode={updateCode}
            codeFiles={codeFiles}
            onUpsertCodeFile={upsertCodeFile}
            onDeleteCodeFile={deleteCodeFile}
            editorSettings={editorSettings}
            onChangeEditorSettings={handleChangeEditorSettings}
            onCursorMove={sendCodeCursor}
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
            onAddImageToCanvas={(dataUrl, name, w, h) => handleAddImageToCanvas(dataUrl, name, w, h)}
            onAddPdfToCanvas={(pdfUrl, name) => handleAddPdfToCanvas(pdfUrl, name)}
            onAddVideoToCanvas={(videoUrl, name) => handleAddVideoToCanvas(videoUrl, name)}
            onClose={() => setActivePanel('none')}
          />
        )}

        {/* Real-Time Chat Drawer */}
        {activePanel === 'chat' && (
          <ChatDrawer
            messages={chatMessages}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            reactions={reactions}
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
            if (!aiElements || aiElements.length === 0) return;
            recordUndo();

            // Compute bounding box of generated elements and center them around current viewport center
            const targetCenterX = (window.innerWidth / 2 - pan.x) / zoom;
            const targetCenterY = (window.innerHeight / 2 - pan.y) / zoom;

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            for (const el of aiElements) {
              if (el.points && el.points.length > 0) {
                for (const pt of el.points) {
                  minX = Math.min(minX, pt.x);
                  minY = Math.min(minY, pt.y);
                  maxX = Math.max(maxX, pt.x);
                  maxY = Math.max(maxY, pt.y);
                }
              } else {
                const w = el.width ?? 140;
                const h = el.height ?? 80;
                minX = Math.min(minX, el.x, el.x + w);
                minY = Math.min(minY, el.y, el.y + h);
                maxX = Math.max(maxX, el.x, el.x + w);
                maxY = Math.max(maxY, el.y, el.y + h);
              }
            }

            const currentCx = Number.isFinite(minX) ? (minX + maxX) / 2 : targetCenterX;
            const currentCy = Number.isFinite(minY) ? (minY + maxY) / 2 : targetCenterY;
            const offsetX = Math.round(targetCenterX - currentCx);
            const offsetY = Math.round(targetCenterY - currentCy);

            const centeredElements = aiElements.map((el) => ({
              ...el,
              x: Math.round(el.x + offsetX),
              y: Math.round(el.y + offsetY),
              points: el.points
                ? el.points.map((pt) => ({
                    x: Math.round(pt.x + offsetX),
                    y: Math.round(pt.y + offsetY),
                  }))
                : undefined,
            }));

            loadTemplate(centeredElements);
            setSelectedElementIds(centeredElements.map((el) => el.id));
            setActiveTool('select');
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
          cloudRooms={cloudRooms}
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
          onSelectRoom={(targetRoomId, targetRoomName, targetMaxUsers, creating) => {
            handleSelectOrSwitchRoom(targetRoomId, targetRoomName, targetMaxUsers, creating);
          }}
          onUpdateRoomSettings={updateRoomSettings}
          onUpdateUserRole={updateUserRole}
          onKickUser={kickUser}
          onDeleteRoom={async (targetRoomId) => {
            const ok = await deleteRoom(targetRoomId);
            return { ok, error: ok ? undefined : 'Oda silinemedi veya yetkiniz bulunmuyor.' };
          }}
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

      {/* Profile & Room Switcher Modal (when opened from inside the workspace) */}
      {isUserSetupOpen && (
        <UserSetupModal
          initialName={currentUser.name}
          initialColor={currentUser.color}
          initialRoomId={roomId}
          initialRoomName={effectiveRoomName}
          hasUrlRoomParam={true}
          isInitialSetup={isInitialSetup}
          joinError={joinGateError || authError || roomError?.message || null}
          onClearJoinError={() => {
            setJoinGateError(null);
            clearAuthError();
            clearRoomError();
          }}
          roomsList={roomsList}
          currentUserId={currentUser.id}
          onDeleteRoom={deleteRoom}
          firebaseUser={firebaseUser}
          onSignInGoogle={async () => {
            const u = await signInWithGoogle(currentUser.name);
            if (u && u.displayName) {
              setCurrentUser((prev) => ({
                ...prev,
                name: u.displayName || prev.name,
                avatar: (u.displayName || prev.name || 'G').charAt(0).toUpperCase(),
              }));
            }
          }}
          onSignOutGoogle={signOutFirebase}
          onClose={!isInitialSetup ? () => setIsUserSetupOpen(false) : undefined}
          onJoin={handleWelcomeOrProfileJoin}
        />
      )}

      {/* Interactive Spotlight Onboarding Tour for First-Time Users */}
      <OnboardingTour
        isOpen={isOnboardingOpen}
        onClose={() => {
          localStorage.setItem('collabboard_onboarding_v2_done', 'true');
          setIsOnboardingOpen(false);
        }}
        onSelectTool={(t) => {
          setActiveTool(t);
        }}
        onOpenCodeEditor={() => {
          setActivePanel('code');
        }}
        onOpenInviteModal={() => {
          setRoomsModalTab('invite');
          setIsRoomsModalOpen(true);
        }}
      />

      {/* Settings Modal (Theme, Dark Mode, Canvas Grid, Panels, Shortcuts) */}
      {isSettingsOpen && (
        <SettingsModal
          settings={{
            ...settings,
            showToolbar,
            showStyleBar,
            showVoiceBar,
            showMinimap,
            showClock,
            showFolder,
            uiHidden,
          }}
          onUpdateSettings={(partial) => {
            // Turning any single widget back on leaves the "everything hidden" mode
            const turnsOnWidget = Object.entries(partial).some(
              ([k, v]) => k.startsWith('show') && v === true
            );
            updateAppSettings(turnsOnWidget ? { ...partial, uiHidden: false } : partial);
          }}
          editorSettings={editorSettings}
          onUpdateEditorSettings={handleChangeEditorSettings}
          onFullyShow={() => {
            updateAppSettings({
              showToolbar: true,
              showStyleBar: true,
              showVoiceBar: true,
              showMinimap: true,
              showClock: true,
              showFolder: true,
              uiHidden: false,
            });
            handleResetWidgetLayout();
          }}
          onFullyHide={() => updateAppSettings({ uiHidden: true })}
          onResetFloatingPositions={handleResetWidgetLayout}
          onResetAllSettings={() => {
            const defaults: AppSettings = {
              theme: 'light',
              gridStyle: 'dots',
              selectionMode: 'intersect',
              showToolbar: true,
              showStyleBar: true,
              showVoiceBar: true,
              soundEffectsEnabled: true,
              showRemoteCursors: true,
              autoSmoothFreehand: true,
              showClock: true,
              showFolder: true,
              uiHidden: false,
            };
            setSettings(defaults);
            handleChangeEditorSettings({ ...DEFAULT_EDITOR_SETTINGS });
            try {
              localStorage.setItem('collab_app_settings', JSON.stringify(defaults));
              localStorage.setItem('collab_theme', 'light');
            } catch {}
            handleResetWidgetLayout();
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}

