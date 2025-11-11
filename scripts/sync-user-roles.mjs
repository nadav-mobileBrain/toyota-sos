#!/usr/bin/env node

/**
 * Script to sync user roles from profiles table to Supabase auth.users metadata
 * This fixes login redirects where role wasn't properly set in user_metadata
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * 
 * Usage:
 *   node scripts/sync-user-roles.mjs                          # Sync all users
 *   node scripts/sync-user-roles.mjs --email=user@example.com # Sync specific user
 *   node scripts/sync-user-roles.mjs --id=uuid-here           # Sync by ID
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

// Parse arguments
const args = process.argv.slice(2);
let email = null;
let id = null;
let shouldSyncAll = true;

args.forEach((arg) => {
  if (arg.startsWith('--email=')) {
    email = arg.replace('--email=', '');
    shouldSyncAll = false;
  } else if (arg.startsWith('--id=')) {
    id = arg.replace('--id=', '');
    shouldSyncAll = false;
  }
});

async function syncByEmail(emailAddr) {
  console.log(`\n🔄 Syncing user: ${emailAddr}`);

  try {
    // Get user from auth
    const { data: authListData, error: listError } = await admin.auth.admin.listUsers();

    if (listError || !authListData.users) {
      throw new Error(listError?.message || 'Failed to list users');
    }

    const user = authListData.users.find((u) => u.email === emailAddr);
    if (!user) {
      console.error(`❌ User not found: ${emailAddr}`);
      process.exit(1);
    }

    // Get user profile to find role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email, name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(profileError?.message || 'Profile not found');
    }

    const newRole = profile.role || 'viewer';

    // Update user metadata
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        role: newRole,
      },
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log(`✅ Synced ${emailAddr}`);
    console.log(`   Name: ${profile.name}`);
    console.log(`   Role: ${newRole}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to sync ${emailAddr}: ${msg}`);
    process.exit(1);
  }
}

async function syncById(userId) {
  console.log(`\n🔄 Syncing user ID: ${userId}`);

  try {
    // Get user from auth
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'User not found');
    }

    // Get user profile to find role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email, name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error(profileError?.message || 'Profile not found');
    }

    const newRole = profile.role || 'viewer';

    // Update user metadata
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: newRole,
      },
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log(`✅ Synced user ${authData.user.email}`);
    console.log(`   Name: ${profile.name}`);
    console.log(`   Role: ${newRole}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to sync ${userId}: ${msg}`);
    process.exit(1);
  }
}

async function syncAll() {
  console.log(`\n🔄 Syncing all admin/manager/viewer users...`);

  let synced = 0;
  let failed = 0;
  const errors = [];

  try {
    // Get all non-driver profiles
    const { data: profiles, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email, name')
      .in('role', ['admin', 'manager', 'viewer']);

    if (profileError || !profiles) {
      throw new Error(profileError?.message || 'Failed to fetch profiles');
    }

    console.log(`   Found ${profiles.length} users to sync\n`);

    // Sync each user
    for (const profile of profiles) {
      try {
        const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
          user_metadata: {
            role: profile.role,
          },
        });

        if (updateError) {
          failed++;
          errors.push({
            email: profile.email,
            error: updateError.message,
          });
          console.log(`   ❌ ${profile.email} (${profile.role}): ${updateError.message}`);
        } else {
          synced++;
          console.log(`   ✅ ${profile.email} (${profile.role})`);
        }
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({
          email: profile.email,
          error: msg,
        });
        console.log(`   ❌ ${profile.email}: ${msg}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  Errors:`);
      errors.forEach((e) => {
        console.log(`   - ${e.email}: ${e.error}`);
      });
      process.exit(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Batch sync failed: ${msg}`);
    process.exit(1);
  }
}

// Run the script
(async () => {
  if (email) {
    await syncByEmail(email);
  } else if (id) {
    await syncById(id);
  } else if (shouldSyncAll) {
    await syncAll();
  }
})();

