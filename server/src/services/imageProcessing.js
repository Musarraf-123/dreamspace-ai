import sharp from 'sharp';

const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export async function normalizeImage(buffer, { maxBytes = 8 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > maxBytes) {
    const error = new Error('Choose an image smaller than 8 MB.'); error.status = 400; throw error;
  }
  try {
    const pipeline = sharp(buffer, { limitInputPixels: 30_000_000, failOn: 'error' });
    const metadata = await pipeline.metadata();
    if (!SUPPORTED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) throw new Error('Unsupported image format');
    const imageBuffer = await pipeline.rotate().resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { imageBuffer, contentType: 'image/jpeg' };
  } catch {
    const error = new Error('This photo could not be opened. Upload a JPG, PNG or WebP image.'); error.status = 400; throw error;
  }
}

export async function normalizeGeneratedImage(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('Invalid generated image');
    const imageBuffer = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'error' }).resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    return { imageBuffer, contentType: 'image/jpeg' };
  } catch {
    const error = new Error('The generated image could not be processed. Please try again.'); error.status = 502; throw error;
  }
}
