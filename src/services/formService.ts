import { supabase } from '@/integrations/supabase/client';
import { FormTemplate, FormField, FormSubmission, FormData, FormBuilderTemplate } from '@/types/form';
import type { FormSubmissionData } from './csvService';

export class FormService {
  /**
   * Get form template for a contract type
   * @param contractTypeKey - The contract type key (e.g., 'business_address_check')
   * @param isNegative - Whether to fetch negative case template (default: false for positive)
   *                     When true, fetches the template named "Negative-Case-Template" regardless of contract type
   */
  async getFormTemplate(contractTypeKey: string, isNegative: boolean = false): Promise<{ success: boolean; template?: FormTemplate; error?: string }> {
    try {
      let template;

      if (isNegative) {
        // For negative cases, find the negative template for the specific contract type
        // Get the contract type ID from the contract type key
        const { data: contractType, error: contractTypeError } = await supabase
          .from('contract_type_config')
          .select('id')
          .eq('type_key', contractTypeKey)
          .single();

        if (contractTypeError) throw contractTypeError;

        // Get the negative form template for this contract type
        const { data: negativeTemplate, error: negativeTemplateError } = await supabase
          .from('form_templates')
          .select(`
            *,
            form_fields (
              id,
              field_key,
              field_title,
              field_type,
              validation_type,
              field_order,
              field_config,
              depends_on_field_id,
              depends_on_value,
              max_files,
              allowed_file_types,
              max_file_size_mb
            )
          `)
          .eq('contract_type_id', contractType.id)
          .eq('is_active', true)
          .eq('is_negative', true)
          .order('template_version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (negativeTemplateError) throw negativeTemplateError;

        if (!negativeTemplate) {
          return {
            success: false,
            error: `No negative form template found for contract type: ${contractTypeKey}. Please ensure you have a negative template published for this contract type.`
          };
        }

        template = negativeTemplate;
      } else {
        // For positive cases, use the actual contract type
        const { data: contractType, error: contractTypeError } = await supabase
          .from('contract_type_config')
          .select('id')
          .eq('type_key', contractTypeKey)
          .single();

        if (contractTypeError) throw contractTypeError;

        // Get the form template
        const { data: positiveTemplate, error: templateError } = await supabase
          .from('form_templates')
          .select(`
            *,
            form_fields (
              id,
              field_key,
              field_title,
              field_type,
              validation_type,
              field_order,
              field_config,
              depends_on_field_id,
              depends_on_value,
              max_files,
              allowed_file_types,
              max_file_size_mb
            )
          `)
          .eq('contract_type_id', contractType.id)
          .eq('is_active', true)
          .eq('is_negative', false)
          .order('template_version', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (templateError) throw templateError;

        if (!positiveTemplate) {
          return {
            success: false,
            error: `No form template found for contract type: ${contractTypeKey}`
          };
        }

        template = positiveTemplate;
      }
      
      console.log('Template query result:', template);
      console.log('Template fields:', template?.form_fields);
      console.log('Is negative template:', isNegative);
      
      return { success: true, template };
    } catch (error) {
      console.error('Error getting form template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all form templates
   */
  async getAllFormTemplates(): Promise<{ success: boolean; templates?: FormTemplate[]; error?: string }> {
    try {
      const { data: templates, error } = await supabase
        .from('form_templates')
        .select(`
          *,
          contract_type_config (type_key, display_name),
          form_fields (
            id,
            field_key,
            field_title,
            field_type,
            validation_type,
            field_order,
            field_config,
            depends_on_field_id,
            depends_on_value,
            max_files,
            allowed_file_types,
            max_file_size_mb
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, templates };
    } catch (error) {
      console.error('Error getting all form templates:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get form template by ID
   */
  async getFormTemplateById(templateId: string): Promise<{ success: boolean; template?: FormTemplate; error?: string }> {
    try {
      const { data: template, error } = await supabase
        .from('form_templates')
        .select(`
          *,
          contract_type_config (type_key, display_name),
          form_fields (
            id,
            field_key,
            field_title,
            field_type,
            validation_type,
            field_order,
            field_config,
            depends_on_field_id,
            depends_on_value,
            max_files,
            allowed_file_types,
            max_file_size_mb
          )
        `)
        .eq('id', templateId)
        .single();

      if (error) throw error;

      return { success: true, template };
    } catch (error) {
      console.error('Error getting form template by ID:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Submit form data
   */
  async submitForm(
    caseId: string, 
    templateId: string, 
    gigWorkerId: string, 
    formData: FormData,
    isDraft: boolean = false
  ): Promise<{ success: boolean; submissionId?: string; error?: string }> {
    try {
      // Prepare submission data
      const submissionData: Record<string, any> = {};
      const filesToUpload: Array<{ fieldId: string; files: File[] }> = [];

      // Process form data
      console.log('Processing form data for submission:', { 
        caseId, 
        templateId, 
        isDraft, 
        formDataKeys: Object.keys(formData),
        hasMetadata: !!formData._metadata,
        isAutoSave: formData._metadata?.auto_save === true
      });
      
      Object.entries(formData).forEach(([fieldKey, fieldValue]) => {
        if (fieldKey === '_metadata') {
          // Store metadata separately
          submissionData[fieldKey] = fieldValue;
        } else if (fieldValue.files && fieldValue.files.length > 0) {
          // Check if this is an auto-save operation
          const isAutoSave = formData._metadata?.auto_save === true;
          
          console.log(`Field ${fieldKey}:`, {
            hasFiles: !!fieldValue.files,
            fileCount: fieldValue.files?.length || 0,
            isAutoSave,
            files: fieldValue.files?.map(f => ({ 
              name: f.name, 
              size: f.size, 
              type: f.type,
              hasUrl: !!f.url,
              isFileObject: f instanceof File
            }))
          });
          
          // Filter out files that already have URLs (already uploaded)
          const newFiles = fieldValue.files.filter((file: any) => {
            if (file instanceof File) {
              console.log(`File ${file.name} is a new File object, will upload`);
              return true;
            } else if (file.url) {
              console.log(`File ${file.name} already has URL, skipping upload`);
              return false;
            } else {
              console.log(`File ${file.name} is not a File object and has no URL, skipping`);
              return false;
            }
          });
          
          console.log(`Field ${fieldKey}: ${newFiles.length} new files to upload out of ${fieldValue.files.length} total`);
          
          if (newFiles.length > 0) {
            if (isAutoSave) {
              // For auto-save, upload only new files
              console.log(`Auto-save: Processing ${newFiles.length} new files for field ${fieldKey}`);
              filesToUpload.push({
                fieldId: fieldKey,
                files: newFiles
              });
              submissionData[fieldKey] = fieldValue.value;
              console.log(`Auto-save: Added new files to upload queue for field ${fieldKey}`);
            } else {
              // For regular submission, upload files and store only the field value
              filesToUpload.push({
                fieldId: fieldKey,
                files: newFiles
              });
              submissionData[fieldKey] = fieldValue.value;
            }
          } else {
            // No new files to upload, just store the field value
            submissionData[fieldKey] = fieldValue.value;
            console.log(`Field ${fieldKey}: No new files to upload, storing field value only`);
          }
        } else {
          // Store regular field values
          submissionData[fieldKey] = fieldValue.value;
        }
      });
      
      console.log('Files to upload summary:', {
        totalFieldGroups: filesToUpload.length,
        fields: filesToUpload.map(f => ({ fieldId: f.fieldId, fileCount: f.files.length }))
      });

      // Check if submission already exists
      const { data: existingSubmission } = await supabase
        .from('form_submissions')
        .select('id, status, submitted_at')
        .eq('case_id', caseId)
        .maybeSingle();

      let submission;
      const currentTime = new Date().toISOString();
      
      // Update case status first - trigger will sync form_submissions.status
      // Get current case status
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('status')
        .eq('id', caseId)
        .single();

      if (caseError) throw caseError;

      // Update case status based on draft/final
      // Only update if not already submitted (once submitted, don't go back)
      if (caseData.status !== 'submitted') {
        let newCaseStatus: string;
        if (isDraft) {
          // If saving draft, set case status to 'in_progress' (trigger will set form_submissions.status to 'draft')
          newCaseStatus = 'in_progress';
        } else {
          // If submitting final, set case status to 'submitted' (trigger will set form_submissions.status to 'final')
          newCaseStatus = 'submitted';
        }

        const updateData: any = {
          status: newCaseStatus,
          status_updated_at: currentTime
        };
        
        // Set submitted_at when status becomes 'submitted'
        if (newCaseStatus === 'submitted') {
          updateData.submitted_at = currentTime;
        }
        
        const { error: caseUpdateError } = await supabase
          .from('cases')
          .update(updateData)
          .eq('id', caseId);

        if (caseUpdateError) throw caseUpdateError;
      }

      if (existingSubmission) {
        // Update existing submission - status will be set by trigger based on case status
        const updateData: any = {
          template_id: templateId,
          gig_partner_id: gigWorkerId,
          submission_data: submissionData,
          updated_at: currentTime
        };
        
        // If submitting (not draft), update submitted_at to current time
        // Only update if it wasn't already set
        if (!isDraft && !existingSubmission.submitted_at) {
          updateData.submitted_at = currentTime;
        }
        
        const { data: updatedSubmission, error: updateError } = await supabase
          .from('form_submissions')
          .update(updateData)
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (updateError) throw updateError;
        submission = updatedSubmission;
      } else {
        // Create new submission - status will be set by trigger based on case status
        const insertData: any = {
          case_id: caseId,
          template_id: templateId,
          gig_partner_id: gigWorkerId,
          submission_data: submissionData
        };
        
        // Only set submitted_at if it's a final submission (not a draft)
        if (!isDraft) {
          insertData.submitted_at = currentTime;
        }
        
        const { data: newSubmission, error: submissionError } = await supabase
          .from('form_submissions')
          .insert(insertData)
          .select()
          .single();

        if (submissionError) throw submissionError;
        submission = newSubmission;
      }

      // Upload signature file if present
      const signatureData = formData['signature_of_person_met'];
      if (signatureData?.files && signatureData.files.length > 0) {
        const signatureFile = signatureData.files.find((f: any) => f instanceof File);
        if (signatureFile) {
          console.log('Uploading signature file...');
          try {
            await this.uploadSignatureFile(submission.id, signatureFile, templateId);
            // Get signature URL and update submission_data
            const signatureFieldId = await this.getOrCreateSignatureField(templateId);
            const { data: signatureFileRecord } = await supabase
              .from('form_submission_files')
              .select('file_url')
              .eq('submission_id', submission.id)
              .eq('field_id', signatureFieldId)
              .single();
            
            if (signatureFileRecord) {
              submissionData['signature_of_person_met'] = signatureFileRecord.file_url;
              // Update submission with signature URL in submission_data
              await supabase
                .from('form_submissions')
                .update({ submission_data: submissionData })
                .eq('id', submission.id);
            }
          } catch (signatureError) {
            console.error('Error uploading signature:', signatureError);
            // Continue with other file uploads even if signature fails
          }
        }
      }

      // Upload files if any
      if (filesToUpload.length > 0) {
              console.log(`Auto-save: Starting file upload process for ${filesToUpload.length} field groups`);
              console.log('Files to upload details:', filesToUpload.map(f => ({
                fieldId: f.fieldId,
                fileCount: f.files.length,
                files: f.files.map(file => ({ name: file.name, size: file.size, type: file.type }))
              })));
              try {
                // Fetch template data to get form fields
                const { data: templateData, error: templateError } = await supabase
                  .from('form_templates')
                  .select(`
                    *,
                    form_fields (
                      id, field_key, field_title, field_type, validation_type, field_order, field_config,
                      depends_on_field_id, depends_on_value, max_files, allowed_file_types, max_file_size_mb
                    )
                  `)
                  .eq('id', templateId)
                  .single();

                if (templateError) {
                  console.warn('Failed to fetch template data for file upload:', templateError);
                } else {
                  console.log('Auto-save: Template data fetched, uploading files...');
                  await this.uploadFormFiles(
                    submission.id, 
                    filesToUpload, 
                    templateData.form_fields || [],
                    (file) => {
                      // Mark file as uploaded after successful database save
                      console.log(`File ${file.name} successfully uploaded and saved to database`);
                    }
                  );
                  console.log('Auto-save: File upload process completed');
                }
              } catch (error) {
                console.warn('File upload failed, but form submission will continue:', error);
                // Continue with form submission even if file upload fails
              }
            } else {
              console.log('Auto-save: No files to upload');
            }

      return { success: true, submissionId: submission.id };
    } catch (error) {
      console.error('Error submitting form:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get draft submission for a case
   */
  async getDraftSubmission(caseId: string): Promise<{ success: boolean; draft?: any; error?: string }> {
    try {
      // Get draft submission - status can be NULL (before in_progress) or 'draft' (when in_progress)
      // Don't get 'final' submissions
      const { data: draft, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates(
            id,
            template_name,
            is_negative
          ),
          form_submission_files(
            id,
            field_id,
            file_url,
            file_name,
            file_size,
            mime_type,
            uploaded_at,
            form_field:form_fields(field_key, field_title, field_type)
          )
        `)
        .eq('case_id', caseId)
        .or('status.is.null,status.eq.draft')
        .maybeSingle();

      if (error) throw error;

      return { success: true, draft };
    } catch (error) {
      console.error('Error getting draft submission:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Delete draft submission
   */
  async deleteDraftSubmission(caseId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .eq('case_id', caseId)
        .eq('status', 'draft');

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting draft submission:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get or create signature field for a template
   */
  private async getOrCreateSignatureField(templateId: string): Promise<string> {
    try {
      // Try to find existing signature field
      const { data: existingField, error: findError } = await supabase
        .from('form_fields')
        .select('id')
        .eq('template_id', templateId)
        .eq('field_key', 'signature_of_person_met')
        .maybeSingle();

      if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error finding signature field:', findError);
        throw findError;
      }

      if (existingField) {
        return existingField.id;
      }

      // Create signature field if it doesn't exist
      const { data: newField, error: createError } = await supabase
        .from('form_fields')
        .insert({
          template_id: templateId,
          field_key: 'signature_of_person_met',
          field_title: 'Signature of the Person Met',
          field_type: 'file_upload',
          validation_type: 'mandatory',
          field_order: 9999, // High order to ensure it's last
          max_files: 1,
          allowed_file_types: ['image/png'],
          max_file_size_mb: 2
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating signature field:', createError);
        throw createError;
      }

      return newField.id;
    } catch (error) {
      console.error('Error in getOrCreateSignatureField:', error);
      throw error;
    }
  }

  /**
   * Upload signature file
   */
  private async uploadSignatureFile(
    submissionId: string,
    signatureFile: File,
    templateId: string
  ): Promise<void> {
    try {
      // Get or create signature field
      const signatureFieldId = await this.getOrCreateSignatureField(templateId);

      // Generate filename
      const uploadTime = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${submissionId}/signature_of_person_met/signature-${uploadTime}.png`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('form_submissions')
        .upload(fileName, signatureFile);

      if (uploadError) {
        console.error('Failed to upload signature:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('form_submissions')
        .getPublicUrl(fileName);

      // Save file record
      const { error: insertError } = await supabase
        .from('form_submission_files')
        .insert({
          submission_id: submissionId,
          field_id: signatureFieldId,
          file_url: urlData.publicUrl,
          file_name: 'signature.png',
          file_size: signatureFile.size,
          mime_type: 'image/png',
          uploaded_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to save signature file record:', insertError);
        throw insertError;
      }

      console.log('Signature uploaded successfully');
    } catch (error) {
      console.error('Error uploading signature:', error);
      throw error;
    }
  }

  /**
   * Upload form files
   */
  private async uploadFormFiles(
    submissionId: string, 
    filesToUpload: Array<{ fieldId: string; files: File[] }>,
    formFields: FormField[],
    onFileUploaded?: (file: File) => void
  ): Promise<void> {
    try {
      console.log('uploadFormFiles called with:', {
        submissionId,
        filesToUploadCount: filesToUpload.length,
        formFieldsCount: formFields.length
      });
      
      // Check if storage bucket exists
      console.log('Checking storage buckets...');
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.error('Error listing storage buckets:', bucketError);
        throw bucketError;
      }
      
      console.log('Available storage buckets:', buckets?.map(b => ({ id: b.id, name: b.name, public: b.public })));
      
      const bucketExists = buckets?.some(bucket => bucket.id === 'form_submissions');
      if (!bucketExists) {
        console.warn('Storage bucket "form_submissions" does not exist. Available buckets:', buckets?.map(b => b.id));
        console.warn('Skipping file uploads. Please run the storage bucket setup script.');
        return;
      }

      console.log('Storage bucket "form_submissions" found. Proceeding with file uploads...');

      for (const { fieldId, files } of filesToUpload) {
        // Find the actual field UUID from formFields
        const field = formFields.find(f => f.field_key === fieldId);
        if (!field) {
          console.warn(`Field not found for key: ${fieldId}`);
          continue;
        }

        for (const file of files) {
          // Skip if a file record with same submission, field and original name already exists
          try {
            const { data: existing, error: existingErr } = await supabase
              .from('form_submission_files')
              .select('id')
              .eq('submission_id', submissionId)
              .eq('field_id', field.id)
              .eq('file_name', file.name)
              .maybeSingle();
            if (!existingErr && existing) {
              console.log(`Skipping duplicate file record for ${file.name} (already exists for this field/submission)`);
              continue;
            }
          } catch (checkErr) {
            console.warn('Error checking for existing file record (will proceed to upload):', checkErr);
          }

          // Generate filename with timestamp
          const fileExt = file.name.split('.').pop();
          const uploadTime = new Date().toISOString().replace(/[:.]/g, '-');
          const isCameraCapture = file.name.includes('camera-capture');
          
          // Use original filename with timestamp for regular uploads, or keep camera capture name
          const baseFileName = isCameraCapture 
            ? file.name.replace('.jpg', '') 
            : file.name.replace(/\.[^/.]+$/, ''); // Remove extension
          
          const fileName = `${submissionId}/${fieldId}/${baseFileName}-${uploadTime}.${fileExt}`;
          
          console.log(`Uploading file: ${file.name} to path: ${fileName}`, {
            uploadType: isCameraCapture ? 'camera' : 'file_upload',
            originalName: file.name,
            newName: fileName
          });
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('form_submissions')
            .upload(fileName, file);

          if (uploadError) {
            console.error(`Failed to upload file ${file.name}:`, uploadError);
            console.error('Upload error details:', {
              message: uploadError.message,
              statusCode: uploadError.statusCode,
              error: uploadError.error
            });
            continue; // Skip this file but continue with others
          }

          console.log(`Successfully uploaded file: ${file.name}`);

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('form_submissions')
            .getPublicUrl(fileName);

          // Save file record using the actual field UUID
          const fileRecord = {
            submission_id: submissionId,
            field_id: field.id, // Use the actual field UUID
            file_url: urlData.publicUrl,
            file_name: file.name, // This will now include timestamp in filename
            file_size: file.size,
            mime_type: file.type,
            uploaded_at: new Date().toISOString()
          };
          
          console.log('Inserting file record:', fileRecord);
          
          const { data: insertData, error: insertError } = await supabase
            .from('form_submission_files')
            .insert(fileRecord)
            .select();

          if (insertError) {
            console.error(`Failed to save file record for ${file.name}:`, insertError);
            console.error('Insert error details:', {
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              code: insertError.code
            });
          } else {
            console.log(`Successfully saved file record for ${file.name}:`, insertData);
            // Call the callback to mark file as uploaded
            if (onFileUploaded) {
              onFileUploaded(file);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error uploading form files:', error);
      // Don't throw error, just log it and continue
      console.warn('File upload failed, but form submission will continue');
    }
  }

  /**
   * Get form submission for a case
   */
  async getFormSubmission(caseId: string): Promise<{ success: boolean; submission?: FormSubmission; error?: string }> {
    try {
      const { data: submission, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_submission_files (
            id,
            field_id,
            file_url,
            file_name,
            file_size,
            mime_type,
            uploaded_at,
            form_field:form_fields (
              field_key,
              field_title,
              field_type
            )
          )
        `)
        .eq('case_id', caseId)
        .single();

      if (error) {
        console.log('FormService: Error fetching form submission for case', caseId, ':', error);
        throw error;
      }

      console.log('FormService: Found form submission for case', caseId, ':', submission);
      console.log('FormService: Submission data structure:', {
        hasSubmissionData: !!submission?.submission_data,
        submissionDataType: typeof submission?.submission_data,
        submissionDataKeys: Object.keys(submission?.submission_data || {}),
        hasFiles: !!submission?.form_submission_files,
        filesLength: submission?.form_submission_files?.length || 0
      });

      return { success: true, submission };
    } catch (error) {
      console.error('Error getting form submission:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create form template (for ops team)
   */
  async createFormTemplate(templateData: FormBuilderTemplate): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      // Validate required fields
      if (!templateData.contract_type_id || templateData.contract_type_id.trim() === '') {
        throw new Error('Contract type ID is required');
      }
      
      if (!templateData.template_name || templateData.template_name.trim() === '') {
        throw new Error('Template name is required');
      }

      console.log('Creating form template with data:', {
        contract_type_id: templateData.contract_type_id,
        template_name: templateData.template_name,
        fields_count: templateData.fields?.length || 0
      });

      // Get is_negative value (default to false for positive cases)
      const isNegative = templateData.is_negative ?? false;

      // Check ALL templates (active and inactive) for this contract type and case type (positive/negative)
      // This prevents unique constraint violations when creating a new template
      // The unique constraint is on (contract_type_id, template_version, is_negative)
      const { data: existingTemplates, error: checkError } = await supabase
        .from('form_templates')
        .select('template_version')
        .eq('contract_type_id', templateData.contract_type_id)
        .eq('is_negative', isNegative)
        .order('template_version', { ascending: false })
        .limit(1);

      if (checkError) throw checkError;

      // Determine the next version number
      // Check ALL templates (not just active) to avoid unique constraint violations
      // If there's any template of the same type (positive/negative), increment its version
      // If no template exists, start from V1
      const nextVersion = existingTemplates && existingTemplates.length > 0 
        ? existingTemplates[0].template_version + 1 
        : 1;

      // Get current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Create template with the provided contract_type_id, version, and is_negative flag
      const templateInsertData = {
        contract_type_id: templateData.contract_type_id,
        template_name: templateData.template_name,
        template_version: nextVersion,
        is_active: false, // Start as draft
        is_negative: isNegative,
        created_by: user.id
      };

      console.log('Creating template with data:', templateInsertData);

      // Validate fields before creating template
      if (!templateData.fields || templateData.fields.length === 0) {
        throw new Error('Template must have at least one field');
      }

      // Validate field keys: check for duplicates and empty values
      const fieldKeys = templateData.fields.map(f => f.field_key?.trim()).filter(Boolean);
      const duplicateKeys = fieldKeys.filter((key, index) => fieldKeys.indexOf(key) !== index);
      if (duplicateKeys.length > 0) {
        throw new Error(`Duplicate field keys found: ${duplicateKeys.join(', ')}. Each field must have a unique key.`);
      }

      // Check for empty field keys
      const emptyFieldKeys = templateData.fields.filter(f => !f.field_key || f.field_key.trim() === '');
      if (emptyFieldKeys.length > 0) {
        throw new Error('All fields must have a field key. Please fill in the field key for all fields.');
      }

      const { data: template, error: templateError } = await supabase
        .from('form_templates')
        .insert(templateInsertData)
        .select()
        .single();

      if (templateError) {
        console.error('Template creation error:', templateError);
        throw templateError;
      }

      // Create fields in two passes:
      // 1. First insert all fields without dependencies (depends_on_field_id = null)
      // 2. Then update fields with dependencies using actual field IDs
      
      // Step 1: Insert fields without dependencies
      const fieldsToInsert = templateData.fields.map((field, index) => {
        const processedField: any = {
          template_id: template.id,
          field_key: field.field_key.trim(),
          field_title: field.field_title,
          field_type: field.field_type,
          validation_type: field.validation_type,
          field_order: field.field_order || index,
          field_config: field.field_config,
          // Don't set depends_on_field_id yet - we'll update it after all fields are created
          depends_on_field_id: null,
          depends_on_value: field.depends_on_value && field.depends_on_value.trim() !== '' ? field.depends_on_value : null,
          max_files: field.field_type === 'file_upload' ? field.field_config.maxFiles : undefined,
          allowed_file_types: field.field_type === 'file_upload' ? field.field_config.allowedTypes : undefined,
          max_file_size_mb: field.field_type === 'file_upload' ? field.field_config.maxSizeMB : undefined
        };
        
        return processedField;
      });

      // Debug: Log the complete data being inserted
      console.log('Fields to insert (without dependencies):', JSON.stringify(fieldsToInsert, null, 2));
      
      const { data: insertedFields, error: fieldsError } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert)
        .select('id, field_key');

      if (fieldsError) {
        console.error('Fields insertion error:', fieldsError);
        // Rollback: Delete the template if field insertion fails
        try {
          await supabase
            .from('form_templates')
            .delete()
            .eq('id', template.id);
          console.log('Template rolled back due to field insertion failure');
        } catch (rollbackError) {
          console.error('Error rolling back template:', rollbackError);
        }
        throw fieldsError;
      }

      // Step 2: Create a map of field_key to field_id for dependency resolution
      const fieldKeyToIdMap = new Map<string, string>();
      insertedFields?.forEach(field => {
        fieldKeyToIdMap.set(field.field_key, field.id);
      });

      // Step 3: Update fields with dependencies
      // Process fields that have depends_on_field_id set
      const fieldsToUpdate = templateData.fields
        .map((field, index) => {
          // Check if this field has a dependency
          if (!field.depends_on_field_id || field.depends_on_field_id.trim() === '') {
            return null; // No dependency, skip
          }

          // Try to resolve depends_on_field_id - it could be:
          // 1. A field_key (string) - need to convert to field_id
          // 2. A field_id (UUID) - use directly
          // 3. Invalid - set to null
          let dependsOnFieldId: string | null = null;
          
          // Check if it's a UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(field.depends_on_field_id.trim())) {
            // It's a UUID - check if it exists in our inserted fields
            const foundField = insertedFields?.find(f => f.id === field.depends_on_field_id.trim());
            if (foundField) {
              dependsOnFieldId = foundField.id;
            } else {
              console.warn(`Field ${field.field_key}: depends_on_field_id is a UUID but not found in inserted fields`);
            }
          } else {
            // It's likely a field_key - convert to field_id
            const fieldId = fieldKeyToIdMap.get(field.depends_on_field_id.trim());
            if (fieldId) {
              dependsOnFieldId = fieldId;
            } else {
              console.warn(`Field ${field.field_key}: depends_on_field_id "${field.depends_on_field_id}" (field_key) not found in template fields`);
            }
          }

          if (!dependsOnFieldId) {
            console.warn(`Field ${field.field_key}: Could not resolve depends_on_field_id, setting to null`);
            return null;
          }

          const insertedField = insertedFields?.[index];
          if (!insertedField) {
            return null;
          }

          return {
            fieldId: insertedField.id,
            depends_on_field_id: dependsOnFieldId
          };
        })
        .filter((update): update is { fieldId: string; depends_on_field_id: string } => update !== null);

      // Update fields with their dependencies
      if (fieldsToUpdate.length > 0) {
        console.log('Updating fields with dependencies:', fieldsToUpdate);
        for (const update of fieldsToUpdate) {
          const { error: updateError } = await supabase
            .from('form_fields')
            .update({ depends_on_field_id: update.depends_on_field_id })
            .eq('id', update.fieldId);

          if (updateError) {
            console.error(`Error updating field ${update.fieldId} with dependency:`, updateError);
            // Don't throw here - the field was created, just without the dependency
            // This is a non-critical error
          }
        }
      }

      return { success: true, templateId: template.id };
    } catch (error) {
      console.error('Error creating form template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Publish a form template (assign to contract type)
   * Only unpublishes templates with the same is_negative value, allowing one positive and one negative template per contract type
   */
  async publishFormTemplate(templateId: string, contractTypeKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the contract type UUID
      const { data: contractType, error: contractTypeError } = await supabase
        .from('contract_type_config')
        .select('id')
        .eq('type_key', contractTypeKey)
        .single();

      if (contractTypeError) throw contractTypeError;

      // Get the template's is_negative value to determine which templates to unpublish
      const { data: template, error: templateFetchError } = await supabase
        .from('form_templates')
        .select('is_negative')
        .eq('id', templateId)
        .single();

      if (templateFetchError) throw templateFetchError;

      const isNegative = template.is_negative ?? false;

      // First, unpublish any existing active template for this contract type with the same is_negative value
      // This allows one positive and one negative template to be active simultaneously
      const { error: unpublishError } = await supabase
        .from('form_templates')
        .update({ is_active: false })
        .eq('contract_type_id', contractType.id)
        .eq('is_active', true)
        .eq('is_negative', isNegative);

      if (unpublishError) throw unpublishError;

      // Now publish the new form
      const { error: publishError } = await supabase
        .from('form_templates')
        .update({ 
          contract_type_id: contractType.id,
          is_active: true 
        })
        .eq('id', templateId);

      if (publishError) throw publishError;

      return { success: true };
    } catch (error) {
      console.error('Error publishing form template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update an existing draft form template (does not create a new version)
   * This is used for editing draft templates
   */
  async updateFormTemplate(templateId: string, templateData: FormBuilderTemplate): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate required fields
      if (!templateData.contract_type_id || templateData.contract_type_id.trim() === '') {
        throw new Error('Contract type ID is required');
      }
      
      if (!templateData.template_name || templateData.template_name.trim() === '') {
        throw new Error('Template name is required');
      }

      // Check for duplicate field_keys in the input data and validate field_keys
      const fieldKeys = templateData.fields
        .map(f => f.field_key?.trim())
        .filter(key => key && key.length > 0); // Filter out empty keys
      
      if (fieldKeys.length !== templateData.fields.length) {
        throw new Error('All fields must have a non-empty field_key.');
      }
      
      const uniqueFieldKeys = new Set(fieldKeys);
      if (fieldKeys.length !== uniqueFieldKeys.size) {
        throw new Error('Duplicate field keys found. Each field must have a unique field_key.');
      }

      // Check if template exists and is a draft
      const { data: existingTemplate, error: templateCheckError } = await supabase
        .from('form_templates')
        .select('id, is_active, template_version')
        .eq('id', templateId)
        .single();

      if (templateCheckError) throw templateCheckError;

      if (existingTemplate.is_active) {
        throw new Error('Cannot update published templates. Editing a published template creates a new version.');
      }

      // Get is_negative value
      const isNegative = templateData.is_negative ?? false;

      // Get current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Update template metadata (keep same version)
      const { error: templateUpdateError } = await supabase
        .from('form_templates')
        .update({
          template_name: templateData.template_name,
          contract_type_id: templateData.contract_type_id,
          is_negative: isNegative,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (templateUpdateError) throw templateUpdateError;

      // Delete existing fields first and wait for completion
      const { error: deleteFieldsError } = await supabase
        .from('form_fields')
        .delete()
        .eq('template_id', templateId);

      if (deleteFieldsError) {
        console.error('Error deleting existing fields:', deleteFieldsError);
        throw deleteFieldsError;
      }

      // Verify deletion completed by checking if any fields remain
      const { data: remainingFields, error: checkError } = await supabase
        .from('form_fields')
        .select('id')
        .eq('template_id', templateId)
        .limit(1);

      if (checkError) {
        console.error('Error checking remaining fields:', checkError);
        throw checkError;
      }

      // If there are still fields remaining, wait a bit and try again
      if (remainingFields && remainingFields.length > 0) {
        console.warn('Some fields still exist after deletion, waiting and retrying...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { error: retryDeleteError } = await supabase
          .from('form_fields')
          .delete()
          .eq('template_id', templateId);

        if (retryDeleteError) throw retryDeleteError;
      }

      // Only insert fields if there are any
      if (templateData.fields && templateData.fields.length > 0) {
        // Prepare fields to insert
        const fieldsToInsert = templateData.fields.map((field, index) => {
          const processedField = {
            template_id: templateId,
            field_key: field.field_key.trim(), // Ensure no leading/trailing spaces
            field_title: field.field_title,
            field_type: field.field_type,
            validation_type: field.validation_type,
            field_order: field.field_order || index,
            field_config: field.field_config,
            depends_on_field_id: field.depends_on_field_id && field.depends_on_field_id.trim() !== '' ? field.depends_on_field_id : null,
            depends_on_value: field.depends_on_value && field.depends_on_value.trim() !== '' ? field.depends_on_value : null,
            max_files: field.field_type === 'file_upload' ? field.field_config.maxFiles : undefined,
            allowed_file_types: field.field_type === 'file_upload' ? field.field_config.allowedTypes : undefined,
            max_file_size_mb: field.field_type === 'file_upload' ? field.field_config.maxSizeMB : undefined
          };
          
          return processedField;
        });

        // Insert new fields
        const { error: fieldsError } = await supabase
          .from('form_fields')
          .insert(fieldsToInsert);

        if (fieldsError) {
          console.error('Error inserting fields:', fieldsError);
          throw fieldsError;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating form template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Unpublish a form template (make it draft again)
   */
  async unpublishFormTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('form_templates')
        .update({ 
          is_active: false 
        })
        .eq('id', templateId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error unpublishing form template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Delete a form template (only if it's a draft and has no submissions)
   */
  async deleteFormTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Attempting to delete template with ID:', templateId);
      
      // First check if the template exists and is a draft
      const { data: template, error: templateError } = await supabase
        .from('form_templates')
        .select('id, is_active, template_name')
        .eq('id', templateId)
        .single();

      if (templateError) {
        console.error('Error fetching template:', templateError);
        throw templateError;
      }

      console.log('Found template:', template);

      // Only allow deletion of draft templates
      if (template.is_active) {
        throw new Error('Cannot delete published templates. Please unpublish first.');
      }

      // Check if there are any form submissions using this template
      const { data: submissions, error: submissionsError } = await supabase
        .from('form_submissions')
        .select('id')
        .eq('template_id', templateId)
        .limit(1);

      if (submissionsError) {
        console.error('Error checking form submissions:', submissionsError);
        throw submissionsError;
      }

      if (submissions && submissions.length > 0) {
        throw new Error('Cannot delete template because it has existing form submissions. Templates with submissions cannot be deleted to preserve data integrity.');
      }

      console.log('Template is draft with no submissions, proceeding with deletion...');

      // Delete the template (this will cascade delete the fields due to foreign key constraint)
      const { error: deleteError, count } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', templateId);

      if (deleteError) {
        console.error('Error deleting template:', deleteError);
        throw deleteError;
      }

      console.log('Delete operation completed. Rows affected:', count);
      
      // If no rows were affected, it means the delete was blocked by RLS
      if (count === 0) {
        throw new Error('Delete operation blocked - no rows affected. This might be due to RLS policies or insufficient permissions.');
      }

      // Verify deletion by trying to fetch the template again
      const { data: verifyTemplate, error: verifyError } = await supabase
        .from('form_templates')
        .select('id')
        .eq('id', templateId)
        .single();

      if (verifyError && verifyError.code === 'PGRST116') {
        console.log('Template successfully deleted (not found in verification)');
        return { success: true };
      } else if (verifyTemplate) {
        console.error('Template still exists after deletion attempt');
        throw new Error('Template deletion failed - template still exists');
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting form template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Merge original contract template fields with negative template fields for PDF/CSV export
   * For negative cases, shows original contract fields with "Not provided" and negative fields with actual responses
   */
  async mergeTemplatesForNegativeCase(
    contractTypeKey: string,
    negativeSubmission: FormSubmissionData
  ): Promise<{ success: boolean; mergedFields?: any[]; error?: string }> {
    try {
      // Get the original contract type template (positive template)
      const originalTemplateResult = await this.getFormTemplate(contractTypeKey, false);
      
      if (!originalTemplateResult.success || !originalTemplateResult.template) {
        return {
          success: false,
          error: `Could not find original template for contract type: ${contractTypeKey}`
        };
      }

      const originalFields = originalTemplateResult.template.form_fields || [];
      const negativeFields = negativeSubmission.form_fields || [];

      // Simple merge: All original fields first, then all negative fields
      const mergedFields: any[] = [];
      
      // 1. Add ALL original contract fields first (with "Not provided")
      originalFields.forEach((field, index) => {
        mergedFields.push({
          ...field,
          _originalFieldKey: field.field_key,
          _uniqueKey: `original_${field.field_key}_${index}`, // Use unique key to prevent conflicts
          _isOriginalField: true
        });
      });
      
      // 2. Add ALL negative template fields after (with actual responses)
      negativeFields.forEach((field, index) => {
        mergedFields.push({
          ...field,
          _negativeFieldKey: field.field_key,
          _uniqueKey: `negative_${field.field_key}_${index}`, // Use unique key to prevent conflicts
          _isNegativeField: true,
          _isNegativeOnly: true
        });
      });

      return { success: true, mergedFields };
    } catch (error) {
      console.error('Error merging templates for negative case:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

}

// Export singleton instance
export const formService = new FormService();
