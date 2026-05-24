export interface PaginatedResponse<T> {
  paging: {
    count: number;
    limit: number;
    offset: number;
    next: string | null;
  };
  content: T[];
}

export interface YGProject {
  id: string;
  title: string;
  users: Record<string, string>;
}

export interface YGBoard {
  id: string;
  title: string;
  projectId: string;
  stickers?: Record<string, unknown>;
}

export interface YGColumn {
  id: string;
  title: string;
  boardId: string;
  color?: string;
}

export interface YGDeadline {
  timestamp: number;
  startDate?: number;
  withTime?: boolean;
}

export interface YGTask {
  id: string;
  title: string;
  columnId: string;
  description?: string;
  assigned?: string[];
  deadline?: YGDeadline | null;
  archived?: boolean;
  completed?: boolean;
  stickers?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
  timeTracking?: unknown;
  createdBy?: string;
  createdAt?: string;
  subtasks?: number;
}

export interface YGUser {
  id: string;
  email: string;
  realName?: string;
  isAdmin?: boolean;
  status?: string;
  lastActivity?: number;
}

export interface YGStickerState {
  id: string;
  name: string;
  color?: string;
  deleted?: boolean;
}

export interface YGSticker {
  id: string;
  name: string;
  icon?: string;
  deleted?: boolean;
  states?: YGStickerState[];
}

export interface YGSprintStickerState {
  id: string;
  name: string;
  begin?: number; // unix seconds
  end?: number;
  deleted?: boolean;
}

export interface YGSprintSticker {
  id: string;
  name: string;
  deleted?: boolean;
  states?: YGSprintStickerState[];
}

export interface YGChatMessage {
  id: string;
  text: string;
  fromUserId?: string;
  timestamp?: number;
  label?: string;
}
