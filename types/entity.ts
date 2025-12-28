/**
 * Related entity type definitions (clients, vehicles, etc.)
 */

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  model: string | null;
  is_available?: boolean;
  unavailability_reason?: string | null;
}

export interface ClientVehicle {
  id: string;
  client_id: string;
  license_plate: string;
  model: string | null;
  created_at?: string;
  updated_at?: string;
}

