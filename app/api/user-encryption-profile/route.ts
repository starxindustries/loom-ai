// app/api/user-encryption-profile/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  UserEncryptionProfile, 
  CreateProfileRequest, 
  UpdateProfileRequest 
} from "@/types/encryption";

/**
 * GET - Retrieve user encryption profile
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[PROFILE-${requestId}] 📥 GET user encryption profile`);

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(`[PROFILE-${requestId}] ❌ Unauthorized access attempt`);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[PROFILE-${requestId}] ✅ User authenticated: ${user.id}`);

    // Get user encryption profile
    const { data: profile, error } = await supabase
      .from("user_encryption_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        console.log(`[PROFILE-${requestId}] ⚠️ No profile found, creating default profile`);
        
        // Create default profile
        const { data: newProfile, error: createError } = await supabase
          .from("user_encryption_profiles")
          .insert({
            user_id: user.id,
            kdf_algorithm: 'pbkdf2',
            kdf_iterations: 100000,
            master_salt: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
            require_passphrase_verification: true,
            auto_logout_minutes: 30,
            max_failed_attempts: 5,
            is_new: true, // Mark as new user for recovery keys dialog
          })
          .select()
          .single();

        if (createError) {
          console.error(`[PROFILE-${requestId}] ❌ Failed to create profile:`, createError);
          return new Response(
            JSON.stringify({ error: "Failed to create encryption profile" }),
            { 
              status: 500, 
              headers: { "Content-Type": "application/json" } 
            }
          );
        }

        console.log(`[PROFILE-${requestId}] ✅ Created new profile`);
        return new Response(
          JSON.stringify({
            success: true,
            profile: newProfile,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      console.error(`[PROFILE-${requestId}] ❌ Database error:`, error);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve encryption profile" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[PROFILE-${requestId}] ✅ Profile retrieved`);
    return new Response(
      JSON.stringify({
        success: true,
        profile,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error(`[PROFILE-${requestId}] ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}

/**
 * POST - Create user encryption profile (should be called during onboarding)
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[PROFILE-${requestId}] 📥 POST create encryption profile`);

  try {
    const body = await request.json() as CreateProfileRequest;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Validate input
    const kdfAlgorithm = body.kdf_algorithm || 'pbkdf2';
    const kdfIterations = body.kdf_iterations || 100000;
    const autoLogoutMinutes = body.auto_logout_minutes || 30;
    const maxFailedAttempts = body.max_failed_attempts || 5;

    if (!['pbkdf2', 'argon2id'].includes(kdfAlgorithm)) {
      return new Response(
        JSON.stringify({ error: "Invalid KDF algorithm" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    if (kdfIterations < 10000 || kdfIterations > 1000000) {
      return new Response(
        JSON.stringify({ error: "KDF iterations must be between 10,000 and 1,000,000" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    if (autoLogoutMinutes < 5 || autoLogoutMinutes > 1440) {
      return new Response(
        JSON.stringify({ error: "Auto logout must be between 5 and 1440 minutes" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Generate master salt
    const masterSalt = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');

    // Create profile
    const { data: profile, error } = await supabase
      .from("user_encryption_profiles")
      .insert({
        user_id: user.id,
        kdf_algorithm: kdfAlgorithm,
        kdf_iterations: kdfIterations,
        master_salt: masterSalt,
        require_passphrase_verification: body.require_passphrase_verification ?? true,
        auto_logout_minutes: autoLogoutMinutes,
        max_failed_attempts: maxFailedAttempts,
        recovery_hint: body.recovery_hint || null,
        is_new: true, // New users need to see recovery keys dialog
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation - profile already exists
        return new Response(
          JSON.stringify({ error: "Encryption profile already exists for this user" }),
          { 
            status: 409, 
            headers: { "Content-Type": "application/json" } 
          }
        );
      }

      console.error(`[PROFILE-${requestId}] ❌ Database error:`, error);
      return new Response(
        JSON.stringify({ error: "Failed to create encryption profile" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[PROFILE-${requestId}] ✅ Profile created for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        message: "Encryption profile created successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error(`[PROFILE-${requestId}] ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}

/**
 * PUT - Update user encryption profile
 */
export async function PUT(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[PROFILE-${requestId}] 📥 PUT update encryption profile`);

  try {
    const body = await request.json() as UpdateProfileRequest;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Validate input if provided
    if (body.kdf_algorithm && !['pbkdf2', 'argon2id'].includes(body.kdf_algorithm)) {
      return new Response(
        JSON.stringify({ error: "Invalid KDF algorithm" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    if (body.kdf_iterations && (body.kdf_iterations < 10000 || body.kdf_iterations > 1000000)) {
      return new Response(
        JSON.stringify({ error: "KDF iterations must be between 10,000 and 1,000,000" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    if (body.auto_logout_minutes && (body.auto_logout_minutes < 5 || body.auto_logout_minutes > 1440)) {
      return new Response(
        JSON.stringify({ error: "Auto logout must be between 5 and 1440 minutes" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (body.kdf_algorithm !== undefined) updateData.kdf_algorithm = body.kdf_algorithm;
    if (body.kdf_iterations !== undefined) updateData.kdf_iterations = body.kdf_iterations;
    if (body.require_passphrase_verification !== undefined) updateData.require_passphrase_verification = body.require_passphrase_verification;
    if (body.auto_logout_minutes !== undefined) updateData.auto_logout_minutes = body.auto_logout_minutes;
    if (body.max_failed_attempts !== undefined) updateData.max_failed_attempts = body.max_failed_attempts;
    if (body.recovery_hint !== undefined) updateData.recovery_hint = body.recovery_hint;
    if (body.is_new !== undefined) updateData.is_new = body.is_new;

    // Regenerate master salt if requested (WARNING: This will invalidate all existing memories)
    if (body.regenerate_master_salt) {
      updateData.master_salt = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
      console.log(`[PROFILE-${requestId}] ⚠️ Regenerating master salt - this will invalidate existing memories`);
    }

    // If changing KDF parameters, update passphrase change timestamp
    if (body.kdf_algorithm || body.kdf_iterations || body.regenerate_master_salt) {
      updateData.last_passphrase_change = new Date().toISOString();
    }

    // Update profile
    const { data: profile, error } = await supabase
      .from("user_encryption_profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error(`[PROFILE-${requestId}] ❌ Database error:`, error);
      return new Response(
        JSON.stringify({ error: "Failed to update encryption profile" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Encryption profile not found" }),
        { 
          status: 404, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[PROFILE-${requestId}] ✅ Profile updated for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        message: "Encryption profile updated successfully",
        warning: body.regenerate_master_salt ? "Master salt regenerated - existing memories may be inaccessible" : undefined,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error(`[PROFILE-${requestId}] ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}