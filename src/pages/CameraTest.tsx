import React, { useState } from 'react';
import { CameraCapture } from '@/components/CameraCapture';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload } from 'lucide-react';

export default function CameraTest() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);

  const handleCapture = (file: File) => {
    console.log('File captured:', { name: file.name, size: file.size, type: file.type });
    setCapturedFiles(prev => [...prev, file]);
  };

  const removeFile = (index: number) => {
    setCapturedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Capture Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-gray-600">
            This page demonstrates the camera capture functionality for form file uploads.
            The camera capture feature will automatically appear in file upload fields that accept image files.
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={() => setCameraOpen(true)}>
                <Camera className="h-4 w-4 mr-2" />
                Test Camera Capture
              </Button>
            </div>

            {capturedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Captured Files:</h3>
                <div className="grid gap-2">
                  {capturedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Features:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Camera access with front/back camera switching</li>
              <li>Mobile-optimized interface</li>
              <li>File size and type validation</li>
              <li>Image preview before confirmation</li>
              <li>Retake functionality</li>
              <li>Automatic file naming with timestamps</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <CameraCapture
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        maxFiles={5}
        currentFileCount={capturedFiles.length}
        allowedFileTypes={['image/jpeg', 'image/png']}
        maxFileSizeMB={10}
      />
    </div>
  );
}
