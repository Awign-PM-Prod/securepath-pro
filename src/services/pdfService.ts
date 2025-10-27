import jsPDF from 'jspdf';
import type { FormSubmissionData } from './csvService';

export class PDFService {
  /**
   * Fetch image from URL and convert to base64 with dimensions
   */
  private static async fetchImageAsBase64(url: string): Promise<{ base64: string; width: number; height: number } | null> {
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
          // Create canvas to convert to base64
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const base64 = canvas.toDataURL('image/png');
            URL.revokeObjectURL(objectUrl); // Clean up
            resolve({
              base64,
              width: img.width,
              height: img.height
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
   * Convert form submission data to PDF format
   */
  static async convertFormSubmissionsToPDF(
    submissions: FormSubmissionData[],
    caseNumber: string
  ): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 7;

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
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Case Form Submissions', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Case Number: ${caseNumber}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 10;

    // Add a line
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    if (submissions.length === 0) {
      doc.setFontSize(12);
      doc.text('No form submissions available', margin, yPosition);
      return;
    }

    // Process each submission
    for (let index = 0; index < submissions.length; index++) {
      const submission = submissions[index];
      checkPageBreak(30);

      // Submission header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const title = `Submission ${index + 1}`;
      doc.text(title, margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Submitted date
      if (submission.submitted_at) {
        doc.setFont('helvetica', 'bold');
        doc.text('Submitted:', margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date(submission.submitted_at).toLocaleString(), margin + 25, yPosition);
        yPosition += 6;
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
          checkPageBreak(25);

          const answer = submission.submission_data[field.field_key];
          
          // Question (field title)
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          const fieldTitle = field.field_title || field.field_key;
          doc.text(fieldTitle, margin, yPosition);
          yPosition += 5;

          // Handle file upload fields specially - try to embed images
          if (field.field_type === 'file_upload') {
            const fieldFiles = submission.form_submission_files?.filter(file => 
              file.form_field?.field_key === field.field_key
            ) || [];

            if (fieldFiles.length > 0) {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.text(`(${fieldFiles.length} file(s))`, margin, yPosition);
              yPosition += 4;

              // Try to embed each image
              for (const file of fieldFiles) {
                const imageUrl = file.file_url;
                if (imageUrl) {
                  // Check if it's an image
                  const isImage = file.mime_type?.startsWith('image/') || 
                                  imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

                  if (isImage) {
                    checkPageBreak(80); // Reserve space for image
                    
                    // Set max dimensions (80% of content width, max 70mm height)
                    const maxImageWidth = Math.min(contentWidth * 0.8, 150);
                    const maxImageHeight = 70;
                    
                    try {
                      const imageData = await this.fetchImageAsBase64(imageUrl);
                      if (imageData) {
                        // Calculate dimensions maintaining aspect ratio
                        const { width, height } = this.calculateImageDimensions(
                          imageData.width,
                          imageData.height,
                          maxImageWidth,
                          maxImageHeight
                        );
                        
                        doc.addImage(imageData.base64, 'PNG', margin + 5, yPosition, width, height);
                        yPosition += height + 5;
                        
                        // Add file name
                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'italic');
                        doc.text(file.file_name || 'unnamed', margin + 5, yPosition);
                        yPosition += 3;
                      } else {
                        // Fallback to URL if image can't be loaded
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Image URL: ${imageUrl}`, margin + 5, yPosition);
                        yPosition += 4;
                      }
                    } catch (error) {
                      // Fallback to URL on error
                      console.error('Error embedding image:', error);
                      doc.setFontSize(8);
                      doc.setFont('helvetica', 'normal');
                      doc.text(`Image URL: ${imageUrl}`, margin + 5, yPosition);
                      yPosition += 4;
                    }
                  } else {
                    // Not an image, just show URL
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    const urlText = `File: ${file.file_name || 'unnamed'} - ${imageUrl}`;
                    const urlHeight = addWrappedText(urlText, margin + 5, yPosition, contentWidth - 10);
                    yPosition += urlHeight + 3;
                  }
                }
              }
            } else {
              // No files
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.text('No files uploaded', margin + 5, yPosition);
              yPosition += 5;
            }
          } else {
            // Regular fields
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            const formattedAnswer = this.formatValueForPDF(answer, field.field_type, submission, field.field_key);
            
            // Add answer with text wrapping
            const answerHeight = addWrappedText(formattedAnswer, margin + 5, yPosition, contentWidth - 10);
            yPosition += answerHeight + 3;
          }
        }
      }

      // Add spacing between submissions
      yPosition += 5;
    }

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

