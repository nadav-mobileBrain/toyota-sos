#!/usr/bin/env node

/**
 * Script to sync user roles from profiles table to Supabase auth.users metadata
 * This fixes login redirects where role wasn't properly set in user_metadata
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Usage:
 *   npx ts-node scripts/sync-user-roles.ts                    # Sync all users
 *   npx ts-node scripts/sync-user-roles.ts --email=user@example.com # Sync specific user
 *   npx ts-node scripts/sync-user-roles.ts --id=uuid-here      # Sync by ID
 */

import { createClient } from '@supabase/supabase-js';

interface SyncOptions {
  email?: string;
  id?: string;
  syncAll?: boolean;
}

async function syncUserRoles() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    syncAll: true, // default behavior
  };

  args.forEach((arg) => {
    if (arg.startsWith('--email=')) {
      options.email = arg.replace('--email=', '');
      options.syncAll = false;
    } else if (arg.startsWith('--id=')) {
      options.id = arg.replace('--id=', '');
      options.syncAll = false;
    }
  });

  // Initialize Supabase admin client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error(
      '   SUPABASE_SERVICE_ROLE_KEY:',
      supabaseServiceKey ? '✓' : '✗'
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (options.email) {
      await syncByEmail(admin, options.email);
    } else if (options.id) {
      await syncById(admin, options.id);
    } else if (options.syncAll) {
      await syncAll(admin);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function syncByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
) {
  console.log(`\n🔄 Syncing user: ${email}`);

  try {
    // Get user from auth
    const { data: authListData, error: listError } =
      await admin.auth.admin.listUsers();

    if (listError || !authListData.users) {
      throw new Error(listError?.message || 'Failed to list users');
    }

    const user = authListData.users.find((u: any) => u.email === email);
    if (!user) {
      console.error(`❌ User not found: ${email}`);
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
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          role: newRole,
        },
      }
    );

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log(`✅ Synced ${email}`);
    console.log(`   Name: ${profile.name}`);
    console.log(`   Role: ${newRole}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to sync ${email}: ${msg}`);
    process.exit(1);
  }
}

async function syncById(admin: ReturnType<typeof createClient>, id: string) {
  console.log(`\n🔄 Syncing user ID: ${id}`);

  try {
    // Get user from auth
    const { data: authData, error: authError } =
      await admin.auth.admin.getUserById(id);

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'User not found');
    }

    // Get user profile to find role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email, name')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      throw new Error(profileError?.message || 'Profile not found');
    }

    const newRole = profile.role || 'viewer';

    // Update user metadata
    const { error: updateError } = await admin.auth.admin.updateUserById(id, {
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
    console.error(`❌ Failed to sync ${id}: ${msg}`);
    process.exit(1);
  }
}

async function syncAll(admin: ReturnType<typeof createClient>) {
  console.log(`\n🔄 Syncing all admin/manager/viewer users...`);

  let synced = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

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
        const { error: updateError } = await admin.auth.admin.updateUserById(
          profile.id,
          {
            user_metadata: {
              role: profile.role,
            },
          }
        );

        if (updateError) {
          failed++;
          errors.push({
            email: profile.email,
            error: updateError.message,
          });
          console.log(
            `   ❌ ${profile.email} (${profile.role}): ${updateError.message}`
          );
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
syncUserRoles();
