const MAX_UPLOAD_BYTES = 650 * 1024;
const MAX_IMAGE_EDGE = 2400;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected document.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size <= 300 * 1024) return file;
  if (typeof createImageBitmap !== 'function') return file;

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const preferredType = 'image/webp';
    for (const quality of [0.92, 0.88, 0.84, 0.8, 0.76]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, preferredType, quality));
      if (blob && blob.type === preferredType && blob.size < file.size && blob.size <= MAX_UPLOAD_BYTES) {
        const base = file.name.replace(/\.[^.]+$/, '') || 'kyc-document';
        return new File([blob], `${base}.webp`, { type: blob.type, lastModified: file.lastModified });
      }
    }
    return file;
  } finally {
    bitmap.close();
  }
}

/** Compresses photos before base64 JSON submission; PDF documents remain unchanged. */
export async function prepareKycUpload(file: File): Promise<{ fileName: string; base64: string; size: number }> {
  const prepared = await compressImage(file);
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error('This document is too large for secure submission. Choose a file under 650 KB or compress the PDF before uploading.');
  }
  const dataUrl = await readAsDataUrl(prepared);
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  if (base64.length > 900_000) {
    throw new Error('The encoded document exceeds the server upload limit. Please choose a smaller file.');
  }
  return { fileName: prepared.name, base64, size: prepared.size };
}
