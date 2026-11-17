import { createHash } from 'node:crypto';
import OpenAI, { toFile } from 'openai';

export const IMAGE_MODEL = 'gpt-image-2.5-sunburst';

export function buildRedesignPrompt({ mode, roomType, style, palette, budget, instructions, layout, doors, windows }) {
  const modeDirection = mode === 'exterior'
    ? 'Redesign the exterior architecture finishes, entry, facade materials, planting and outdoor details.'
    : mode === '3d'
      ? 'Render this same space as a polished, photorealistic 3D interior visualization from the same camera position.'
      : 'Redesign the interior finishes, furnishings, lighting and decor.';
  const openingParts = [
    Number.isFinite(Number(doors)) && Number(doors) > 0 ? `${Number(doors)} door opening(s)` : '',
    Number.isFinite(Number(windows)) && Number(windows) > 0 ? `${Number(windows)} window opening(s)` : '',
  ].filter(Boolean);
  const analysisLine = [
    layout && layout !== 'Not sure' ? `layout ${layout}` : '',
    openingParts.length ? `visible openings: ${openingParts.join(', ')}` : '',
  ].filter(Boolean).join('; ');

  return [
    'Create a photorealistic home redesign by editing the supplied real photo.',
    `Space: ${roomType}. Design style: ${style}. Colour palette: ${palette}. Budget guide: ${budget}.`,
    analysisLine ? `Space analysis to respect: ${analysisLine}.` : '',
    modeDirection,
    'Preserve the original architectural layout and camera view as closely as possible. Keep the room or house footprint, wall positions, ceiling height, doors, windows, built-in openings, perspective and major structural elements in their original locations. Do not add rooms, move walls, change the camera angle, or invent architectural features. Make the design feel buildable and appropriate for an Indian home.',
    'Change the visible finishes, furnishings and styling to match the requested style and budget. Keep a natural photographic appearance, realistic materials, believable lighting and coherent scale.',
    instructions ? `Additional user instructions: ${instructions}` : '',
  ].filter(Boolean).join('\n');
}

export async function generateRedesign({ imageBuffer, mode, roomType, style, palette, budget, instructions, userId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Image generation is not configured. Add OPENAI_API_KEY to the server environment.');
    error.status = 503;
    error.publicMessage = 'AI redesign is temporarily unavailable. Please try again later.';
    throw error;
  }

  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 180_000 });
  const safetyIdentifier = createHash('sha256').update(String(userId)).digest('hex');

  try {
    const response = await client.images.edit({
      model: IMAGE_MODEL,
      image: await toFile(imageBuffer, 'dreamspace-source.jpg', { type: 'image/jpeg' }),
      prompt: buildRedesignPrompt({ mode, roomType, style, palette, budget, instructions }),
      quality: 'high',
      size: 'auto',
      output_format: 'jpeg',
      output_compression: 88,
      n: 1,
      safety_identifier: safetyIdentifier,
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error('The image service returned no image data.');
    return { imageBuffer: Buffer.from(encoded, 'base64'), model: IMAGE_MODEL };
  } catch (cause) {
    const error = new Error(
      cause.status === 429
        ? 'Image generation is busy. Please wait a moment and try again.'
        : 'We could not create this redesign. Try a different photo or adjust your instructions.',
    );
    error.status = cause.status === 429 ? 429 : 502;
    error.cause = cause;
    throw error;
  }
}
