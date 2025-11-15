export type DriverRow = {
  id: string;
  name: string | null;
  email: string | null;
  employee_id: string | null;
  role: 'driver' | 'admin' | 'manager' | 'viewer';
  created_at: string;
  updated_at: string;
};


