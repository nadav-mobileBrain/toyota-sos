import { useDroppable } from '@dnd-kit/core';
import type { KanbanColumnProps } from '@/types/board';
import { TaskCard } from './TaskCard';

export function KanbanColumn({
  column,
  tasks,
  isOver,
  activeTaskId,
  selectedIds,
  taskAssigneeMap,
  driverMap,
  clientMap,
  vehicleMap,
  conflict,
  onDragStart,
  toggleSelected,
  selectAllInColumn,
  bulkEnabled,
  onEdit,
}: KanbanColumnProps) {
  // Setup droppable
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: column.type },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-0 min-w-[320px] shrink-0 flex-col rounded-lg border-2 transition-all ${
        isOver
          ? 'border-toyota-primary/50 bg-toyota-50/30 shadow-md'
          : 'border-gray-200 bg-gray-50'
      }`}
      role="region"
      aria-label={`עמודה: ${column.label}`}
      data-drop-target={column.id}
    >
      {/* Column Header */}
      <div className="sticky top-0 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-blue-700 underline text-xl">
              {column.label}
            </h3>
            <p className="text-xs font-medium text-gray-500">
              {tasks.length} {tasks.length === 1 ? 'משימה' : 'משימות'}
            </p>
          </div>
          <div className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-700">
            {tasks.length}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {bulkEnabled && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                onChange={(e) => selectAllInColumn(column.id, e.target.checked)}
              />
              בחר הכל
            </label>
          )}
        </div>
      </div>

      {/* Column Body - Scrollable task list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 pb-10">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-2 text-2xl">📭</div>
            <p className="text-sm font-medium text-gray-400">אין משימות</p>
            <p className="text-xs text-gray-300">גרור משימה לכאן</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isActive={activeTaskId === task.id}
              assignees={taskAssigneeMap.get(task.id) || []}
              driverMap={driverMap}
              clientMap={clientMap}
              vehicleMap={vehicleMap}
              conflictInfo={conflict[task.id]}
              onDragStart={onDragStart}
              onEdit={onEdit}
              selected={selectedIds.has(task.id)}
              onToggleSelected={() => toggleSelected(task.id)}
              showSelect={bulkEnabled}
            />
          ))
        )}
      </div>
    </div>
  );
}
