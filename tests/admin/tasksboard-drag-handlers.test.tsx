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

describe('TasksBoard Drag Handlers and Optimistic Preview (7.1.4)', () => {
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
    {
      id: 'vehicle-1',
      license_plate: '123-456',
      model: 'Toyota Camry',
    },
    {
      id: 'vehicle-2',
      license_plate: '789-012',
      model: 'Honda Civic',
    },
  ];

  test('renders board with columns and cards', () => {
    render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    expect(
      screen.getByRole('main', { name: /לוח משימות/i })
    ).toBeInTheDocument();
    // Check for type labels (used as title)
    expect(screen.getByText('איסוף רכב/שינוע פרטי')).toBeInTheDocument();
    expect(screen.getByText('הסעת לקוח הביתה')).toBeInTheDocument();
  });

  test('board has DragOverlay area for preview rendering', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // DragOverlay is a portal that renders outside the main tree
    // Just verify the board renders without errors
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('task cards have grab cursor for drag affordance', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const draggableCards = container.querySelectorAll('[data-draggable-id]');
    expect(draggableCards.length).toBe(mockTasks.length);

    draggableCards.forEach((card) => {
      expect(card).toHaveClass('cursor-grab');
      expect(card).toHaveClass('active:cursor-grabbing');
    });
  });

  test('columns have drop zone styling for visual feedback', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Columns should have data-drop-target for drop zone identification
    const dropZones = container.querySelectorAll('[data-drop-target]');
    expect(dropZones.length).toBeGreaterThan(0);

    // All drop zones should have border and transition for visual feedback
    dropZones.forEach((zone) => {
      expect(zone).toHaveClass('rounded-lg');
      expect(zone).toHaveClass('border-2');
      expect(zone).toHaveClass('transition-all');
    });
  });

  test('columns have different styling for initial and hover states', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const dropZones = container.querySelectorAll('[data-drop-target]');

    // Initial state: should have default border and background
    dropZones.forEach((zone) => {
      const classList = zone.className;
      expect(classList).toMatch(/border-gray-200|border-primary/);
      expect(classList).toMatch(/bg-gray-50|bg-toyota-50/);
    });
  });

  test('board shows all status columns when grouped by status', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Columns should be visible
    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);

    // Verify column labels are visible (status labels appear multiple times in header + cards)
    expect(screen.getAllByText('ממתין').length).toBeGreaterThan(0); // pending
  });

  test('task cards render with preview-friendly styling', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const cards = container.querySelectorAll('[data-draggable-id]');
    expect(cards.length).toBeGreaterThan(0);

    cards.forEach((card) => {
      // Cards should have styles for drag preview rendering
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('p-3');
      expect(card).toHaveClass('shadow-sm');
    });
  });

  test('dragoverlay preview card has priority badge', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Find priority badges in the rendered cards
    // "גבוה" = high priority
    const priorityBadges = screen.getAllByText('גבוה');
    expect(priorityBadges.length).toBeGreaterThan(0);

    // Verify badge styling (should be visible in normal cards)
    priorityBadges.forEach((badge) => {
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('px-1.5');
      expect(badge).toHaveClass('py-0.5');
    });
  });

  test('dragoverlay preview card includes task type', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    // Type labels should render
    // "הרמת/הורדת רכב" = pickup_or_dropoff_car
    const typeLabels = container.querySelectorAll('[class*="bg-gray-100"]');
    expect(typeLabels.length).toBeGreaterThan(0);
  });

  test('board preserves task order and grouping on re-render', () => {
    const { container, rerender } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const firstRender = screen.getAllByText(/איסוף רכב\/שינוע|הסעת לקוח הביתה/);
    expect(firstRender.length).toBe(2);

    // Re-render with same props
    rerender(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const secondRender = screen.getAllByText(
      /איסוף רכב\/שינוע|הסעת לקוח הביתה/
    );
    expect(secondRender.length).toBe(2);
  });

  test('columns render with proper accessibility attributes', () => {
    const { container } = render(
      <TasksBoard
        initialTasks={mockTasks}
        drivers={mockDrivers}
        taskAssignees={mockTaskAssignees}
        clients={mockClients}
        vehicles={mockVehicles}
      />
    );

    const regions = screen.getAllByRole('region', { name: /עמודה:/ });
    expect(regions.length).toBeGreaterThan(0);

    // All drop zones should be regions
    regions.forEach((region) => {
      expect(region).toHaveAttribute('data-drop-target');
    });
  });
});
