import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface RequestBody {
  userId?: string;
  email?: string;
  syncAll?: boolean;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ userId: string; email?: string; error: string }>;
  message: string;
}

export async function main(req: Request): Promise<Response> {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { userId, email, syncAll } = body;

    // Get service role client for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing Supabase configuration',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    let result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
      message: '',
    };

    // Case 1: Sync specific user by ID
    if (userId && !syncAll) {
      result = await syncSingleUserById(admin, userId);
    }
    // Case 2: Sync specific user by email
    else if (email && !syncAll) {
      result = await syncSingleUserByEmail(admin, email);
    }
    // Case 3: Sync all admin/manager/viewer users
    else if (syncAll) {
      result = await syncAllUsers(admin);
    } else {
      return new Response(
        JSON.stringify({
          error: 'Must provide userId, email, or set syncAll=true',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMsg,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Sync a single user by ID
 */
async function syncSingleUserById(admin: any, userId: string): Promise<SyncResult> {
  const errors: Array<{ userId: string; email?: string; error: string }> = [];

  try {
    // Get user from auth
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);

    if (authError || !authData.user) {
      errors.push({
        userId,
        error: authError?.message || 'User not found',
      });
      return {
        success: false,
        synced: 0,
        failed: 1,
        errors,
        message: 'Failed to find user',
      };
    }

    const userEmail = authData.user.email;

    // Get user profile from profiles table to find their role
    const { data: profileData, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      errors.push({
        userId,
        email: userEmail,
        error: profileError?.message || 'Profile not found',
      });
      return {
        success: false,
        synced: 0,
        failed: 1,
        errors,
        message: 'Profile not found',
      };
    }

    const newRole = profileData.role || 'viewer';

    // Update user metadata
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: newRole,
      },
    });

    if (updateError) {
      errors.push({
        userId,
        email: userEmail,
        error: updateError.message,
      });
      return {
        success: false,
        synced: 0,
        failed: 1,
        errors,
        message: 'Failed to update user metadata',
      };
    }

    return {
      success: true,
      synced: 1,
      failed: 0,
      errors: [],
      message: `Synced user ${userEmail} with role: ${newRole}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push({
      userId,
      error: errorMsg,
    });
    return {
      success: false,
      synced: 0,
      failed: 1,
      errors,
      message: 'Error syncing user',
    };
  }
}

/**
 * Sync a single user by email
 */
async function syncSingleUserByEmail(admin: any, email: string): Promise<SyncResult> {
  const errors: Array<{ userId: string; email?: string; error: string }> = [];

  try {
    // Get user from auth by email
    const { data: authData, error: authError } = await admin.auth.admin.listUsers();

    if (authError || !authData.users) {
      return {
        success: false,
        synced: 0,
        failed: 1,
        errors: [
          {
            userId: 'unknown',
            email,
            error: authError?.message || 'Failed to list users',
          },
        ],
        message: 'Failed to find user',
      };
    }

    const user = authData.users.find((u: any) => u.email === email);
    if (!user) {
      return {
        success: false,
        synced: 0,
        failed: 1,
        errors: [
          {
            userId: 'unknown',
            email,
            error: 'User not found in auth',
          },
        ],
        message: 'User not found',
      };
    }

    return syncSingleUserById(admin, user.id);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push({
      userId: 'unknown',
      email,
      error: errorMsg,
    });
    return {
      success: false,
      synced: 0,
      failed: 1,
      errors,
      message: 'Error syncing user',
    };
  }
}

/**
 * Sync all admin/manager/viewer users from profiles table to auth metadata
 */
async function syncAllUsers(admin: any): Promise<SyncResult> {
  let synced = 0;
  let failed = 0;
  const errors: Array<{ userId: string; email?: string; error: string }> = [];

  try {
    // Get all non-driver profiles (admin, manager, viewer)
    const { data: profiles, error: profileError } = await admin
      .from('profiles')
      .select('id, role, email')
      .in('role', ['admin', 'manager', 'viewer']);

    if (profileError || !profiles) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [
          {
            userId: 'batch',
            error: profileError?.message || 'Failed to fetch profiles',
          },
        ],
        message: 'Failed to fetch profiles',
      };
    }

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
            userId: profile.id,
            email: profile.email,
            error: updateError.message,
          });
        } else {
          synced++;
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          userId: profile.id,
          email: profile.email,
          error: errorMsg,
        });
      }
    }

    return {
      success: errors.length === 0,
      synced,
      failed,
      errors,
      message: `Synced ${synced} users, ${failed} failed`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [
        {
          userId: 'batch',
          error: errorMsg,
        },
      ],
      message: 'Error during batch sync',
    };
  }
}

