import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  X, 
  Check, 
  MapPin, 
  Clock, 
  Upload,
  RotateCcw,
  Trash2,
  Eye
} from 'lucide-react';

interface CapturedPhoto {
  id: string;
  file: File;
  preview: string;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
  description?: string;
  category: 'premises' | 'documents' | 'evidence' | 'other';
}

interface PhotoCaptureProps {
  caseId: string;
  onPhotosSubmit: (photos: CapturedPhoto[]) => void;
  onClose: () => void;
}

const PHOTO_CATEGORIES = [
  { value: 'premises', label: 'Premises', color: 'bg-blue-100 text-blue-800' },
  { value: 'documents', label: 'Documents', color: 'bg-green-100 text-green-800' },
  { value: 'evidence', label: 'Evidence', color: 'bg-orange-100 text-orange-800' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' },
];

export default function PhotoCapture({ caseId, onPhotosSubmit, onClose }: PhotoCaptureProps) {
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<CapturedPhoto | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'premises' | 'documents' | 'evidence' | 'other'>('premises');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapturePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photo: CapturedPhoto = {
          id: Date.now().toString(),
          file,
          preview: e.target?.result as string,
          timestamp: new Date().toISOString(),
          category: 'premises',
        };
        
        setCurrentPhoto(photo);
        setIsCapturing(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePhoto = () => {
    if (currentPhoto) {
      const photoWithDetails = {
        ...currentPhoto,
        description,
        category,
      };
      
      setCapturedPhotos(prev => [...prev, photoWithDetails]);
      setCurrentPhoto(null);
      setDescription('');
      setCategory('premises');
      setIsCapturing(false);
    }
  };

  const handleDiscardPhoto = () => {
    setCurrentPhoto(null);
    setDescription('');
    setCategory('premises');
    setIsCapturing(false);
  };

  const handleRemovePhoto = (photoId: string) => {
    setCapturedPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleSubmitPhotos = () => {
    onPhotosSubmit(capturedPhotos);
  };

  const getCategoryBadge = (cat: string) => {
    const categoryInfo = PHOTO_CATEGORIES.find(c => c.value === cat);
    return (
      <Badge className={categoryInfo?.color || 'bg-gray-100 text-gray-800'}>
        {categoryInfo?.label || cat}
      </Badge>
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Photo Capture</h2>
            <p className="text-sm text-muted-foreground">Case: {caseId}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isCapturing && currentPhoto ? (
          /* Photo Preview and Details */
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Photo Preview</CardTitle>
                <CardDescription>Add details for this photo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <img
                    src={currentPhoto.preview}
                    alt="Captured photo"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary">
                      {new Date(currentPhoto.timestamp).toLocaleTimeString()}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {PHOTO_CATEGORIES.map((cat) => (
                        <Button
                          key={cat.value}
                          variant={category === cat.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCategory(cat.value as any)}
                          className="justify-start"
                        >
                          {cat.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this photo shows..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSavePhoto} className="flex-1">
                    <Check className="h-4 w-4 mr-2" />
                    Save Photo
                  </Button>
                  <Button onClick={handleDiscardPhoto} variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-2" />
                    Discard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Photo Gallery and Capture */
          <div className="p-4 space-y-4">
            {/* Capture Button */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Capture Photo</h3>
                    <p className="text-sm text-muted-foreground">
                      Take a photo or select from gallery
                    </p>
                  </div>
                  <Button onClick={handleCapturePhoto} size="lg" className="w-full">
                    <Camera className="h-5 w-5 mr-2" />
                    Take Photo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Captured Photos */}
            {capturedPhotos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Captured Photos ({capturedPhotos.length})</CardTitle>
                  <CardDescription>Review and manage your captured photos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {capturedPhotos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.preview}
                          alt="Captured photo"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <div className="absolute top-2 left-2">
                          {getCategoryBadge(photo.category)}
                        </div>
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="text-xs">
                            {new Date(photo.timestamp).toLocaleTimeString()}
                          </Badge>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 h-8"
                              onClick={() => {
                                setCurrentPhoto(photo);
                                setDescription(photo.description || '');
                                setCategory(photo.category);
                                setIsCapturing(true);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() => handleRemovePhoto(photo.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {photo.description && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg">
                            {photo.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            {capturedPhotos.length > 0 && (
              <div className="sticky bottom-0 bg-white border-t p-4">
                <Button onClick={handleSubmitPhotos} className="w-full" size="lg">
                  <Upload className="h-5 w-5 mr-2" />
                  Submit {capturedPhotos.length} Photo{capturedPhotos.length !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

