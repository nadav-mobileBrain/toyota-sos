-- Add is_picked_up column to task_stops
ALTER TABLE task_stops ADD COLUMN is_picked_up BOOLEAN DEFAULT true;

-- RPC to batch update stop pickup status
CREATE OR REPLACE FUNCTION update_task_stops_pickup_status(
  p_updates jsonb
) RETURNS void AS $$
DECLARE
  update_record jsonb;
BEGIN
  FOR update_record IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE task_stops
    SET is_picked_up = (update_record->>'is_picked_up')::boolean,
        updated_at = NOW()
    WHERE id = (update_record->>'id')::uuid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
