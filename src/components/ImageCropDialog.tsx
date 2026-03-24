import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getPanBounds = (
  naturalSize: { width: number; height: number },
  zoom: number,
) => {
  if (!naturalSize.width || !naturalSize.height) {
    return { maxOffsetX: 0, maxOffsetY: 0, renderedWidth: PREVIEW_SIZE, renderedHeight: PREVIEW_SIZE };
  }

  const coverScale = Math.max(PREVIEW_SIZE / naturalSize.width, PREVIEW_SIZE / naturalSize.height);
  const renderedWidth = naturalSize.width * coverScale * zoom;
  const renderedHeight = naturalSize.height * coverScale * zoom;

  return {
    renderedWidth,
    renderedHeight,
    maxOffsetX: Math.max(0, (renderedWidth - PREVIEW_SIZE) / 2),
    maxOffsetY: Math.max(0, (renderedHeight - PREVIEW_SIZE) / 2),
  };
};

const computePreviewMetrics = (
  naturalSize: { width: number; height: number },
  zoom: number,
  panX: number,
  panY: number,
) => {
  const { renderedWidth, renderedHeight, maxOffsetX, maxOffsetY } = getPanBounds(naturalSize, zoom);
  const clampedPanX = clamp(panX, -maxOffsetX, maxOffsetX);
  const clampedPanY = clamp(panY, -maxOffsetY, maxOffsetY);

  return {
    width: renderedWidth,
    height: renderedHeight,
    left: (PREVIEW_SIZE - renderedWidth) / 2 + clampedPanX,
    top: (PREVIEW_SIZE - renderedHeight) / 2 + clampedPanY,
    maxOffsetX,
    maxOffsetY,
    panX: clampedPanX,
    panY: clampedPanY,
  };
};

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
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

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
    return computePreviewMetrics(naturalSize, zoom, panX, panY);
  }, [naturalSize, panX, panY, zoom]);

  useEffect(() => {
    if (panX !== previewMetrics.panX) {
      setPanX(previewMetrics.panX);
    }
    if (panY !== previewMetrics.panY) {
      setPanY(previewMetrics.panY);
    }
  }, [panX, panY, previewMetrics.panX, previewMetrics.panY]);

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const nextMetrics = computePreviewMetrics(naturalSize, clampedZoom, panX, panY);
    setZoom(clampedZoom);
    setPanX(nextMetrics.panX);
    setPanY(nextMetrics.panY);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageUrl) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX,
      panY,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const nextMetrics = computePreviewMetrics(
      naturalSize,
      zoom,
      dragState.panX + deltaX,
      dragState.panY + deltaY,
    );

    setPanX(nextMetrics.panX);
    setPanY(nextMetrics.panY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12));
  };

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
              <div
                className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
                onWheel={handleWheel}
              >
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
              </div>
            ) : null}
            <div className="absolute inset-0 rounded-2xl border-[3px] border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)] pointer-events-none" />
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Drag the photo directly with your finger or mouse to position it. Use the zoom buttons if needed.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => updateZoom(zoom - 0.15)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                −
              </button>
              <div className="min-w-20 rounded-lg bg-muted px-3 py-2 text-center text-sm font-medium text-foreground">
                {zoom.toFixed(1)}×
              </div>
              <button
                type="button"
                onClick={() => updateZoom(zoom + 0.15)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  setPanX(0);
                  setPanY(0);
                  setZoom(1);
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Reset
              </button>
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
