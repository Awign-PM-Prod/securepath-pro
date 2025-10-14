-- Update RLS policy to allow service role to create profiles
DROP POLICY IF EXISTS "Users can create profiles they are authorized to manage" ON public.profiles;

CREATE POLICY "Users can create profiles they are authorized to manage" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  -- Allow service role (for edge functions)
  auth.jwt() ->> 'role' = 'service_role' OR
  -- Allow users who can manage the target role and are setting themselves as creator
  (can_manage_user(role) AND created_by = auth.uid())
);