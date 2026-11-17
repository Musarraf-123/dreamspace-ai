export const CITIES = {
  Pune: 1.00,
  Mumbai: 1.16,
  Bengaluru: 1.08,
  Delhi: 1.10,
  Hyderabad: 1.02,
  Chennai: 1.04,
  Kolkata: 0.98,
  Jaipur: 0.92,
  Ahmedabad: 0.97,
  Lucknow: 0.90,
};

export const RENOVATION_TYPES = {
  'Full room renovation': 'A complete finish refresh with furniture and fittings.',
  'Paint refresh': 'Wall paint and labour, plus transport and allowances.',
  'Flooring + paint': 'Wall paint, new floor finish and associated labour.',
  'Kitchen renovation': 'Kitchen finishes, storage, lighting and installation.',
  'Bathroom renovation': 'Wall and floor tiles, ceiling, fittings and installation.',
};

export const QUALITY_LEVELS = {
  Basic: true,
  Standard: true,
  Premium: true,
};

export const DEFAULT_ALLOWANCES = { contingencyPercent: 10, taxPercent: 18 };

const categories = [
  { key: 'paint', name: 'Paint & primer', unit: 'litre', kind: 'material', rate: { Basic: 250, Standard: 390, Premium: 680 }, lowFactor: 0.88, highFactor: 1.18 },
  { key: 'tiles', name: 'Wall tiles', unit: 'sq. ft.', kind: 'material', rate: { Basic: 55, Standard: 105, Premium: 190 }, lowFactor: 0.84, highFactor: 1.28 },
  { key: 'flooring', name: 'Flooring', unit: 'sq. ft.', kind: 'material', rate: { Basic: 75, Standard: 145, Premium: 290 }, lowFactor: 0.84, highFactor: 1.30 },
  { key: 'furniture', name: 'Furniture allowance', unit: 'room allowance', kind: 'material', rate: { Basic: 18000, Standard: 48000, Premium: 115000 }, lowFactor: 0.85, highFactor: 1.25 },
  { key: 'lights', name: 'Lights & electrical fittings', unit: 'point', kind: 'material', rate: { Basic: 1100, Standard: 2800, Premium: 6500 }, lowFactor: 0.84, highFactor: 1.28 },
  { key: 'ceiling', name: 'Ceiling finish', unit: 'sq. ft.', kind: 'material', rate: { Basic: 75, Standard: 135, Premium: 245 }, lowFactor: 0.84, highFactor: 1.28 },
  { key: 'carpentry', name: 'Carpentry & storage', unit: 'sq. ft. allowance', kind: 'material', rate: { Basic: 420, Standard: 900, Premium: 1850 }, lowFactor: 0.82, highFactor: 1.30 },
  { key: 'sanitary', name: 'Sanitaryware & fixtures', unit: 'bathroom allowance', kind: 'material', rate: { Basic: 12000, Standard: 28000, Premium: 65000 }, lowFactor: 0.85, highFactor: 1.25 },
  { key: 'painter', name: 'Painting labour', unit: 'wall sq. ft.', kind: 'labour', rate: { Basic: 18, Standard: 28, Premium: 42 }, lowFactor: 0.85, highFactor: 1.20 },
  { key: 'carpenter', name: 'Carpentry labour', unit: 'floor sq. ft.', kind: 'labour', rate: { Basic: 65, Standard: 110, Premium: 175 }, lowFactor: 0.82, highFactor: 1.22 },
  { key: 'electrician', name: 'Electrical labour', unit: 'point', kind: 'labour', rate: { Basic: 320, Standard: 520, Premium: 850 }, lowFactor: 0.84, highFactor: 1.24 },
  { key: 'plumber', name: 'Plumbing & sanitary labour', unit: 'room allowance', kind: 'labour', rate: { Basic: 3500, Standard: 6500, Premium: 12000 }, lowFactor: 0.84, highFactor: 1.24 },
  { key: 'installation', name: 'Installation & finishing', unit: 'floor sq. ft.', kind: 'labour', rate: { Basic: 40, Standard: 65, Premium: 105 }, lowFactor: 0.85, highFactor: 1.20 },
  { key: 'transport', name: 'Transport & site handling', unit: 'trip allowance', kind: 'service', rate: { Basic: 2500, Standard: 4500, Premium: 8000 }, lowFactor: 0.85, highFactor: 1.25 },
];

function roundQuantity(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function validateMeasurements(input) {
  const errors = {};
  const dimensions = [
    ['length', 'Room length', 3, 60],
    ['width', 'Room width', 3, 60],
    ['height', 'Ceiling height', 7, 20],
  ];
  for (const [key, label, min, max] of dimensions) {
    const value = Number(input?.[key]);
    if (!Number.isFinite(value) || value < min || value > max) errors[key] = `${label} must be between ${min} and ${max} ft.`;
  }
  const openingsRaw = input?.openingsArea;
  const openingsArea = openingsRaw === '' || openingsRaw === undefined || openingsRaw === null ? 0 : Number(openingsRaw);
  if (!Number.isFinite(openingsArea) || openingsArea < 0 || openingsArea > 500) errors.openingsArea = 'Door and window opening area must be between 0 and 500 sq. ft.';
  if (!Object.hasOwn(CITIES, input?.city)) errors.city = 'Choose a city from the list.';
  if (!Object.hasOwn(RENOVATION_TYPES, input?.renovationType)) errors.renovationType = 'Choose a renovation type.';
  if (!Object.hasOwn(QUALITY_LEVELS, input?.quality)) errors.quality = 'Choose a quality level.';
  if (!errors.length && !errors.width && Number(input.length) * Number(input.width) > 2000) {
    errors.length = 'Room floor area must be 2,000 sq. ft. or less.';
  }
  if (!errors.length && !errors.width && !errors.height && !errors.openingsArea) {
    const grossWallArea = 2 * (Number(input.length) + Number(input.width)) * Number(input.height);
    if (openingsArea > grossWallArea) errors.openingsArea = 'Opening area cannot be larger than the room wall area.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function quantitiesFor({ length, width, height, openingsArea, renovationType }) {
  const floorArea = length * width;
  const perimeter = 2 * (length + width);
  const grossWallArea = perimeter * height;
  const netWallArea = Math.max(0, grossWallArea - openingsArea);
  const isFull = renovationType === 'Full room renovation';
  const isPaint = renovationType === 'Paint refresh';
  const isFloorPaint = renovationType === 'Flooring + paint';
  const isKitchen = renovationType === 'Kitchen renovation';
  const isBathroom = renovationType === 'Bathroom renovation';
  const wallTileArea = isBathroom ? netWallArea * 0.68 : isKitchen ? Math.min(netWallArea * 0.2, perimeter * 1.5) : 0;
  const paintArea = Math.max(0, netWallArea - wallTileArea);
  const hasPaint = isFull || isPaint || isFloorPaint || isKitchen || isBathroom;
  const scope = isFull || isKitchen || isBathroom;
  const flooring = isFull || isFloorPaint || isKitchen || isBathroom ? floorArea * 1.1 : 0;
  const lights = scope ? Math.max(1, Math.ceil(floorArea / 100)) : 0;
  const carpentry = isFull ? floorArea * 0.18 : isKitchen ? floorArea * 0.36 : isBathroom ? floorArea * 0.05 : 0;

  return {
    floorArea,
    grossWallArea,
    netWallArea,
    paintArea,
    paint: hasPaint ? paintArea * 2.2 / 100 : 0,
    tiles: wallTileArea * 1.1,
    flooring,
    furniture: isFull || isKitchen ? 1 : 0,
    lights,
    ceiling: scope ? floorArea : 0,
    carpentry,
    sanitary: isBathroom ? 1 : 0,
    painter: hasPaint ? paintArea : 0,
    carpenter: carpentry,
    electrician: lights,
    plumber: isKitchen || isBathroom ? 1 : 0,
    installation: scope ? floorArea : 0,
    transport: 1,
  };
}

/** Pure calculator. Rates are INR; measurements and generated quantities are in feet/sq. ft. */
export function calculateRenovationEstimate(input, { quantityOverrides = {}, rateOverrides = {}, contingencyPercent = DEFAULT_ALLOWANCES.contingencyPercent, taxPercent = DEFAULT_ALLOWANCES.taxPercent, rateCard = null } = {}) {
  const validation = validateMeasurements(input);
  for (const [key, value] of Object.entries({ ...quantityOverrides, ...rateOverrides })) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1_000_000) validation.errors[`override-${key}`] = 'Enter an amount from 0 to 1,000,000.';
  }
  for (const [key, value, maximum] of [['contingency', contingencyPercent, 50], ['tax', taxPercent, 40]]) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > maximum) validation.errors[key] = `Enter a percentage from 0 to ${maximum}.`;
  }
  validation.valid = Object.keys(validation.errors).length === 0;
  if (!validation.valid) return { ...validation, rows: [], totals: null, shoppingList: [], assumptions: [] };

  const length = Number(input.length);
  const width = Number(input.width);
  const height = Number(input.height);
  const openingsArea = input.openingsArea === '' || input.openingsArea === undefined || input.openingsArea === null ? 0 : Number(input.openingsArea);
  const quantities = quantitiesFor({ length, width, height, openingsArea, renovationType: input.renovationType });
  const cityFactor = CITIES[input.city];
  const cardByKey = rateCard?.categories ? Object.fromEntries(rateCard.categories.map((category) => [category.key, category])) : {};
  const rows = categories.map((category) => {
    const card = cardByKey[category.key];
    const defaultRate = Number.isFinite(Number(card?.rate)) ? Number(card.rate) : category.rate[input.quality] * cityFactor;
    const lowFactor = Number.isFinite(Number(card?.lowFactor)) ? Number(card.lowFactor) : category.lowFactor;
    const highFactor = Number.isFinite(Number(card?.highFactor)) ? Number(card.highFactor) : category.highFactor;
    const rate = roundQuantity(Number(rateOverrides[category.key] ?? defaultRate), 2);
    const quantity = Number(quantityOverrides[category.key] ?? quantities[category.key] ?? 0);
    const lowRate = rate * lowFactor;
    const highRate = rate * highFactor;
    return {
      ...category,
      quantity: roundQuantity(quantity, category.key === 'paint' ? 1 : 2),
      rate: roundQuantity(rate, 2),
      lowRate: roundQuantity(lowRate, 2),
      highRate: roundQuantity(highRate, 2),
      low: quantity * lowRate,
      expected: quantity * rate,
      high: quantity * highRate,
      editable: true,
    };
  });

  const base = rows.reduce((sum, row) => ({ low: sum.low + row.low, expected: sum.expected + row.expected, high: sum.high + row.high }), { low: 0, expected: 0, high: 0 });
  const contingencyRate = Math.max(0, Math.min(50, Number(contingencyPercent)));
  const taxRate = Math.max(0, Math.min(40, Number(taxPercent)));
  const allowanceRow = (key, name, percent, basis, order) => {
    const quantity = Math.max(0, Number(quantityOverrides[key] ?? percent));
    const defaultRate = basis.expected / 100;
    const rate = roundQuantity(Number(rateOverrides[key] ?? defaultRate), 2);
    const lowRate = basis.expected ? rate * (basis.low / basis.expected) : rate;
    const highRate = basis.expected ? rate * (basis.high / basis.expected) : rate;
    return {
      key, name, unit: '% of subtotal', kind: 'allowance', quantity: roundQuantity(quantity, 1), rate: roundQuantity(rate, 2),
      lowRate: roundQuantity(lowRate, 2), highRate: roundQuantity(highRate, 2),
      low: quantity * lowRate, expected: quantity * rate, high: quantity * highRate,
      editable: true, order,
    };
  };
  const contingency = allowanceRow('contingency', 'Contingency allowance', contingencyRate, base, 0);
  const taxBasis = {
    low: base.low + contingency.low,
    expected: base.expected + contingency.expected,
    high: base.high + contingency.high,
  };
  const taxes = allowanceRow('taxes', 'Tax allowance (indicative)', taxRate, taxBasis, 1);
  rows.push(taxes, contingency);

  const totals = {
    low: Math.round(rows.reduce((sum, row) => sum + row.low, 0)),
    expected: Math.round(rows.reduce((sum, row) => sum + row.expected, 0)),
    high: Math.round(rows.reduce((sum, row) => sum + row.high, 0)),
    subtotal: Math.round(base.expected),
  };
  const shoppingList = rows.filter((row) => row.kind === 'material' && row.quantity > 0).map((row) => ({ key: row.key, name: row.name, quantity: row.quantity, unit: row.unit }));
  const rateSource = rateCard?.effectiveDate
    ? `Planning rates dated ${rateCard.effectiveDate} (${rateCard.source || 'DreamSpace allowances'}) adjusted for ${input.city} and ${input.quality} quality; confirm current local supplier and contractor prices.`
    : `Rates are planning allowances adjusted for ${input.city} and ${input.quality} quality; confirm current local supplier and contractor prices.`;
  return {
    valid: true,
    errors: {},
    rows,
    totals,
    shoppingList,
    dimensions: {
      floorArea: roundQuantity(quantities.floorArea, 1),
      wallArea: roundQuantity(quantities.netWallArea, 1),
      grossWallArea: roundQuantity(quantities.grossWallArea, 1),
      openingsArea: roundQuantity(openingsArea, 1),
    },
    assumptions: [
      'Wall area uses room perimeter × height, minus the door and window opening area you enter.',
      'Paint quantity assumes two coats, about 100 sq. ft. per litre per coat, plus 10% for wastage.',
      'Tile and flooring quantities include 10% cutting/wastage allowance. Bathroom wall tile coverage assumes 68%; kitchen backsplash assumes a 1.5 ft band.',
      'Labour is split into painting, carpentry, electrical, plumbing and installation lines so each can be quoted separately.',
      rateSource,
      `Tax is modeled as an editable ${roundQuantity(Number(quantityOverrides.taxes ?? taxRate), 1)}% planning allowance. Actual GST depends on the goods, service and contract; verify with your contractor.`,
    ],
  };
}
