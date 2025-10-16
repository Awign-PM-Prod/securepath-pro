/**
 * Test file for image overlay utilities
 * This is a basic test to verify the overlay functionality works
 */

import { addImageOverlay, isImageFile, formatLocationForOverlay } from '../imageOverlayUtils';

// Mock canvas and Image for testing
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 })),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: '',
    textBaseline: ''
  })),
  toBlob: jest.fn((callback) => {
    const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
    callback(mockBlob);
  })
};

// Mock document.createElement
Object.defineProperty(document, 'createElement', {
  value: jest.fn((tagName) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    return {};
  })
});

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  value: jest.fn(() => 'mock-url')
});

// Mock Image constructor
global.Image = jest.fn(() => ({
  onload: null,
  onerror: null,
  src: ''
})) as any;

describe('imageOverlayUtils', () => {
  describe('isImageFile', () => {
    it('should return true for image files', () => {
      const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      expect(isImageFile(imageFile)).toBe(true);
    });

    it('should return false for non-image files', () => {
      const textFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(isImageFile(textFile)).toBe(false);
    });
  });

  describe('formatLocationForOverlay', () => {
    it('should format location with address', () => {
      const location = {
        lat: 12.9716,
        lng: 77.5946,
        address: 'Bangalore, Karnataka'
      };
      expect(formatLocationForOverlay(location)).toBe('Bangalore, Karnataka');
    });

    it('should format location with coordinates when no address', () => {
      const location = {
        lat: 12.9716,
        lng: 77.5946
      };
      expect(formatLocationForOverlay(location)).toBe('12.971600, 77.594600');
    });

    it('should return default message when no location', () => {
      expect(formatLocationForOverlay(undefined)).toBe('Location not available');
    });
  });

  describe('addImageOverlay', () => {
    it('should add overlay to image file', async () => {
      const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const location = {
        lat: 12.9716,
        lng: 77.5946,
        address: 'Bangalore, Karnataka'
      };

      // Mock image load
      const mockImage = new Image() as any;
      mockImage.onload = null;
      mockImage.src = '';

      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      const result = await addImageOverlay(imageFile, location);
      
      expect(result).toBeInstanceOf(File);
      expect(result.name).toContain('overlay');
      expect(result.type).toBe('image/jpeg');
    });

    it('should handle image load error', async () => {
      const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // Mock image error
      const mockImage = new Image() as any;
      mockImage.onload = null;
      mockImage.onerror = null;
      mockImage.src = '';

      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror();
        }
      }, 0);

      await expect(addImageOverlay(imageFile)).rejects.toThrow('Failed to load image');
    });
  });
});
