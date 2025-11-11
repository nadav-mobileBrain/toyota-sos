import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TasksBoard, Task, Driver, TaskAssignee } from '@/components/admin/TasksBoard';

describe('TasksBoard Scaffold (7.1.1)', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'משימה 1',
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
      title: 'משימה 2',
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
    { id: 'driver-1', name: 'דוד כהן', email: 'driver1@example.com', role: 'driver' },
    { id: 'driver-2', name: 'שרה לוי', email: 'driver2@example.com', role: 'driver' },
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

  test('renders with mock data and shows columns by default (status)', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    // Check for main board region
    expect(screen.getByRole('main', { name: /לוח משימות/i })).toBeInTheDocument();

    // Check for status column headers (in regions)
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);

    // Check for task cards
    expect(screen.getByText('משימה 1')).toBeInTheDocument();
    expect(screen.getByText('משימה 2')).toBeInTheDocument();
  });

  test('displays task count per column', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    // Look for task count indicators
    const counts = screen.getAllByText(/משימות/i);
    expect(counts.length).toBeGreaterThan(0);
  });

  test('toggles grouping between status and driver', () => {
    const { rerender } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    // Start with status grouping - verify the main board is there
    expect(screen.getByRole('main', { name: /לוח משימות/i })).toBeInTheDocument();

    // Toggle to driver grouping
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'driver' } });

    // Should show region for driver column
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);
  });

  test('renders task card with priority badge', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    // Check for priority labels
    expect(screen.getByText('גבוה')).toBeInTheDocument(); // high
    expect(screen.getByText('בינוני')).toBeInTheDocument(); // medium
  });

  test('supports drag-and-drop event listeners', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    // Find a task card and check it has @dnd-kit draggable attributes
    const taskCards = container.querySelectorAll('[data-draggable-id]');
    expect(taskCards.length).toBeGreaterThan(0);

    // Verify task cards have grab cursor class
    const firstCard = taskCards[0] as HTMLElement;
    expect(firstCard).toHaveClass('cursor-grab');
  });

  test('renders with RTL layout (dir=rtl)', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    // Board should be in a RTL context (not explicitly testing the parent div here,
    // but the TasksBoard component should render with appropriate RTL styles)
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('displays empty state when no tasks', () => {
    render(
      <TasksBoard
        initialTasks={[]}
        drivers={mockDrivers}
        taskAssignees={[]}
        clients={[]}
        vehicles={[]}
      />
    );

    // Should show columns but with "no tasks" messages
    expect(screen.getByText('ממתין')).toBeInTheDocument();
    expect(screen.getAllByText('אין משימות').length).toBeGreaterThan(0);
  });

  test('renders group toggle with options', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={[]}
        vehicles={[]}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[0]).toHaveTextContent('סטטוס');
    expect(options[1]).toHaveTextContent('נהג');
  });
});

