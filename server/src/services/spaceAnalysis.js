import OpenAI from 'openai';

export const SPACE_ANALYSIS_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
export const LAYOUT_OPTIONS = ['Open plan', 'Galley', 'L-shaped', 'U-shaped', 'Closed rooms', 'Not sure'];

export function normalizeLayout(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return 'Not sure';
  if (text.includes('open')) return 'Open plan';
  if (text.includes('galley')) return 'Galley';
  if (text.includes('l-shape') || text.includes('l shape')) return 'L-shaped';
  if (text.includes('u-shape') || text.includes('u shape')) return 'U-shaped';
  if (text.includes('closed')) return 'Closed rooms';
  return 'Not sure';
}

function clampCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(20, Math.round(number)));
}

export function parseSpaceAnalysis(content) {
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error('The space analysis response was not valid JSON.'); }
  return {
    roomType: typeof parsed.roomType === 'string' ? parsed.roomType.trim().slice(0, 80) : '',
    layout: normalizeLayout(parsed.layout),
    doors: clampCount(parsed.doors),
    windows: clampCount(parsed.windows),
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 300) : '',
  };
}

export async function analyzeSpace({ imageBuffer }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Space analysis is not configured. Add OPENAI_API_KEY to the server environment.');
    error.status = 503;
    error.publicMessage = 'AI space analysis is temporarily unavailable. Add the layout and openings manually.';
    throw error;
  }
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 60_000 });
  try {
    const response = await client.chat.completions.create({
      model: SPACE_ANALYSIS_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: [
            'You analyse home photos for a renovation planning app used in India.',
            'Return only JSON with keys: roomType (short string such as Living room, Bedroom, Kitchen, Dining room, Bathroom, Home office, Balcony, Independent home, Apartment facade, Entryway, Terrace, Garden or Compound wall),',
            'layout (exactly one of: Open plan, Galley, L-shaped, U-shaped, Closed rooms, Not sure),',
            'doors (integer count of clearly visible door openings, 0-20),',
            'windows (integer count of clearly visible window openings, 0-20),',
            'notes (one short sentence about visible structural features, maximum 300 characters).',
            'Do not estimate dimensions, prices or hidden services. If unsure, use Not sure and 0 counts.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse this space photo for room type, layout and visible openings.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`, detail: 'low' } },
          ],
        },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('The space analysis service returned no content.');
    return { ...parseSpaceAnalysis(content), model: SPACE_ANALYSIS_MODEL };
  } catch (cause) {
    const error = new Error('The space analysis request failed.');
    error.status = cause.status === 429 ? 429 : 502;
    error.publicMessage = cause.status === 429
      ? 'Space analysis is busy. Add the layout and openings manually, or try again shortly.'
      : 'AI space analysis is temporarily unavailable. Add the layout and openings manually.';
    error.cause = cause;
    throw error;
  }
}
