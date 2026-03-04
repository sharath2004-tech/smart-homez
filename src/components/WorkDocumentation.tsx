import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Camera, CheckCircle, Clock, Image as ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";

interface WorkDocumentationProps {
  bookingId: string;
  maxPhotos?: number;
}

interface Photo {
  _id?: string;
  url: string;
  type: 'before' | 'during' | 'after';
  timestamp: string;
  notes: string;
  uploadedBy?: { _id: string; name: string };
}

const WorkDocumentation = ({ bookingId, maxPhotos = 10 }: WorkDocumentationProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoType, setPhotoType] = useState<'before' | 'during' | 'after'>('before');
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchWorkDocumentation();
  }, [bookingId]);

  const fetchWorkDocumentation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/work-documentation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPhotos(data.workDocumentation?.photos || []);
      }
    } catch (error) {
      console.error('Error fetching work documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError("Only image files are allowed");
      return;
    }

    // Check photo limit
    if (photos.length >= maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed per booking`);
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Image = reader.result as string;

        // Upload photo
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/upload-photo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            photoUrl: base64Image,
            type: photoType,
            notes: notes
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to upload photo');
        }

        const result = await response.json();
        
        setPhotos(prev => [...prev, result.photo]);
        setNotes("");
        setSuccess(`Photo uploaded successfully! (${result.totalPhotos}/${maxPhotos})`);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(""), 3000);

      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError((err as Error).message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const getPhotosByType = (type: 'before' | 'during' | 'after') => {
    return photos.filter(p => p.type === type);
  };

  const renderPhotoGallery = () => {
    const types: Array<'before' | 'during' | 'after'> = ['before', 'during', 'after'];
    
    return types.map(type => {
      const typePhotos = getPhotosByType(type);
      if (typePhotos.length === 0) return null;

      return (
        <div key={type} className="space-y-3">
          <h4 className="font-medium capitalize flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            {type === 'before' && 'Before Service'}
            {type === 'during' && 'During Service'}
            {type === 'after' && 'After Service'}
            <span className="text-sm text-muted-foreground">({typePhotos.length})</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {typePhotos.map((photo, index) => (
              <div key={photo._id || index} className="relative group">
                <img
                  src={photo.url}
                  alt={`${type} work - ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-2 flex flex-col justify-end">
                  <div className="text-xs text-white space-y-1">
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(photo.timestamp).toLocaleString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short'
                      })}
                    </p>
                    {photo.notes && (
                      <p className="text-xs line-clamp-2">{photo.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Loading work documentation...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Work Documentation
        </CardTitle>
        <CardDescription>
          Upload photos of your work (max {maxPhotos} photos). Current: {photos.length}/{maxPhotos}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Form */}
        {photos.length < maxPhotos && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-3">
              <Label>Photo Type</Label>
              <RadioGroup value={photoType} onValueChange={(value) => setPhotoType(value as 'before' | 'during' | 'after')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="before" id="before" />
                  <Label htmlFor="before" className="font-normal cursor-pointer">
                    Before Work
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="during" id="during" />
                  <Label htmlFor="during" className="font-normal cursor-pointer">
                    During Work
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="after" id="after" />
                  <Label htmlFor="after" className="font-normal cursor-pointer">
                    After Work
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this photo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo-upload">Upload Photo</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={uploading}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Image
                    </>
                  )}
                </Button>
              </div>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                Max 5MB • JPG, PNG, or WebP
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {/* Photo Gallery */}
        {photos.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Uploaded Photos</h3>
              <span className="text-sm text-muted-foreground">
                {photos.length} of {maxPhotos} photos
              </span>
            </div>
            {renderPhotoGallery()}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No photos uploaded yet</p>
            <p className="text-xs">Start by uploading a "Before Work" photo</p>
          </div>
        )}

        {/* Limit Warning */}
        {photos.length >= maxPhotos && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You've reached the maximum limit of {maxPhotos} photos for this booking.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkDocumentation;
