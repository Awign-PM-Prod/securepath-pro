// =====================================================
// API KEY VALIDATION HELPER
// Shared utility for edge functions to validate API keys
// Background Verification Platform
// =====================================================

// @deno-types="https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore - Deno URL imports are valid in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ApiKeyValidation {
  valid: boolean;
  key_id?: string;
  client_id?: string;
  permissions?: any;
  error?: string;
}

/**
 * Validate an API key by calling the database function
 * @param apiKey - The API key to validate
 * @param supabaseUrl - Supabase project URL
 * @param supabaseServiceKey - Supabase service role key (bypasses RLS)
 * @returns Validation result with permissions if valid
 */
export async function validateApiKey(
  apiKey: string | null,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  // Trim whitespace
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  // Create service role client (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Call the validate_api_key database function
    const { data, error } = await supabase.rpc('validate_api_key', {
      p_api_key: trimmedKey
    });

    if (error) {
      console.error('API key validation error:', error);
      return { valid: false, error: 'Failed to validate API key' };
    }

    if (!data || !data.valid) {
      return { 
        valid: false, 
        error: data?.error || 'Invalid API key' 
      };
    }

    // Return successful validation with permissions
    return {
      valid: true,
      key_id: data.key_id,
      client_id: data.client_id,
      permissions: data.permissions
    };
  } catch (error) {
    console.error('API key validation exception:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    };
  }
}

/**
 * Check if API key has a specific permission
 * @param permissions - Permissions object from API key validation
 * @param requiredPermission - The permission to check (e.g., 'create_cases', 'read_cases')
 * @returns true if permission is granted
 */
export function checkPermission(
  permissions: any,
  requiredPermission: string
): boolean {
  if (!permissions || typeof permissions !== 'object') {
    return false;
  }
  
  // Check if the permission exists and is true
  return permissions[requiredPermission] === true;
}

/**
 * Get authentication method from request
 * Returns 'api_key' if x-api-key header exists, 'jwt' if Authorization header exists, null otherwise
 */
export function getAuthMethod(req: Request): 'api_key' | 'jwt' | null {
  const apiKey = req.headers.get('x-api-key');
  const authHeader = req.headers.get('Authorization');
  
  if (apiKey) {
    return 'api_key';
  } else if (authHeader) {
    return 'jwt';
  }
  
  return null;
}

