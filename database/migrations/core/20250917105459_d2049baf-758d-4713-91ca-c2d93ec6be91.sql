-- Create user roles enum
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'ops_team', 
  'vendor_team',
  'qc_team',
  'vendor',
  'gig_worker',
  'client'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role app_role NOT NULL DEFAULT 'gig_worker',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = _role AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create function to check if user can manage another user
CREATE OR REPLACE FUNCTION public.can_manage_user(_target_role app_role)
RETURNS BOOLEAN AS $$
DECLARE
  current_role app_role;
BEGIN
  SELECT get_current_user_role() INTO current_role;
  
  -- Super admin can manage all roles except other super admins
  IF current_role = 'super_admin' AND _target_role != 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Ops team can manage clients
  IF current_role = 'ops_team' AND _target_role = 'client' THEN
    RETURN true;
  END IF;
  
  -- Vendor team can manage vendors and gig workers
  IF current_role = 'vendor_team' AND _target_role IN ('vendor', 'gig_worker') THEN
    RETURN true;
  END IF;
  
  -- Vendors can manage their own gig workers (additional check needed in application)
  IF current_role = 'vendor' AND _target_role = 'gig_worker' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS Policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role('super_admin'));

CREATE POLICY "Ops team can view client profiles"
  ON public.profiles FOR SELECT  
  USING (has_role('ops_team') AND role = 'client');

CREATE POLICY "Vendor team can view vendor and gig worker profiles"
  ON public.profiles FOR SELECT
  USING (has_role('vendor_team') AND role IN ('vendor', 'gig_worker'));

CREATE POLICY "Vendors can view gig worker profiles they created"
  ON public.profiles FOR SELECT
  USING (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid());

CREATE POLICY "Users can create profiles they are authorized to manage"
  ON public.profiles FOR INSERT
  WITH CHECK (can_manage_user(role) AND created_by = auth.uid());

CREATE POLICY "Users can update profiles they are authorized to manage"
  ON public.profiles FOR UPDATE
  USING (
    (auth.uid() = user_id) OR 
    (has_role('super_admin') AND role != 'super_admin') OR
    (has_role('ops_team') AND role = 'client') OR
    (has_role('vendor_team') AND role IN ('vendor', 'gig_worker')) OR
    (has_role('vendor') AND role = 'gig_worker' AND created_by = auth.uid())
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't exist (prevent duplicate key errors)
  INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'gig_worker')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();