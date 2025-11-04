import jsPDF from 'jspdf';
import type { FormSubmissionData } from './csvService';

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
    caseNumber: string
  ): Promise<Blob> {
    const doc = await this.generatePDFDocument(submissions, caseNumber);
    return doc.output('blob');
  }

  /**
   * Generate PDF document (internal helper method)
   */
  private static async generatePDFDocument(
    submissions: FormSubmissionData[],
    caseNumber: string
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

    // Add header
    doc.setFontSize(18); // Increased for better readability
    doc.setFont('helvetica', 'bold');
    doc.text('Case Form Submissions', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11); // Increased for better readability
    doc.setFont('helvetica', 'normal');
    doc.text(`Case Number: ${caseNumber}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 9;

    // Add a line
    doc.setLineWidth(0.4);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    if (submissions.length === 0) {
      doc.setFontSize(12);
      doc.text('No form submissions available', margin, yPosition);
      return;
    }

    // Process each submission
    for (let index = 0; index < submissions.length; index++) {
      const submission = submissions[index];
      checkPageBreak(20); // Reduced from 30

      // Submission header
      doc.setFontSize(14); // Increased for better readability
      doc.setFont('helvetica', 'bold');
      const title = `Submission ${index + 1}`;
      doc.text(title, margin, yPosition);
      yPosition += 8;

      doc.setFontSize(11); // Increased for better readability
      doc.setFont('helvetica', 'normal');
      
      // Submitted date
      if (submission.submitted_at) {
        doc.setFont('helvetica', 'bold');
        doc.text('Submitted:', margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date(submission.submitted_at).toLocaleString(), margin + 25, yPosition);
        yPosition += 7;
      }

      yPosition += 2;

      // Draw a divider line
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // Process form fields and answers
      if (submission.form_fields && submission.form_fields.length > 0) {
        // Sort fields by order
        const sortedFields = [...submission.form_fields].sort((a, b) => 
          (a.field_order || 0) - (b.field_order || 0)
        );

        for (const field of sortedFields) {
          checkPageBreak(20); // Reduced from 25

          const answer = submission.submission_data[field.field_key];
          
          // Question (field title)
          doc.setFontSize(11); // Increased for better readability
          doc.setFont('helvetica', 'bold');
          const fieldTitle = field.field_title || field.field_key;
          doc.text(fieldTitle, margin, yPosition);
          yPosition += 6;

          // Handle file upload fields specially - try to embed images
          if (field.field_type === 'file_upload') {
            const fieldFiles = submission.form_submission_files?.filter(file => 
              file.form_field?.field_key === field.field_key
            ) || [];

            if (fieldFiles.length > 0) {
              doc.setFontSize(9); // Increased for better readability
              doc.setFont('helvetica', 'normal');
              doc.text(`(${fieldFiles.length} file(s))`, margin, yPosition);
              yPosition += 5;

              // Limit images per field to 5 to balance file size (target 1-5MB)
              const maxImagesPerField = 5;
              const imagesToProcess = fieldFiles.filter(file => {
                const isImage = file.mime_type?.startsWith('image/') || 
                                file.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return isImage;
              });

              // Try to embed each image (limit to maxImagesPerField)
              let imagesProcessed = 0;
              for (const file of fieldFiles) {
                const imageUrl = file.file_url;
                if (!imageUrl) continue;
                
                // Check if it's an image
                const isImage = file.mime_type?.startsWith('image/') || 
                                imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

                if (isImage) {
                  // Skip if we've already processed max images
                  if (imagesProcessed >= maxImagesPerField) {
                    continue;
                  }
                  
                  checkPageBreak(70); // Increased for larger images
                  
                  // Set max dimensions (balanced for 1-5MB: 75% of content width, max 60mm height)
                  const maxImageWidth = Math.min(contentWidth * 0.75, 140); // Increased for better readability
                  const maxImageHeight = 60; // Increased for better readability
                  
                  try {
                    // Fetch with balanced compression (1200x900px max, 70% quality for 1-5MB target)
                    const imageData = await this.fetchImageAsBase64(imageUrl, 1200, 900, 0.7);
                    if (imageData) {
                      // Calculate dimensions maintaining aspect ratio
                      const { width, height } = this.calculateImageDimensions(
                        imageData.width,
                        imageData.height,
                        maxImageWidth,
                        maxImageHeight
                      );
                      
                      // Use JPEG format (from compressed base64) instead of PNG
                      doc.addImage(imageData.base64, 'JPEG', margin + 4, yPosition, width, height);
                      imagesProcessed++;
                      yPosition += height + 5; // Increased spacing
                      
                      // Add file name
                      doc.setFontSize(8); // Increased for better readability
                      doc.setFont('helvetica', 'italic');
                      doc.text(file.file_name || 'unnamed', margin + 4, yPosition);
                      yPosition += 4;
                      
                      // If we've hit the limit, show a message
                      if (imagesProcessed >= maxImagesPerField && imagesToProcess.length > maxImagesPerField) {
                        const remainingCount = imagesToProcess.length - maxImagesPerField;
                        if (remainingCount > 0) {
                          doc.setFontSize(8);
                          doc.setFont('helvetica', 'italic');
                          doc.text(`... and ${remainingCount} more image(s) (omitted to keep file size < 5MB)`, margin + 4, yPosition);
                          yPosition += 3;
                          break; // Stop processing more images
                        }
                      }
                    } else {
                      // Fallback to URL if image can't be loaded
                      doc.setFontSize(9); // Increased for better readability
                      doc.setFont('helvetica', 'normal');
                      doc.text(`Image URL: ${imageUrl}`, margin + 4, yPosition);
                      yPosition += 5;
                    }
                  } catch (error) {
                    // Fallback to URL on error
                    console.error('Error embedding image:', error);
                    doc.setFontSize(9); // Increased for better readability
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Image URL: ${imageUrl}`, margin + 4, yPosition);
                    yPosition += 5;
                  }
                } else {
                  // Not an image, just show URL
                  doc.setFontSize(9); // Increased for better readability
                  doc.setFont('helvetica', 'normal');
                  const urlText = `File: ${file.file_name || 'unnamed'} - ${imageUrl}`;
                  const urlHeight = addWrappedText(urlText, margin + 4, yPosition, contentWidth - 8);
                  yPosition += urlHeight + 4;
                }
              }
            } else {
              // No files
              doc.setFontSize(10); // Increased for better readability
              doc.setFont('helvetica', 'normal');
              doc.text('No files uploaded', margin + 4, yPosition);
              yPosition += 6;
            }
          } else {
            // Regular fields
            doc.setFontSize(10); // Increased for better readability
            doc.setFont('helvetica', 'normal');
            
            const formattedAnswer = this.formatValueForPDF(answer, field.field_type, submission, field.field_key);
            
            // Add answer with text wrapping
            const answerHeight = addWrappedText(formattedAnswer, margin + 4, yPosition, contentWidth - 8);
            yPosition += answerHeight + 4;
          }
        }
      }

      // Add spacing between submissions
      yPosition += 4;
    }

    return doc;
  }

  /**
   * Convert form submission data to PDF format (downloads automatically)
   */
  static async convertFormSubmissionsToPDF(
    submissions: FormSubmissionData[],
    caseNumber: string
  ): Promise<void> {
    const doc = await this.generatePDFDocument(submissions, caseNumber);
    // Download the PDF
    const filename = `case-${caseNumber}-responses-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  /**
   * Format a value for PDF output based on field type
   */
  private static formatValueForPDF(
    value: any, 
    fieldType: string, 
    submission: FormSubmissionData, 
    fieldKey?: string
  ): string {
    if (value === null || value === undefined || value === '') {
      return 'Not provided';
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
        try {
          return new Date(value).toLocaleDateString();
        } catch (e) {
          return 'Invalid date';
        }
      }

      case 'boolean':
        return value ? 'Yes' : 'No';

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

