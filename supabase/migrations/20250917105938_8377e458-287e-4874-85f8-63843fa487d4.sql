-- Insert a super admin user for testing (password: admin123)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
VALUES (
  'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
  '00000000-0000-0000-0000-000000000000',
  'admin@bgverification.com',
  '$2a$10$rJ8LPm8k2eP5FkN.OsxP2uZL4V1l8K9x3bE9m2yN7mP5fD8oX5vQ.',
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
);

-- Insert the corresponding profile
INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
VALUES (
  'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
  'admin@bgverification.com',
  'System',
  'Administrator',
  'super_admin'
);