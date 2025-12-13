/**
 * Board UI and component type definitions
 */

import type { DragStartEvent } from '@dnd-kit/core';
import type { Task, TaskAssignee } from './task';
import type { Driver } from './user';
import type { Client, Vehicle } from './entity';

export type GroupBy = 'driver' | 'status';
export type SortBy = 'עדיפות' | 'זמן' | 'נהג';
export type SortDir = 'asc' | 'desc';

export interface DragItem {
  type: string;
  taskId: string;
  sourceColumn: string;
}

export interface TasksBoardProps {
  initialTasks: Task[];
  drivers: Driver[];
  taskAssignees: TaskAssignee[];
  clients: Client[];
  vehicles: Vehicle[];
  driverBreaks?: Record<string, boolean>;
}

export interface KanbanColumnProps {
  column: { id: string; label: string; type: 'driver' | 'status' };
  tasks: Task[];
  isOver: boolean;
  activeTaskId: string | null;
  selectedIds: Set<string>;
  taskAssigneeMap: Map<string, TaskAssignee[]>;
  driverMap: Map<string, Driver>;
  clientMap: Map<string, Client>;
  vehicleMap: Map<string, Vehicle>;
  conflict: Record<string, { by?: string | null; at?: string | null }>;
  onDragStart: (event: DragStartEvent) => void;
  toggleSelected: (taskId: string) => void;
  selectAllInColumn: (columnId: string, checked: boolean) => void;
  bulkEnabled: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  driverBreaks?: Record<string, boolean>;
}

export interface TaskCardProps {
  task: Task;
  columnId: string;
  isActive: boolean;
  assignees: TaskAssignee[];
  driverMap: Map<string, Driver>;
  clientMap: Map<string, Client>;
  vehicleMap: Map<string, Vehicle>;
  conflictInfo?: { by?: string | null; at?: string | null };
  onDragStart: (event: DragStartEvent) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  selected: boolean;
  onToggleSelected: () => void;
  showSelect: boolean;
}
