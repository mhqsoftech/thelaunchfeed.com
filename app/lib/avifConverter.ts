/**
 * Utility to auto-convert any uploaded image file (PNG, JPG, WEBP, GIF, SVG)
 * into a compressed AVIF Data URL on the client-side.
 */
export async function convertImageFileToAvifDataUrl(
  file: File | Blob,
  maxWidth = 800,
  quality = 0.9
): Promise<{ dataUrl: string; sizeKb: number; format: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Downscale proportionally if larger than maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export to AVIF (browsers fallback to webp if image/avif unsupported)
        let mimeType = "image/avif";
        let dataUrl = canvas.toDataURL(mimeType, quality);

        // Check if browser exported as requested mimeType
        if (!dataUrl.startsWith("data:image/avif")) {
          // Attempt canvas webp if avif canvas export unavailable in old browser engine
          dataUrl = canvas.toDataURL("image/webp", quality);
          mimeType = "image/webp";
        }

        // Calculate approximate size in KB
        const base64Len = dataUrl.length - dataUrl.indexOf(",") - 1;
        const sizeKb = Math.round((base64Len * 3) / 4 / 1024);

        resolve({
          dataUrl,
          sizeKb,
          format: mimeType.split("/")[1].toUpperCase(),
        });
      };

      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
