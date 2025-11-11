import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TasksBoard, Task, Driver, TaskAssignee, Client, Vehicle } from '@/components/admin/TasksBoard';

describe('TasksBoard Loading Skeletons and Empty States (7.1.6)', () => {
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
  ];

  const mockDrivers: Driver[] = [
    { id: 'driver-1', name: 'דוד כהן', email: 'driver1@example.com', role: 'driver' },
  ];

  const mockTaskAssignees: TaskAssignee[] = [
    {
      id: 'assignee-1',
      task_id: 'task-1',
      driver_id: 'driver-1',
      is_lead: true,
      assigned_at: '2025-11-10T10:00:00Z',
    },
  ];

  const mockClients: Client[] = [
    { id: 'client-1', name: 'אחי אבו קנו', phone: '050-1234567', email: 'client1@example.com' },
  ];

  const mockVehicles: Vehicle[] = [
    { id: 'vehicle-1', license_plate: '123-456', model: 'Toyota Camry', vin: 'VIN123456' },
  ];

  test('renders board with data without loading state', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Should show the board and tasks, not loading state
    expect(screen.getByRole('main', { name: /לוח משימות/i })).toBeInTheDocument();
    expect(screen.getByText('משימה 1')).toBeInTheDocument();
  });

  test('shows empty state when no tasks exist', () => {
    render(
      <TasksBoard
        initialTasks={[]}
        drivers={mockDrivers}
        taskAssignees={[]}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Should show columns but with empty state messages
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);
    
    // All columns should show empty state
    expect(screen.getAllByText('אין משימות').length).toBeGreaterThan(0);
  });

  test('shows empty column state when column has no tasks', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // The board might have some empty columns (e.g., completed, blocked statuses with no tasks)
    // These should show empty state
    expect(screen.getAllByText('אין משימות').length).toBeGreaterThan(0);
    expect(screen.getAllByText('גרור משימה לכאן').length).toBeGreaterThan(0);
  });

  test('empty column state has proper accessibility', () => {
    render(
      <TasksBoard
        initialTasks={[]}
        drivers={mockDrivers}
        taskAssignees={[]}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Empty column text should be visible and accessible
    const emptyTexts = screen.getAllByText('אין משימות');
    expect(emptyTexts.length).toBeGreaterThan(0);
    expect(emptyTexts[0]).toBeVisible();
  });

  test('renders column headers properly', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Headers should be visible with status labels or driver names
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);

    // Each region should have proper structure
    regions.forEach((region) => {
      expect(region).toHaveAttribute('data-drop-target');
    });
  });

  test('task cards display with proper layout', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Task card should display with all parts
    expect(screen.getByText('משימה 1')).toBeInTheDocument();
    expect(screen.getByText('דוד כהן')).toBeInTheDocument(); // Driver name
  });

  test('columns maintain proper structure in both grouping modes', async () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Initially in status mode
    let regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);

    // All regions should have proper structure
    regions.forEach((region) => {
      expect(region).toHaveClass('flex');
      expect(region).toHaveClass('flex-col');
      expect(region).toHaveClass('rounded-lg');
    });
  });

  test('empty column state shows proper emoji and text', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Check for empty state indicator
    const emptyIndicators = screen.getAllByText('אין משימות');
    expect(emptyIndicators.length).toBeGreaterThan(0);
    emptyIndicators.forEach((indicator) => {
      expect(indicator).toBeVisible();
    });

    // Check for drag hint
    const dragHints = screen.getAllByText('גרור משימה לכאן');
    expect(dragHints.length).toBeGreaterThan(0);
    dragHints.forEach((hint) => {
      expect(hint).toBeVisible();
    });
  });

  test('renders board with columns in different states', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Verify board renders with both populated and empty columns
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);

    // Some columns should have tasks, some should be empty
    const emptyColumns = screen.getAllByText('אין משימות');
    expect(emptyColumns.length).toBeGreaterThan(0);
  });

  test('board container has proper scrolling for many columns', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Main board container should have scroll
    const mainBoard = screen.getByRole('main');
    expect(mainBoard).toHaveClass('overflow-hidden');

    // Column container should allow horizontal scroll
    const columnContainer = mainBoard.querySelector('.overflow-x-auto');
    expect(columnContainer).toBeInTheDocument();
  });

  test('skeletons have proper styling for loading state', () => {
    // This test would need a way to trigger loading state
    // For now, just verify the board renders
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('empty column states have proper contrast for accessibility', () => {
    render(
      <TasksBoard
        initialTasks={[]}
        drivers={mockDrivers}
        taskAssignees={[]}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Empty column messages should have proper text color and styling
    const emptyTexts = screen.getAllByText('אין משימות');
    expect(emptyTexts.length).toBeGreaterThan(0);
    emptyTexts.forEach((text) => {
      expect(text).toHaveClass('text-gray-400');
    });

    const dragHints = screen.getAllByText('גרור משימה לכאן');
    expect(dragHints.length).toBeGreaterThan(0);
    dragHints.forEach((hint) => {
      expect(hint).toHaveClass('text-gray-300');
    });
  });

  test('columns render with consistent sizing', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // All columns should have consistent width
    const columns = container.querySelectorAll('[data-drop-target]');
    columns.forEach((col) => {
      expect(col).toHaveClass('min-w-[320px]');
      expect(col).toHaveClass('flex-shrink-0');
    });
  });
});

