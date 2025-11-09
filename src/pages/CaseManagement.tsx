import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import CaseForm, { CaseFormData } from '@/components/CaseManagement/CaseForm';
import CaseListWithAllocation from '@/components/CaseManagement/CaseListWithAllocation';
import CaseDetail from '@/components/CaseManagement/CaseDetail';
import { caseService, Case } from '@/services/caseService';
import { CaseUpdateService } from '@/services/caseUpdateService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Mock data - in real app, this would come from API
const mockClients = [
  { id: '1', name: 'ABC Corporation', email: 'contact@abccorp.com' },
  { id: '2', name: 'XYZ Industries', email: 'hr@xyzind.com' },
  { id: '3', name: 'Tech Solutions Ltd', email: 'admin@techsol.com' },
];


const mockCases = [
  {
    id: '1',
    case_number: 'BG-20250120-000001',
    title: 'Background Verification - John Doe',
    description: 'Complete background verification for new employee John Doe including address, education, and employment verification.',
    priority: 'high' as const,
    status: 'in_progress' as const,
    client: {
      id: '1',
      name: 'ABC Corporation',
      email: 'contact@abccorp.com',
    },
    location: {
      address_line: '123 Main Street, Sector 5',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    assignee: {
      id: '1',
      name: 'Rajesh Kumar',
      type: 'gig' as const,
    },
    tat_hours: 24,
    due_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    base_rate_inr: 500,
    total_rate_inr: 550,
  },
  {
    id: '2',
    case_number: 'BG-20250120-000002',
    title: 'Address Verification - Jane Smith',
    description: 'Verify residential address for Jane Smith in Delhi.',
    priority: 'medium' as const,
    status: 'allocated' as const,
    client: {
      id: '2',
      name: 'XYZ Industries',
      email: 'hr@xyzind.com',
    },
    location: {
      address_line: '456 Park Avenue, Connaught Place',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
    tat_hours: 48,
    due_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    base_rate_inr: 400,
    total_rate_inr: 400,
  },
  {
    id: '3',
    case_number: 'BG-20250120-000003',
    title: 'Education Verification - Mike Johnson',
    description: 'Verify educational qualifications for Mike Johnson from University of Mumbai.',
    priority: 'low' as const,
    status: 'completed' as const,
    client: {
      id: '3',
      name: 'Tech Solutions Ltd',
      email: 'admin@techsol.com',
    },
    location: {
      address_line: '789 University Road, Kalina',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400098',
    },
    assignee: {
      id: '2',
      name: 'Priya Sharma',
      type: 'gig' as const,
    },
    tat_hours: 72,
    due_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    base_rate_inr: 300,
    total_rate_inr: 300,
  },
];

type ViewMode = 'list' | 'create' | 'edit' | 'detail';

export default function CaseManagement() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize state based on current URL
  const getInitialState = () => {
    const path = location.pathname;
    console.log('Initializing state for path:', path);
    
    if (path === '/ops/cases') {
      return { viewMode: 'list' as ViewMode, selectedCaseId: null };
    } else if (path === '/ops/cases/create') {
      return { viewMode: 'create' as ViewMode, selectedCaseId: null };
    } else if (path.startsWith('/ops/cases/') && path.endsWith('/edit')) {
      const urlCaseId = path.split('/')[3];
      return { viewMode: 'edit' as ViewMode, selectedCaseId: urlCaseId };
    } else if (path.startsWith('/ops/cases/') && !path.endsWith('/edit')) {
      const urlCaseId = path.split('/')[3];
      return { viewMode: 'detail' as ViewMode, selectedCaseId: urlCaseId };
    }
    return { viewMode: 'list' as ViewMode, selectedCaseId: null };
  };

  const initialState = getInitialState();
  const [viewMode, setViewMode] = useState<ViewMode>(initialState.viewMode);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialState.selectedCaseId);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  // Debug initial state
  console.log('CaseManagement component initialized with path:', location.pathname);
  console.log('Initial state:', initialState);
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string; contact_person: string; email: string }>>([]);
  const [contractTypes, setContractTypes] = useState<Array<{ type_key: string; display_name: string; description: string; is_active: boolean; sort_order: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load cases and clients from database
  useEffect(() => {
    loadData();
  }, []);

  // Load case data for edit mode on initial load
  useEffect(() => {
    if (viewMode === 'edit' && selectedCaseId && !editingCase) {
      console.log('Loading case data for edit mode on initial load');
      loadCaseForEdit(selectedCaseId);
    }
  }, [viewMode, selectedCaseId, editingCase]);

  // Handle URL-based navigation
  useEffect(() => {
    const path = location.pathname;
    console.log('URL navigation effect triggered for path:', path);
    console.log('Current viewMode:', viewMode);
    console.log('Current selectedCaseId:', selectedCaseId);
    
    // Don't change navigation if we're already in the correct state
    if (path === '/ops/cases' && viewMode === 'list') {
      console.log('Already in list mode, skipping navigation');
      return;
    }
    
    if (path === '/ops/cases') {
      console.log('Setting list mode');
      setViewMode('list');
      setSelectedCaseId(null);
      setEditingCase(null);
    } else if (path === '/ops/cases/create') {
      console.log('Setting create mode');
      setViewMode('create');
      setSelectedCaseId(null);
      setEditingCase(null);
    } else if (path.startsWith('/ops/cases/') && path.endsWith('/edit')) {
      const urlCaseId = path.split('/')[3];
      console.log('Edit mode detected, caseId:', urlCaseId);
      if (viewMode !== 'edit' || selectedCaseId !== urlCaseId) {
        setViewMode('edit');
        setSelectedCaseId(urlCaseId);
        if (urlCaseId) {
          loadCaseForEdit(urlCaseId);
        }
      }
    } else if (path.startsWith('/ops/cases/') && !path.endsWith('/edit')) {
      const urlCaseId = path.split('/')[3];
      console.log('Detail mode detected, caseId:', urlCaseId);
      if (viewMode !== 'detail' || selectedCaseId !== urlCaseId) {
        setViewMode('detail');
        setSelectedCaseId(urlCaseId);
      }
    }
  }, [location.pathname, viewMode, selectedCaseId]);

  const loadCaseForEdit = async (caseId: string) => {
    console.log('Loading case for edit:', caseId);
    try {
      const caseData = await CaseUpdateService.getCaseForEdit(caseId);
      console.log('Case data loaded:', caseData);
      setEditingCase(caseData);
    } catch (error) {
      console.error('Failed to load case for edit:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [casesData, clientsData, contractTypesData] = await Promise.all([
        caseService.getCases(),
        caseService.getClients(),
        loadContractTypes()
      ]);
      
      // Filter cases created after November 2nd, 2025
      const cutoffDate = new Date('2025-11-02T00:00:00.000Z');
      
      const filteredCases = casesData.filter(caseItem => {
        const caseCreatedDate = new Date(caseItem.created_at);
        return caseCreatedDate >= cutoffDate;
      });
      
      console.log(`Filtered cases: ${filteredCases.length} out of ${casesData.length} total cases (showing cases created after November 2nd, 2025)`);
      
      setCases(filteredCases);
      setClients(clientsData);
      setContractTypes(contractTypesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cases and clients',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_type_config')
        .select('type_key, display_name, description, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.warn('Contract type config table not found, using fallback types:', error);
        // Fallback to hardcoded contract types if table doesn't exist
        return [
          {
            type_key: 'residential_address_check',
            display_name: 'Residential Address Check',
            description: 'Verification of residential addresses for individuals',
            is_active: true,
            sort_order: 1
          },
          {
            type_key: 'business_address_check',
            display_name: 'Business Address Check',
            description: 'Verification of business addresses for companies',
            is_active: true,
            sort_order: 2
          }
        ];
      }

      // Filter out "Negative Case Contract" - exclude contract types with "negative" in display_name or type_key
      const filteredData = (data || []).filter(contractType => {
        const displayNameLower = contractType.display_name?.toLowerCase() || '';
        const typeKeyLower = contractType.type_key?.toLowerCase() || '';
        return !displayNameLower.includes('negative') && 
               !typeKeyLower.includes('negative_case') &&
               typeKeyLower !== 'negative_case';
      });

      return filteredData;
    } catch (error) {
      console.error('Failed to load contract types:', error);
      return [];
    }
  };

  const selectedCase = useMemo(() => 
    selectedCaseId ? cases.find(c => c.id === selectedCaseId) : null, 
    [selectedCaseId, cases]
  );

  const handleCreateCase = () => {
    navigate('/ops/cases/create');
  };

  const handleEditCase = async (caseId: string) => {
    navigate(`/ops/cases/${caseId}/edit`);
  };

  const handleViewCase = (caseId: string) => {
    navigate(`/ops/cases/${caseId}`);
  };

  const handleDeleteCase = async (caseId: string) => {
    if (window.confirm('Are you sure you want to delete this case?')) {
      setIsLoading(true);
      try {
        const success = await caseService.deleteCase(caseId);
        if (success) {
          setCases(prev => prev.filter(c => c.id !== caseId));
          toast({
            title: 'Case Deleted',
            description: 'The case has been successfully deleted.',
          });
        } else {
          throw new Error('Failed to delete case');
        }
      } catch (error) {
        const { getErrorToast } = await import('@/utils/errorMessages');
        toast(getErrorToast(error));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUpdateCase = async (caseData: CaseFormData) => {
    if (!editingCase) return;
    
    setIsLoading(true);
    try {
      await CaseUpdateService.updateCase(editingCase.id, {
        client_case_id: caseData.client_case_id,
        contract_type: caseData.contract_type,
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary,
        address_line: caseData.address_line,
        city: caseData.city,
        state: caseData.state,
        pincode: caseData.pincode,
        country: caseData.country,
        lat: caseData.lat,
        lng: caseData.lng,
        location_url: caseData.location_url,
        client_id: caseData.client_id,
        vendor_tat_start_date: caseData.vendor_tat_start_date,
        tat_hours: caseData.tat_hours,
        due_date: caseData.due_date,
        instructions: caseData.instructions,
      });

      // Reload cases to get updated data
      await loadData();
      
      setEditingCase(null);
      navigate('/ops/cases');
      
      toast({
        title: 'Case Updated',
        description: 'The case has been successfully updated.',
      });
    } catch (error) {
      console.error('Failed to update case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitCase = async (caseData: CaseFormData) => {
    setIsLoading(true);
    try {
      // Create or get location first
      const locationId = await caseService.createOrGetLocation({
        address_line: caseData.address_line,
        city: caseData.city,
        state: caseData.state,
        pincode: caseData.pincode,
        lat: caseData.lat,
        lng: caseData.lng,
        location_url: caseData.location_url,
      });

      if (!locationId) {
        const locationError = new Error('Unable to save location. Please verify the address details.');
        locationError.name = 'LocationError';
        throw locationError;
      }

      // Create case with new structure
      const newCase = await caseService.createCase({
        client_case_id: caseData.client_case_id,
        contract_type: caseData.contract_type,
        candidate_name: caseData.candidate_name,
        company_name: caseData.company_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary,
        client_id: caseData.client_id,
        location_id: locationId,
        vendor_tat_start_date: caseData.vendor_tat_start_date.toISOString(),
        due_at: caseData.due_date.toISOString(),
        base_rate_inr: caseData.base_rate_inr,
        bonus_inr: caseData.bonus_inr,
        penalty_inr: caseData.penalty_inr,
        total_payout_inr: caseData.total_payout_inr,
        tat_hours: caseData.tat_hours,
        instructions: caseData.instructions,
      });

      if (newCase) {
        setCases(prev => [newCase, ...prev]);
        navigate('/ops/cases');
        toast({
          title: 'Case Created',
          description: 'The case has been successfully created.',
        });
      } else {
        throw new Error('Failed to create case');
      }
    } catch (error) {
      console.error('Failed to create case:', error);
      const { getErrorToast } = await import('@/utils/errorMessages');
      toast(getErrorToast(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelForm = () => {
    navigate('/ops/cases');
    setEditingCase(null);
  };

  const handleCloseDetail = () => {
    navigate('/ops/cases');
  };


  if (viewMode === 'create' || viewMode === 'edit') {
    console.log('Rendering CaseForm in edit mode:', viewMode === 'edit');
    console.log('editingCase:', editingCase);
    console.log('selectedCaseId:', selectedCaseId);
    
    // Show loading state when editing and case data is not loaded yet
    if (viewMode === 'edit' && !editingCase) {
      return (
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading case data...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return (
      <div className="container mx-auto py-6">
        <CaseForm
          key={editingCase?.id || 'create'} // Force re-render when editingCase changes
          onSubmit={viewMode === 'edit' ? handleUpdateCase : handleSubmitCase}
          onCancel={handleCancelForm}
          isLoading={isLoading}
          clients={clients.map(c => ({ 
            id: c.id, 
            name: c.name, 
            email: c.email,
            contact_person: c.contact_person || '' 
          }))}
          contractTypes={contractTypes}
          isEditing={viewMode === 'edit'}
          caseId={editingCase?.id}
          initialData={editingCase ? {
            client_case_id: editingCase.client_case_id,
            contract_type: editingCase.contract_type,
            candidate_name: editingCase.candidate_name,
            company_name: (editingCase as any).company_name,
            phone_primary: editingCase.phone_primary,
            phone_secondary: editingCase.phone_secondary,
            address_line: editingCase.location?.address_line || '',
            city: editingCase.location?.city || '',
            state: editingCase.location?.state || '',
            pincode: editingCase.location?.pincode || '',
            country: 'India',
            lat: editingCase.location?.lat,
            lng: editingCase.location?.lng,
            client_id: editingCase.client.id,
            vendor_tat_start_date: new Date(editingCase.vendor_tat_start_date),
            tat_hours: editingCase.tat_hours,
            due_date: new Date(editingCase.due_at),
            base_rate_inr: editingCase.base_rate_inr || 0,
            bonus_inr: editingCase.bonus_inr || 0,
            penalty_inr: editingCase.penalty_inr || 0,
            total_payout_inr: editingCase.total_payout_inr || 0,
            instructions: (editingCase as any).instructions || ''
          } : undefined}
        />
      </div>
    );
  }

  if (viewMode === 'detail' && selectedCase) {
    return (
      <div className="container mx-auto py-6">
        <CaseDetail
          caseData={{
            ...selectedCase,
            client: {
              ...selectedCase.client,
              phone: '+91 98765 43210',
              contact_person: 'HR Manager',
            },
            location: {
              ...selectedCase.location,
              country: 'India',
              lat: 19.0760,
              lng: 72.8777,
            },
            notes: 'Please ensure thorough verification of all documents.',
            attachments: [],
            submissions: [],
            qc_reviews: [],
          }}
          onEdit={() => handleEditCase(selectedCase.id)}
          onClose={handleCloseDetail}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <CaseListWithAllocation
        cases={cases}
        onViewCase={handleViewCase}
        onEditCase={handleEditCase}
        onDeleteCase={handleDeleteCase}
        onCreateCase={handleCreateCase}
        onRefresh={loadData}
        isLoading={isLoading}
      />
    </div>
  );
}
