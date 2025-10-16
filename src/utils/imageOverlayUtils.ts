/**
 * Utility functions for adding location and timestamp overlays to images
 */

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
}

/**
 * Add location and timestamp overlay to an image
 * @param imageFile - The original image file
 * @param location - Location data to overlay
 * @param timestamp - Optional custom timestamp (defaults to current time)
 * @returns Promise<File> - New file with overlay
 */
export async function addImageOverlay(
  imageFile: File,
  location?: LocationData,
  timestamp?: Date
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Prepare overlay text
      const now = timestamp || new Date();
      const timeString = now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const locationString = location 
        ? (location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`)
        : 'Location not available';

      // Calculate overlay dimensions and position
      const padding = 16; // Increased from 10
      const lineHeight = 28; // Increased from 20
      const fontSize = Math.max(16, Math.min(24, img.width / 20)); // Increased font size range
      
      // Set font properties
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3; // Increased from 2

      // Calculate text dimensions
      const timeMetrics = ctx.measureText(timeString);
      const locationMetrics = ctx.measureText(locationString);
      const maxWidth = Math.max(timeMetrics.width, locationMetrics.width);
      
      // Position overlay in bottom-right corner
      const overlayX = img.width - maxWidth - (padding * 2);
      const overlayY = img.height - (lineHeight * 2) - (padding * 2);
      const overlayWidth = maxWidth + (padding * 2);
      const overlayHeight = (lineHeight * 2) + (padding * 2);

      // Draw background rectangle
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Increased opacity from 0.7
      ctx.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);

      // Draw border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2; // Increased from 1
      ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);

      // Draw text
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Draw timestamp
      ctx.fillText(timeString, overlayX + padding, overlayY + padding);
      
      // Draw location
      ctx.fillText(locationString, overlayX + padding, overlayY + padding + lineHeight);

      // Convert canvas to blob and create new file
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }

        // Create new file with overlay
        const originalName = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const fileExt = imageFile.name.split('.').pop() || 'jpg';
        const newFileName = `${originalName}-overlay.${fileExt}`;
        
        const newFile = new File([blob], newFileName, {
          type: imageFile.type,
          lastModified: Date.now()
        });

        resolve(newFile);
      }, imageFile.type, 0.9); // Slight compression to maintain quality
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image
    img.src = URL.createObjectURL(imageFile);
  });
}

/**
 * Add overlay to multiple images
 * @param imageFiles - Array of image files
 * @param locations - Array of location data (one per image)
 * @param timestamp - Optional custom timestamp
 * @returns Promise<File[]> - Array of new files with overlays
 */
export async function addImageOverlays(
  imageFiles: File[],
  locations: (LocationData | undefined)[],
  timestamp?: Date
): Promise<File[]> {
  const promises = imageFiles.map((file, index) => 
    addImageOverlay(file, locations[index], timestamp)
  );
  
  return Promise.all(promises);
}

/**
 * Check if a file is an image
 * @param file - File to check
 * @returns boolean - True if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Format location for display
 * @param location - Location data
 * @returns string - Formatted location string
 */
export function formatLocationForOverlay(location?: LocationData): string {
  if (!location) return 'Location not available';
  
  if (location.address) {
    return location.address;
  }
  
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}
