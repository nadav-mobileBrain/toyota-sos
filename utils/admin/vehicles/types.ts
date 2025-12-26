export type VehicleRow = {
  id: string;
  license_plate: string;
  model: string | null;
  is_available: boolean;
  unavailability_reason: string | null;
  created_at: string;
};

