import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addImageOverlay, isImageFile } from '@/utils/imageOverlayUtils';

/**
 * Demo component to test image overlay functionality
 * This component allows users to upload an image and see the overlay effect
 */
export const ImageOverlayDemo: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      setError('Please select an image file');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // Show original image
      const originalUrl = URL.createObjectURL(file);
      setOriginalImage(originalUrl);

      // Mock location data for demo
      const mockLocation = {
        lat: 12.9716,
        lng: 77.5946,
        address: 'Bangalore, Karnataka, India',
        accuracy: 10
      };

      // Add overlay
      const fileWithOverlay = await addImageOverlay(file, mockLocation, new Date());
      
      // Show overlay image
      const overlayUrl = URL.createObjectURL(fileWithOverlay);
      setOverlayImage(overlayUrl);

      console.log('Overlay demo completed:', {
        originalSize: file.size,
        overlaySize: fileWithOverlay.size,
        originalName: file.name,
        overlayName: fileWithOverlay.name
      });
    } catch (err) {
      console.error('Overlay demo error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add overlay');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDemo = () => {
    setOriginalImage(null);
    setOverlayImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Image Overlay Demo</CardTitle>
          <p className="text-sm text-gray-600">
            Upload an image to see the location and timestamp overlay effect
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Select Image'}
            </Button>
            <Button
              variant="outline"
              onClick={resetDemo}
              disabled={isProcessing}
            >
              Reset
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {originalImage && (
              <div className="space-y-2">
                <h3 className="font-medium">Original Image</h3>
                <img
                  src={originalImage}
                  alt="Original"
                  className="w-full h-64 object-cover rounded border"
                />
              </div>
            )}

            {overlayImage && (
              <div className="space-y-2">
                <h3 className="font-medium">With Overlay</h3>
                <img
                  src={overlayImage}
                  alt="With Overlay"
                  className="w-full h-64 object-cover rounded border"
                />
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Adding overlay...</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Overlay Specifications:</h4>
            <div className="text-sm text-gray-700 space-y-2">
              <p><strong>Font Size:</strong> 16-24px (responsive based on image width)</p>
              <p><strong>Padding:</strong> 16px (increased from 10px)</p>
              <p><strong>Line Height:</strong> 28px (increased from 20px)</p>
              <p><strong>Background:</strong> Semi-transparent black (80% opacity)</p>
              <p><strong>Border:</strong> White border with 2px width</p>
              <p><strong>Position:</strong> Bottom-right corner</p>
              <p><strong>Content:</strong> Timestamp and location information</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
