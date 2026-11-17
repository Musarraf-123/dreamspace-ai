import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectReport } from './projectReportPdf.js';

test('creates a downloadable PDF with project, estimate and shopping-list data', async () => {
  const result = await createProjectReport({
    title: 'Pune Living Room', type: 'interior', room: 'Living room', style: 'Warm minimal',
    prompt: 'Keep the existing window placement and make the room feel calm. '.repeat(22),
    roomType: 'Living room', palette: 'Warm neutrals', budget: 'INR 2-5 lakh',
    measurements: { length: 14, width: 12, height: 10, unit: 'ft', city: 'Pune' },
    generations: [{ mode: 'interior', roomType: 'Living room', style: 'Warm minimal', palette: 'Warm neutrals', budget: 'INR 2-5 lakh' }],
    estimateReport: {
      renovationType: 'Full room renovation', quality: 'Standard', low: 125000, expected: 162000, high: 204000, currency: 'INR',
      items: ['Paint and primer', 'Wall tiles', 'Flooring', 'Furniture', 'Lights', 'Ceiling', 'Carpentry', 'Labour', 'Transport', 'Tax', 'Contingency'].map((name, index) => ({ name, quantity: index + 1, unit: 'unit', unitRate: 390, low: 3900, expected: 4446, high: 5280 })),
      shoppingList: ['Paint and primer', 'Wall tiles', 'Flooring', 'Furniture', 'Lights', 'Ceiling', 'Carpentry'].map((name) => ({ name, quantity: 1, unit: 'unit' })),
    },
  });
  assert.match(result.filename, /^dreamspace-pune-living-room-report\.pdf$/);
  assert.equal(result.blob.type, 'application/pdf');
  assert.ok(result.blob.size > 4000);
  const header = new TextDecoder().decode(await result.blob.slice(0, 5).arrayBuffer());
  assert.equal(header, '%PDF-');
});
