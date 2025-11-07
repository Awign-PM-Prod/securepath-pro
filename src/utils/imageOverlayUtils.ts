/**
 * Utility functions for adding location and timestamp overlays to images
 */

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  pincode: string;
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

      // Create location strings for display
      let addressString = 'Location not available';
      let coordsString = '';
      let pincodeString = '';
      
      if (location) {
        coordsString = `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
        pincodeString = location.pincode && location.pincode.trim() ? `Pincode: ${location.pincode}` : '';
        addressString = location.address || coordsString;
      }

      // Calculate overlay dimensions and position - Full width at bottom
      const padding = 20;
      const lineHeight = 32;
      const fontSize = Math.max(18, Math.min(28, img.width / 25));
      const maxOverlayWidth = img.width - (padding * 2); // Full width minus padding
      
      // Set font properties
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;

      // Function to wrap text to fit within max width
      const wrapText = (text: string, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [text];
      };

      // Wrap address text if it's too long
      const addressLines = wrapText(addressString, maxOverlayWidth);
      
      // Build all lines to display
      const allLines: string[] = [timeString, ...addressLines];
      if (coordsString && location) allLines.push(coordsString);
      if (pincodeString) allLines.push(pincodeString);
      
      // Calculate overlay dimensions - full width at bottom
      const overlayX = padding;
      const overlayY = img.height - (lineHeight * allLines.length) - (padding * 2);
      const overlayWidth = maxOverlayWidth;
      const overlayHeight = (lineHeight * allLines.length) + (padding * 2);

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

      // Draw all lines with proper spacing
      let currentY = overlayY + padding;
      allLines.forEach((line) => {
        ctx.fillText(line, overlayX + padding, currentY);
        currentY += lineHeight;
      });

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
  
  const coords = `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
  const pincode = location.pincode ? ` - Pincode: ${location.pincode}` : '';
  
  if (location.address) {
    return `${location.address}${pincode}`;
  }
  
  return `${coords}${pincode}`;
}
