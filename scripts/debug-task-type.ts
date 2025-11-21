
import { createClient } from '@supabase/supabase-js';

// Manually creating client to avoid import issues with relative paths if I run from root
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  console.log('Searching for task with title "checklist"...');
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, type, status, priority')
    .ilike('title', '%checklist%');

  if (error) {
    console.error('Error fetching tasks:', error);
    return;
  }

  console.log('Found tasks:', JSON.stringify(data, null, 2));
}

main();

