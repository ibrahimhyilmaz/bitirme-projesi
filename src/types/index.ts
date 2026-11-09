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
  | 'highlighter'
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
  | 'pan';

export interface Point {
  x: number;
  y: number;
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
  showRemoteCursors: boolean;
  autoSmoothFreehand: boolean;
  language: string;
  showClock: boolean;
  showFolder: boolean;
}

export interface RoomSettings {
  isLocked: boolean;
  maxUsers: number;
  defaultRole: 'editor' | 'viewer';
  allowGuestDraw: boolean;
  ownerId: string;
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
  /** True when the requesting user owns this room (computed by the server per viewer). */
  isMine?: boolean;
  /** Locked automatically because nobody was active for the idle timeout. */
  idleLocked?: boolean;
  lastActivityAt?: number;
}

export interface ServerLimits {
  maxRooms: number;
  maxUsersPerRoom: number;
  maxRoomsPerUser?: number;
  currentRoomsCount: number;
}

export interface CanvasElement {
  id: string;
  type:
    | 'pencil'
    | 'highlighter'
    | ShapeElementType
    | 'arrow'
    | 'line'
    | 'text'
    | 'sticky'
    | 'image'
    | 'pdf'
    | 'video';
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
  fileAttachment?: {
    name: string;
    url: string;
    type?: string;
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
