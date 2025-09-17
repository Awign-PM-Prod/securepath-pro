export type UserRole = 
  | 'super_admin'
  | 'ops_team' 
  | 'vendor_team'
  | 'qc_team'
  | 'vendor'
  | 'gig_worker'
  | 'client';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
}