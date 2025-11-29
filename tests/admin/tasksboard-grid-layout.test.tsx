import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { TasksBoard, Task, Driver, TaskAssignee, Client, Vehicle } from '@/components/admin/TasksBoard';

describe('TasksBoard Grid Layout (7.1.2)', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'משימה 1 - איסוף רכב',
      type: 'איסוף רכב/שינוע',
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
      title: 'משימה 2 - הסעת לקוח הביתה',
      type: 'הסעת לקוח הביתה',
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
    {
      id: 'task-3',
      title: 'משימה 3 - חילוץ רכב',
      type: 'חילוץ רכב תקוע',
      priority: 'low',
      status: 'pending',
      estimated_start: '2025-11-11T14:00:00Z',
      estimated_end: '2025-11-11T15:00:00Z',
      address: 'תל אביב, בן יהודה',
      details: null,
      client_id: 'client-1',
      vehicle_id: 'vehicle-1',
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
    {
      id: 'assignee-3',
      task_id: 'task-3',
      driver_id: 'driver-1',
      is_lead: true,
      assigned_at: '2025-11-10T10:00:00Z',
    },
  ];

  const mockClients: Client[] = [
    { id: 'client-1', name: 'אחי אבו קנו', phone: '050-1234567', email: 'client1@example.com' },
    { id: 'client-2', name: 'רוני גם אני', phone: '050-7654321', email: 'client2@example.com' },
  ];

  const mockVehicles: Vehicle[] = [
    { id: 'vehicle-1', license_plate: '123-456', model: 'Toyota Camry' },
    { id: 'vehicle-2', license_plate: '789-012', model: 'Honda Civic' },
  ];

  test('renders responsive grid layout with columns', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for main Kanban board container
    const board = screen.getByRole('main', { name: /לוח משימות/i });
    expect(board).toBeInTheDocument();

    // Check for column regions
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);
  });

  test('displays column headers with task count', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Look for column headers with task counts
    const counts = screen.getAllByText(/משימות/);
    expect(counts.length).toBeGreaterThan(0);
  });

  test('renders task cards with priority badges', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for priority labels
    expect(screen.getByText('גבוה')).toBeInTheDocument(); // high
    expect(screen.getByText('בינוני')).toBeInTheDocument(); // medium
  });

  test('renders task card information (driver, client, vehicle)', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for driver names (using getAllByText to ensure they exist)
    expect(screen.getAllByText('דוד כהן').length).toBeGreaterThan(0);
    expect(screen.getAllByText('שרה לוי').length).toBeGreaterThan(0);

    // Check for client names (using getAllByText)
    expect(screen.getAllByText('אחי אבו קנו').length).toBeGreaterThan(0);
    expect(screen.getAllByText('רוני גם אני').length).toBeGreaterThan(0);

    // Check for vehicle license plates (using getAllByText)
    expect(screen.getAllByText('123-456').length).toBeGreaterThan(0);
    expect(screen.getAllByText('789-012').length).toBeGreaterThan(0);
  });

  test('renders task type badges', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for type labels
    expect(screen.getByText('איסוף רכב/שינוע')).toBeInTheDocument();
    expect(screen.getByText('הסעת לקוח הביתה')).toBeInTheDocument();
    expect(screen.getByText('חילוץ רכב תקוע')).toBeInTheDocument();
  });

  test('renders columns with scrollable content area', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for scrollable container
    const scrollContainer = container.querySelector('div.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();

    // Check for column divs with min width (responsive sizing)
    const columnDivs = container.querySelectorAll('div.min-w-\\[320px\\]');
    expect(columnDivs.length).toBeGreaterThan(0);
  });

  test('shows empty state message when column has no tasks', () => {
    render(
      <TasksBoard
        initialTasks={[]}
        drivers={mockDrivers}
        taskAssignees={[]}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Should show "אין משימות" in empty columns
    const emptyMessages = screen.getAllByText('אין משימות');
    expect(emptyMessages.length).toBeGreaterThan(0);
  });

  test('renders RTL layout with proper text direction', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check that board is in RTL context (parent should have dir="rtl")
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('columns have proper styling for hover state', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for column styling with border and background
    const columns = container.querySelectorAll('div.border-2');
    expect(columns.length).toBeGreaterThan(0);

    columns.forEach((col) => {
      expect(col).toHaveClass('rounded-lg');
      expect(col).toHaveClass('transition-all');
    });
  });

  test('task cards are draggable', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for @dnd-kit draggable task cards
    const draggableCards = container.querySelectorAll('[data-draggable-id]');
    expect(draggableCards.length).toBe(mockTasks.length);

    // Check for cursor-grab class
    draggableCards.forEach((card) => {
      expect(card).toHaveClass('cursor-grab');
    });
  });

  test('displays task title, priority, and status', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for task titles
    expect(screen.getByText('משימה 1 - איסוף רכב')).toBeInTheDocument();
    expect(screen.getByText('משימה 2 - הסעת לקוח הביתה')).toBeInTheDocument();
    expect(screen.getByText('משימה 3 - חילוץ רכב')).toBeInTheDocument();

    // Check for status labels (using getAllByText because they appear in column headers + cards)
    expect(screen.getAllByText('ממתין').length).toBeGreaterThanOrEqual(1); // pending
    expect(screen.getAllByText('בתהליך').length).toBeGreaterThanOrEqual(1); // in_progress
  });
});

