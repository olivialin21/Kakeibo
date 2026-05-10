/**
 * Universal image processing and compression utilities
 */

/**
 * Compresses an image Blob or File.
 * Returns a DataURL (base64 string with header).
 * 
 * @param file The image to compress
 * @param maxDim Maximum dimension for the longest side
 * @param quality JPEG quality (0.0 to 1.0)
 */
export async function compressImage(
  file: File | Blob, 
  maxDim: number = 1600, 
  quality: number = 0.8
): Promise<string> {
  try {
    // 1. Create bitmap (browser optimized way to read image data)
    const bitmap = await createImageBitmap(file);
    
    // 2. Calculate aspect ratio aware dimensions
    let width = bitmap.width;
    let height = bitmap.height;

    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // 3. Draw to canvas for compression
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    
    // 4. Export as compressed JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    // Cleanup
    bitmap.close();
    
    return dataUrl;
  } catch (e) {
    console.error('[ImageUtils] Compression failed', e);
    // Fallback: return original as base64 if possible
    return await blobToBase64(file);
  }
}

/**
 * Basic Blob to Base64/DataURL converter (no compression)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a Base64/DataURL string back to a Blob
 */
export function base64ToBlob(base64: string): Blob {
  try {
    const parts = base64.split(';base64,');
    if (parts.length !== 2) {
      // Not a standard data URL, return as is or handle error
      return new Blob([], { type: 'image/jpeg' });
    }
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error('[ImageUtils] base64ToBlob failed', e);
    return new Blob([], { type: 'image/jpeg' });
  }
}
