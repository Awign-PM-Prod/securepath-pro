import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, UserX, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile, UserRole } from '@/types/auth';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';
import { useToast } from '@/hooks/use-toast';

export function UserList() {
  const { user, canManageRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userProfile: UserProfile) => {
    const action = userProfile.is_active ? 'deactivate' : 'activate';
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${userProfile.first_name} ${userProfile.last_name}?`
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !userProfile.is_active })
        .eq('id', userProfile.id);

      if (error) throw error;
      
      await fetchUsers();
      toast({
        title: 'Success',
        description: `User ${action}d successfully`,
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userProfile: UserProfile) => {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY DELETE ${userProfile.first_name} ${userProfile.last_name}?\n\nThis action cannot be undone and will:\n- Delete the user's authentication account\n- Delete the user's profile\n- Remove all associated data`
    );
    
    if (!confirmed) return;

    try {
      // First, delete the auth user using the edge function
      if (userProfile.user_id) {
        const { data: deleteResult, error: deleteUserError } = await supabase.functions.invoke('delete-user', {
          body: {
            user_id: userProfile.user_id
          }
        });

        if (deleteUserError) {
          throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
        }

        if (deleteResult?.error) {
          throw new Error(deleteResult.error);
        }
      }

      // Then delete the profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userProfile.id);

      if (profileError) {
        // If profile deletion fails but auth user was deleted, log warning
        console.warn('Auth user deleted but profile deletion failed:', profileError);
        throw new Error('User authentication account deleted but failed to delete profile');
      }
      
      await fetchUsers();
      toast({
        title: 'Success',
        description: 'User permanently deleted from the system',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500';
      case 'ops_team':
        return 'bg-blue-500';
      case 'vendor_team':
        return 'bg-purple-500';
      case 'qc_team':
        return 'bg-green-500';
      case 'vendor':
        return 'bg-orange-500';
      case 'gig_worker':
        return 'bg-yellow-500';
      case 'client':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatRoleDisplay = (role: UserRole) => {
    return role.replace('_', ' ').toUpperCase();
  };

  const canCreateUsers = user?.profile.role === 'super_admin' || 
                        user?.profile.role === 'ops_team' || 
                        user?.profile.role === 'vendor_team' || 
                        user?.profile.role === 'vendor';

  const handleEditUser = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage users and their roles in the system
              </CardDescription>
            </div>
            {canCreateUsers && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userProfile) => (
                <TableRow key={userProfile.id}>
                  <TableCell className="font-medium">
                    {userProfile.first_name} {userProfile.last_name}
                  </TableCell>
                  <TableCell>{userProfile.email}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={`text-white ${getRoleBadgeColor(userProfile.role)}`}
                    >
                      {formatRoleDisplay(userProfile.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>{userProfile.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={userProfile.is_active ? 'default' : 'secondary'}>
                      {userProfile.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(userProfile.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {canManageRole(userProfile.role) && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditUser(userProfile)}
                            title="Edit user"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(userProfile)}
                            title={userProfile.is_active ? 'Deactivate user' : 'Activate user'}
                          >
                            {userProfile.is_active ? (
                              <Ban className="h-4 w-4" />
                            ) : (
                              <UserX className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(userProfile)}
                            title="Permanently delete user"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={fetchUsers}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onUserUpdated={fetchUsers}
      />
    </div>
  );
}