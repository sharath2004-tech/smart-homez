import jsQR from 'jsqr';

const PADDING = 24; // px padding around detected QR

/**
 * Given a base64 image string, detects the QR code region using jsQR,
 * crops to just the QR (with padding), and returns the cropped base64 PNG.
 * If detection fails, returns the original image unchanged.
 */
export async function cropQRFromImage(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (!code) {
        // Fallback: QR not detected — return original
        resolve(base64);
        return;
      }

      // Get bounding box from the four corner points
      const xs = [
        code.location.topLeftCorner.x,
        code.location.topRightCorner.x,
        code.location.bottomRightCorner.x,
        code.location.bottomLeftCorner.x,
      ];
      const ys = [
        code.location.topLeftCorner.y,
        code.location.topRightCorner.y,
        code.location.bottomRightCorner.y,
        code.location.bottomLeftCorner.y,
      ];

      const minX = Math.max(0, Math.floor(Math.min(...xs)) - PADDING);
      const minY = Math.max(0, Math.floor(Math.min(...ys)) - PADDING);
      const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)) + PADDING);
      const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)) + PADDING);

      const cropW = maxX - minX;
      const cropH = maxY - minY;

      // Draw cropped region onto a new square canvas (add white bg for clean look)
      const size = Math.max(cropW, cropH);
      const outCanvas = document.createElement('canvas');
      outCanvas.width = size;
      outCanvas.height = size;
      const outCtx = outCanvas.getContext('2d')!;
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, size, size);

      // Center the crop within the square canvas
      const offsetX = Math.floor((size - cropW) / 2);
      const offsetY = Math.floor((size - cropH) / 2);
      outCtx.drawImage(canvas, minX, minY, cropW, cropH, offsetX, offsetY, cropW, cropH);

      resolve(outCanvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(base64); // Fallback on error
    img.src = base64;
  });
}
