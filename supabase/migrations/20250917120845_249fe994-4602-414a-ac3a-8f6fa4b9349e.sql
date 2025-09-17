-- Convert user deepanshu.shahara@awign.com to super admin
UPDATE profiles 
SET role = 'super_admin'::app_role, 
    updated_at = now()
WHERE email = 'deepanshu.shahara@awign.com';