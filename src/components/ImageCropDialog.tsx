import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

interface ImageCropDialogProps {
  open: boolean;
  imageFile: File | null;
  onClose: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
  title?: string;
  description?: string;
  outputSize?: number;
}

const PREVIEW_SIZE = 280;

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Failed to load image"));
  image.src = src;
});

export const ImageCropDialog = ({
  open,
  imageFile,
  onClose,
  onConfirm,
  title = "Crop profile photo",
  description = "Adjust the image so your profile picture looks crisp and centered everywhere in the app.",
  outputSize = 512,
}: ImageCropDialogProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !imageFile) {
      setImageUrl(null);
      setNaturalSize({ width: 0, height: 0 });
      setZoom(1);
      setPanX(0);
      setPanY(0);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImageUrl(objectUrl);
    setZoom(1);
    setPanX(0);
    setPanY(0);

    loadImage(objectUrl)
      .then((image) => {
        setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
      })
      .catch(() => {
        setNaturalSize({ width: 0, height: 0 });
      });

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [open, imageFile]);

  const previewMetrics = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) {
      return {
        width: PREVIEW_SIZE,
        height: PREVIEW_SIZE,
        left: 0,
        top: 0,
      };
    }

    const coverScale = Math.max(PREVIEW_SIZE / naturalSize.width, PREVIEW_SIZE / naturalSize.height);
    const renderedWidth = naturalSize.width * coverScale * zoom;
    const renderedHeight = naturalSize.height * coverScale * zoom;
    const maxOffsetX = Math.max(0, (renderedWidth - PREVIEW_SIZE) / 2);
    const maxOffsetY = Math.max(0, (renderedHeight - PREVIEW_SIZE) / 2);
    const offsetX = maxOffsetX * (panX / 100);
    const offsetY = maxOffsetY * (panY / 100);

    return {
      width: renderedWidth,
      height: renderedHeight,
      left: (PREVIEW_SIZE - renderedWidth) / 2 + offsetX,
      top: (PREVIEW_SIZE - renderedHeight) / 2 + offsetY,
    };
  }, [naturalSize.height, naturalSize.width, panX, panY, zoom]);

  const handleConfirm = async () => {
    if (!imageFile || !imageUrl || !naturalSize.width || !naturalSize.height) {
      return;
    }

    setSaving(true);
    try {
      const image = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Could not prepare cropped image");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputSize, outputSize);

      const sourceX = Math.max(0, (0 - previewMetrics.left) * (naturalSize.width / previewMetrics.width));
      const sourceY = Math.max(0, (0 - previewMetrics.top) * (naturalSize.height / previewMetrics.height));
      const sourceWidth = Math.max(1, Math.min(PREVIEW_SIZE * (naturalSize.width / previewMetrics.width), naturalSize.width - sourceX));
      const sourceHeight = Math.max(1, Math.min(PREVIEW_SIZE * (naturalSize.height / previewMetrics.height), naturalSize.height - sourceY));

      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputSize, outputSize);

      const mimeType = imageFile.type === "image/png" ? "image/png" : "image/jpeg";
      const extension = mimeType === "image/png" ? "png" : "jpg";

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) {
            resolve(value);
            return;
          }
          reject(new Error("Failed to crop image"));
        }, mimeType, 0.92);
      });

      const croppedFile = new File([blob], `profile-photo-${Date.now()}.${extension}`, { type: mimeType });
      const previewUrl = URL.createObjectURL(croppedFile);
      onConfirm(croppedFile, previewUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="mx-auto h-[280px] w-[280px] overflow-hidden rounded-2xl border border-border bg-muted relative shadow-inner">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Crop preview"
                className="absolute left-0 top-0 max-w-none select-none pointer-events-none"
                style={{
                  width: `${previewMetrics.width}px`,
                  height: `${previewMetrics.height}px`,
                  transform: `translate(${previewMetrics.left}px, ${previewMetrics.top}px)`,
                }}
              />
            ) : null}
            <div className="absolute inset-0 rounded-2xl border-[3px] border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)] pointer-events-none" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Zoom</span>
                <span>{zoom.toFixed(1)}×</span>
              </div>
              <Slider min={1} max={3} step={0.1} value={[zoom]} onValueChange={([value]) => setZoom(value)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Move left / right</span>
                <span>{panX}%</span>
              </div>
              <Slider min={-100} max={100} step={1} value={[panX]} onValueChange={([value]) => setPanX(value)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Move up / down</span>
                <span>{panY}%</span>
              </div>
              <Slider min={-100} max={100} step={1} value={[panY]} onValueChange={([value]) => setPanY(value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            disabled={!imageFile || saving}
          >
            {saving ? <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> : null}
            Crop & use photo
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
