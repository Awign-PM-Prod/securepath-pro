import React, { useState, useEffect, useCallback } from 'react';
import { FormTemplate, FormField, FormData, FormFieldValue } from '@/types/form';
import { formService } from '@/services/formService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, FileText, Camera } from 'lucide-react';
import { CameraCapture } from '@/components/CameraCapture';
import { addImageOverlay, isImageFile } from '@/utils/imageOverlayUtils';

interface DynamicFormProps {
  contractTypeId: string;
  caseId: string;
  gigWorkerId: string;
  onSubmit: (formData: FormData) => void;
  onSaveDraft?: (formData: FormData) => void;
  onAutoSave?: (formData: FormData) => void;
  onCancel: () => void;
  loading?: boolean;
  hasDraft?: boolean;
  onResumeDraft?: () => void;
  onStartFresh?: () => void;
  draftData?: any;
  isAutoSaving?: boolean;
  lastAutoSaveTime?: Date | null;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  contractTypeId,
  caseId,
  gigWorkerId,
  onSubmit,
  onSaveDraft,
  onAutoSave,
  onCancel,
  loading = false,
  hasDraft = false,
  onResumeDraft,
  onStartFresh,
  draftData,
  isAutoSaving = false,
  lastAutoSaveTime
}) => {
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFieldKey, setCameraFieldKey] = useState<string | null>(null);
  const [fileLocations, setFileLocations] = useState<Record<string, {
    lat: number;
    lng: number;
    address?: string;
    accuracy?: number;
  }>>({});
  
  // Track individual file locations: fieldKey -> fileIndex -> location
  const [individualFileLocations, setIndividualFileLocations] = useState<Record<string, Record<number, {
    lat: number;
    lng: number;
    address?: string;
    accuracy?: number;
  }>>>({});

  const [hasFormData, setHasFormData] = useState(false);
  
  // Track uploaded files to prevent duplicates in auto-save
  const [uploadedFileHashes, setUploadedFileHashes] = useState<Set<string>>(new Set());
  
  // Debug text fields
  const textFields = ['additional_notes', 'contact_person_designation', 'contact_person_name', 'business_name', 'premises_other'];

  // Generate a simple hash for file comparison
  const generateFileHash = (file: File): string => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  };

  // Check if file is already uploaded
  const isFileAlreadyUploaded = (file: File): boolean => {
    const fileHash = generateFileHash(file);
    return uploadedFileHashes.has(fileHash);
  };

  // Mark file as uploaded
  const markFileAsUploaded = (file: File) => {
    const fileHash = generateFileHash(file);
    setUploadedFileHashes(prev => new Set(prev).add(fileHash));
  };

  // Image compression utility
  const compressImage = (file: File, maxSizeMB: number = 1, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions to fit within size limit
        let { width, height } = img;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        // Calculate compression ratio needed
        const originalSize = file.size;
        const compressionRatio = Math.sqrt(maxSizeBytes / originalSize);
        
        if (compressionRatio < 1) {
          width = Math.floor(width * compressionRatio);
          height = Math.floor(height * compressionRatio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  };

  useEffect(() => {
    setDraftLoaded(false);
    loadFormTemplate();
  }, [contractTypeId, draftData]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Immediate save functionality - save when user adds responses
  const saveFormData = useCallback(async (updatedFormData: FormData) => {
    console.log('saveFormData called with:', {
      hasOnAutoSave: !!onAutoSave,
      hasFormData: !!updatedFormData,
      formDataKeys: Object.keys(updatedFormData || {}),
      formData: updatedFormData
    });
    
    if (onAutoSave && updatedFormData && Object.keys(updatedFormData).length > 0) {
      // Create a deep copy of form data for save
      const saveFormData = JSON.parse(JSON.stringify(updatedFormData));
      
      // Process files for auto-save - always include files for upload if they exist
      Object.keys(saveFormData).forEach(fieldKey => {
        if (fieldKey === '_metadata') return;
        const fieldData = saveFormData[fieldKey];
        if (fieldData && fieldData.files && fieldData.files.length > 0) {
          console.log(`Auto-save: Processing field ${fieldKey} with ${fieldData.files.length} files`);
          // For auto-save, always include files for processing
          // The formService will handle filtering out already uploaded files
          console.log(`Field ${fieldKey}: Including ${fieldData.files.length} files for auto-save processing`);
        }
      });
      
      // Check if there are any changes worth saving
      const hasFileChanges = Object.keys(saveFormData).some(fieldKey => {
        if (fieldKey === '_metadata') return false;
        const fieldData = saveFormData[fieldKey];
        return fieldData && fieldData.files && fieldData.files.length > 0;
      });
      
      const hasNonFileChanges = Object.keys(saveFormData).some(fieldKey => {
        if (fieldKey === '_metadata') return false;
        const fieldData = saveFormData[fieldKey];
        return fieldData && fieldData.value !== undefined && fieldData.value !== '';
      });
      
      if (hasFileChanges || hasNonFileChanges) {
        // Prepare form data with location information for save
        const formDataWithLocation = {
          ...saveFormData,
          _metadata: {
            file_locations: fileLocations,
            individual_file_locations: individualFileLocations,
            submission_timestamp: new Date().toISOString(),
            auto_save: true
          }
        };
        console.log('Calling onAutoSave with formDataWithLocation:', formDataWithLocation);
        onAutoSave(formDataWithLocation);
      }
    }
  }, [onAutoSave, fileLocations, individualFileLocations, isFileAlreadyUploaded]);


  // Debug: Monitor fileLocations state changes
  useEffect(() => {
    console.log('fileLocations state updated:', fileLocations);
  }, [fileLocations]);
  
  // Debug: Monitor individualFileLocations state changes
  useEffect(() => {
    console.log('individualFileLocations state updated:', individualFileLocations);
  }, [individualFileLocations]);

  // Debug: Monitor formData state changes
  useEffect(() => {
    console.log('formData state updated:', formData);
    console.log('Draft data available:', !!draftData);
    console.log('Template loaded:', !!template);
    
    // Check if form data has values
    const hasValues = Object.entries(formData).some(([key, field]) => {
      if (key === '_metadata') return false; // Skip metadata
      
      // Check if field has a value property (standard structure)
      if (field && typeof field === 'object' && 'value' in field) {
        const hasValue = field.value !== '' && field.value !== false && 
               (!Array.isArray(field.value) || field.value.length > 0);
        if (hasValue) {
          console.log(`Field ${key} has value:`, field.value);
        }
        return hasValue;
      }
      
      // Check if field is an array directly (multiple choice fields)
      if (Array.isArray(field) && field.length > 0) {
        console.log(`Field ${key} has array value:`, field);
        return true;
      }
      
      return false;
    });
    console.log('Form data has values:', hasValues);
  }, [formData, draftData, template]);

  const loadDraftFilesFromDraft = async (draftData: any, initialData: FormData): Promise<FormData> => {
    try {
      // Get files from draft data
      const files = draftData.form_submission_files || [];

      // Group files by field_key
      const filesByField: Record<string, any[]> = {};
      files.forEach((file: any) => {
        const fieldKey = file.form_field?.field_key;
        if (fieldKey) {
          if (!filesByField[fieldKey]) {
            filesByField[fieldKey] = [];
          }
          filesByField[fieldKey].push(file);
        }
      });

      // Create a deep copy of initialData to avoid mutating the original
      const updatedData = JSON.parse(JSON.stringify(initialData));

      // Update updatedData with files (transform database format to form format)
      Object.entries(filesByField).forEach(([fieldKey, fieldFiles]) => {
        if (updatedData[fieldKey]) {
          // Transform database file format to form file format
          const transformedFiles = fieldFiles.map(file => ({
            ...file,
            name: file.file_name,
            size: file.file_size || 0,
            url: file.file_url,
            type: file.mime_type,
            uploaded_at: file.uploaded_at
          }));
          
          // Remove duplicates based on file URL to prevent showing same file multiple times
          const uniqueFiles = transformedFiles.filter((file, index, self) => 
            index === self.findIndex(f => f.url === file.url)
          );
          
          // REPLACE files instead of adding to existing ones
          updatedData[fieldKey].files = uniqueFiles;
          
          // Mark loaded files as uploaded to prevent duplicates in auto-save
          uniqueFiles.forEach(file => {
            // Create a File object for marking (we'll use the file data we have)
            const fileObj = new File([], file.name, {
              type: file.type || 'application/octet-stream',
              lastModified: new Date(file.uploaded_at || Date.now()).getTime()
            });
            // Override the size property since we can't set it in File constructor
            Object.defineProperty(fileObj, 'size', { value: file.size || 0 });
            markFileAsUploaded(fileObj);
          });
        }
      });

      return updatedData;
    } catch (error) {
      console.error('Error loading draft files:', error);
      return initialData;
    }
  };

  const loadDraftFiles = async (submissionId: string, initialData: FormData): Promise<FormData> => {
    try {
      console.log('Loading draft files for submission:', submissionId);
      
      // Import supabase client
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Check current user context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Auto-save: Current user:', user?.id, userError);
      
      // Check gig_partner relationship
      const { data: gigPartner, error: gigPartnerError } = await supabase
        .from('gig_partners')
        .select('id, user_id')
        .eq('user_id', user?.id)
        .single();
      console.log('Auto-save: Gig partner:', gigPartner, gigPartnerError);
      
      // Check form submission relationship
      const { data: submission, error: submissionError } = await supabase
        .from('form_submissions')
        .select('id, gig_partner_id')
        .eq('id', submissionId)
        .single();
      console.log('Auto-save: Form submission:', submission, submissionError);
      
      // Fetch files for this submission
      console.log('Auto-save: Fetching files for submission ID:', submissionId);
      const { data: files, error } = await supabase
        .from('form_submission_files')
        .select(`
          id,
          field_id,
          file_url,
          file_name,
          file_size,
          mime_type,
          uploaded_at,
          form_field:form_fields(field_key, field_title, field_type)
        `)
        .eq('submission_id', submissionId);

      if (error) {
        console.error('Auto-save: Error fetching files:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return initialData;
      }

      console.log('Loaded draft files:', files);
      console.log('Number of files found:', files?.length || 0);

      // Group files by field_key
      const filesByField: Record<string, any[]> = {};
      files?.forEach(file => {
        const fieldKey = file.form_field?.field_key;
        console.log(`File ${file.file_name} belongs to field: ${fieldKey}`);
        if (fieldKey) {
          if (!filesByField[fieldKey]) {
            filesByField[fieldKey] = [];
          }
          filesByField[fieldKey].push(file);
        }
      });

      console.log('Files grouped by field:', filesByField);
      console.log('Number of fields with files:', Object.keys(filesByField).length);

      // Create a deep copy of initialData to avoid mutating the original
      const updatedData = JSON.parse(JSON.stringify(initialData));

      // Update updatedData with files (transform database format to form format)
      Object.entries(filesByField).forEach(([fieldKey, fieldFiles]) => {
        if (updatedData[fieldKey]) {
          // Transform database file format to form file format
          const transformedFiles = fieldFiles.map(file => ({
            ...file,
            name: file.file_name,  // Map file_name to name
            size: file.file_size || 0,  // Map file_size to size
            url: file.file_url,  // Add url property for display
            type: file.mime_type,  // Add type property
            uploaded_at: file.uploaded_at  // Keep uploaded_at
          }));
          
          // Remove duplicates based on file URL to prevent showing same file multiple times
          const uniqueFiles = transformedFiles.filter((file, index, self) => 
            index === self.findIndex(f => f.url === file.url)
          );
          
          // REPLACE files instead of adding to existing ones
          updatedData[fieldKey].files = uniqueFiles;
          
          // Mark loaded files as uploaded to prevent duplicates in auto-save
          uniqueFiles.forEach(file => {
            // Create a File object for marking (we'll use the file data we have)
            const fileObj = new File([], file.name, {
              type: file.type || 'application/octet-stream',
              lastModified: new Date(file.uploaded_at || Date.now()).getTime()
            });
            // Override the size property since we can't set it in File constructor
            Object.defineProperty(fileObj, 'size', { value: file.size || 0 });
            markFileAsUploaded(fileObj);
          });
        }
      });

      return updatedData;
    } catch (error) {
      console.error('Error loading draft files:', error);
      return initialData;
    }
  };

  const loadFormTemplate = async () => {
    setLoadingTemplate(true);
    setDraftLoaded(false);
    console.log('Loading form template for contract type:', contractTypeId);
    const result = await formService.getFormTemplate(contractTypeId);
    console.log('Form template result:', result);
    
    if (result.success && result.template) {
      console.log('Form template loaded successfully:', result.template);
      setTemplate(result.template);
      
      // Initialize form data - either from draft or fresh
      let initialData: FormData = {};
      
      // First, initialize all template fields with empty data
      result.template.form_fields?.forEach(field => {
        initialData[field.field_key] = {
          value: field.field_type === 'boolean' ? false : 
                 field.field_type === 'multiple_choice' ? [] : '',
          files: []
        };
      });
      
      if (draftData && draftData.submission_data) {
        console.log('Loading draft data:', draftData.submission_data);
        
        
        
        // initialData is already initialized with template fields above
        
        // Debug for text fields
        textFields.forEach(fieldKey => {
          if (initialData[fieldKey]) {
            console.log(`Template field ${fieldKey}:`, {
              field_key: fieldKey,
              field_type: initialData[fieldKey].value,
              initialDataValue: initialData[fieldKey]
            });
          }
        });
        
        // Merge draft data with current form data (only update fields that have values in draft)
        Object.entries(draftData.submission_data).forEach(([key, value]) => {
          if (key === '_metadata') {
            // Handle metadata separately
            return;
          }
          
          // Special debug for text fields
          if (textFields.includes(key)) {
            console.log(`Processing text field ${key}:`, { key, value, initialDataKey: initialData[key] });
          }
          
          if (initialData[key]) {
            // Field exists in template, merge the data
            if (value && typeof value === 'object' && 'value' in value) {
              // Standard structure: {value: "", files: []}
              if (value.value !== undefined) {
                initialData[key] = {
                  value: value.value,
                  files: initialData[key].files // Keep existing files array, don't merge from draft data
                };
                console.log(`Merging field ${key} with draft value:`, value.value);
              } else {
                console.log(`Skipping field ${key} - value is undefined`);
              }
            } else if (Array.isArray(value)) {
              // Array structure: ["Yes", "No"] - convert to standard structure
              initialData[key] = {
                value: value,
                files: initialData[key].files // Keep existing files array
              };
              console.log(`Merging field ${key} with draft array:`, value);
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              // Direct value structure: "some text" or 123 or true - convert to standard structure
              initialData[key] = {
                value: value,
                files: initialData[key].files // Keep existing files array
              };
              console.log(`Merging field ${key} with direct value:`, value);
            }
          } else if (key === 'additional_notes') {
            console.log('additional_notes field not found in initialData template');
          }
        });
        
        // Load file locations from draft metadata
        if (draftData.submission_data._metadata?.file_locations) {
          setFileLocations(draftData.submission_data._metadata.file_locations);
        }
        if (draftData.submission_data._metadata?.individual_file_locations) {
          setIndividualFileLocations(draftData.submission_data._metadata.individual_file_locations);
        }
        
        // Load files from draft data (now included in the draft)
        const updatedFormData = await loadDraftFilesFromDraft(draftData, initialData);
        
        // Update form data with loaded files
        setFormData(updatedFormData);
        setDraftLoaded(true);
        setHasFormData(true);
      } else {
        // initialData is already initialized with template fields above
        // Set form data for fresh form
        setFormData(initialData);
        setHasFormData(true);
      }
      
      
      
      // Mark as loaded after all data is processed
      setDraftLoaded(true);
    } else {
      console.error('Error loading form template:', result.error);
      // Show a user-friendly message
      setTemplate(null);
      setDraftLoaded(true);
    }
    setLoadingTemplate(false);
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => {
      const updatedFormData = {
        ...prev,
        [fieldKey]: {
          ...prev[fieldKey],
          value
        }
      };
      
      // Trigger immediate save after state update with a small delay
      // to ensure file processing is complete
      setTimeout(() => {
        saveFormData(updatedFormData);
      }, 100);
      
      return updatedFormData;
    });
    
    // Clear error when user starts typing
    if (errors[fieldKey]) {
      setErrors(prev => ({
        ...prev,
        [fieldKey]: ''
      }));
    }
  };

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    return new Promise<{lat: number; lng: number; address?: string; accuracy?: number}>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Try to get address from coordinates
          let address = '';
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            address = `${data.locality || ''} ${data.city || ''} ${data.principalSubdivision || ''}`.trim();
          } catch (e) {
            console.warn('Could not get address from coordinates:', e);
          }

          resolve({
            lat: latitude,
            lng: longitude,
            address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            accuracy: accuracy
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }, []);

  const handleFileUpload = async (fieldKey: string, files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const currentFiles = formData[fieldKey]?.files || [];
    const startIndex = currentFiles.length;
    
    // Set uploading state and progress
    setUploadingFiles(prev => ({ ...prev, [fieldKey]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldKey]: 0 }));
    
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const currentProgress = prev[fieldKey] || 0;
        if (currentProgress < 90) {
          return { ...prev, [fieldKey]: currentProgress + Math.random() * 20 };
        }
        return prev;
      });
    }, 200);
    
    try {
      // Validate file sizes (10MB limit)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = fileArray.filter(file => file.size > maxSizeBytes);
      
      if (oversizedFiles.length > 0) {
        clearInterval(progressInterval);
        setUploadingFiles(prev => ({ ...prev, [fieldKey]: false }));
        setUploadProgress(prev => ({ ...prev, [fieldKey]: 0 }));
        
        setErrors(prev => ({
          ...prev,
          [fieldKey]: `File size limit is 10MB. ${oversizedFiles.length} file(s) exceed this limit.`
        }));
        return;
      }

      // Get current location for file uploads
      const location = await getCurrentLocation();
      console.log('Location captured for file upload:', location);

      // Process and compress images, then add overlays
      const processedFiles: File[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        let processedFile = file;
        
        // Check if it's an image and larger than 1MB
        if (file.type.startsWith('image/') && file.size > 1024 * 1024) { // 1MB
          try {
            console.log(`Compressing image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            processedFile = await compressImage(file, 1, 0.8);
            console.log(`Compressed to: ${processedFile.name} (${(processedFile.size / 1024 / 1024).toFixed(2)}MB)`);
          } catch (error) {
            console.warn('Image compression failed, using original:', error);
            processedFile = file;
          }
        }
        
        // Add overlay to images
        if (isImageFile(processedFile)) {
          try {
            console.log(`Adding overlay to image: ${processedFile.name}`);
            const fileWithOverlay = await addImageOverlay(processedFile, location, new Date());
            console.log(`Overlay added successfully: ${fileWithOverlay.name} (${(fileWithOverlay.size / 1024 / 1024).toFixed(2)}MB)`);
            processedFiles.push(fileWithOverlay);
          } catch (overlayError) {
            console.warn('Failed to add overlay, using original file:', overlayError);
            processedFiles.push(processedFile);
          }
        } else {
          processedFiles.push(processedFile);
        }
      }
      
      // Store location for this field (for backward compatibility)
      setFileLocations(prev => ({
        ...prev,
        [fieldKey]: location
      }));
      
      // Store location for each individual file
      setIndividualFileLocations(prev => {
        const fieldLocations = prev[fieldKey] || {};
        const newFieldLocations = { ...fieldLocations };
        
        processedFiles.forEach((_, index) => {
          newFieldLocations[startIndex + index] = location;
        });
        
        return {
          ...prev,
          [fieldKey]: newFieldLocations
        };
      });

      // Simulate file processing time
      await new Promise(resolve => setTimeout(resolve, 1000));

      setFormData(prev => {
        const updatedFormData = {
          ...prev,
          [fieldKey]: {
            ...prev[fieldKey],
            files: [...currentFiles, ...processedFiles]
          }
        };
        
        // Trigger immediate save after state update
        setTimeout(() => {
          saveFormData(updatedFormData);
        }, 0);
        
        return updatedFormData;
      });

      // Don't mark files as uploaded yet - let auto-save handle the upload
      // Files will be marked as uploaded after successful database save

    } catch (locationError) {
      console.warn('Could not get location for file upload:', locationError);
      
      // Still process files even if location fails
      const processedFiles: File[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        let processedFile = file;
        
        // Check if it's an image and larger than 1MB
        if (file.type.startsWith('image/') && file.size > 1024 * 1024) { // 1MB
          try {
            console.log(`Compressing image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            processedFile = await compressImage(file, 1, 0.8);
            console.log(`Compressed to: ${processedFile.name} (${(processedFile.size / 1024 / 1024).toFixed(2)}MB)`);
          } catch (error) {
            console.warn('Image compression failed, using original:', error);
            processedFile = file;
          }
        }
        
        // Add overlay to images (without location data)
        if (isImageFile(processedFile)) {
          try {
            console.log(`Adding overlay to image (no location): ${processedFile.name}`);
            const fileWithOverlay = await addImageOverlay(processedFile, undefined, new Date());
            console.log(`Overlay added successfully: ${fileWithOverlay.name} (${(fileWithOverlay.size / 1024 / 1024).toFixed(2)}MB)`);
            processedFiles.push(fileWithOverlay);
          } catch (overlayError) {
            console.warn('Failed to add overlay, using original file:', overlayError);
            processedFiles.push(processedFile);
          }
        } else {
          processedFiles.push(processedFile);
        }
      }

      setFormData(prev => {
        const updatedFormData = {
          ...prev,
          [fieldKey]: {
            ...prev[fieldKey],
            files: [...currentFiles, ...processedFiles]
          }
        };
        
        // Trigger immediate save after state update
        setTimeout(() => {
          saveFormData(updatedFormData);
        }, 0);
        
        return updatedFormData;
      });

      // Don't mark files as uploaded yet - let auto-save handle the upload
      // Files will be marked as uploaded after successful database save
    }

    // Complete upload
    clearInterval(progressInterval);
    setUploadProgress(prev => ({ ...prev, [fieldKey]: 100 }));
    
    // Clear uploading state after a short delay
    setTimeout(() => {
      setUploadingFiles(prev => ({ ...prev, [fieldKey]: false }));
      setUploadProgress(prev => ({ ...prev, [fieldKey]: 0 }));
    }, 500);

    // Clear error when files are uploaded
    if (errors[fieldKey]) {
      setErrors(prev => ({
        ...prev,
        [fieldKey]: ''
      }));
    }
  };

  const removeFile = (fieldKey: string, fileIndex: number) => {
    // Get the file being removed to update the uploaded set
    const fileToRemove = formData[fieldKey]?.files?.[fileIndex];
    
    setFormData(prev => {
      const updatedFormData = {
        ...prev,
        [fieldKey]: {
          ...prev[fieldKey],
          files: prev[fieldKey].files?.filter((_, index) => index !== fileIndex) || []
        }
      };
      
      // Trigger immediate save after state update with a small delay
      // to ensure file processing is complete
      setTimeout(() => {
        saveFormData(updatedFormData);
      }, 100);
      
      return updatedFormData;
    });
    
    // Remove file from uploaded set if it was a File object
    if (fileToRemove && fileToRemove instanceof File) {
      const fileHash = generateFileHash(fileToRemove);
      setUploadedFileHashes(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileHash);
        return newSet;
      });
    }
    
    // Remove individual file location and reindex remaining locations
    setIndividualFileLocations(prev => {
      const fieldLocations = prev[fieldKey] || {};
      const newFieldLocations = { ...fieldLocations };
      
      // Remove the location for the deleted file
      delete newFieldLocations[fileIndex];
      
      // Reindex remaining locations
      const reindexedLocations: Record<number, any> = {};
      let newIndex = 0;
      Object.keys(newFieldLocations)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(key => {
          const oldIndex = parseInt(key);
          if (oldIndex !== fileIndex) {
            reindexedLocations[newIndex] = newFieldLocations[oldIndex];
            newIndex++;
          }
        });
      
      return {
        ...prev,
        [fieldKey]: reindexedLocations
      };
    });
  };

  const handleCameraCapture = (fieldKey: string) => {
    setCameraFieldKey(fieldKey);
    setCameraOpen(true);
  };

  const handleCapturedImage = async (file: File, location?: { lat: number; lng: number; address?: string; accuracy?: number }) => {
    if (!cameraFieldKey) return;

    console.log('Camera capture received:', { file: file.name, location, cameraFieldKey });

    // Set uploading state and progress for camera capture
    setUploadingFiles(prev => ({ ...prev, [cameraFieldKey]: true }));
    setUploadProgress(prev => ({ ...prev, [cameraFieldKey]: 0 }));
    
    // Simulate upload progress for camera capture
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const currentProgress = prev[cameraFieldKey] || 0;
        if (currentProgress < 90) {
          return { ...prev, [cameraFieldKey]: currentProgress + Math.random() * 20 };
        }
        return prev;
      });
    }, 200);

    const currentFiles = formData[cameraFieldKey]?.files || [];
    const newFiles = [...currentFiles, file];
    const fileIndex = currentFiles.length; // Index of the new file

    // Store location for this field if provided
    if (location) {
      console.log('Storing location from camera:', location);
      setFileLocations(prev => {
        const newLocations = {
          ...prev,
          [cameraFieldKey]: location
        };
        console.log('Updated fileLocations state:', newLocations);
        return newLocations;
      });
      
      // Store location for this specific file
      setIndividualFileLocations(prev => {
        const fieldLocations = prev[cameraFieldKey] || {};
        const newFieldLocations = {
          ...fieldLocations,
          [fileIndex]: location
        };
        console.log('Storing individual file location:', { fieldKey: cameraFieldKey, fileIndex, location });
        console.log('Previous individualFileLocations:', prev);
        const newState = {
          ...prev,
          [cameraFieldKey]: newFieldLocations
        };
        console.log('New individualFileLocations state:', newState);
        return newState;
      });
    } else {
      // Fallback: Parse location from camera capture filename
      const locationMatch = file.name.match(/-(\d+\.\d+)-(\d+\.\d+)\./);
      if (locationMatch) {
        const lat = parseFloat(locationMatch[1]);
        const lng = parseFloat(locationMatch[2]);
        const parsedLocation = {
          lat,
          lng,
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        };
        
        console.log('Parsed location from filename:', parsedLocation);
        setFileLocations(prev => ({
          ...prev,
          [cameraFieldKey]: parsedLocation
        }));
        
        // Store parsed location for this specific file
        setIndividualFileLocations(prev => {
          const fieldLocations = prev[cameraFieldKey] || {};
          const newFieldLocations = {
            ...fieldLocations,
            [fileIndex]: parsedLocation
          };
          console.log('Storing parsed individual file location:', { fieldKey: cameraFieldKey, fileIndex, location: parsedLocation });
          console.log('Previous individualFileLocations for parsed:', prev);
          const newState = {
            ...prev,
            [cameraFieldKey]: newFieldLocations
          };
          console.log('New individualFileLocations state for parsed:', newState);
          return newState;
        });
      } else {
        console.log('No location found in filename:', file.name);
      }
    }

    // Process and compress the captured image
    let processedFile = file;
    
    // Check if it's an image and larger than 1MB
    if (file.type.startsWith('image/') && file.size > 1024 * 1024) { // 1MB
      try {
        console.log(`Compressing captured image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        processedFile = await compressImage(file, 1, 0.8);
        console.log(`Compressed to: ${processedFile.name} (${(processedFile.size / 1024 / 1024).toFixed(2)}MB)`);
      } catch (error) {
        console.warn('Image compression failed, using original:', error);
        processedFile = file;
      }
    }

    // Simulate file processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    setFormData(prev => ({
      ...prev,
      [cameraFieldKey]: {
        ...prev[cameraFieldKey],
        files: [...currentFiles, processedFile]
      }
    }));

    // Mark file as uploaded to prevent duplicates in auto-save
    markFileAsUploaded(processedFile);

    // Complete upload
    clearInterval(progressInterval);
    setUploadProgress(prev => ({ ...prev, [cameraFieldKey]: 100 }));
    
    // Clear uploading state after a short delay
    setTimeout(() => {
      setUploadingFiles(prev => ({ ...prev, [cameraFieldKey]: false }));
      setUploadProgress(prev => ({ ...prev, [cameraFieldKey]: 0 }));
    }, 500);

    // Clear error when files are uploaded
    if (errors[cameraFieldKey]) {
      setErrors(prev => ({
        ...prev,
        [cameraFieldKey]: ''
      }));
    }

    setCameraOpen(false);
    setCameraFieldKey(null);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraFieldKey(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    template?.form_fields?.forEach(field => {
      const fieldData = formData[field.field_key];
      
      if (field.validation_type === 'mandatory') {
        // For file upload fields, check if files exist
        if (field.field_type === 'file_upload') {
          console.log(`Validating file field ${field.field_key}:`, {
            fieldData,
            hasFiles: fieldData?.files,
            filesLength: fieldData?.files?.length
          });
          
          if (!fieldData?.files || fieldData.files.length === 0) {
            newErrors[field.field_key] = `${field.field_title} is required`;
          }
        } else {
          // For other field types, check the value
          if (!fieldData?.value || 
              (Array.isArray(fieldData.value) && fieldData.value.length === 0)) {
            newErrors[field.field_key] = `${field.field_title} is required`;
          }
        }
      }

      // Validate file uploads
      if (field.field_type === 'file_upload' && fieldData?.files && fieldData.files.length > 0) {
        const maxFiles = field.max_files || 1;
        if (fieldData.files.length > maxFiles) {
          newErrors[field.field_key] = `Maximum ${maxFiles} file(s) allowed`;
        }

        fieldData.files.forEach(file => {
          if (field.allowed_file_types && !field.allowed_file_types.includes(file.type)) {
            newErrors[field.field_key] = `Invalid file type. Allowed: ${field.allowed_file_types.join(', ')}`;
          }
          
          if (field.max_file_size_mb && file.size > field.max_file_size_mb * 1024 * 1024) {
            newErrors[field.field_key] = `File size must be less than ${field.max_file_size_mb}MB`;
          }
        });
      }
    });

    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormComplete = () => {
    if (!template?.form_fields) return false;
    
    return template.form_fields.every(field => {
      const fieldData = formData[field.field_key];
      
      if (field.validation_type === 'mandatory') {
        if (field.field_type === 'file_upload') {
          const files = fieldData?.files || [];
          return files.length > 0;
        } else {
          const value = fieldData?.value;
          return value && (typeof value !== 'string' || value.trim() !== '');
        }
      }
      return true;
    });
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      // Get current location for form submission
      let submissionLocation = null;
      try {
        submissionLocation = await getCurrentLocation();
        console.log('Form submission location captured:', submissionLocation);
      } catch (locationError) {
        console.warn('Could not get location for form submission:', locationError);
      }

      // Prepare form data with location information
      const formDataWithLocation = {
        ...formData,
        _metadata: {
          file_locations: fileLocations,
          individual_file_locations: individualFileLocations,
          submission_timestamp: new Date().toISOString(),
          submission_location: submissionLocation
        }
      };
      
      console.log('Submitting form with individual file locations:', individualFileLocations);
      console.log('Submitting form with submission location:', submissionLocation);
      onSubmit(formDataWithLocation);
    }
  };

  const handleSaveDraft = async () => {
    // No validation for drafts - save whatever data is available
    let submissionLocation = null;
    try {
      submissionLocation = await getCurrentLocation();
      console.log('Draft submission location captured:', submissionLocation);
    } catch (locationError) {
      console.warn('Could not get location for draft submission:', locationError);
    }

    // Prepare form data with location information
    const formDataWithLocation = {
      ...formData,
      _metadata: {
        file_locations: fileLocations,
        individual_file_locations: individualFileLocations,
        submission_timestamp: new Date().toISOString(),
        submission_location: submissionLocation
      }
    };
    
    console.log('Saving draft with data:', formDataWithLocation);
    if (onSaveDraft) {
      onSaveDraft(formDataWithLocation);
    }
  };

  const renderField = (field: FormField) => {
    try {
      // Handle both data structures: {value: "", files: []} and direct arrays
      let fieldData;
      const rawFieldData = formData[field.field_key];
      
      if (rawFieldData && typeof rawFieldData === 'object' && 'value' in rawFieldData) {
        // Standard structure: {value: "", files: []}
        fieldData = rawFieldData;
      } else if (Array.isArray(rawFieldData)) {
        // Array structure: ["Yes", "No"] - convert to standard structure
        fieldData = { value: rawFieldData, files: [] };
      } else {
        // Default structure
        fieldData = { value: '', files: [] };
      }
      
      const fieldError = errors[field.field_key];
      
      // Debug: Log field data for each field
      if (textFields.includes(field.field_key)) {
        console.log(`Rendering text field ${field.field_key} (${field.field_type}):`, {
          rawFieldData,
          fieldData,
          hasValue: !!fieldData.value,
          valueType: typeof fieldData.value,
          value: fieldData.value,
          isArray: Array.isArray(fieldData.value),
          formDataKey: formData[field.field_key]
        });
      }

      switch (field.field_type) {
        case 'short_answer':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.field_key}
                value={fieldData.value as string || ''}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                placeholder={field.field_config.placeholder}
                maxLength={field.field_config.maxLength}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'paragraph':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                id={field.field_key}
                value={fieldData.value as string || ''}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                placeholder={field.field_config.placeholder}
                maxLength={field.field_config.maxLength}
                rows={4}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'multiple_choice':
          return (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <div className="space-y-2">
                {field.field_config.options?.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.field_key}-${option}`}
                      checked={(fieldData.value as string[])?.includes(option) || false}
                      onCheckedChange={(checked) => {
                        const currentValues = (fieldData.value as string[]) || [];
                        if (checked) {
                          handleFieldChange(field.field_key, [...currentValues, option]);
                        } else {
                          handleFieldChange(field.field_key, currentValues.filter(v => v !== option));
                        }
                      }}
                    />
                    <Label htmlFor={`${field.field_key}-${option}`} className="text-sm">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'file_upload':
          const currentFileCount = fieldData.files?.length || 0;
          const canAddMoreFiles = !field.max_files || currentFileCount < field.max_files;
          const isImageField = field.allowed_file_types?.some(type => type.startsWith('image/')) || false;
          

          return (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              
              <div className="space-y-2">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    id={field.field_key}
                    multiple={field.max_files ? field.max_files > 1 : false}
                    accept={field.allowed_file_types?.join(',')}
                    onChange={(e) => handleFileUpload(field.field_key, e.target.files)}
                    className="hidden"
                    disabled={uploadingFiles[field.field_key]}
                  />
                  <label
                    htmlFor={field.field_key}
                    className={`cursor-pointer flex flex-col items-center space-y-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors ${uploadingFiles[field.field_key] ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {uploadingFiles[field.field_key] ? 'Uploading...' : 'Click to upload files'}
                      {field.max_files && ` (max ${field.max_files})`}
                    </span>
                    <span className="text-xs text-gray-500">
                      Max file size: 10MB • Images over 1MB will be compressed
                    </span>
                  </label>
                  
                  {/* Upload Progress Bar */}
                  {uploadingFiles[field.field_key] && (
                    <div className="w-full mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Processing & uploading...</span>
                        <span>{Math.round(uploadProgress[field.field_key] || 0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress[field.field_key] || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera Capture Button - Only for image fields */}
                {isImageField && canAddMoreFiles && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCameraCapture(field.field_key)}
                    className={`w-full ${isMobile ? 'h-12 text-base' : ''}`}
                    disabled={uploadingFiles[field.field_key]}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {uploadingFiles[field.field_key] ? 'Processing...' : 'Capture Photo'}
                  </Button>
                )}

                {/* File count indicator */}
                {field.max_files && (
                  <div className="text-xs text-gray-500 text-center">
                    {currentFileCount}/{field.max_files} files uploaded
                  </div>
                )}

                {/* Upload Progress for Camera Capture */}
                {uploadingFiles[field.field_key] && (
                  <div className="w-full">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Compressing & processing image...</span>
                      <span>{Math.round(uploadProgress[field.field_key] || 0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress[field.field_key] || 0}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Location indicator - show if any file has location */}
                {(fileLocations[field.field_key] || (individualFileLocations[field.field_key] && Object.keys(individualFileLocations[field.field_key]).length > 0)) && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-200">
                    📍 Location captured: {(() => {
                      // Show field-level location if available
                      if (fileLocations[field.field_key]) {
                        return fileLocations[field.field_key].address || 
                          `${fileLocations[field.field_key].lat.toFixed(4)}, ${fileLocations[field.field_key].lng.toFixed(4)}`;
                      }
                      
                      // Show individual file locations count
                      const individualLocs = individualFileLocations[field.field_key];
                      if (individualLocs && Object.keys(individualLocs).length > 0) {
                        const locCount = Object.keys(individualLocs).length;
                        return `${locCount} file${locCount > 1 ? 's' : ''} with location${locCount > 1 ? 's' : ''}`;
                      }
                      
                      return 'Location available';
                    })()}
                  </div>
                )}
                
              </div>
              
              {/* Display uploaded files */}
              {fieldData.files && fieldData.files.length > 0 && (
                <div className="space-y-2">
                  {fieldData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="text-sm">{file.name || file.file_name || 'Unknown file'}</span>
                          <span className="text-xs text-gray-500">
                            ({((file.size || file.file_size || 0) / 1024 / 1024).toFixed(2)} MB)
                          </span>
                          {(() => {
                            // First try to get location from individual file locations
                            const individualLocation = individualFileLocations[field.field_key]?.[index];
                            if (individualLocation) {
                              return (
                                <span className="text-xs text-blue-600">
                                  📍 {individualLocation.address || `${individualLocation.lat.toFixed(4)}, ${individualLocation.lng.toFixed(4)}`}
                                </span>
                              );
                            }
                            
                            // Fallback: Parse location from filename
                            const locationMatch = file.name.match(/-(\d+\.\d+)-(\d+\.\d+)\./);
                            if (locationMatch) {
                              const lat = parseFloat(locationMatch[1]);
                              const lng = parseFloat(locationMatch[2]);
                              return (
                                <span className="text-xs text-blue-600">
                                  📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(field.field_key, index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'number':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.field_key}
                type="number"
                value={fieldData.value as number}
                onChange={(e) => handleFieldChange(field.field_key, parseFloat(e.target.value) || 0)}
                min={field.field_config.min}
                max={field.field_config.max}
                step={field.field_config.step}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'date':
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.field_key}>
                {field.field_title}
                {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.field_key}
                type="date"
                value={fieldData.value as string}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                min={field.field_config.minDate}
                max={field.field_config.maxDate}
              />
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        case 'boolean':
          return (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={field.field_key}
                  checked={fieldData.value as boolean}
                  onCheckedChange={(checked) => handleFieldChange(field.field_key, checked)}
                />
                <Label htmlFor={field.field_key}>
                  {field.field_title}
                  {field.validation_type === 'mandatory' && <span className="text-red-500 ml-1">*</span>}
                </Label>
              </div>
              {field.field_config.description && (
                <p className="text-sm text-gray-600">{field.field_config.description}</p>
              )}
              {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>
          );

        default:
          console.warn('Unknown field type:', field.field_type, 'for field:', field.field_key);
          return null;
      }
    } catch (error) {
      console.error('Error rendering field:', field.field_key, error);
      return (
        <div key={field.id} className="p-4 border border-red-200 bg-red-50 rounded">
          <p className="text-red-600">Error rendering field: {field.field_title}</p>
        </div>
      );
    }
  };

  if (loadingTemplate || !draftLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading form{draftData ? ' and draft data' : ''}...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <Alert>
        <AlertDescription>
          No form template found for this contract type. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  // Debug logs removed to prevent excessive re-rendering

  return (
    <Card key={draftData ? `draft-${draftData.id}` : 'fresh'}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{template.template_name}</span>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {isAutoSaving && (
              <span className="flex items-center gap-1 text-blue-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                Auto-saving...
              </span>
            )}
            {lastAutoSaveTime && !isAutoSaving && (
              <span className="text-green-600">
                ✓ Last saved: {lastAutoSaveTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardTitle>
        <p className="text-sm text-gray-500">Fields: {template.form_fields?.length || 0}</p>
        {draftData && (
          <div className="text-sm text-blue-600">
            <p>📝 Resuming draft - Previous data loaded</p>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 flex flex-col h-[70vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {template.form_fields?.sort((a, b) => a.field_order - b.field_order).map(renderField)}
        </div>
        
        {/* Sticky Footer */}
        <div className={`flex p-6 pt-4 border-t bg-gray-50 sticky bottom-0 z-10 ${isMobile ? 'flex-col gap-3' : 'justify-end space-x-4'}`}>
          <Button variant="outline" onClick={onCancel} disabled={loading} className={isMobile ? 'w-full' : ''}>
            Cancel
          </Button>
          {onSaveDraft && (
            <Button variant="secondary" onClick={handleSaveDraft} disabled={loading} className={isMobile ? 'w-full' : ''}>
              {loading ? 'Saving...' : 'Save as Draft'}
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={loading || !isFormComplete()} className={isMobile ? 'w-full' : ''}>
            {loading ? 'Submitting...' : 'Submit Form'}
          </Button>
        </div>
      </CardContent>

      {/* Camera Capture Dialog */}
      {cameraFieldKey && (
        <CameraCapture
          isOpen={cameraOpen}
          onClose={closeCamera}
          onCapture={handleCapturedImage}
          maxFiles={template?.form_fields?.find(f => f.field_key === cameraFieldKey)?.max_files}
          currentFileCount={formData[cameraFieldKey]?.files?.length || 0}
          allowedFileTypes={template?.form_fields?.find(f => f.field_key === cameraFieldKey)?.allowed_file_types}
          maxFileSizeMB={template?.form_fields?.find(f => f.field_key === cameraFieldKey)?.max_file_size_mb}
        />
      )}
    </Card>
  );
};
