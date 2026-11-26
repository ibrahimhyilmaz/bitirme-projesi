import { EXTRA_SHAPE_IDS, type ExtraShapeId } from '../utils/extraShapes';

export type ShapeElementType =
  | ExtraShapeId
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
  ...EXTRA_SHAPE_IDS,
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
  identityKey?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  color: string;
  cursorColor?: string;
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
    | 'polygon'
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
  /** Paginated document kind: PDF (pdf.js), formatted Markdown (.md), or clean plain text (.txt) */
  documentKind?: 'pdf' | 'markdown' | 'text';
  /** Marks a Paint-style bucket flood-fill layer bound to enclosing strokes */
  isBucketFill?: boolean;
  /** IDs of boundary strokes/shapes enclosing this bucket fill */
  boundElementIds?: string[];
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
  /** Corner radius for rectangles / rounded rectangles (px) */
  cornerRadius?: number;
  /** Drop shadow */
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffset?: number;
  /** Linear gradient fill: second colour + angle in degrees */
  gradientTo?: string;
  gradientAngle?: number;
  /** Star: number of points (3-12) and inner radius ratio (0.1-0.9) */
  starPoints?: number;
  starInner?: number;
  /** Polygon: round the corners (curved path through the points) */
  smooth?: boolean;
  /** Colour of the text label placed inside a shape */
  textColor?: string;
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
  {
    id: 'Inter',
    label: 'Inter',
    category: 'Modern Sans',
    cssFamily: "'Inter', sans-serif",
  },
  {
    id: 'Roboto',
    label: 'Roboto',
    category: 'Modern Sans',
    cssFamily: "'Roboto', sans-serif",
  },
  {
    id: 'Open Sans',
    label: 'Open Sans',
    category: 'Modern Sans',
    cssFamily: "'Open Sans', sans-serif",
  },
  {
    id: 'Lato',
    label: 'Lato',
    category: 'Modern Sans',
    cssFamily: "'Lato', sans-serif",
  },
  {
    id: 'Montserrat',
    label: 'Montserrat',
    category: 'Modern Sans',
    cssFamily: "'Montserrat', sans-serif",
  },
  {
    id: 'Poppins',
    label: 'Poppins',
    category: 'Modern Sans',
    cssFamily: "'Poppins', sans-serif",
  },
  {
    id: 'Nunito',
    label: 'Nunito',
    category: 'Yuvarlak Sans',
    cssFamily: "'Nunito', sans-serif",
  },
  {
    id: 'Quicksand',
    label: 'Quicksand',
    category: 'Yuvarlak Sans',
    cssFamily: "'Quicksand', sans-serif",
  },
  {
    id: 'Comfortaa',
    label: 'Comfortaa',
    category: 'Yuvarlak Sans',
    cssFamily: "'Comfortaa', sans-serif",
  },
  {
    id: 'Raleway',
    label: 'Raleway',
    category: 'Modern Sans',
    cssFamily: "'Raleway', sans-serif",
  },
  {
    id: 'Ubuntu',
    label: 'Ubuntu',
    category: 'Modern Sans',
    cssFamily: "'Ubuntu', sans-serif",
  },
  {
    id: 'Work Sans',
    label: 'Work Sans',
    category: 'Modern Sans',
    cssFamily: "'Work Sans', sans-serif",
  },
  {
    id: 'DM Sans',
    label: 'DM Sans',
    category: 'Modern Sans',
    cssFamily: "'DM Sans', sans-serif",
  },
  {
    id: 'Rubik',
    label: 'Rubik',
    category: 'Modern Sans',
    cssFamily: "'Rubik', sans-serif",
  },
  {
    id: 'Barlow',
    label: 'Barlow',
    category: 'Modern Sans',
    cssFamily: "'Barlow', sans-serif",
  },
  {
    id: 'Josefin Sans',
    label: 'Josefin Sans',
    category: 'Geometrik',
    cssFamily: "'Josefin Sans', sans-serif",
  },
  {
    id: 'Lora',
    label: 'Lora',
    category: 'Klasik Serif',
    cssFamily: "'Lora', serif",
  },
  {
    id: 'Roboto Slab',
    label: 'Roboto Slab',
    category: 'Klasik Serif',
    cssFamily: "'Roboto Slab', serif",
  },
  {
    id: 'Cormorant Garamond',
    label: 'Cormorant Garamond',
    category: 'Klasik Serif',
    cssFamily: "'Cormorant Garamond', serif",
  },
  {
    id: 'Cinzel',
    label: 'Cinzel',
    category: 'Klasik Serif',
    cssFamily: "'Cinzel', serif",
  },
  {
    id: 'Abril Fatface',
    label: 'Abril Fatface',
    category: 'Poster / Başlık',
    cssFamily: "'Abril Fatface', serif",
  },
  {
    id: 'Bebas Neue',
    label: 'Bebas Neue',
    category: 'Poster / Başlık',
    cssFamily: "'Bebas Neue', sans-serif",
  },
  {
    id: 'Anton',
    label: 'Anton',
    category: 'Poster / Başlık',
    cssFamily: "'Anton', sans-serif",
  },
  {
    id: 'Archivo Black',
    label: 'Archivo Black',
    category: 'Poster / Başlık',
    cssFamily: "'Archivo Black', sans-serif",
  },
  {
    id: 'Righteous',
    label: 'Righteous',
    category: 'Poster / Başlık',
    cssFamily: "'Righteous', sans-serif",
  },
  {
    id: 'Bangers',
    label: 'Bangers',
    category: 'Çizgi Roman',
    cssFamily: "'Bangers', cursive",
  },
  {
    id: 'Pacifico',
    label: 'Pacifico',
    category: 'El Yazısı',
    cssFamily: "'Pacifico', cursive",
  },
  {
    id: 'Lobster',
    label: 'Lobster',
    category: 'El Yazısı',
    cssFamily: "'Lobster', cursive",
  },
  {
    id: 'Permanent Marker',
    label: 'Permanent Marker',
    category: 'El Yazısı',
    cssFamily: "'Permanent Marker', cursive",
  },
  {
    id: 'Satisfy',
    label: 'Satisfy',
    category: 'El Yazısı',
    cssFamily: "'Satisfy', cursive",
  },
  {
    id: 'Indie Flower',
    label: 'Indie Flower',
    category: 'El Yazısı',
    cssFamily: "'Indie Flower', cursive",
  },
  {
    id: 'Shadows Into Light',
    label: 'Shadows Into Light',
    category: 'El Yazısı',
    cssFamily: "'Shadows Into Light', cursive",
  },
  {
    id: 'Amatic SC',
    label: 'Amatic SC',
    category: 'El Yazısı',
    cssFamily: "'Amatic SC', cursive",
  },
  {
    id: 'Kalam',
    label: 'Kalam',
    category: 'El Yazısı',
    cssFamily: "'Kalam', cursive",
  },
  {
    id: 'Patrick Hand',
    label: 'Patrick Hand',
    category: 'El Yazısı',
    cssFamily: "'Patrick Hand', cursive",
  },
  {
    id: 'Great Vibes',
    label: 'Great Vibes',
    category: 'Kaligrafik',
    cssFamily: "'Great Vibes', cursive",
  },
  {
    id: 'Fira Code',
    label: 'Fira Code',
    category: 'Kod / Monospace',
    cssFamily: "'Fira Code', monospace",
  },
  {
    id: 'Source Code Pro',
    label: 'Source Code Pro',
    category: 'Kod / Monospace',
    cssFamily: "'Source Code Pro', monospace",
  },
  {
    id: 'Roboto Mono',
    label: 'Roboto Mono',
    category: 'Kod / Monospace',
    cssFamily: "'Roboto Mono', monospace",
  },
  {
    id: 'Press Start 2P',
    label: 'Press Start 2P',
    category: 'Piksel / Retro',
    cssFamily: "'Press Start 2P', monospace",
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
  /** Which file tab the cursor is in ('main' or a CodeFile id) */
  fileId?: string;
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
  /** userId -> time the user saw this message */
  readBy?: Record<string, number>;
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
  identityKey?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  color: string;
  cursorColor?: string;
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
