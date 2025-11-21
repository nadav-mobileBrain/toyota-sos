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
  model: string;
  vin: string;
}

