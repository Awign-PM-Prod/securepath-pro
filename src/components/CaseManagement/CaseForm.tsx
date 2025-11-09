import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MapPin, Clock, User, Building, Hash, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { caseFormService } from '@/services/caseFormService';

interface ContractType {
  type_key: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface CaseFormProps {
  onSubmit: (caseData: CaseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  clients?: Array<{ id: string; name: string; contact_person: string; email: string }>;
  contractTypes?: ContractType[];
  initialData?: Partial<CaseFormData>;
  isEditing?: boolean;
  caseId?: string;
}

export interface CaseFormData {
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat?: number;
  lng?: number;
  location_url?: string;
  client_id: string;
  vendor_tat_start_date: Date;
  // These fields will be auto-calculated from client contract
  tat_hours: number;
  due_date: Date;
  base_rate_inr: number;
  bonus_inr: number;
  penalty_inr: number;
  total_payout_inr: number;
  instructions?: string;
  company_name?: string;
}

export default function CaseForm({ onSubmit, onCancel, isLoading = false, clients = [], contractTypes = [], initialData, isEditing = false, caseId }: CaseFormProps) {
  const [formData, setFormData] = useState<CaseFormData>({
    client_case_id: initialData?.client_case_id || '',
    contract_type: initialData?.contract_type || '',
    candidate_name: initialData?.candidate_name || '',
    phone_primary: initialData?.phone_primary || '',
    phone_secondary: initialData?.phone_secondary || '',
    address_line: initialData?.address_line || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    country: initialData?.country || 'India',
    lat: initialData?.lat,
    lng: initialData?.lng,
    location_url: initialData?.location_url || '',
    client_id: initialData?.client_id || '',
    vendor_tat_start_date: initialData?.vendor_tat_start_date || new Date(),
    tat_hours: initialData?.tat_hours || 24,
    due_date: initialData?.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000),
    base_rate_inr: initialData?.base_rate_inr || 0,
    bonus_inr: initialData?.bonus_inr || 0,
    penalty_inr: initialData?.penalty_inr || 0,
    total_payout_inr: initialData?.total_payout_inr || 0,
    instructions: initialData?.instructions || '',
    company_name: initialData?.company_name || '',
  });

  const [errors, setErrors] = useState<Partial<CaseFormData>>({});
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  
  // State for dropdown selections to maintain them during editing
  const [selectedClient, setSelectedClient] = useState<string>(initialData?.client_id || '');
  const [selectedContractType, setSelectedContractType] = useState<string>(initialData?.contract_type || '');

  // Handle initialData changes for editing
  useEffect(() => {
    if (isEditing && initialData) {
      console.log('CaseForm: Updating form data with initialData:', initialData);
      const newFormData = {
        client_case_id: initialData.client_case_id || '',
        contract_type: initialData.contract_type || '',
        candidate_name: initialData.candidate_name || '',
        phone_primary: initialData.phone_primary || '',
        phone_secondary: initialData.phone_secondary || '',
        address_line: initialData.address_line || '',
        city: initialData.city || '',
        state: initialData.state || '',
        pincode: initialData.pincode || '',
        country: initialData.country || 'India',
        lat: initialData.lat,
        lng: initialData.lng,
        client_id: initialData.client_id || '',
        vendor_tat_start_date: initialData.vendor_tat_start_date || new Date(),
        tat_hours: initialData.tat_hours || 24,
        due_date: initialData.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000),
        base_rate_inr: initialData.base_rate_inr || 0,
        bonus_inr: initialData.bonus_inr || 0,
        penalty_inr: initialData.penalty_inr || 0,
        total_payout_inr: initialData.total_payout_inr || 0,
        instructions: initialData.instructions || '',
        company_name: initialData.company_name || '',
      };
      console.log('CaseForm: Setting new form data:', newFormData);
      setFormData(newFormData);
      setSelectedClient(initialData.client_id || '');
      setSelectedContractType(initialData.contract_type || '');
    }
  }, [isEditing, initialData]);

  // Debug form data changes
  useEffect(() => {
    console.log('CaseForm: formData changed:', formData);
  }, [formData]);

  const handleInputChange = (field: keyof CaseFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    setFormData(prev => ({ ...prev, client_id: clientId }));
    if (errors.client_id) {
      setErrors(prev => ({ ...prev, client_id: undefined }));
    }
  };

  const handleContractTypeChange = (contractType: string) => {
    setSelectedContractType(contractType);
    setFormData(prev => ({ ...prev, contract_type: contractType }));
    if (errors.contract_type) {
      setErrors(prev => ({ ...prev, contract_type: undefined }));
    }
  };

  // Auto-fill city and state from pincode when pincode is entered
  useEffect(() => {
    const loadLocationFromPincode = async () => {
      // Only auto-fill if pincode is 6 digits
      if (!formData.pincode || formData.pincode.length !== 6) {
        // If pincode is cleared, clear auto-filled city/state
        if (formData.pincode.length === 0) {
          setFormData(prev => {
            // Only clear if they were auto-filled (check by comparing with empty)
            if (prev.city && prev.state) {
              return { ...prev, city: '', state: '' };
            }
            return prev;
          });
          setAutoFilled(prev => {
            const newSet = new Set(prev);
            newSet.delete('city');
            newSet.delete('state');
            return newSet;
          });
        }
        return;
      }

      setIsLoadingDefaults(true);
      try {
        const location = await caseFormService.getLocationFromPincode(formData.pincode);
        
        if (location) {
          setFormData(prev => ({
            ...prev,
            city: location.city,
            state: location.state
          }));
          setAutoFilled(prev => {
            const newSet = new Set(prev);
            newSet.add('city');
            newSet.add('state');
            return newSet;
          });
        }
      } catch (error) {
        console.error('Failed to load location from pincode:', error);
      } finally {
        setIsLoadingDefaults(false);
      }
    };

    loadLocationFromPincode();
  }, [formData.pincode]);

  // Load case defaults when client, contract type, and pincode are all available
  useEffect(() => {
    const loadCaseDefaults = async () => {
      if (!formData.client_id || !formData.contract_type || !formData.pincode) return;

      setIsLoadingDefaults(true);
      try {
        const defaults = await caseFormService.getCaseDefaults(
          formData.client_id,
          formData.contract_type,
          formData.pincode, 
          formData.tat_hours
        );
        
        if (defaults) {
          const updates: Partial<CaseFormData> = {};
          const newAutoFilled = new Set<string>(autoFilled);

          // Auto-fill TAT hours and calculate due date
          if (!formData.tat_hours || autoFilled.has('tat_hours')) {
            updates.tat_hours = defaults.tat_hours;
            newAutoFilled.add('tat_hours');
            
            // Calculate due date based on vendor TAT start date + TAT hours
            if (formData.vendor_tat_start_date) {
              const dueDate = new Date(formData.vendor_tat_start_date);
              dueDate.setHours(dueDate.getHours() + defaults.tat_hours);
              updates.due_date = dueDate;
              newAutoFilled.add('due_date');
            }
          }

          // Auto-fill payout details
          // Rate fields will be calculated automatically during case creation

          setFormData(prev => ({ ...prev, ...updates }));
          setAutoFilled(newAutoFilled);
        }
      } catch (error) {
        console.error('Failed to load case defaults:', error);
      } finally {
        setIsLoadingDefaults(false);
      }
    };

    loadCaseDefaults();
  }, [formData.client_id, formData.contract_type, formData.pincode, formData.vendor_tat_start_date]);

  // Recalculate due date when vendor TAT start date or TAT hours change
  useEffect(() => {
    if (formData.vendor_tat_start_date && formData.tat_hours > 0) {
      const dueDate = new Date(formData.vendor_tat_start_date);
      dueDate.setHours(dueDate.getHours() + formData.tat_hours);
      setFormData(prev => ({ ...prev, due_date: dueDate }));
    }
  }, [formData.vendor_tat_start_date, formData.tat_hours]);

  const validateForm = (): boolean => {
    const newErrors: Partial<CaseFormData> = {};

    if (!formData.client_case_id.trim()) newErrors.client_case_id = 'Client Case ID is required';
    if (!formData.contract_type) newErrors.contract_type = 'Contract Type is required';
    if (!formData.candidate_name.trim()) newErrors.candidate_name = 'Candidate Name is required';
    if (!formData.phone_primary.trim()) newErrors.phone_primary = 'Primary Phone is required';
    if (!formData.client_id) newErrors.client_id = 'Client is required';
    if (!formData.address_line.trim()) newErrors.address_line = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
    if (!formData.vendor_tat_start_date) (newErrors as any).vendor_tat_start_date = 'Vendor TAT Start Date is required';
    // If business verification, Company Name is required
    if ((formData.contract_type || '').toLowerCase().includes('business')) {
      if (!formData.company_name || !formData.company_name.trim()) {
        (newErrors as any).company_name = 'Company Name is required for business verification';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Case' : 'Create New Case'}</CardTitle>
        <CardDescription>
          {isEditing ? 'Edit the details of the case.' : 'Fill in the details to create a new background verification case.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Case ID */}
          <div className="space-y-2">
            <Label htmlFor="client_case_id">Client Case ID <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="client_case_id"
                value={formData.client_case_id}
                onChange={(e) => handleInputChange('client_case_id', e.target.value)}
                placeholder="Enter client-provided case ID"
                className={`pl-10 ${errors.client_case_id ? 'border-red-500' : ''}`}
              />
            </div>
            {errors.client_case_id && <p className="text-sm text-red-500">{errors.client_case_id}</p>}
          </div>

          {/* Client and Contract Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client <span className="text-red-500">*</span></Label>
              <Select value={selectedClient} onValueChange={handleClientChange}>
                <SelectTrigger className={errors.client_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" /> {client.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && <p className="text-sm text-red-500">{errors.client_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract_type">Contract Type <span className="text-red-500">*</span></Label>
              <Select value={selectedContractType} onValueChange={handleContractTypeChange}>
                <SelectTrigger className={errors.contract_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select contract type" />
                </SelectTrigger>
                <SelectContent>
                  {contractTypes.map((contractType) => (
                    <SelectItem key={contractType.type_key} value={contractType.type_key}>
                      <div className="flex flex-col">
                        <span className="font-medium">{contractType.display_name}</span>
                        {contractType.description && (
                          <span className="text-sm text-muted-foreground">
                            {contractType.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contract_type && <p className="text-sm text-red-500">{errors.contract_type}</p>}
            </div>
          </div>

          {/* Candidate Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center"><User className="mr-2 h-4 w-4" /> Candidate Information</h3>
            {selectedContractType.toLowerCase().includes('business') && (
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name <span className="text-red-500">*</span></Label>
                <Input
                  id="company_name"
                  value={formData.company_name || ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Enter company name"
                  className={(errors as any).company_name ? 'border-red-500' : ''}
                />
                {(errors as any).company_name && <p className="text-sm text-red-500">{(errors as any).company_name}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="candidate_name">Candidate Name <span className="text-red-500">*</span></Label>
              <Input
                id="candidate_name"
                value={formData.candidate_name}
                onChange={(e) => handleInputChange('candidate_name', e.target.value)}
                placeholder="Enter candidate's full name"
                className={errors.candidate_name ? 'border-red-500' : ''}
              />
              {errors.candidate_name && <p className="text-sm text-red-500">{errors.candidate_name}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone_primary">Primary Phone <span className="text-red-500">*</span></Label>
                <Input
                  id="phone_primary"
                  value={formData.phone_primary}
                  onChange={(e) => handleInputChange('phone_primary', e.target.value)}
                  placeholder="Enter primary phone number"
                  className={errors.phone_primary ? 'border-red-500' : ''}
                />
                {errors.phone_primary && <p className="text-sm text-red-500">{errors.phone_primary}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_secondary">Secondary Phone (Optional)</Label>
                <Input
                  id="phone_secondary"
                  value={formData.phone_secondary || ''}
                  onChange={(e) => handleInputChange('phone_secondary', e.target.value)}
                  placeholder="Enter secondary phone number"
                />
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center"><MapPin className="mr-2 h-4 w-4" /> Location Details</h3>
            <div className="space-y-2">
              <Label htmlFor="address_line">Address <span className="text-red-500">*</span></Label>
              <Input
                id="address_line"
                value={formData.address_line}
                onChange={(e) => handleInputChange('address_line', e.target.value)}
                placeholder="Enter full address"
                className={errors.address_line ? 'border-red-500' : ''}
              />
              {errors.address_line && <p className="text-sm text-red-500">{errors.address_line}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode <span className="text-red-500">*</span></Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange('pincode', e.target.value)}
                  placeholder="Enter pincode"
                  className={errors.pincode ? 'border-red-500' : ''}
                  maxLength={6}
                />
                {errors.pincode && <p className="text-sm text-red-500">{errors.pincode}</p>}
                {isLoadingDefaults && formData.pincode.length === 6 && (
                  <p className="text-xs text-blue-600">Loading location...</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                <Input
                  id="city"
                  value={formData.city}
                  readOnly
                  placeholder="Auto-filled from pincode"
                  className={errors.city ? 'border-red-500 bg-muted' : 'bg-muted'}
                />
                {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
                {autoFilled.has('city') && <p className="text-xs text-blue-600">Auto-filled from pincode</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
                <Input
                  id="state"
                  value={formData.state}
                  readOnly
                  placeholder="Auto-filled from pincode"
                  className={errors.state ? 'border-red-500 bg-muted' : 'bg-muted'}
                />
                {errors.state && <p className="text-sm text-red-500">{errors.state}</p>}
                {autoFilled.has('state') && <p className="text-xs text-blue-600">Auto-filled from pincode</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_url">Location URL (Optional)</Label>
              <Input
                id="location_url"
                value={formData.location_url || ''}
                onChange={(e) => handleInputChange('location_url', e.target.value)}
                placeholder="Enter location URL (e.g., Google Maps link, property listing)"
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Add a URL related to this location (Google Maps, property listing, etc.)
              </p>
            </div>
          </div>

          {/* Vendor TAT Start Date */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center"><Clock className="mr-2 h-4 w-4" /> Vendor TAT</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_tat_start_date">Vendor TAT Start Date <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.vendor_tat_start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.vendor_tat_start_date ? format(formData.vendor_tat_start_date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.vendor_tat_start_date}
                      onSelect={(date) => {
                        if (date) {
                          // Preserve existing time or set to current time
                          const existingTime = formData.vendor_tat_start_date;
                          const newDate = new Date(date);
                          if (existingTime) {
                            newDate.setHours(existingTime.getHours(), existingTime.getMinutes(), 0, 0);
                          } else {
                            newDate.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
                          }
                          handleInputChange('vendor_tat_start_date', newDate);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {(errors as any).vendor_tat_start_date && <p className="text-sm text-red-500">{String((errors as any).vendor_tat_start_date)}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_tat_start_time">Start Time <span className="text-red-500">*</span></Label>
                <Input
                  id="vendor_tat_start_time"
                  type="time"
                  value={formData.vendor_tat_start_date ? format(formData.vendor_tat_start_date, "HH:mm") : ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (formData.vendor_tat_start_date) {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(formData.vendor_tat_start_date);
                      newDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
                      handleInputChange('vendor_tat_start_date', newDate);
                    }
                  }}
                  className={(errors as any).vendor_tat_start_date ? 'border-red-500' : ''}
                />
                {(errors as any).vendor_tat_start_date && <p className="text-sm text-red-500">{typeof (errors as any).vendor_tat_start_date === 'string' ? (errors as any).vendor_tat_start_date : 'Invalid date'}</p>}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              TAT hours, due date, and payout details will be automatically calculated from the client contract.
            </p>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Additional Information</h3>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                placeholder="Enter any special instructions"
                rows={3}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Case' : 'Create Case'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}