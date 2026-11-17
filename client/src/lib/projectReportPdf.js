import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { assetUrl } from './api.js';

const clean = (value) => String(value ?? 'Not provided')
  .replaceAll('₹', 'INR ')
  .replaceAll('×', ' x ')
  .replaceAll('–', '-')
  .replaceAll('—', '-')
  .replaceAll('·', ' | ')
  .replace(/[^\x20-\x7E]/g, '')
  .trim();
const money = (value) => `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
const quantity = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value) || 0);

async function imageData(assetId) {
  if (!assetId) return null;
  const response = await fetch(assetUrl(`/api/design-assets/${assetId}`), { credentials: 'include' });
  if (!response.ok) throw new Error('A private project image could not be loaded. Sign in again and retry the report.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('A project image has an unsupported format.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not prepare a project image for the report.'));
    reader.readAsDataURL(blob);
  });
}

function addContainedImage(doc, image, x, y, maxWidth, maxHeight) {
  const dimensions = doc.getImageProperties(image);
  const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  doc.addImage(image, 'JPEG', x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height, undefined, 'FAST');
}

function sectionTitle(doc, title, y) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(37, 64, 47);
  doc.text(clean(title).toUpperCase(), 14, y);
  doc.setDrawColor(225, 230, 221); doc.line(14, y + 2, 196, y + 2);
}

function ensureSectionSpace(doc, y, reservedHeight = 24) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + reservedHeight <= pageHeight - 18) return y;
  doc.addPage();
  return 18;
}

export async function createProjectReport(project) {
  const latest = project.generations?.at(-1);
  const originalId = latest?.originalAssetId || project.sourceAssetId;
  const generatedId = latest?.generatedAssetId;
  const [originalPhoto, designPhoto, referencePhoto] = await Promise.all([imageData(originalId), imageData(generatedId), imageData(project.referenceAssetId)]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const title = clean(project.title || 'DreamSpace home project');
  const details = latest || {};
  const report = project.estimateReport;
  const measurements = project.measurements;

  doc.setFillColor(34, 69, 49); doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(218, 232, 211); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('DREAMSPACE AI  /  HOME PROJECT REPORT', 14, 10);
  doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text(doc.splitTextToSize(title, 178), 14, 21);
  doc.setTextColor(222, 232, 219); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`Prepared ${new Date().toLocaleDateString('en-IN')}  |  ${clean(project.type || 'interior').toUpperCase()} DESIGN`, 14, 30);

  const photoSlots = referencePhoto
    ? [{ label: 'ORIGINAL PHOTO', image: originalPhoto, x: 14, width: 56 }, { label: 'AI REDESIGN', image: designPhoto, x: 75, width: 56 }, { label: 'REFERENCE PHOTO', image: referencePhoto, x: 136, width: 56 }]
    : [{ label: 'ORIGINAL PHOTO', image: originalPhoto, x: 14, width: 88 }, { label: 'AI REDESIGN', image: designPhoto, x: 108, width: 88 }];
  for (const slot of photoSlots) {
    doc.setFillColor(248, 249, 245); doc.roundedRect(slot.x, 40, slot.width, 65, 3, 3, 'F');
    doc.setTextColor(75, 91, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(slot.label, slot.x + 4, 46);
    if (slot.image) addContainedImage(doc, slot.image, slot.x + 4, 49, slot.width - 8, 51);
    else {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(139, 147, 136);
      doc.text(doc.splitTextToSize(slot.label === 'AI REDESIGN' ? 'No AI design image attached' : `No ${slot.label.toLowerCase()} attached`, slot.width - 8), slot.x + 4, 78);
    }
  }

  sectionTitle(doc, 'Design preferences', 114);
  const preferenceRows = [
    ['Mode / room', `${details.mode || project.type || 'Interior'} / ${details.roomType || project.roomType || project.room || 'Not specified'}`,
      'Style', details.style || project.style || 'Not specified'],
    ['Colour palette', details.palette || project.palette || 'Not specified', 'Budget guide', details.budget || project.budget || 'Not specified'],
    ['Layout', details.layout || project.layout || 'Not recorded',
      'Door / window openings', `${details.doors ?? project.doors ?? 'Not recorded'} doors / ${details.windows ?? project.windows ?? 'Not recorded'} windows`],
  ];
  let prefY = 122;
  for (const [labelA, valueA, labelB, valueB] of preferenceRows) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(125, 135, 121); doc.text(clean(labelA), 14, prefY); doc.text(clean(labelB), 108, prefY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 67, 51);
    doc.text(doc.splitTextToSize(clean(valueA), 82), 14, prefY + 5); doc.text(doc.splitTextToSize(clean(valueB), 82), 108, prefY + 5);
    prefY += 13;
  }
  if (details.instructions || project.prompt) {
    const instructionLines = doc.splitTextToSize(clean(details.instructions || project.prompt), 180);
    let instructionY = prefY + 5;
    if (instructionY + instructionLines.length * 4 > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage();
      instructionY = 24;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(125, 135, 121); doc.text('CUSTOM INSTRUCTIONS', 14, prefY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 67, 51);
    if (instructionY === 24) doc.text('CUSTOM INSTRUCTIONS (continued)', 14, 18);
    doc.text(instructionLines, 14, instructionY);
    prefY = instructionY + instructionLines.length * 4;
  }

  let measurementY = ensureSectionSpace(doc, prefY + 4, 55);
  sectionTitle(doc, 'Room measurements & renovation', measurementY);
  const measureText = measurements
    ? `${quantity(measurements.length)} x ${quantity(measurements.width)} x ${quantity(measurements.height)} ${measurements.unit || 'ft'}  |  ${clean(measurements.city || 'City not set')}${measurements.openingsArea > 0 ? `  |  Openings: ${quantity(measurements.openingsArea)} sq. ft.` : ''}`
    : project.room || 'Measurements have not been attached to this project.';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 67, 51);
  doc.text(clean(measureText), 14, measurementY + 9);
  const renovationText = report ? `${report.renovationType}  |  ${report.quality} quality` : 'Renovation scope and quality have not been attached.';
  doc.setTextColor(102, 114, 101); doc.text(clean(renovationText), 14, measurementY + 14);

  let tableY = measurementY + 23;
  if (report) {
    tableY = ensureSectionSpace(doc, tableY, 30);
    sectionTitle(doc, 'Indicative renovation cost', tableY);
    tableY += 5;
    autoTable(doc, {
      startY: tableY,
      head: [['LOW ESTIMATE', 'EXPECTED', 'HIGH ESTIMATE']],
      body: [[money(report.low), money(report.expected), money(report.high)]],
      theme: 'grid', styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: [48, 67, 51], lineColor: [227, 231, 223] },
      headStyles: { fillColor: [238, 243, 233], textColor: [55, 78, 54], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    let itemY = ensureSectionSpace(doc, doc.lastAutoTable.finalY + 7, 38);
    sectionTitle(doc, 'Itemized quantities & costs (INR)', itemY); itemY += 4;
    autoTable(doc, {
      startY: itemY,
      head: [['Item', 'Quantity', 'Assumed rate', 'Low / Expected / High']],
      body: (report.items || []).map((item) => [clean(item.name), `${quantity(item.quantity)} ${clean(item.unit)}`, money(item.unitRate), `${money(item.low)} / ${money(item.expected)} / ${money(item.high)}`]),
      theme: 'striped', styles: { font: 'helvetica', fontSize: 6, cellPadding: 1.5, minCellWidth: 4, textColor: [52, 68, 53], lineColor: [232, 235, 229] },
      headStyles: { fillColor: [43, 76, 53], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 32 }, 2: { cellWidth: 28 }, 3: { cellWidth: 72 } },
      margin: { left: 14, right: 14 },
    });
    let materialY = ensureSectionSpace(doc, doc.lastAutoTable.finalY + 8, 38);
    sectionTitle(doc, 'Material shopping list', materialY); materialY += 4;
    autoTable(doc, {
      startY: materialY,
      head: [['Material / item', 'Quantity to plan for']],
      body: (report.shoppingList || []).length
        ? report.shoppingList.map((item) => [clean(item.name), `${quantity(item.quantity)} ${clean(item.unit)}`])
        : [['No material list attached', '']],
      theme: 'grid', styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.8, textColor: [52, 68, 53], lineColor: [232, 235, 229] },
      headStyles: { fillColor: [238, 243, 233], textColor: [55, 78, 54], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    let noteY = ensureSectionSpace(doc, doc.lastAutoTable.finalY + 7, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(112, 122, 109);
    if (report.assumptions?.length) {
      sectionTitle(doc, 'Planning assumptions', noteY);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(102, 114, 101);
      const assumptionText = report.assumptions.map((line) => `- ${clean(line)}`).join('\n');
      const assumptionLines = doc.splitTextToSize(assumptionText, 180);
      let assumptionY = noteY + 7;
      if (assumptionY + assumptionLines.length * 3.4 > doc.internal.pageSize.getHeight() - 24) { doc.addPage(); assumptionY = 20; }
      doc.text(assumptionLines, 14, assumptionY);
      noteY = assumptionY + assumptionLines.length * 3.4 + 4;
    }
    doc.text(doc.splitTextToSize('Tax is an editable planning allowance, not a GST determination. Actual tax treatment depends on goods, services and contract terms. Confirm locally before committing.', 180), 14, ensureSectionSpace(doc, noteY + 6, 18));
  } else {
    sectionTitle(doc, 'Renovation cost & materials', tableY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(102, 114, 101);
    doc.text(project.estimate != null ? `Saved estimate: ${money(project.estimate)} (range and itemized details not attached)` : 'No renovation estimate or material list has been attached yet.', 14, tableY + 9);
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(228, 231, 225); doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(124, 132, 122);
    doc.text('Indicative planning report only. Not a guaranteed contractor quote.', 14, pageHeight - 9);
    doc.text(`Page ${page} of ${pages}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'home-project';
  return { blob: doc.output('blob'), filename: `dreamspace-${slug}-report.pdf` };
}
