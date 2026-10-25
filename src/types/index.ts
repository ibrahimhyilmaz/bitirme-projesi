export type ToolType =
  | 'select'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'star'
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

export interface CanvasElement {
  id: string;
  type:
    | 'pencil'
    | 'highlighter'
    | 'rectangle'
    | 'rounded-rect'
    | 'circle'
    | 'diamond'
    | 'triangle'
    | 'star'
    | 'arrow'
    | 'line'
    | 'text'
    | 'sticky'
    | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  imageUrl?: string;
  rotation?: number;
  isLocked?: boolean;
  createdBy: string;
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
  };
}

export interface UserPresence {
  id: string;
  name: string;
  avatar: string;
  color: string;
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
