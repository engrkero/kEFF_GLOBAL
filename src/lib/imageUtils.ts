
/**
 * Compresses a base64 image string by resizing it and reducing quality.
 * @param base64Str The original base64 string
 * @param maxWidth The maximum width of the resulting image
 * @param quality The quality of the resulting image (0 to 1)
 * @returns A promise that resolves to the compressed base64 string
 */
export async function compressImage(base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedRes = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedRes);
    };
    img.onerror = (err) => reject(err);
  });
}
