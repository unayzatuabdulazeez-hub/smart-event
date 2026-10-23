import { supabaseBrowser } from './supabase/client';

const MAX_BYTES = 3 * 1024 * 1024;
const OK = ['image/jpeg', 'image/png', 'image/webp'];

/** Downscale in the browser so phone photos don't waste storage or mobile data. */
async function shrink(file: File, maxEdge = 1600): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
    return blob ?? file;
  } catch { return file; }
}

/** Uploads to <bucket>/<businessId>/<random>.webp and returns the public URL. Throws a friendly Error. */
export async function uploadImage(bucket: 'branding' | 'event-images', businessId: string, file: File): Promise<string> {
  if (!OK.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.');
  const blob = await shrink(file);
  if (blob.size > MAX_BYTES) throw new Error('That image is too large. Please choose one under 3 MB.');
  const ext = blob.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
  const sb = supabaseBrowser();
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error('Image upload failed. Please try again.');
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
