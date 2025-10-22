import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Plus, 
  Search, 
  MapPin, 
  Clock, 
  TrendingUp, 
  UserCheck, 
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  Target,
  BarChart3,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import VendorAssociationBadge from '@/components/VendorAssociationBadge';

interface GigWorker {
  id: string;
  user_id: string;
  profile_id: string;
  vendor_id?: string;
  alternate_phone?: string;  // Only alternate phone in gig_partners
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  coverage_pincodes: string[];
  max_daily_capacity: number;
  capacity_available: number;
  completion_rate: number;
  ontime_completion_rate: number;
  acceptance_rate: number;
  quality_score: number;
  qc_pass_count: number;
  total_cases_completed: number;
  active_cases_count: number;
  last_assignment_at?: string;
  is_direct_gig: boolean;
  is_active: boolean;
  is_available: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
  // Related data
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;  // Phone is now in profiles
  };
  vendors?: {
    name: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  email: string;
}

export default function GigWorkerManagement() {
  const [gigWorkers, setGigWorkers] = useState<GigWorker[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkUploadDialogOpen, setIsBulkUploadDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<GigWorker | null>(null);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);
  const { toast } = useToast();

  // Form state for create/edit
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    coverage_pincodes: [] as string[],
    max_daily_capacity: 1,
    vendor_id: '',
    is_direct_gig: true,
    is_active: true,
    is_available: true
  });

  const [newPincode, setNewPincode] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [workersData, vendorsData] = await Promise.all([
        loadGigWorkers(),
        loadVendors()
      ]);
      setGigWorkers(workersData);
      setVendors(vendorsData);
      console.log('Vendors state set to:', vendorsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load gig workers and vendors',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGigWorkers = async (): Promise<GigWorker[]> => {
    try {
      // First, let's try to load gig_partners without relationships
      const { data: gigPartnersData, error: gigPartnersError } = await supabase
        .from('gig_partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (gigPartnersError) {
        console.error('Error loading gig_partners:', gigPartnersError);
        throw gigPartnersError;
      }

      console.log('Raw gig_partners data:', gigPartnersData);

      if (!gigPartnersData || gigPartnersData.length === 0) {
        console.log('No gig partners found');
        return [];
      }

      // Now load profiles for each gig partner
      const profileIds = gigPartnersData.map(gp => gp.profile_id);
      console.log('Profile IDs to query:', profileIds);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', profileIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        console.error('Profile IDs that failed:', profileIds);
        throw profilesError;
      }

      console.log('Profiles data:', profilesData);
      console.log('Number of profiles found:', profilesData?.length || 0);

      // Load vendors if any gig partners have vendor_id
      const vendorIds = gigPartnersData
        .map(gp => gp.vendor_id)
        .filter(id => id !== null);
      
      let vendorsData = [];
      if (vendorIds.length > 0) {
        const { data: vendors, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, name')
          .in('id', vendorIds);
        
        if (vendorsError) {
          console.error('Error loading vendors:', vendorsError);
        } else {
          vendorsData = vendors || [];
        }
      }

      console.log('Vendors data:', vendorsData);

      // Combine the data
      const combinedData = gigPartnersData.map(gigPartner => {
        const profile = profilesData?.find(p => p.id === gigPartner.profile_id);
        const vendor = vendorsData?.find(v => v.id === gigPartner.vendor_id);
        
        return {
          ...gigPartner,
          profiles: profile,
          vendors: vendor
        };
      });

      console.log('Combined data:', combinedData);
      console.log('First worker profiles data:', combinedData[0]?.profiles);
      
      return combinedData;
    } catch (error) {
      console.error('Error in loadGigWorkers:', error);
      throw error;
    }
  };

  const loadVendors = async (): Promise<Vendor[]> => {
    console.log('Loading vendors...');
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading vendors:', error);
      throw new Error('Failed to load vendors');
    }

    console.log('Vendors loaded:', data);
    return data || [];
  };

  const handleCreateWorker = async () => {
    try {
      // Validate required fields
      if (!formData.first_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'First name is required',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.last_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Last name is required',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.email.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Email is required',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.phone.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Phone number is required',
          variant: 'destructive',
        });
        return;
      }

      // First create a user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Handle vendor_id - convert "direct" or empty string to null
      const vendorId = (formData.vendor_id === 'direct' || formData.vendor_id === '' || !formData.vendor_id) ? null : formData.vendor_id;

      // Use the database function to create gig worker (bypasses RLS)
      const { data: gigPartnerId, error: functionError } = await supabase
        .rpc('create_gig_worker_profile', {
          p_first_name: formData.first_name,
          p_last_name: formData.last_name,
          p_email: formData.email,
          p_phone: formData.phone,
          p_address: formData.address,
          p_city: formData.city,
          p_state: formData.state,
          p_pincode: formData.pincode,
          p_alternate_phone: formData.alternate_phone || null,
          p_country: formData.country,
          p_coverage_pincodes: formData.coverage_pincodes,
          p_max_daily_capacity: formData.max_daily_capacity,
          p_vendor_id: vendorId,
          p_is_direct_gig: formData.is_direct_gig,
          p_is_active: formData.is_active,
          p_is_available: formData.is_available,
          p_created_by: user.id
        });

      if (functionError) {
        console.error('Function error:', functionError);
        
        // Handle specific error cases
        if (functionError.message.includes('unique constraint') || 
            functionError.message.includes('duplicate key') ||
            functionError.message.includes('unique_phone_number')) {
          throw new Error('A gig worker with this phone number already exists. Please use a different phone number.');
        }
        
        throw new Error('Failed to create gig worker: ' + functionError.message);
      }

      toast({
        title: 'Success',
        description: 'Gig worker created successfully',
      });

      setIsCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create gig worker:', error);
      toast({
        title: 'Error',
        description: 'Failed to create gig worker',
        variant: 'destructive',
      });
    }
  };

  const handleEditWorker = async () => {
    if (!editingWorker) return;

    try {
      // Validate required fields
      if (!formData.first_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'First name is required',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.last_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Last name is required',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.email.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Email is required',
          variant: 'destructive',
        });
        return;
      }
      
      if (!formData.phone.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Phone number is required',
          variant: 'destructive',
        });
        return;
      }

      // Handle vendor_id - convert "direct" or empty string to null
      const vendorId = (formData.vendor_id === 'direct' || formData.vendor_id === '' || !formData.vendor_id) ? null : formData.vendor_id;

      // Calculate new available capacity if max_daily_capacity changed
      let newCapacityAvailable = editingWorker.capacity_available;
      if (formData.max_daily_capacity !== editingWorker.max_daily_capacity) {
        // Get current active cases count
        const { data: activeCases, error: activeCasesError } = await supabase
          .from('cases')
          .select('id', { count: 'exact' })
          .eq('current_assignee_id', editingWorker.id)
          .in('status', ['allocated', 'accepted', 'in_progress', 'submitted']);

        if (activeCasesError) {
          console.error('Error fetching active cases:', activeCasesError);
          throw new Error('Failed to calculate capacity');
        }

        const activeCasesCount = activeCases?.length || 0;
        newCapacityAvailable = Math.max(0, formData.max_daily_capacity - activeCasesCount);
      }

      // Update both profiles and gig_partners tables
      const [profilesResult, gigPartnersResult] = await Promise.all([
        supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,  // Update phone in profiles table
            updated_at: new Date().toISOString()
          })
          .eq('id', editingWorker.profile_id),
        
        supabase
          .from('gig_partners')
          .update({
            alternate_phone: formData.alternate_phone || null,  // Only alternate phone in gig_partners
            address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            country: formData.country,
            coverage_pincodes: formData.coverage_pincodes,
            max_daily_capacity: formData.max_daily_capacity,
            capacity_available: newCapacityAvailable,  // Update available capacity
            vendor_id: vendorId,
            is_direct_gig: formData.is_direct_gig,
            is_active: formData.is_active,
            is_available: formData.is_available,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingWorker.id)
      ]);

      if (profilesResult.error) {
        console.error('Profiles update error:', profilesResult.error);
        
        // Handle specific error cases for phone uniqueness
        if (profilesResult.error.message.includes('unique constraint') || 
            profilesResult.error.message.includes('duplicate key') ||
            profilesResult.error.message.includes('unique_phone_number')) {
          throw new Error('A gig worker with this phone number already exists. Please use a different phone number.');
        }
        
        throw profilesResult.error;
      }
      
      if (gigPartnersResult.error) {
        console.error('Gig partners update error:', gigPartnersResult.error);
        
        // Handle specific error cases
        if (gigPartnersResult.error.message.includes('unique constraint') || 
            gigPartnersResult.error.message.includes('duplicate key') ||
            gigPartnersResult.error.message.includes('unique_phone_number')) {
          throw new Error('A gig worker with this phone number already exists. Please use a different phone number.');
        }
        
        throw gigPartnersResult.error;
      }

      // Update capacity tracking if max_daily_capacity changed
      if (formData.max_daily_capacity !== editingWorker.max_daily_capacity) {
        const today = new Date().toISOString().split('T')[0];
        
        // Update or create capacity tracking record for today
        const { error: capacityError } = await supabase
          .from('capacity_tracking')
          .upsert({
            gig_partner_id: editingWorker.id,
            date: today,
            max_daily_capacity: formData.max_daily_capacity,
            initial_capacity_available: formData.max_daily_capacity,
            current_capacity_available: newCapacityAvailable,
            cases_allocated: formData.max_daily_capacity - newCapacityAvailable,
            last_reset_at: new Date().toISOString(),
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'gig_partner_id,date'
          });

        if (capacityError) {
          console.error('Capacity tracking update error:', capacityError);
          // Don't throw error here as the main update was successful
        }
      }

      toast({
        title: 'Success',
        description: 'Gig worker updated successfully',
      });

      setIsEditDialogOpen(false);
      setEditingWorker(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to update gig worker:', error);
      toast({
        title: 'Error',
        description: 'Failed to update gig worker',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!window.confirm('Are you sure you want to delete this gig worker?')) return;

    try {
      const { error } = await supabase
        .from('gig_partners')
        .delete()
        .eq('id', workerId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Gig worker deleted successfully',
      });

      loadData();
    } catch (error) {
      console.error('Failed to delete gig worker:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete gig worker',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      alternate_phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      coverage_pincodes: [],
      max_daily_capacity: 1,
      vendor_id: 'direct',
      is_direct_gig: true,
      is_active: true,
      is_available: true
    });
    setNewPincode('');
  };

  const openEditDialog = (worker: GigWorker) => {
    console.log('Opening edit dialog for worker:', worker);
    console.log('Worker profiles data:', worker.profiles);
    
    setEditingWorker(worker);
    setFormData({
      first_name: worker.profiles?.first_name || '',
      last_name: worker.profiles?.last_name || '',
      email: worker.profiles?.email || '',
      phone: worker.profiles?.phone || '',  // Get phone from profiles
      alternate_phone: worker.alternate_phone || '',
      address: worker.address,
      city: worker.city,
      state: worker.state,
      pincode: worker.pincode,
      country: worker.country,
      coverage_pincodes: worker.coverage_pincodes,
      max_daily_capacity: worker.max_daily_capacity,
      vendor_id: worker.vendor_id || 'direct',
      is_direct_gig: worker.is_direct_gig,
      is_active: worker.is_active,
      is_available: worker.is_available
    });
    setIsEditDialogOpen(true);
  };

  const addPincode = () => {
    if (newPincode.trim() && !formData.coverage_pincodes.includes(newPincode.trim())) {
      setFormData(prev => ({
        ...prev,
        coverage_pincodes: [...prev.coverage_pincodes, newPincode.trim()]
      }));
      setNewPincode('');
    }
  };

  const removePincode = (pincode: string) => {
    setFormData(prev => ({
      ...prev,
      coverage_pincodes: prev.coverage_pincodes.filter(p => p !== pincode)
    }));
  };

  // Bulk upload functionality
  const handleBulkUpload = async () => {
    if (!bulkUploadFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setBulkUploadProgress(0);
    setBulkUploadErrors([]);

    try {
      const text = await bulkUploadFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'pincode'];
      
      console.log('CSV Headers found:', headers);
      console.log('Expected headers:', requiredHeaders);
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}. Found columns: ${headers.join(', ')}`);
      }

      const dataRows = lines.slice(1);
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (let i = 0; i < dataRows.length; i++) {
        try {
          // Better CSV parsing that handles quoted values and commas within fields
          const parseCSVRow = (row: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let j = 0; j < row.length; j++) {
              const char = row[j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const row = parseCSVRow(dataRows[i]);
          const rowData: any = {};
          
          // Check if row has enough columns
          if (row.length < headers.length) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: Not enough columns (expected ${headers.length}, got ${row.length})`);
            continue;
          }
          
          headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });

          // Debug logging to see what's being parsed
          console.log(`Row ${i + 2} - Parsed data:`, {
            vendor_id: rowData.vendor_id,
            pincode: rowData.pincode,
            max_daily_capacity: rowData.max_daily_capacity,
            is_direct_gig: rowData.is_direct_gig
          });

          // Validate required fields
          const missingFields = [];
          if (!rowData.first_name) missingFields.push('first_name');
          if (!rowData.last_name) missingFields.push('last_name');
          if (!rowData.email) missingFields.push('email');
          if (!rowData.phone) missingFields.push('phone');
          if (!rowData.address) missingFields.push('address');
          if (!rowData.city) missingFields.push('city');
          if (!rowData.state) missingFields.push('state');
          if (!rowData.pincode) missingFields.push('pincode');
          
          if (missingFields.length > 0) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(rowData.email)) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: Invalid email format: ${rowData.email}`);
            continue;
          }

          // Validate phone format (basic validation)
          const phoneRegex = /^[0-9]{10}$/;
          if (!phoneRegex.test(rowData.phone)) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: Invalid phone format: ${rowData.phone} (must be 10 digits)`);
            continue;
          }

          // Validate and parse vendor_id
          let vendorId = null;
          if (rowData.vendor_id && rowData.vendor_id.trim() !== '' && rowData.vendor_id.trim() !== 'direct') {
            // Check if it looks like a pincode (3-6 digits) - this indicates column misalignment
            const pincodeRegex = /^\d{3,6}$/;
            if (pincodeRegex.test(rowData.vendor_id.trim())) {
              results.failed++;
              results.errors.push(`Row ${i + 2}: Column misalignment detected - vendor_id contains pincode value "${rowData.vendor_id}". Please check your CSV format and ensure columns are properly aligned.`);
              continue;
            }
            
            // Check if it's a valid UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(rowData.vendor_id.trim())) {
              vendorId = rowData.vendor_id.trim();
            } else {
              results.failed++;
              results.errors.push(`Row ${i + 2}: Invalid vendor ID format "${rowData.vendor_id}" - must be a valid UUID, 'direct', or leave empty`);
              continue;
            }
          }

          // Validate coverage pincodes
          let coveragePincodes = [''];
          if (rowData.coverage_pincodes && rowData.coverage_pincodes.trim() !== '') {
            coveragePincodes = rowData.coverage_pincodes.split(';').map(p => p.trim()).filter(p => p !== '');
          }

          // Create gig worker
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          // Debug logging
          console.log(`Row ${i + 2} - vendorId:`, vendorId, 'type:', typeof vendorId);

          const { error: functionError } = await supabase.rpc('create_gig_worker_profile', {
            p_first_name: rowData.first_name.trim(),
            p_last_name: rowData.last_name.trim(),
            p_email: rowData.email.trim(),
            p_phone: rowData.phone.trim(),
            p_address: rowData.address.trim(),
            p_city: rowData.city.trim(),
            p_state: rowData.state.trim(),
            p_pincode: rowData.pincode.trim(),
            p_alternate_phone: rowData.alternate_phone?.trim() || null,
            p_country: rowData.country?.trim() || 'India',
            p_coverage_pincodes: coveragePincodes,
            p_max_daily_capacity: parseInt(rowData.max_daily_capacity) || 1,
            p_vendor_id: vendorId,
            p_is_direct_gig: rowData.is_direct_gig !== 'false',
            p_is_active: rowData.is_active !== 'false',
            p_is_available: rowData.is_available !== 'false',
            p_created_by: user.id
          });

          if (functionError) {
            results.failed++;
            let errorMessage = functionError.message;
            
            // Provide more specific error messages
            if (functionError.message.includes('unique constraint') || functionError.message.includes('duplicate key')) {
              errorMessage = `Phone number ${rowData.phone} already exists`;
            } else if (functionError.message.includes('invalid input value for enum')) {
              errorMessage = `Invalid enum value in row data`;
            } else if (functionError.message.includes('null value in column')) {
              errorMessage = `Missing required field: ${functionError.message.split('"')[1] || 'unknown field'}`;
            } else if (functionError.message.includes('invalid input syntax for type uuid')) {
              const invalidValue = functionError.message.match(/"([^"]+)"/)?.[1] || 'unknown value';
              if (invalidValue === '') {
                errorMessage = `Vendor ID cannot be empty string - leave the vendor_id column completely empty for direct gig workers`;
              } else {
                errorMessage = `Invalid vendor ID "${invalidValue}" - must be a valid UUID or leave empty for direct gig worker`;
              }
            } else if (functionError.message.includes('foreign key constraint')) {
              errorMessage = `Invalid vendor ID - vendor does not exist in system`;
            } else if (functionError.message.includes('check constraint')) {
              errorMessage = `Invalid data format - check your input values`;
            } else if (functionError.message.includes('value too long')) {
              errorMessage = `Data too long for field - please shorten your input`;
            }
            
            results.errors.push(`Row ${i + 2}: ${errorMessage}`);
          } else {
            results.success++;
          }

          setBulkUploadProgress(Math.round(((i + 1) / dataRows.length) * 100));
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Store errors in state for UI display
      setBulkUploadErrors(results.errors);

      // Show detailed results
      if (results.failed > 0) {
        toast({
          title: 'Bulk Upload Completed with Errors',
          description: `Successfully created ${results.success} gig workers. ${results.failed} failed. See details below.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Bulk Upload Complete',
          description: `Successfully created ${results.success} gig workers.`,
          variant: 'default',
        });
      }

      // Only close dialog if no errors, otherwise keep it open to show errors
      if (results.failed === 0) {
        setIsBulkUploadDialogOpen(false);
        setBulkUploadFile(null);
        setBulkUploadProgress(0);
      }
      loadData();
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast({
        title: 'Bulk Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please select a CSV file',
          variant: 'destructive',
        });
        return;
      }
      setBulkUploadFile(file);
    }
  };

  const filteredWorkers = gigWorkers.filter(worker => {
    const matchesSearch = 
      worker.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.phone.includes(searchTerm) ||
      worker.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.state.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesVendor = selectedVendor === 'all' || 
      (selectedVendor === 'direct' && worker.is_direct_gig) ||
      worker.vendor_id === selectedVendor;

    const matchesStatus = selectedStatus === 'all' ||
      (selectedStatus === 'active' && worker.is_active) ||
      (selectedStatus === 'available' && worker.is_available) ||
      (selectedStatus === 'inactive' && !worker.is_active);

    return matchesSearch && matchesVendor && matchesStatus;
  });

  const getPerformanceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCapacityColor = (available: number, max: number) => {
    const percentage = (available / max) * 100;
    if (percentage >= 50) return 'text-green-600';
    if (percentage >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading gig workers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Management</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Gig Worker Management</h1>
              <p className="text-muted-foreground">
                Manage gig workers, their capacity, and coverage areas
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Gig Worker
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Gig Worker</DialogTitle>
                    <DialogDescription>
                      Create a new gig worker profile with coverage and capacity settings
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="alternate_phone">Alternate Phone</Label>
                        <Input
                          id="alternate_phone"
                          value={formData.alternate_phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, alternate_phone: e.target.value }))}
                          placeholder="Enter alternate phone"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter full address"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Enter city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                          placeholder="Enter state"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          value={formData.pincode}
                          onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                          placeholder="Enter pincode"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coverage_pincodes">Coverage Pincodes</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newPincode}
                          onChange={(e) => setNewPincode(e.target.value)}
                          placeholder="Add pincode"
                          onKeyPress={(e) => e.key === 'Enter' && addPincode()}
                        />
                        <Button type="button" onClick={addPincode} variant="outline">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.coverage_pincodes.map((pincode, index) => (
                          <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removePincode(pincode)}>
                            {pincode} ×
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_daily_capacity">Max Daily Capacity</Label>
                        <Input
                          id="max_daily_capacity"
                          type="number"
                          min="1"
                          value={formData.max_daily_capacity}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_daily_capacity: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vendor_id">Vendor</Label>
                        <Select value={formData.vendor_id} onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="direct">Direct Gig Worker</SelectItem>
                            {console.log('Rendering vendors dropdown with vendors:', vendors)}
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_direct_gig"
                          checked={formData.is_direct_gig}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_direct_gig: checked }))}
                        />
                        <Label htmlFor="is_direct_gig">Direct Gig Worker</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                        />
                        <Label htmlFor="is_active">Active</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_available"
                          checked={formData.is_available}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
                        />
                        <Label htmlFor="is_available">Available for Assignment</Label>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateWorker}>
                        Create Gig Worker
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Gig Worker</DialogTitle>
                    <DialogDescription>
                      Update gig worker profile and settings
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-first-name">First Name *</Label>
                        <Input
                          id="edit-first-name"
                          value={formData.first_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-last-name">Last Name *</Label>
                        <Input
                          id="edit-last-name"
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-email">Email *</Label>
                        <Input
                          id="edit-email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-phone">Phone *</Label>
                        <Input
                          id="edit-phone"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-alternate-phone">Alternate Phone</Label>
                        <Input
                          id="edit-alternate-phone"
                          value={formData.alternate_phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, alternate_phone: e.target.value }))}
                          placeholder="Enter alternate phone"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-max-capacity">Max Daily Capacity</Label>
                        <Input
                          id="edit-max-capacity"
                          type="number"
                          min="1"
                          value={formData.max_daily_capacity}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_daily_capacity: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit-address">Address</Label>
                      <Textarea
                        id="edit-address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter address"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="edit-city">City</Label>
                        <Input
                          id="edit-city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Enter city"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-state">State</Label>
                        <Input
                          id="edit-state"
                          value={formData.state}
                          onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                          placeholder="Enter state"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-pincode">Pincode</Label>
                        <Input
                          id="edit-pincode"
                          value={formData.pincode}
                          onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                          placeholder="Enter pincode"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit-vendor">Vendor</Label>
                      <Select value={formData.vendor_id} onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct Gig Worker</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Coverage Pincodes</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newPincode}
                          onChange={(e) => setNewPincode(e.target.value)}
                          placeholder="Enter pincode"
                          onKeyPress={(e) => e.key === 'Enter' && addPincode()}
                        />
                        <Button type="button" onClick={addPincode} size="sm">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.coverage_pincodes.map((pincode) => (
                          <Badge key={pincode} variant="secondary" className="flex items-center gap-1">
                            {pincode}
                            <button
                              type="button"
                              onClick={() => removePincode(pincode)}
                              className="ml-1 text-xs hover:text-red-500"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-direct-gig"
                          checked={formData.is_direct_gig}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_direct_gig: checked }))}
                        />
                        <Label htmlFor="edit-direct-gig">Direct Gig Worker</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                        />
                        <Label htmlFor="edit-active">Active</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-available"
                          checked={formData.is_available}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
                        />
                        <Label htmlFor="edit-available">Available</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEditWorker}>
                      Update Gig Worker
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isBulkUploadDialogOpen} onOpenChange={setIsBulkUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Upload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Gig Workers</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file to create multiple gig workers at once
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* CSV Template Download */}
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">CSV Template</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Download the template to see the required format
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const csvContent = `first_name,last_name,email,phone,address,city,state,pincode,alternate_phone,country,coverage_pincodes,max_daily_capacity,vendor_id,is_direct_gig,is_active,is_available
John,Doe,john.doe@example.com,9876543210,123 Main St,Bangalore,Karnataka,560001,9876543211,India,560001;560002,5,,true,true,true
Jane,Smith,jane.smith@example.com,9876543212,456 Oak Ave,Mumbai,Maharashtra,400001,9876543213,India,400001;400002,3,,true,true,true

# IMPORTANT: Column order must be exactly as shown above
# Column positions:
# 1. first_name, 2. last_name, 3. email, 4. phone, 5. address
# 6. city, 7. state, 8. pincode, 9. alternate_phone, 10. country
# 11. coverage_pincodes, 12. max_daily_capacity, 13. vendor_id, 14. is_direct_gig
# 15. is_active, 16. is_available

# Notes:
# - vendor_id (column 13): Leave completely empty for direct gig workers
# - coverage_pincodes (column 11): Use semicolon (;) to separate multiple pincodes
# - Boolean fields: Use true/false (not 1/0 or yes/no)
# - Phone must be exactly 10 digits
# - Email must be valid format
# - Do NOT put "direct" in vendor_id column - leave it empty instead`;
                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'gig_workers_template.csv';
                          a.click();
                          window.URL.revokeObjectURL(url);
                        }}
                      >
                        Download Template
                      </Button>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="csv-file">Select CSV File</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                      />
                      {bulkUploadFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {bulkUploadFile.name}
                        </p>
                      )}
                    </div>

                    {/* Upload Progress */}
                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{bulkUploadProgress}%</span>
                        </div>
                        <Progress value={bulkUploadProgress} className="w-full" />
                      </div>
                    )}

                    {/* Error Display */}
                    {bulkUploadErrors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-red-600">Upload Errors ({bulkUploadErrors.length})</h4>
                        <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-red-50">
                          {bulkUploadErrors.slice(0, 20).map((error, index) => (
                            <div key={index} className="text-sm text-red-700 py-1">
                              {error}
                            </div>
                          ))}
                          {bulkUploadErrors.length > 20 && (
                            <div className="text-sm text-red-600 font-medium">
                              ... and {bulkUploadErrors.length - 20} more errors
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Upload Button */}
                    <div className="flex justify-between">
                      <div>
                        {bulkUploadErrors.length > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setBulkUploadErrors([]);
                              setBulkUploadFile(null);
                              setBulkUploadProgress(0);
                            }}
                            disabled={isUploading}
                          >
                            Clear Errors & Reset
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsBulkUploadDialogOpen(false);
                            setBulkUploadErrors([]);
                            setBulkUploadFile(null);
                            setBulkUploadProgress(0);
                          }}
                          disabled={isUploading}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleBulkUpload}
                          disabled={!bulkUploadFile || isUploading}
                        >
                          {isUploading ? 'Uploading...' : 'Upload CSV'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gig Workers</CardTitle>
              <CardDescription>
                Manage gig workers and their assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search gig workers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    <SelectItem value="direct">Direct Gig Workers</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Vendor Association</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => {
                    console.log('Rendering worker:', worker);
                    console.log('Worker profiles:', worker.profiles);
                    return (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {worker.profiles?.first_name || 'No First Name'} {worker.profiles?.last_name || 'No Last Name'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {worker.profiles?.email || 'No Email'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{worker.profiles?.phone || 'No Phone'}</div>
                          {worker.alternate_phone && (
                            <div className="text-muted-foreground">{worker.alternate_phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{worker.city}, {worker.state}</div>
                          <div className="text-muted-foreground">{worker.pincode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {worker.coverage_pincodes.slice(0, 3).map((pincode, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {pincode}
                            </Badge>
                          ))}
                          {worker.coverage_pincodes.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{worker.coverage_pincodes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <VendorAssociationBadge 
                          gigWorker={{
                            vendor_id: worker.vendor_id,
                            is_direct_gig: worker.is_direct_gig,
                            vendor_name: worker.vendor_name
                          }} 
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className={getCapacityColor(worker.capacity_available, worker.max_daily_capacity)}>
                            {worker.capacity_available}/{worker.max_daily_capacity}
                          </div>
                          <div className="text-muted-foreground">
                            {Math.round((worker.capacity_available / worker.max_daily_capacity) * 100)}% available
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className={getPerformanceColor(worker.quality_score)}>
                            Quality: {(worker.quality_score * 100).toFixed(1)}%
                          </div>
                          <div className={getPerformanceColor(worker.completion_rate)}>
                            Completion: {(worker.completion_rate * 100).toFixed(1)}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={worker.is_active ? "default" : "secondary"}>
                            {worker.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant={worker.is_available ? "outline" : "destructive"}>
                            {worker.is_available ? "Available" : "Busy"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(worker)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteWorker(worker.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capacity Overview</CardTitle>
              <CardDescription>
                Monitor and manage gig worker capacity across all workers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {filteredWorkers.map((worker) => {
                  const capacityPercentage = (worker.capacity_available / worker.max_daily_capacity) * 100;
                  const utilizationPercentage = 100 - capacityPercentage;

                  return (
                    <div key={worker.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-medium">
                            {worker.profiles?.first_name} {worker.profiles?.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {worker.city}, {worker.state} • {worker.coverage_pincodes.length} coverage areas
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getCapacityColor(worker.capacity_available, worker.max_daily_capacity)}`}>
                            {worker.capacity_available}/{worker.max_daily_capacity} slots
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {capacityPercentage.toFixed(1)}% available
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Capacity Utilization</span>
                          <span>{utilizationPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              utilizationPercentage >= 80 ? 'bg-red-500' :
                              utilizationPercentage >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${utilizationPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Track gig worker performance and quality metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Quality Score</TableHead>
                    <TableHead>Completion Rate</TableHead>
                    <TableHead>On-Time Rate</TableHead>
                    <TableHead>Acceptance Rate</TableHead>
                    <TableHead>Total Cases</TableHead>
                    <TableHead>Last Assignment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {worker.profiles?.first_name} {worker.profiles?.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {worker.vendors?.name || 'Direct Gig Worker'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.quality_score)}>
                          {(worker.quality_score * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.completion_rate)}>
                          {(worker.completion_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.ontime_completion_rate)}>
                          {(worker.ontime_completion_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={getPerformanceColor(worker.acceptance_rate)}>
                          {(worker.acceptance_rate * 100).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {worker.total_cases_completed} completed
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {worker.last_assignment_at 
                            ? new Date(worker.last_assignment_at).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
