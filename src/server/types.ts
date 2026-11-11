import { WebSocket } from 'ws';

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface RoomSettings {
  isLocked: boolean;
  maxUsers: number;
  defaultRole: 'editor' | 'viewer';
  allowGuestDraw: boolean;
  ownerId: string;
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
  points?: { x: number; y: number }[];
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
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
    type?: string;
  };
  recipientId?: string;
  recipientName?: string;
  isPrivate?: boolean;
}

export interface UserPresence {
  id: string;
  name: string;
  avatar: string;
  color: string;
  role: UserRole;
  cursor: { x: number; y: number };
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
  ownerName: string;
  settings: RoomSettings;
  roleAssignments: Map<string, UserRole>;
  elements: Map<string, CanvasElement>;
  elementOrder: string[];
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
  users: Map<string, { ws: WebSocket; presence: UserPresence }>;
}

export interface CompilerExecutionResult {
  stdout: string;
  stderr: string;
  compileOutput?: string;
  exitCode: number;
  engine: string;
}
