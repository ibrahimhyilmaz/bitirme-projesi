export type ShapeElementType =
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'right-triangle'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'cylinder'
  | 'parallelogram'
  | 'trapezoid'
  | 'document'
  | 'cloud'
  | 'callout-rect'
  | 'callout-oval'
  | 'block-arrow-right'
  | 'block-arrow-left'
  | 'block-arrow-up'
  | 'block-arrow-down'
  | 'double-arrow'
  | 'curved-arrow'
  | 'heart'
  | 'lightning'
  | 'cross'
  | 'flag';

export const ALL_SHAPE_TYPES: ShapeElementType[] = [
  'rectangle',
  'rounded-rect',
  'circle',
  'diamond',
  'triangle',
  'right-triangle',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
  'cylinder',
  'parallelogram',
  'trapezoid',
  'document',
  'cloud',
  'callout-rect',
  'callout-oval',
  'block-arrow-right',
  'block-arrow-left',
  'block-arrow-up',
  'block-arrow-down',
  'double-arrow',
  'curved-arrow',
  'heart',
  'lightning',
  'cross',
  'flag',
];

export type ToolType =
  | 'select'
  | 'pencil'
  | 'fountain-pen'
  | 'highlighter'
  | 'bucket'
  | 'eraser'
  | 'point-eraser'
  | 'ping'
  | ShapeElementType
  | 'arrow'
  | 'line'
  | 'sticky'
  | 'text'
  | 'image'
  | 'laser'
  | 'pan'
  | 'folder';

export interface Point {
  x: number;
  y: number;
  w?: number;
}

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type ThemeMode = 'light' | 'dark' | 'midnight' | 'sepia';

export interface AppSettings {
  theme: ThemeMode;
  gridStyle: 'dots' | 'grid' | 'none';
  selectionMode: 'intersect' | 'contain';
  showToolbar: boolean;
  showStyleBar: boolean;
  showVoiceBar: boolean;
  soundEffectsEnabled: boolean;
  chatNotificationsEnabled?: boolean;
  showRemoteCursors: boolean;
  autoSmoothFreehand: boolean;
  language?: LanguageCode;
  uiHidden?: boolean;
  showClock?: boolean;
  showFolder?: boolean;
  showMinimap?: boolean;
}

export type LanguageCode = 'tr' | 'en' | 'de' | 'fr' | 'ar' | 'es';

export interface EditorSettings {
  editorFontSize: number;
  editorTextColor: string;
  editorBgColor: string;
  tabSize: number;
  consoleFontSize: number;
  consoleTextColor: string;
  consoleErrorColor: string;
  consoleBgColor: string;
  consoleHeight: number;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  editorFontSize: 12,
  editorTextColor: '#34d399',
  editorBgColor: '#0f172a',
  tabSize: 2,
  consoleFontSize: 12,
  consoleTextColor: '#6ee7b7',
  consoleErrorColor: '#fb7185',
  consoleBgColor: '#020617',
  consoleHeight: 208,
};

export interface RoomSettings {
  isLocked: boolean;
  maxUsers: number;
  defaultRole: 'editor' | 'viewer';
  allowGuestDraw: boolean;
  saveChat?: boolean;
  ownerId: string;
}

export interface RoomActiveUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  role: UserRole;
}

export interface RoomSummary {
  id: string;
  name: string;
  userCount: number;
  maxUsers: number;
  isLocked: boolean;
  elementCount: number;
  createdAt: number;
  ownerName: string;
  ownerId?: string;
  ownerKey?: string;
  lockedByIdle?: boolean;
  lastActivityAt?: number;
  activeUsers?: RoomActiveUser[];
}

export interface ServerLimits {
  maxRooms: number;
  maxUsersPerRoom: number;
  maxRoomsPerUser?: number;
  currentRoomsCount: number;
}

export interface FolderFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface CanvasElement {
  id: string;
  type:
    | 'pencil'
    | 'fountain-pen'
    | 'highlighter'
    | ShapeElementType
    | 'arrow'
    | 'line'
    | 'text'
    | 'sticky'
    | 'image'
    | 'pdf'
    | 'video'
    | 'folder';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
  pdfUrl?: string;
  videoUrl?: string;
  markdownContent?: string;
  isPlaying?: boolean;
  currentTime?: number;
  volume?: number;
  isMuted?: boolean;
  currentPage?: number;
  totalPages?: number;
  fileName?: string;
  folderName?: string;
  folderFiles?: FolderFileItem[];
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  isLocked?: boolean;
  createdBy: string;
  updatedAt: number;
}

export interface FontFamilyOption {
  id: string;
  label: string;
  category: string;
  cssFamily: string;
}

export const GOOGLE_FONT_FAMILIES: FontFamilyOption[] = [
  {
    id: 'Plus Jakarta Sans',
    label: 'Plus Jakarta Sans',
    category: 'Modern Sans',
    cssFamily: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'Playfair Display',
    label: 'Playfair Display',
    category: 'Klasik Serif',
    cssFamily: "'Playfair Display', serif",
  },
  {
    id: 'Caveat',
    label: 'Caveat',
    category: 'El Yazısı',
    cssFamily: "'Caveat', cursive",
  },
  {
    id: 'Dancing Script',
    label: 'Dancing Script',
    category: 'Kaligrafik',
    cssFamily: "'Dancing Script', cursive",
  },
  {
    id: 'Space Grotesk',
    label: 'Space Grotesk',
    category: 'Teknik / Geometrik',
    cssFamily: "'Space Grotesk', sans-serif",
  },
  {
    id: 'Oswald',
    label: 'Oswald',
    category: 'Poster / Başlık',
    cssFamily: "'Oswald', sans-serif",
  },
  {
    id: 'Merriweather',
    label: 'Merriweather',
    category: 'Kitap / Editoryal',
    cssFamily: "'Merriweather', serif",
  },
  {
    id: 'JetBrains Mono',
    label: 'JetBrains Mono',
    category: 'Kod / Monospace',
    cssFamily: "'JetBrains Mono', monospace",
  },
];

export const TEXT_FONT_SIZES: number[] = [
  12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72, 96,
];

export interface CodeCursorPresence {
  userId: string;
  userName: string;
  userColor: string;
  line: number;
  column: number;
  selectionStart: number;
  selectionEnd: number;
  updatedAt: number;
}

export interface CodeFile {
  id: string;
  name: string;
  language: string;
  content: string;
  lastUpdatedBy: string;
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedBy: string;
  uploadedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
  recipientId?: string;
  recipientName?: string;
  isPrivate?: boolean;
  fileAttachment?: {
    name: string;
    url: string;
    type?: string;
    size?: number;
    dataUrl?: string;
  };
}

export interface UserPresence {
  id: string;
  name: string;
  avatar: string;
  color: string;
  role: UserRole;
  cursor: Point;
  isDrawing: boolean;
  activeTool: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface RoomState {
  id: string;
  name: string;
  createdAt: number;
  settings: RoomSettings;
  elements: CanvasElement[];
  code: {
    content: string;
    language: string;
    lastUpdatedBy: string;
  };
  notes: {
    content: string;
    lastUpdatedBy: string;
  };
  files: SharedFile[];
  messages: ChatMessage[];
  users: UserPresence[];
}

export interface UserPing {
  x: number;
  y: number;
  userName: string;
  userColor: string;
  timestamp: number;
}

export interface UserReaction {
  id: string;
  x: number;
  y: number;
  emoji: string;
  userName: string;
  timestamp: number;
}

export interface LaserStrokePoint {
  x: number;
  y: number;
  time: number;
  userId?: string;
  color?: string;
}
