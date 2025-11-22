
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get latest task
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (taskError) {
    console.error('Error fetching task:', taskError);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log('No tasks found');
    return;
  }

  const task = tasks[0];
  console.log('Latest Task:', {
    id: task.id,
    title: task.title,
    vehicle_id: task.vehicle_id,
    created_at: task.created_at
  });

  if (task.vehicle_id) {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', task.vehicle_id)
      .single();
    
    if (vehicleError) {
      console.error('Error fetching vehicle:', vehicleError);
    } else {
      console.log('Vehicle Details:', vehicle);
    }
  } else {
    console.log('No vehicle_id on this task.');
  }
}

main();
