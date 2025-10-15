import { supabase } from '@/integrations/supabase/client';
import { FormTemplate, FormField, FormSubmission, FormData, FormBuilderTemplate } from '@/types/form';

export class FormService {
  /**
   * Get form template for a contract type
   */
  async getFormTemplate(contractTypeKey: string): Promise<{ success: boolean; template?: FormTemplate; error?: string }> {
    try {
      // First, get the contract type ID from contract_type_config
      const { data: contractType, error: contractTypeError } = await supabase
        .from('contract_type_config')
        .select('id')
        .eq('type_key', contractTypeKey)
        .single();

      if (contractTypeError) throw contractTypeError;

      // Then get the form template using the contract type ID
      const { data: template, error } = await supabase
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
        .order('template_version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      console.log('Template query result:', template);
      console.log('Template fields:', template?.form_fields);
      
      // If no template found, return a helpful error
      if (!template) {
        return {
          success: false,
          error: `No form template found for contract type: ${contractTypeKey}`
        };
      }

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
      Object.entries(formData).forEach(([fieldKey, fieldValue]) => {
        if (fieldKey === '_metadata') {
          // Store metadata separately
          submissionData[fieldKey] = fieldValue;
        } else if (fieldValue.files && fieldValue.files.length > 0) {
          // Handle file uploads separately - don't store files in submission_data
          filesToUpload.push({
            fieldId: fieldKey,
            files: fieldValue.files
          });
          // Store only the field value, not the files
          submissionData[fieldKey] = fieldValue.value;
        } else {
          // Store regular field values
          submissionData[fieldKey] = fieldValue.value;
        }
      });

      // Check if submission already exists
      const { data: existingSubmission } = await supabase
        .from('form_submissions')
        .select('id, status')
        .eq('case_id', caseId)
        .maybeSingle();

      let submission;
      if (existingSubmission) {
        // Update existing submission
        const { data: updatedSubmission, error: updateError } = await supabase
          .from('form_submissions')
          .update({
            template_id: templateId,
            gig_partner_id: gigWorkerId,
            submission_data: submissionData,
            status: isDraft ? 'draft' : 'final',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (updateError) throw updateError;
        submission = updatedSubmission;
      } else {
        // Create new submission
        const { data: newSubmission, error: submissionError } = await supabase
          .from('form_submissions')
          .insert({
            case_id: caseId,
            template_id: templateId,
            gig_partner_id: gigWorkerId,
            submission_data: submissionData,
            status: isDraft ? 'draft' : 'final'
          })
          .select()
          .single();

        if (submissionError) throw submissionError;
        submission = newSubmission;
      }

            // Upload files if any
            if (filesToUpload.length > 0) {
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
                  await this.uploadFormFiles(submission.id, filesToUpload, templateData.form_fields || []);
                }
              } catch (error) {
                console.warn('File upload failed, but form submission will continue:', error);
                // Continue with form submission even if file upload fails
              }
            }

      // If saving as draft, update case status to in_progress
      if (isDraft) {
        const { error: caseUpdateError } = await supabase
          .from('cases')
          .update({
            status: 'in_progress',
            status_updated_at: new Date().toISOString()
          })
          .eq('id', caseId);

        if (caseUpdateError) {
          console.warn('Failed to update case status to in_progress:', caseUpdateError);
        }
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
      const { data: draft, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('case_id', caseId)
        .eq('status', 'draft')
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
   * Upload form files
   */
  private async uploadFormFiles(
    submissionId: string, 
    filesToUpload: Array<{ fieldId: string; files: File[] }>,
    formFields: FormField[]
  ): Promise<void> {
    try {
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
          const { error: insertError } = await supabase
            .from('form_submission_files')
            .insert({
              submission_id: submissionId,
              field_id: field.id, // Use the actual field UUID
              file_url: urlData.publicUrl,
              file_name: file.name, // This will now include timestamp in filename
              file_size: file.size,
              mime_type: file.type
            });

          if (insertError) {
            console.warn(`Failed to save file record for ${file.name}:`, insertError);
          } else {
            console.log(`Successfully saved file record for ${file.name}`);
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
          files (
            id,
            field_id,
            file_url,
            file_name,
            file_size,
            mime_type,
            uploaded_at
          )
        `)
        .eq('case_id', caseId)
        .single();

      if (error) throw error;

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
      // Create template in draft mode (no contract_type_id yet)
      const { data: template, error: templateError } = await supabase
        .from('form_templates')
        .insert({
          contract_type_id: null, // Will be set when published
          template_name: templateData.template_name,
          is_active: false, // Start as draft
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create fields
      const fieldsToInsert = templateData.fields.map((field, index) => ({
        template_id: template.id,
        field_key: field.field_key,
        field_title: field.field_title,
        field_type: field.field_type,
        validation_type: field.validation_type,
        field_order: field.field_order || index,
        field_config: field.field_config,
        depends_on_field_id: field.depends_on_field_id,
        depends_on_value: field.depends_on_value,
        max_files: field.field_type === 'file_upload' ? field.field_config.maxFiles : undefined,
        allowed_file_types: field.field_type === 'file_upload' ? field.field_config.allowedTypes : undefined,
        max_file_size_mb: field.field_type === 'file_upload' ? field.field_config.maxSizeMB : undefined
      }));

      const { error: fieldsError } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert);

      if (fieldsError) throw fieldsError;

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

      // First, unpublish any existing form for this contract type
      const { error: unpublishError } = await supabase
        .from('form_templates')
        .update({ is_active: false })
        .eq('contract_type_id', contractType.id)
        .eq('is_active', true);

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
   * Unpublish a form template (make it draft again)
   */
  async unpublishFormTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('form_templates')
        .update({ 
          contract_type_id: null,
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

}

// Export singleton instance
export const formService = new FormService();
