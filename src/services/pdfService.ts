import jsPDF from 'jspdf';
import type { FormSubmissionData } from './csvService';

/**
 * Case data interface for auto-filling fields in negative case PDFs
 */
export interface CaseDataForPDF {
  case_number?: string;
  client_case_id?: string;
  candidate_name?: string;
  phone_primary?: string;
  location?: {
    city?: string;
    address_line?: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  };
  contract_type?: string;
  company_name?: string;
}

export class PDFService {
  /**
   * Fetch image from URL and convert to base64 with dimensions (optimized for 1-5MB range)
   */
  private static async fetchImageAsBase64(url: string, maxWidth: number = 1200, maxHeight: number = 900, quality: number = 0.7): Promise<{ base64: string; width: number; height: number } | null> {
    try {
      // First, fetch the image
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${url}`);
        return null;
      }
      const blob = await response.blob();
      
      // Create object URL for the blob
      const objectUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          // Calculate resized dimensions to reduce file size
          let width = img.width;
          let height = img.height;
          
          // Resize if image is too large
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            if (width > height) {
              width = Math.min(width, maxWidth);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, maxHeight);
              width = height * aspectRatio;
            }
          }
          
          // Create canvas with resized dimensions
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Draw resized image
            ctx.drawImage(img, 0, 0, width, height);
            // Use JPEG compression with quality setting for smaller file size
            const base64 = canvas.toDataURL('image/jpeg', quality);
            URL.revokeObjectURL(objectUrl); // Clean up
            resolve({
              base64,
              width: width,
              height: height
            });
          } else {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        
        // Set source to load the image
        img.src = objectUrl;
      });
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  }

  /**
   * Fetch signature image and convert to base64 with white background preserved
   */
  private static async fetchSignatureImageAsBase64(url: string, maxWidth: number = 1600, maxHeight: number = 1200): Promise<{ base64: string; width: number; height: number } | null> {
    try {
      // First, fetch the image
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch signature image: ${url}`);
        return null;
      }
      const blob = await response.blob();
      
      // Create object URL for the blob
      const objectUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          // Calculate resized dimensions to reduce file size
          let width = img.width;
          let height = img.height;
          
          // Resize if image is too large
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            if (width > height) {
              width = Math.min(width, maxWidth);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, maxHeight);
              width = height * aspectRatio;
            }
          }
          
          // Create canvas with resized dimensions
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Fill with white background first (ensures no black background)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the signature image on top of white background
            ctx.drawImage(img, 0, 0, width, height);
            
            // Use PNG format to preserve white background (not JPEG)
            const base64 = canvas.toDataURL('image/png', 1.0);
            URL.revokeObjectURL(objectUrl); // Clean up
            resolve({
              base64,
              width: width,
              height: height
            });
          } else {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          }
        };
        
        img.onerror = () => {
          console.error('Failed to load signature image:', url);
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        
        // Set source to load the image
        img.src = objectUrl;
      });
    } catch (error) {
      console.error('Error fetching signature image:', error);
      return null;
    }
  }

  /**
   * Calculate dimensions while maintaining aspect ratio
   */
  private static calculateImageDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    
    let width = maxWidth;
    let height = width / aspectRatio;
    
    // If height exceeds maxHeight, constrain by height instead
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  }

  /**
   * Convert form submission data to PDF format and return as blob
   */
  static async convertFormSubmissionsToPDFBlob(
    submissions: FormSubmissionData[],
    caseNumber: string,
    contractType?: string,
    isPositive?: boolean,
    caseData?: CaseDataForPDF
  ): Promise<Blob> {
    const doc = await this.generatePDFDocument(submissions, caseNumber, contractType, isPositive, caseData);
    return doc.output('blob');
  }

  /**
   * Get report title based on contract type
   */
  private static getReportTitle(contractType?: string): string {
    if (!contractType) {
      return 'Verification Report';
    }
    
    const contractTypeLower = contractType.toLowerCase();
    if (contractTypeLower.includes('business') || contractTypeLower.includes('business_address')) {
      return 'Business Verification Report';
    } else if (contractTypeLower.includes('residence') || contractTypeLower.includes('residential') || contractTypeLower.includes('residential_address')) {
      return 'Residence Verification Report';
    } else {
      return 'Verification Report';
    }
  }

  /**
   * Get auto-fill value for a field based on case data
   * Only auto-fills specific fields: Applicant name, Company name (business only), Contact Number, City, Pincode, Latitude/Longitude, Case ID
   */
  private static getAutoFillValue(fieldKey: string, caseData?: CaseDataForPDF): string | undefined {
    if (!caseData) {
      return undefined;
    }

    // Check if it's a business contract for company name auto-fill
    const isBusinessContract = caseData.contract_type?.toLowerCase().includes('business');

    // Format latitude/longitude if available
    const getLatLng = (): string | undefined => {
      const lat = caseData.location?.lat;
      const lng = caseData.location?.lng;
      // Check for both null and undefined, and ensure they are valid numbers
      if (lat != null && lng != null && typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
      return undefined;
    };

    // Only map the specific fields requested
    const autoFillMappings: Record<string, string | undefined> = {
      // Case ID - use client_case_id if available, otherwise fallback to case_number
      'case_id': caseData.client_case_id || caseData.case_number,
      'lead_id': caseData.client_case_id || caseData.case_number,
      'applicant_id': caseData.client_case_id || caseData.case_number,
      
      // Applicant name
      'applicant_name': caseData.candidate_name,
      
      // Contact Number (various field name variations)
      'contact_number': caseData.phone_primary,
      'contact_no': caseData.phone_primary,
      'phone': caseData.phone_primary,
      'phone_number': caseData.phone_primary,
      'phone_primary': caseData.phone_primary,
      'mobile': caseData.phone_primary,
      'mobile_number': caseData.phone_primary,
      'contact_phone': caseData.phone_primary,
      
      // City
      'city': caseData.location?.city,
      
      // Pincode
      'pincode': caseData.location?.pincode,
      'pin_code': caseData.location?.pincode,
      
      // Latitude/Longitude
      'latitude_and_longitude': getLatLng(),
      'lat_lng': getLatLng(),
      'coordinates': getLatLng(),
      'location_coordinates': getLatLng(),
    };

    // Company name - only for business contracts
    if (isBusinessContract) {
      autoFillMappings['company_name'] = caseData.company_name;
      autoFillMappings['business_name'] = caseData.company_name;
      autoFillMappings['company'] = caseData.company_name;
    }

    return autoFillMappings[fieldKey];
  }

  /**
   * Generate PDF document (internal helper method)
   */
  private static async generatePDFDocument(
    submissions: FormSubmissionData[],
    caseNumber: string,
    contractType?: string,
    isPositive?: boolean,
    caseData?: CaseDataForPDF
  ): Promise<jsPDF> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18; // Balanced for readability and size
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 6; // Balanced for readability

    let yPosition = margin;

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace: number = 20) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to wrap text
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * lineHeight;
    };

    // Add logo on the right side (only first page)
    const logoHeight = await this.addLogoToPDF(doc, pageWidth - margin, margin, contentWidth, true);
    
    // Add report title centered below the logo (only first page)
    const reportTitle = this.getReportTitle(contractType);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    
    // Center the title
    const titleWidth = doc.getTextWidth(reportTitle);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(reportTitle, titleX, margin + logoHeight + 12);
    yPosition = margin + logoHeight + 22;

    if (submissions.length === 0) {
      doc.setFontSize(12);
      doc.text('No form submissions available', margin, yPosition);
      return;
    }

    // First, collect all images from all submissions to determine the very last image
    let allImagesAcrossSubmissions: Array<{ 
      file: any; 
      fieldTitle: string; 
      imageIndex: number; 
      totalImages: number; 
      submissionIndex: number; 
      fieldIndex: number;
      submission: FormSubmissionData;
    }> = [];
    
    for (let subIndex = 0; subIndex < submissions.length; subIndex++) {
      const sub = submissions[subIndex];
      if (sub.form_fields && sub.form_fields.length > 0) {
        const sortedFields = [...sub.form_fields].sort((a, b) => 
          (a.field_order || 0) - (b.field_order || 0)
        );
        const subFileUploadFields = sortedFields.filter(field => 
          field.field_type === 'file_upload'
        );
        
        for (let fieldIdx = 0; fieldIdx < subFileUploadFields.length; fieldIdx++) {
          const field = subFileUploadFields[fieldIdx];
          const fieldTitle = field.field_title || field.field_key;
          const fieldFiles = sub.form_submission_files?.filter(file => 
            file.form_field?.field_key === field.field_key
          ) || [];

          if (fieldFiles.length > 0) {
            const imagesToProcess = fieldFiles.filter(file => {
              const isImage = file.mime_type?.startsWith('image/') || 
                              file.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              return isImage && file.file_url;
            });

            for (let imageIdx = 0; imageIdx < imagesToProcess.length; imageIdx++) {
              allImagesAcrossSubmissions.push({
                file: imagesToProcess[imageIdx],
                fieldTitle,
                imageIndex: imageIdx,
                totalImages: imagesToProcess.length,
                submissionIndex: subIndex,
                fieldIndex: fieldIdx,
                submission: sub
              });
            }
          }
        }
      }
    }
    
    const totalImagesCount = allImagesAcrossSubmissions.length;
    let globalImageIndex = 0;

    // Process each submission
    for (let index = 0; index < submissions.length; index++) {
      let submission = submissions[index];
      
      // For negative cases, use original contract template fields instead of negative template fields
      if (isPositive === false && contractType && submission.form_fields) {
        const { formService } = await import('./formService');
        // Get the original contract template (positive template)
        const originalTemplateResult = await formService.getFormTemplate(contractType, false);
        
        if (originalTemplateResult.success && originalTemplateResult.template) {
          const originalFields = originalTemplateResult.template.form_fields || [];
          
          // Create submission data with original template fields
          // Use values from submission if they exist (for auto-filled fields), otherwise "Not verified"
          const originalSubmissionData: Record<string, any> = {};
          
          originalFields.forEach(field => {
            // Check if this field has a value in the negative submission
            // Map common field keys that might be in the negative submission
            const fieldKey = field.field_key;
            const valueFromSubmission = submission.submission_data[fieldKey];
            
            // Check if field is boolean/radio type
            const isBooleanField = field.field_type === 'boolean' || field.field_type === 'radio';
            
            // For boolean/radio fields in negative cases, always show "Not verified" unless explicitly set
            if (isBooleanField) {
              // Check for auto-fill value (unlikely for boolean fields, but check anyway)
              const autoFillValue = this.getAutoFillValue(fieldKey, caseData);
              if (autoFillValue) {
                originalSubmissionData[fieldKey] = autoFillValue;
              } else {
                // For negative cases, boolean/radio fields should show "Not verified"
                originalSubmissionData[fieldKey] = 'Not verified';
              }
            } else if (valueFromSubmission !== undefined && valueFromSubmission !== null && valueFromSubmission !== '') {
              // Use the value from submission (for auto-filled fields)
              originalSubmissionData[fieldKey] = valueFromSubmission;
            } else {
              // Check for auto-fill value from case data
              const autoFillValue = this.getAutoFillValue(fieldKey, caseData);
              if (autoFillValue) {
                originalSubmissionData[fieldKey] = autoFillValue;
              } else {
                // No value available - show "Not verified"
                originalSubmissionData[fieldKey] = 'Not verified';
              }
            }
          });
          
          // Replace submission with original template fields
          submission = {
            ...submission,
            form_fields: originalFields,
            submission_data: originalSubmissionData
          };
        }
      }
      
      // For subsequent submissions, just add spacing (no title/logo on new pages)
      if (index > 0) {
        yPosition += 10; // Space between submissions
        checkPageBreak(30);
      }

      // Process form fields and answers in table format
      if (submission.form_fields && submission.form_fields.length > 0) {
        // Sort fields by field_order for both positive and negative cases
        const sortedFields = [...submission.form_fields].sort((a, b) => 
          (a.field_order || 0) - (b.field_order || 0)
        );
        
        // Separate non-file-upload fields and file-upload fields
        // Include signature fields in textFields (they'll be rendered in the table)
        const textFields = sortedFields.filter(field => 
          field.field_type !== 'file_upload' || field.field_type === 'signature'
        );
        const fileUploadFields = sortedFields.filter(field => 
          field.field_type === 'file_upload'
        );

        // Create table with Question and Answer columns
        const questionColWidth = contentWidth * 0.4; // 40% for questions (increased from 35%)
        const answerColWidth = contentWidth * 0.6; // 60% for answers (reduced from 65%)
        const questionColX = margin;
        const answerColX = margin + questionColWidth; // No gap - columns are directly connected
        const rowHeight = 8; // Base row height
        const headerHeight = 10;

        // Process text fields first
        if (textFields.length > 0) {
          // Table rows for text fields (header removed)
          for (let rowIndex = 0; rowIndex < textFields.length; rowIndex++) {
            const field = textFields[rowIndex];
            const answer = submission.submission_data[field.field_key];
            
            // Check if we need a new page
            checkPageBreak(rowHeight * 2);
            
            // Row number
            const rowNumber = rowIndex + 1;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            // Calculate row height based on content
            const fieldTitle = field.field_title || field.field_key;
            
            // Handle signature fields specially - embed image in table cell
            if (field.field_type === 'signature') {
              // Get signature URL from submission_data or form_submission_files
              const signatureUrl = answer || (submission.form_submission_files?.find(file => 
                file.form_field?.field_key === field.field_key
              )?.file_url);
              
              const signatureImageHeight = 30; // Height for signature image in table
              const actualRowHeight = Math.max(signatureImageHeight + 8, 20);
              
              // Alternate row background
              if (rowIndex % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(questionColX, yPosition - 4, questionColWidth, actualRowHeight, 'F');
                doc.rect(answerColX, yPosition - 4, answerColWidth, actualRowHeight, 'F');
              }
              
              // Question text
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              const questionLines = doc.splitTextToSize(fieldTitle, questionColWidth - 10);
              doc.text(questionLines, questionColX + 3, yPosition);
              
              // Answer - embed signature image
              if (signatureUrl) {
                try {
                  const imageData = await this.fetchSignatureImageAsBase64(signatureUrl, 400, 300);
                  if (imageData) {
                    // Calculate dimensions to fit in answer cell
                    const maxImageWidth = answerColWidth - 10;
                    const maxImageHeight = signatureImageHeight;
                    const { width, height } = this.calculateImageDimensions(
                      imageData.width,
                      imageData.height,
                      maxImageWidth,
                      maxImageHeight
                    );
                    
                    // Center image in answer cell
                    const imageX = answerColX + (answerColWidth - width) / 2;
                    const imageY = yPosition - 2;
                    
                    doc.addImage(imageData.base64, 'PNG', imageX, imageY, width, height);
                  } else {
                    // Fallback to text if image can't be loaded
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Signature image unavailable', answerColX + 3, yPosition);
                  }
                } catch (error) {
                  console.error('Error embedding signature in PDF table:', error);
                  doc.setFontSize(8);
                  doc.setFont('helvetica', 'normal');
                  doc.text('Signature image unavailable', answerColX + 3, yPosition);
                }
              } else {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text('Not provided', answerColX + 3, yPosition);
              }
              
              // Row borders
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.2);
              doc.rect(questionColX, yPosition - 4, questionColWidth, actualRowHeight);
              doc.rect(answerColX, yPosition - 4, answerColWidth, actualRowHeight);
              doc.line(answerColX, yPosition - 4, answerColX, yPosition - 4 + actualRowHeight);
              
              yPosition += actualRowHeight;
            } else {
              // Regular text field handling
              const formattedAnswer = this.formatValueForPDF(answer, field.field_type, submission, field.field_key, field.field_title);
              
              // Estimate height needed for wrapped text - use narrower widths to prevent overlap
              const questionLines = doc.splitTextToSize(fieldTitle, questionColWidth - 10); // Reduced width with padding
              const answerLines = doc.splitTextToSize(formattedAnswer, answerColWidth - 10); // Reduced width with padding
              const actualRowHeight = Math.max(questionLines.length, answerLines.length) * lineHeight + 4;
              
              // Alternate row background
              if (rowIndex % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(questionColX, yPosition - 4, questionColWidth, actualRowHeight, 'F');
                doc.rect(answerColX, yPosition - 4, answerColWidth, actualRowHeight, 'F');
              }
              
              // Question text - no row number
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              doc.text(questionLines, questionColX + 3, yPosition);
              
              // Answer text - start with proper spacing from column border
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.text(answerLines, answerColX + 3, yPosition);
              
              // Row borders
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.2);
              doc.rect(questionColX, yPosition - 4, questionColWidth, actualRowHeight);
              doc.rect(answerColX, yPosition - 4, answerColWidth, actualRowHeight);
              doc.line(answerColX, yPosition - 4, answerColX, yPosition - 4 + actualRowHeight);
              
              yPosition += actualRowHeight;
            }
          }
        }

        // Process file upload fields after all text fields - one image per page
        if (fileUploadFields.length > 0) {
          for (let fieldIndex = 0; fieldIndex < fileUploadFields.length; fieldIndex++) {
            const field = fileUploadFields[fieldIndex];
            const fieldTitle = field.field_title || field.field_key;
            const fieldFiles = submission.form_submission_files?.filter(file => 
              file.form_field?.field_key === field.field_key
            ) || [];

            if (fieldFiles.length > 0) {
              // Filter only image files
              const imagesToProcess = fieldFiles.filter(file => {
                const isImage = file.mime_type?.startsWith('image/') || 
                                file.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return isImage && file.file_url;
              });

              // Process each image on a separate page
              for (let imageIndex = 0; imageIndex < imagesToProcess.length; imageIndex++) {
                const file = imagesToProcess[imageIndex];
                const imageUrl = file.file_url;
                
                // Check if this is the last image across all submissions
                const isLastImage = globalImageIndex === totalImagesCount - 1;
                    
                // Create new page for each image
                doc.addPage();
                yPosition = margin + 15; // Start a bit below top for question
                    
                // Show question title at top
                // If multiple images, add number: "Question - 1", "Question - 2", etc.
                // If single image, just show "Question"
                const questionText = imagesToProcess.length > 1 
                  ? `${fieldTitle} - ${imageIndex + 1}`
                  : fieldTitle;
                    
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                const questionWidth = doc.getTextWidth(questionText);
                const questionX = (pageWidth - questionWidth) / 2; // Center the question
                doc.text(questionText, questionX, yPosition);
                yPosition += 12;
                    
                try {
                  // Fetch image with higher quality for full-page display
                  const imageData = await this.fetchImageAsBase64(imageUrl, 1600, 1200, 0.75);
                  if (imageData) {
                    // Calculate dimensions to fit the page (with margins)
                    // Reserve space for stamp if this is the last image
                    const stampSpace = isLastImage ? 50 : 10;
                    const availableWidth = pageWidth - 2 * margin;
                    const availableHeight = pageHeight - yPosition - margin - stampSpace;
                    
                    // Calculate dimensions maintaining aspect ratio
                    const { width, height } = this.calculateImageDimensions(
                      imageData.width,
                      imageData.height,
                      availableWidth,
                      availableHeight
                    );
                    
                    // Center the image horizontally
                    const imageX = (pageWidth - width) / 2;
                    
                    // Use JPEG format (from compressed base64)
                    doc.addImage(imageData.base64, 'JPEG', imageX, yPosition, width, height);
                    
                    // Add stamp and signature to the last image
                    if (isLastImage) {
                      const imageBottom = yPosition + height;
                      await this.addStampAndSignature(doc, pageWidth, imageBottom, margin);
                    }
                  } else {
                    // Fallback to URL if image can't be loaded
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Image URL: ${imageUrl}`, margin, yPosition);
                    
                    // Still add stamp if this is the last image
                    if (isLastImage) {
                      await this.addStampAndSignature(doc, pageWidth, yPosition + 20, margin);
                    }
                  }
                } catch (error) {
                  // Fallback to URL on error
                  console.error('Error embedding image:', error);
                  doc.setFontSize(10);
                  doc.setFont('helvetica', 'normal');
                  doc.text(`Image URL: ${imageUrl}`, margin, yPosition);
                  
                  // Still add stamp if this is the last image
                  if (isLastImage) {
                    await this.addStampAndSignature(doc, pageWidth, yPosition + 20, margin);
                  }
                }
                
                globalImageIndex++;
              }
              
              // Handle non-image files (if any)
              const nonImageFiles = fieldFiles.filter(file => {
                const isImage = file.mime_type?.startsWith('image/') || 
                                file.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return !isImage && file.file_url;
              });
              
              if (nonImageFiles.length > 0) {
                doc.addPage();
                yPosition = margin + 15;
                
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(fieldTitle, margin, yPosition);
                yPosition += 10;
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                for (const file of nonImageFiles) {
                  const urlText = `File: ${file.file_name || 'unnamed'} - ${file.file_url}`;
                  const urlHeight = addWrappedText(urlText, margin, yPosition, contentWidth);
                  yPosition += urlHeight + 3;
                }
              }
            }
          }
        }
      }
    }

    // Signature fields are now included in the table, so no separate signature section needed

    return doc;
  }

  /**
   * Add stamp and signature text to PDF (helper method)
   * Positions stamp on the left side of the page below the last image
   */
  private static async addStampAndSignature(doc: jsPDF, pageWidth: number, imageBottom: number, margin: number): Promise<void> {
    try {
      // Position stamp below the image with some spacing
      const stampY = imageBottom + 10;
      
      // Try to load stamp from public folder
      const stampUrl = window.location.origin + '/stamp.png';
      const stampData = await this.fetchImageAsBase64(stampUrl, 150, 75, 0.9);
      
      if (stampData) {
        // Calculate stamp dimensions (max 25mm width, maintain aspect ratio)
        const maxStampWidth = 25;
        const maxStampHeight = 20;
        const { width, height } = this.calculateImageDimensions(
          stampData.width,
          stampData.height,
          maxStampWidth,
          maxStampHeight
        );
        
        // Position stamp on the left side of the page
        const stampX = margin;
        
        // Add stamp image
        doc.addImage(stampData.base64, 'PNG', stampX, stampY, width, height);
        
        // Add signature text below stamp, aligned to left
        const signatureText = 'Agency seal and signature';
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(signatureText, stampX, stampY + height + 8);
      } else {
        // If stamp not found, just add text on the left
        const signatureText = 'Agency seal and signature';
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(signatureText, margin, stampY);
      }
    } catch (error) {
      console.error('Error adding stamp:', error);
      // Fallback: just add text on the left
      const signatureText = 'Agency seal and signature';
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(signatureText, margin, imageBottom + 20);
    }
  }

  /**
   * Add logo to PDF (helper method)
   * @param doc - jsPDF document
   * @param x - X position (right edge if alignRight is true)
   * @param y - Y position
   * @param maxWidth - Maximum width available
   * @param alignRight - If true, x is the right edge, logo will be right-aligned
   */
  private static async addLogoToPDF(doc: jsPDF, x: number, y: number, maxWidth: number, alignRight: boolean = false): Promise<number> {
    // Try to load logo from public folder
    // Common logo paths to try
    const logoPaths = [
      '/logo.png',
      '/logo.svg',
      '/awign-logo.png',
      '/awign-logo.svg',
      '/icon-512.png' // Fallback to app icon
    ];
    
    let logoHeight = 0;
    const logoWidth = Math.min(60, maxWidth * 0.3); // Max 60mm width or 30% of content
    
    for (const logoPath of logoPaths) {
      try {
        // Try to fetch logo from public folder
        const logoUrl = window.location.origin + logoPath;
        const imageData = await this.fetchImageAsBase64(logoUrl, 300, 100, 0.9);
        
        if (imageData) {
          const { width, height } = this.calculateImageDimensions(
            imageData.width,
            imageData.height,
            logoWidth,
            25 // Max 25mm height for logo
          );
          
          // Calculate X position: if alignRight, x is right edge, so subtract width
          const logoX = alignRight ? x - width : x;
          
          doc.addImage(imageData.base64, 'PNG', logoX, y, width, height);
          logoHeight = height;
          break;
        }
      } catch (error) {
        // Try next logo path
        continue;
      }
    }
    
    // If no logo found, add text logo
    if (logoHeight === 0) {
      const textWidth = 40; // Approximate width for text logo
      const logoX = alignRight ? x - textWidth : x;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204); // Blue color for logo
      
      // Calculate text position for right alignment
      const textX = alignRight ? x - textWidth : x;
      doc.text('awign', textX, y + 8);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('A Mynavi company', textX, y + 12);
      doc.setTextColor(0, 0, 0); // Reset to black
      logoHeight = 15;
    }
    
    return logoHeight;
  }

  /**
   * Generate PDF filename based on contract type
   */
  static generatePDFFilename(caseData?: CaseDataForPDF): string {
    if (!caseData?.client_case_id) {
      // Fallback to old format if client_case_id is not available
      return `case-${caseData?.case_number || 'unknown'}-responses-${new Date().toISOString().split('T')[0]}.pdf`;
    }

    const contractType = caseData.contract_type?.toLowerCase() || '';
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9-_]/g, '_').trim();
    
    let namePart = '';
    
    if (contractType.includes('business_address_check')) {
      // Business address check: client_case_id_company_name
      namePart = caseData.company_name || 'UnknownCompany';
    } else {
      // Residential address check (default): client_case_id_Applicant Name
      namePart = caseData.candidate_name || 'UnknownApplicant';
    }
    
    const sanitizedClientCaseId = sanitize(caseData.client_case_id);
    const sanitizedNamePart = sanitize(namePart);
    
    return `${sanitizedClientCaseId}_${sanitizedNamePart}.pdf`;
  }

  /**
   * Convert form submission data to PDF format (downloads automatically)
   */
  static async convertFormSubmissionsToPDF(
    submissions: FormSubmissionData[],
    caseNumber: string,
    contractType?: string,
    isPositive?: boolean,
    caseData?: CaseDataForPDF
  ): Promise<void> {
    const doc = await this.generatePDFDocument(submissions, caseNumber, contractType, isPositive, caseData);
    // Download the PDF
    const filename = this.generatePDFFilename(caseData);
    doc.save(filename);
  }

  /**
   * Format a value for PDF output based on field type
   */
  private static formatValueForPDF(
    value: any, 
    fieldType: string, 
    submission: FormSubmissionData, 
    fieldKey?: string,
    fieldTitle?: string
  ): string {
    // Check if value is "Not verified" or "Not provided" and return as-is
    if (value === 'Not verified' || value === 'Not provided') {
      return 'Not verified';
    }
    
    if (value === null || value === undefined || value === '') {
      return 'Not verified';
    }

    switch (fieldType) {
      case 'multiple_choice': {
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'object' && item !== null && 'label' in item) {
              return item.label;
            }
            return String(item);
          }).join(', ');
        } else if (typeof value === 'object' && value !== null && 'label' in value) {
          return value.label;
        }
        return String(value);
      }

      case 'signature': {
        // Signature fields are handled specially in table rendering (images embedded)
        // This is just a fallback for text display
        const signatureUrl = value || (submission.form_submission_files?.find(file => 
          file.form_field?.field_key === fieldKey
        )?.file_url);
        
        if (!signatureUrl) {
          return 'Not provided';
        }
        
        return '[Signature Image]'; // Placeholder - actual image is embedded in table
      }

      case 'file_upload': {
        // Find files for this specific field
        const fieldFiles = submission.form_submission_files?.filter(file => 
          file.form_field?.field_key === fieldKey
        ) || [];
        
        if (fieldFiles.length === 0) {
          return 'No files uploaded';
        }
        
        return fieldFiles.map(file => file.file_url).join('\n');
      }

      case 'date': {
        // If value is "Not verified" or empty, return it as-is
        if (value === 'Not verified' || value === 'Not provided' || !value) {
          return 'Not verified';
        }
        
        try {
          // Check if this is a datetime field based on field title or key
          const fieldKeyLower = (fieldKey || '').toLowerCase();
          const fieldTitleLower = (fieldTitle || '').toLowerCase();
          
          const hasDate = fieldKeyLower.includes('date') || fieldTitleLower.includes('date');
          const hasTime = fieldKeyLower.includes('time') || fieldTitleLower.includes('time');
          const hasVisit = fieldKeyLower.includes('visit') || fieldTitleLower.includes('visit');
          
          const isDateTimeField = fieldKeyLower.includes('datetime') || 
                                 fieldKeyLower.includes('date_time') || 
                                 fieldKeyLower.includes('dateandtime') ||
                                 fieldKeyLower.includes('date_and_time') ||
                                 fieldTitleLower.includes('date and time') ||
                                 fieldTitleLower.includes('date & time') ||
                                 (hasDate && hasTime) ||
                                 (hasVisit && hasDate && hasTime);
          
          // Check if value contains time information
          const dateValue = typeof value === 'string' ? value : String(value);
          
          // Check if it's a valid date string before parsing
          if (!dateValue || dateValue.trim() === '' || dateValue === 'Invalid date') {
            return 'Not verified';
          }
          
          const hasTimeInValue = dateValue.includes('T') || /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(dateValue);
          
          if (isDateTimeField && hasTimeInValue) {
            // Parse the date value - handle both datetime-local format (YYYY-MM-DDTHH:MM) and space-separated format
            // datetime-local format doesn't include timezone, so we need to parse it as local time
            let date: Date;
            if (dateValue.includes('T')) {
              // datetime-local format: YYYY-MM-DDTHH:MM (local time, no timezone)
              // Parse manually to ensure it's treated as local time
              const match = dateValue.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
              if (match) {
                const [, year, month, day, hours, minutes] = match;
                date = new Date(
                  parseInt(year),
                  parseInt(month) - 1, // Month is 0-indexed
                  parseInt(day),
                  parseInt(hours),
                  parseInt(minutes)
                );
              } else {
                date = new Date(dateValue);
              }
            } else if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(dateValue)) {
              // Space-separated format: YYYY-MM-DD HH:MM (local time)
              const match = dateValue.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
              if (match) {
                const [, year, month, day, hours, minutes] = match;
                date = new Date(
                  parseInt(year),
                  parseInt(month) - 1, // Month is 0-indexed
                  parseInt(day),
                  parseInt(hours),
                  parseInt(minutes)
                );
              } else {
                date = new Date(dateValue.replace(' ', 'T'));
              }
            } else {
              date = new Date(dateValue);
            }
            
            // Format with date and time using local timezone
            // Check if date is valid
            if (isNaN(date.getTime())) {
              return 'Not verified';
            }
            return date.toLocaleString(); // e.g., "1/15/2024, 2:30:00 PM"
          } else {
            // Regular date field or datetime field without time - show date only
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return 'Not verified';
            }
            return date.toLocaleDateString();
          }
        } catch (e) {
          return 'Not verified';
        }
      }

      case 'boolean':
      case 'radio':
        // For negative cases, if value is empty/null/undefined or "Not verified", return "Not verified"
        if (value === null || value === undefined || value === '' || value === 'Not verified' || value === 'Not provided') {
          return 'Not verified';
        }
        // If value is explicitly false or "no", return "No"
        if (value === false || value === 'no' || value === 'No' || value === 'false') {
          return 'No';
        }
        // For radio fields, check if it's an object with label/value
        if (typeof value === 'object' && value !== null) {
          if ('label' in value) {
            return value.label;
          }
          if ('value' in value) {
            const val = value.value;
            if (val === false || val === 'no' || val === 'No' || val === 'false') {
              return 'No';
            }
            if (val === true || val === 'yes' || val === 'Yes' || val === 'true') {
              return 'Yes';
            }
            return String(val);
          }
        }
        // Otherwise return "Yes" only if value is explicitly true/yes
        return (value === true || value === 'yes' || value === 'Yes' || value === 'true') ? 'Yes' : 'Not verified';

      case 'number':
        return String(value);

      default: {
        if (typeof value === 'object' && value !== null) {
          if ('label' in value) {
            return value.label;
          }
          if ('value' in value) {
            return value.value;
          }
          try {
            return JSON.stringify(value);
          } catch (e) {
            return '[Object]';
          }
        }
        return String(value);
      }
    }
  }

  /**
   * Download PDF content as a file
   */
  static downloadPDF(doc: jsPDF, filename: string): void {
    doc.save(filename);
  }
}



