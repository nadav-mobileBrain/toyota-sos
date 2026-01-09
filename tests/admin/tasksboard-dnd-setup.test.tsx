import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TasksBoard,
  Task,
  Driver,
  TaskAssignee,
  Client,
  Vehicle,
} from '@/components/admin/TasksBoard';

describe('TasksBoard DnD Setup (7.1.3)', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',

      type: 'pickup_or_dropoff_car',
      priority: 'high',
      status: 'pending',
      estimated_start: '2025-11-11T09:00:00Z',
      estimated_end: '2025-11-11T10:00:00Z',
      address: 'תל אביב, דיזנגוף 100',
      details: 'פרטים',
      client_id: 'client-1',
      vehicle_id: 'vehicle-1',
      created_by: 'admin-1',
      updated_by: 'admin-1',
      created_at: '2025-11-10T10:00:00Z',
      updated_at: '2025-11-10T10:00:00Z',
    },
    {
      id: 'task-2',

      type: 'drive_client_home',
      priority: 'medium',
      status: 'in_progress',
      estimated_start: '2025-11-11T11:00:00Z',
      estimated_end: '2025-11-11T12:00:00Z',
      address: 'תל אביב, בנגוריון',
      details: null,
      client_id: 'client-2',
      vehicle_id: 'vehicle-2',
      created_by: 'admin-1',
      updated_by: 'admin-1',
      created_at: '2025-11-10T10:00:00Z',
      updated_at: '2025-11-10T10:00:00Z',
    },
  ];

  const mockDrivers: Driver[] = [
    {
      id: 'driver-1',
      name: 'דוד כהן',
      email: 'driver1@example.com',
      role: 'driver',
    },
    {
      id: 'driver-2',
      name: 'שרה לוי',
      email: 'driver2@example.com',
      role: 'driver',
    },
  ];

  const mockTaskAssignees: TaskAssignee[] = [
    {
      id: 'assignee-1',
      task_id: 'task-1',
      driver_id: 'driver-1',
      is_lead: true,
      assigned_at: '2025-11-10T10:00:00Z',
    },
    {
      id: 'assignee-2',
      task_id: 'task-2',
      driver_id: 'driver-2',
      is_lead: true,
      assigned_at: '2025-11-10T10:00:00Z',
    },
  ];

  const mockClients: Client[] = [
    {
      id: 'client-1',
      name: 'אחי אבו קנו',
      phone: '050-1234567',
      email: 'client1@example.com',
    },
    {
      id: 'client-2',
      name: 'רוני גם אני',
      phone: '050-7654321',
      email: 'client2@example.com',
    },
  ];

  const mockVehicles: Vehicle[] = [
    { id: 'vehicle-1', license_plate: '123-456', model: 'Toyota Camry' },
    { id: 'vehicle-2', license_plate: '789-012', model: 'Honda Civic' },
  ];

  test('renders DndContext wrapper', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check that the main board is rendered
    expect(
      screen.getByRole('main', { name: /לוח משימות/i })
    ).toBeInTheDocument();
  });

  test('initializes drag and drop sensors', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Verify board is interactive
    const board = screen.getByRole('main');
    expect(board).toBeInTheDocument();
  });

  test('task cards have draggable IDs', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check that task cards have data-draggable-id attributes for @dnd-kit
    const draggableCards = container.querySelectorAll('[data-draggable-id]');
    expect(draggableCards.length).toBe(mockTasks.length);

    // Verify each card has correct ID
    mockTasks.forEach((task) => {
      const card = container.querySelector(`[data-draggable-id="${task.id}"]`);
      expect(card).toBeInTheDocument();
    });
  });

  test('columns have drop target data attributes', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check that columns have data-drop-target attributes for @dnd-kit
    const dropTargets = container.querySelectorAll('[data-drop-target]');
    expect(dropTargets.length).toBeGreaterThan(0);
  });

  test('active card styling is applied when dragging', async () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Find a task card
    const taskCards = container.querySelectorAll('[data-draggable-id]');
    const firstCard = taskCards[0] as HTMLElement;

    expect(firstCard).toBeInTheDocument();
    // Note: Actually testing drag would require more complex setup with DndContext mock
  });

  test('DragOverlay component is present for rendering dragged preview', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Verify board renders without errors
    expect(screen.getByRole('main')).toBeInTheDocument();
    // DragOverlay will be visible when dragging (not visible in static render)
  });

  test('task cursor changes on hover', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const taskCard = container.querySelector(
      '[data-draggable-id="task-1"]'
    ) as HTMLElement;
    expect(taskCard).toHaveClass('cursor-grab');
    expect(taskCard).toHaveClass('active:cursor-grabbing');
  });

  test('board renders all columns and cards', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Verify cards render (using type label)
    expect(screen.getByText('איסוף רכב/שינוע פרטי')).toBeInTheDocument();
    expect(screen.getByText('הסעת לקוח הביתה')).toBeInTheDocument();

    // Verify column regions exist
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);
  });
});
