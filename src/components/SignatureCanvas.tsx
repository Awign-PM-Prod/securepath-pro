import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SignatureCanvasProps {
  onSignatureChange: (signatureData: File | null) => void;
  onSignatureUploaded?: (signatureUrl: string) => void; // Callback when signature is uploaded
  initialSignature?: string; // URL of existing signature
  disabled?: boolean;
  caseId?: string; // For auto-save path
  templateId?: string; // For auto-save
  submissionId?: string; // For replacing existing signature
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSignatureChange,
  onSignatureUploaded,
  initialSignature,
  disabled = false,
  caseId,
  templateId,
  submissionId
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentSignatureUrl, setCurrentSignatureUrl] = useState<string | null>(initialSignature || null);
  const [existingSignaturePath, setExistingSignaturePath] = useState<string | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200; // Fixed height for signature

    // Fill canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set drawing style
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load initial signature if provided
    if (initialSignature) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Clear and fill with white background first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Then draw the signature image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
        setCurrentSignatureUrl(initialSignature);
        
        // Extract file path from URL for future deletion
        try {
          const urlObj = new URL(initialSignature);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === 'form_submissions');
          if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            setExistingSignaturePath(filePath);
          }
        } catch (error) {
          console.warn('Failed to extract file path from signature URL:', error);
        }
      };
      img.onerror = () => {
        console.error('Failed to load initial signature');
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  // Convert canvas to File with white background
  const canvasToFile = useCallback((): Promise<File | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve(null);

    return new Promise<File | null>((resolve) => {
      // Create a temporary canvas with white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        resolve(null);
        return;
      }
      
      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the original canvas content on top
      tempCtx.drawImage(canvas, 0, 0);
      
      // Convert to blob
      tempCanvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const file = new File([blob], 'signature.png', { type: 'image/png' });
        resolve(file);
      }, 'image/png', 1.0);
    });
  }, []);

  // Upload signature to Supabase storage
  const uploadSignatureToStorage = useCallback(async (file: File): Promise<string | null> => {
    if (!caseId) {
      console.warn('Cannot auto-save signature: caseId not provided');
      return null;
    }

    try {
      setIsUploading(true);
      
      // Generate file path
      const uploadTime = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = submissionId 
        ? `${submissionId}/signature_of_person_met/signature-${uploadTime}.png`
        : `${caseId}/signature_of_person_met/signature-${uploadTime}.png`;

      // Delete old signature if exists
      if (existingSignaturePath) {
        try {
          await supabase.storage
            .from('form_submissions')
            .remove([existingSignaturePath]);
          console.log('Deleted old signature:', existingSignaturePath);
        } catch (deleteError) {
          console.warn('Failed to delete old signature:', deleteError);
          // Continue even if delete fails
        }
      }

      // Upload new signature
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('form_submissions')
        .upload(filePath, file, {
          upsert: true, // Replace if exists
          contentType: 'image/png'
        });

      if (uploadError) {
        console.error('Failed to upload signature:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('form_submissions')
        .getPublicUrl(filePath);

      console.log('Signature uploaded successfully:', urlData.publicUrl);
      
      // Update state
      setExistingSignaturePath(filePath);
      setCurrentSignatureUrl(urlData.publicUrl);
      
      // Notify parent component
      if (onSignatureUploaded) {
        onSignatureUploaded(urlData.publicUrl);
      }

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading signature:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [caseId, submissionId, existingSignaturePath, onSignatureUploaded]);

  // Handle signature change and auto-save
  const handleSignatureChange = useCallback(async () => {
    const file = await canvasToFile();
    if (file) {
      onSignatureChange(file);
      setHasSignature(true);
      
      // Auto-save to Supabase if caseId is provided
      if (caseId) {
        const uploadedUrl = await uploadSignatureToStorage(file);
        if (uploadedUrl) {
          console.log('Signature auto-saved:', uploadedUrl);
        }
      }
    } else {
      onSignatureChange(null);
      setHasSignature(false);
      setCurrentSignatureUrl(null);
    }
  }, [canvasToFile, onSignatureChange, caseId, uploadSignatureToStorage]);

  // Get coordinates from event (mouse or touch)
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  // Start drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  // Draw
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  // Stop drawing
  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      handleSignatureChange();
    }
  };

  // Clear signature
  const clearSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and fill with white background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setCurrentSignatureUrl(null);
    onSignatureChange(null);
    
    // Delete signature from storage if exists
    if (existingSignaturePath) {
      try {
        await supabase.storage
          .from('form_submissions')
          .remove([existingSignaturePath]);
        setExistingSignaturePath(null);
        console.log('Signature deleted from storage');
      } catch (error) {
        console.error('Failed to delete signature from storage:', error);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="signature-canvas" className="text-sm font-medium">
        Signature of the Person Met <span className="text-red-500">*</span>
      </Label>
      <div className="relative border-2 border-gray-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          id="signature-canvas"
          className="w-full cursor-crosshair touch-none"
          style={{ height: '200px' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Please sign here</p>
          </div>
        )}
        {isUploading && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            Saving...
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
};

