import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, X, RotateCcw, Check } from 'lucide-react';
import { addImageOverlay } from '@/utils/imageOverlayUtils';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, location?: { lat: number; lng: number; address?: string; accuracy?: number }) => void;
  maxFiles?: number;
  currentFileCount?: number;
  allowedFileTypes?: string[];
  maxFileSizeMB?: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
  maxFiles = 1,
  currentFileCount = 0,
  allowedFileTypes = ['image/jpeg', 'image/png'],
  maxFileSizeMB = 10
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
    pincode: string;
    accuracy?: number;
  } | null>(null);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    console.log('getCurrentLocation called');
    return new Promise<{lat: number; lng: number; address?: string; pincode: string; accuracy?: number}>((resolve, reject) => {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported');
        reject(new Error('Geolocation is not supported'));
        return;
      }

      console.log('Calling navigator.geolocation.getCurrentPosition...');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('Geolocation success:', position);
          const { latitude, longitude, accuracy } = position.coords;
          console.log('Coordinates:', { latitude, longitude, accuracy });
          
          // Try to get address and pincode from coordinates
          let address = '';
          let pincode = '';
          try {
            console.log('Fetching address and pincode from coordinates...');
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            console.log('Address response:', data);
            address = `${data.locality || ''} ${data.city || ''} ${data.principalSubdivision || ''}`.trim();
            pincode = data.postcode || '';
            console.log('Pincode found:', pincode);
          } catch (e) {
            console.warn('Could not get address and pincode from coordinates:', e);
          }

          const locationData = {
            lat: latitude,
            lng: longitude,
            address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            pincode: pincode || '',
            accuracy: accuracy
          };
          console.log('Resolving with location data:', locationData);
          resolve(locationData);
        },
        (error) => {
          console.error('Geolocation error:', error);
          console.error('Error details:', {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT
          });
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

  // Debug: Monitor currentLocation state changes
  useEffect(() => {
    console.log('currentLocation state changed:', currentLocation);
  }, [currentLocation]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Normalize max files; if null/invalid, don't block camera start
      const effectiveMaxFiles = typeof maxFiles === 'number' && isFinite(maxFiles) && maxFiles > 0 ? maxFiles : Number.POSITIVE_INFINITY;
      if (currentFileCount >= effectiveMaxFiles) {
        setError(`Maximum ${Number.isFinite(effectiveMaxFiles) ? effectiveMaxFiles : ''} file(s) allowed`);
        // Still allow opening camera so user can retake/replace after removing
      }

      // Get current location
      try {
        console.log('Attempting to get location...');
        const location = await getCurrentLocation();
        console.log('Location captured successfully:', location);
        setCurrentLocation(location);
        console.log('currentLocation state set to:', location);
      } catch (locationError) {
        console.error('Could not get location:', locationError);
        setCurrentLocation(null);
        console.log('currentLocation state set to null due to error');
        // Show user-friendly error
        setError('Location access denied. Please enable location permissions for better tracking.');
      }

      // Check if camera is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device');
        return;
      }

      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Detect if we're on mobile for better camera settings
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Try preferred facing mode first, then fall back to the other camera
      const getStream = async (preferred: 'user' | 'environment') => {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferred },
            width: isMobile ? { ideal: 640, max: 1280 } : { ideal: 1280 },
            height: isMobile ? { ideal: 480, max: 720 } : { ideal: 720 },
            ...(isMobile && { frameRate: { ideal: 30, max: 60 } })
          }
        });
      };

      let stream: MediaStream | null = null;
      try {
        stream = await getStream(facingMode);
      } catch (primaryErr) {
        console.warn('Primary camera open failed, trying fallback camera:', primaryErr);
        const fallbackMode = facingMode === 'environment' ? 'user' : 'environment';
        try {
          stream = await getStream(fallbackMode);
          setFacingMode(fallbackMode);
        } catch (fallbackErr) {
          console.error('Fallback camera also failed:', fallbackErr);
          throw primaryErr;
        }
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari needs playsInline and a play call in a user gesture; we already set playsInline
        const playPromise = videoRef.current.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(err => console.warn('Video play was prevented:', err));
        }
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera is already in use by another application.');
        } else {
          setError('Failed to access camera. Please check permissions.');
        }
      } else {
        setError('Failed to access camera. Please check permissions.');
      }
    }
  }, [facingMode, currentFileCount, maxFiles]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    setError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Could not get canvas context');
      setError('Could not access canvas. Please try again.');
      setIsCapturing(false);
      return;
    }

    // Ensure video is ready
    if (video.readyState < 2) {
      console.error('Video not ready');
      setError('Video not ready. Please try again.');
      setIsCapturing(false);
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log('Capturing photo:', { 
      videoWidth: video.videoWidth, 
      videoHeight: video.videoHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
      setIsCapturing(false);
      
      if (!blob) {
        console.error('Failed to create blob from canvas');
        setError('Failed to capture image. Please try again.');
        return;
      }

      console.log('Blob created:', { size: blob.size, type: blob.type });

      // Check file size
      if (blob.size > maxFileSizeMB * 1024 * 1024) {
        setError(`File size must be less than ${maxFileSizeMB}MB`);
        return;
      }

      // Check file type
      if (!allowedFileTypes.includes(blob.type)) {
        setError(`Invalid file type. Allowed: ${allowedFileTypes.join(', ')}`);
        return;
      }

      // Create file from blob with timestamp and location in filename
      const captureTime = new Date().toISOString().replace(/[:.]/g, '-');
      const locationSuffix = currentLocation 
        ? `-${currentLocation.lat.toFixed(6)}-${currentLocation.lng.toFixed(6)}`
        : '';
      const file = new File([blob], `camera-capture-${captureTime}${locationSuffix}.jpg`, {
        type: blob.type,
        lastModified: Date.now()
      });

      console.log('File created:', { name: file.name, size: file.size, type: file.type });

      // Set captured image for preview
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      
      // Stop camera
      stopCamera();
    }, 'image/jpeg', 0.8);
  }, [maxFileSizeMB, allowedFileTypes, stopCamera]);

  const confirmCapture = useCallback(async () => {
    if (!canvasRef.current) {
      console.error('Canvas not available for confirmation');
      return;
    }

    console.log('Confirming capture...');

    // Try to get location again if we don't have it
    let finalLocation = currentLocation;
    if (!finalLocation) {
      console.log('No location available, trying to get location again...');
      try {
        finalLocation = await getCurrentLocation();
        console.log('Location captured on retry:', finalLocation);
        setCurrentLocation(finalLocation);
      } catch (locationError) {
        console.warn('Location retry failed:', locationError);
        finalLocation = null;
      }
    }

    canvasRef.current.toBlob(async (blob) => {
      if (!blob) {
        console.error('Failed to create blob for confirmation');
        setError('Failed to process image. Please try again.');
        return;
      }

      console.log('Confirmation blob created:', { size: blob.size, type: blob.type });

      const captureTime = new Date().toISOString().replace(/[:.]/g, '-');
      const locationSuffix = finalLocation 
        ? `-${finalLocation.lat.toFixed(6)}-${finalLocation.lng.toFixed(6)}`
        : '';
      const originalFile = new File([blob], `camera-capture-${captureTime}${locationSuffix}.jpg`, {
        type: blob.type,
        lastModified: Date.now()
      });

      try {
        // Add overlay to the image
        console.log('Adding overlay to captured image...');
        const fileWithOverlay = await addImageOverlay(originalFile, finalLocation || undefined, new Date());
        console.log('Overlay added successfully:', { 
          originalSize: originalFile.size, 
          newSize: fileWithOverlay.size,
          name: fileWithOverlay.name 
        });

        console.log('Final file created with overlay:', { name: fileWithOverlay.name, size: fileWithOverlay.size, type: fileWithOverlay.type });
        console.log('Final location state at capture:', finalLocation);
        console.log('Passing location to form:', finalLocation);

        console.log('Passing to form:', { file: fileWithOverlay.name, location: finalLocation });
        onCapture(fileWithOverlay, finalLocation);
        setCapturedImage(null);
        onClose(); // Close the camera dialog
      } catch (overlayError) {
        console.error('Failed to add overlay:', overlayError);
        // Fallback to original file if overlay fails
        console.log('Using original file without overlay due to error');
        onCapture(originalFile, finalLocation);
        setCapturedImage(null);
        onClose();
      }
    }, 'image/jpeg', 0.8);
  }, [onCapture, onClose, currentLocation, getCurrentLocation]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    onClose();
  }, [stopCamera, onClose]);

  // Start camera when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Detect mobile device for responsive design
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${isMobile ? 'max-w-full h-full max-h-full' : 'max-w-md'}`}>
        <DialogHeader className={isMobile ? 'pb-2' : ''}>
          <DialogTitle>Capture Photo</DialogTitle>
          <DialogDescription>
            Take a photo using your device's camera
          </DialogDescription>
        </DialogHeader>

        <div className={`space-y-4 ${isMobile ? 'flex-1 flex flex-col' : ''}`}>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className={`relative bg-black rounded-lg overflow-hidden ${isMobile ? 'flex-1 min-h-0' : ''}`}>
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  className={`w-full object-cover ${isMobile ? 'h-full' : 'h-64'}`}
                  playsInline
                  muted
                  autoPlay
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center text-white">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Starting camera...</p>
                    </div>
                  </div>
                )}
                {isCapturing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm">Capturing photo...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <img
                src={capturedImage}
                alt="Captured"
                className={`w-full object-cover ${isMobile ? 'h-full' : 'h-64'}`}
              />
            )}
            
            {/* Hidden canvas for image capture */}
            <canvas
              ref={canvasRef}
              className="hidden"
              style={{ display: 'none' }}
            />
          </div>

          {/* Location status */}
          {!currentLocation && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 mb-2">
              ⚠️ Location not captured. 
              <Button
                onClick={async () => {
                  try {
                    const location = await getCurrentLocation();
                    setCurrentLocation(location);
                    console.log('Location captured on retry:', location);
                  } catch (error) {
                    console.warn('Location retry failed:', error);
                  }
                }}
                variant="outline"
                size="sm"
                className="ml-2 h-6 text-xs"
              >
                Try Again
              </Button>
            </div>
          )}
          {currentLocation && (
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200 mb-2">
              📍 Location: {currentLocation.address || `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`}
            </div>
          )}

          <div className={`flex justify-center space-x-2 ${isMobile ? 'flex-shrink-0' : ''}`}>
            {!capturedImage ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  onClick={switchCamera}
                  disabled={!isStreaming}
                  className={isMobile ? 'flex-1' : ''}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Switch Camera
                </Button>
                <Button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isStreaming || isCapturing}
                  className={isMobile ? 'flex-1' : ''}
                >
                  <Camera className="h-4 w-4 mr-1" />
                  {isCapturing ? 'Capturing...' : 'Capture'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={retakePhoto}
                  className={isMobile ? 'flex-1' : ''}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retake
                </Button>
                <Button
                  type="button"
                  onClick={confirmCapture}
                  className={isMobile ? 'flex-1' : ''}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Use Photo
                </Button>
              </>
            )}
          </div>

          <div className="text-xs text-gray-500 text-center">
            {currentFileCount}
            {typeof maxFiles === 'number' && isFinite(maxFiles) && maxFiles > 0 ? `/${maxFiles}` : ''} files uploaded
            {maxFileSizeMB && ` • Max ${maxFileSizeMB}MB per file`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
