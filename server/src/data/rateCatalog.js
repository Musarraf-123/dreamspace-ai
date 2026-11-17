export const RATE_CARD_EFFECTIVE_DATE = '2026-11-01';
export const RATE_CARD_SOURCE = 'DreamSpace planning allowance (illustrative, not live supplier data)';

export const CITY_FACTORS = {
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

export const QUALITY_LEVELS = ['Basic', 'Standard', 'Premium'];

export const RATE_CATEGORIES = [
  { key: 'paint', name: 'Paint & primer', kind: 'material', unit: 'litre', rate: { Basic: 250, Standard: 390, Premium: 680 }, lowFactor: 0.88, highFactor: 1.18 },
  { key: 'tiles', name: 'Wall tiles', kind: 'material', unit: 'sq. ft.', rate: { Basic: 55, Standard: 105, Premium: 190 }, lowFactor: 0.84, highFactor: 1.28 },
  { key: 'flooring', name: 'Flooring', kind: 'material', unit: 'sq. ft.', rate: { Basic: 75, Standard: 145, Premium: 290 }, lowFactor: 0.84, highFactor: 1.30 },
  { key: 'furniture', name: 'Furniture allowance', kind: 'material', unit: 'room allowance', rate: { Basic: 18000, Standard: 48000, Premium: 115000 }, lowFactor: 0.85, highFactor: 1.25 },
  { key: 'lights', name: 'Lights & electrical fittings', kind: 'material', unit: 'point', rate: { Basic: 1100, Standard: 2800, Premium: 6500 }, lowFactor: 0.84, highFactor: 1.28 },
  { key: 'ceiling', name: 'Ceiling finish', kind: 'material', unit: 'sq. ft.', rate: { Basic: 75, Standard: 135, Premium: 245 }, lowFactor: 0.84, highFactor: 1.28 },
  { key: 'carpentry', name: 'Carpentry & storage', kind: 'material', unit: 'sq. ft. allowance', rate: { Basic: 420, Standard: 900, Premium: 1850 }, lowFactor: 0.82, highFactor: 1.30 },
  { key: 'sanitary', name: 'Sanitaryware & fixtures', kind: 'material', unit: 'bathroom allowance', rate: { Basic: 12000, Standard: 28000, Premium: 65000 }, lowFactor: 0.85, highFactor: 1.25 },
  { key: 'painter', name: 'Painting labour', kind: 'labour', unit: 'wall sq. ft.', rate: { Basic: 18, Standard: 28, Premium: 42 }, lowFactor: 0.85, highFactor: 1.20 },
  { key: 'carpenter', name: 'Carpentry labour', kind: 'labour', unit: 'floor sq. ft.', rate: { Basic: 65, Standard: 110, Premium: 175 }, lowFactor: 0.82, highFactor: 1.22 },
  { key: 'electrician', name: 'Electrical labour', kind: 'labour', unit: 'point', rate: { Basic: 320, Standard: 520, Premium: 850 }, lowFactor: 0.84, highFactor: 1.24 },
  { key: 'plumber', name: 'Plumbing & sanitary labour', kind: 'labour', unit: 'room allowance', rate: { Basic: 3500, Standard: 6500, Premium: 12000 }, lowFactor: 0.84, highFactor: 1.24 },
  { key: 'installation', name: 'Installation & finishing', kind: 'labour', unit: 'floor sq. ft.', rate: { Basic: 40, Standard: 65, Premium: 105 }, lowFactor: 0.85, highFactor: 1.20 },
  { key: 'transport', name: 'Transport & site handling', kind: 'service', unit: 'trip allowance', rate: { Basic: 2500, Standard: 4500, Premium: 8000 }, lowFactor: 0.85, highFactor: 1.25 },
];

export const MATERIAL_CATALOG = [
  { sku: 'paint-tractor', name: 'Tractor Emulsion', brand: 'Asian Paints', category: 'paint', unit: 'litre', tier: 'Basic', rate: 285 },
  { sku: 'paint-apcolite', name: 'Apcolite Premium Emulsion', brand: 'Asian Paints', category: 'paint', unit: 'litre', tier: 'Standard', rate: 395 },
  { sku: 'paint-royale', name: 'Royale Luxury Emulsion', brand: 'Asian Paints', category: 'paint', unit: 'litre', tier: 'Premium', rate: 640 },
  { sku: 'tile-somany', name: 'Duragres Wall Tile', brand: 'Somany', category: 'tiles', unit: 'sq. ft.', tier: 'Basic', rate: 58 },
  { sku: 'tile-kajaria', name: 'Eternity Wall Tile', brand: 'Kajaria', category: 'tiles', unit: 'sq. ft.', tier: 'Standard', rate: 108 },
  { sku: 'tile-johnson', name: 'Marble Look Wall Tile', brand: 'Johnson', category: 'tiles', unit: 'sq. ft.', tier: 'Premium', rate: 195 },
  { sku: 'floor-vitrified', name: 'Vitrified Floor Tile 600x600', brand: 'Kajaria', category: 'flooring', unit: 'sq. ft.', tier: 'Basic', rate: 78 },
  { sku: 'floor-engineered', name: 'Engineered Wood Plank', brand: 'Pergo', category: 'flooring', unit: 'sq. ft.', tier: 'Standard', rate: 185 },
  { sku: 'floor-marble', name: 'Italian Marble', brand: 'Classic Marble', category: 'flooring', unit: 'sq. ft.', tier: 'Premium', rate: 345 },
  { sku: 'furniture-basic', name: 'Essential furniture package', brand: 'DreamSpace Studio', category: 'furniture', unit: 'room allowance', tier: 'Basic', rate: 18000 },
  { sku: 'furniture-standard', name: 'Balanced furniture package', brand: 'DreamSpace Studio', category: 'furniture', unit: 'room allowance', tier: 'Standard', rate: 48000 },
  { sku: 'furniture-premium', name: 'Bespoke furniture package', brand: 'DreamSpace Studio', category: 'furniture', unit: 'room allowance', tier: 'Premium', rate: 115000 },
  { sku: 'light-wipro', name: 'LED point package', brand: 'Wipro', category: 'lights', unit: 'point', tier: 'Basic', rate: 1100 },
  { sku: 'light-philips', name: 'Designer fitting package', brand: 'Philips', category: 'lights', unit: 'point', tier: 'Standard', rate: 2800 },
  { sku: 'light-havells', name: 'Luxe lighting package', brand: 'Havells', category: 'lights', unit: 'point', tier: 'Premium', rate: 6500 },
  { sku: 'ceiling-pop', name: 'POP ceiling', brand: 'Saint-Gobain', category: 'ceiling', unit: 'sq. ft.', tier: 'Basic', rate: 78 },
  { sku: 'ceiling-gypsum', name: 'Gypsum ceiling', brand: 'Saint-Gobain', category: 'ceiling', unit: 'sq. ft.', tier: 'Standard', rate: 135 },
  { sku: 'ceiling-cove', name: 'Cove ceiling with profile lighting', brand: 'Saint-Gobain', category: 'ceiling', unit: 'sq. ft.', tier: 'Premium', rate: 250 },
  { sku: 'carpentry-ply', name: 'Plywood storage', brand: 'Century', category: 'carpentry', unit: 'sq. ft. allowance', tier: 'Basic', rate: 420 },
  { sku: 'carpentry-modular', name: 'Modular storage', brand: 'Godrej Interio', category: 'carpentry', unit: 'sq. ft. allowance', tier: 'Standard', rate: 900 },
  { sku: 'carpentry-veneer', name: 'Bespoke veneer storage', brand: 'DreamSpace Studio', category: 'carpentry', unit: 'sq. ft. allowance', tier: 'Premium', rate: 1850 },
  { sku: 'sanitary-cera', name: 'Cera essentials set', brand: 'Cera', category: 'sanitary', unit: 'bathroom allowance', tier: 'Basic', rate: 12000 },
  { sku: 'sanitary-jaquar', name: 'Jaquar premium set', brand: 'Jaquar', category: 'sanitary', unit: 'bathroom allowance', tier: 'Standard', rate: 28000 },
  { sku: 'sanitary-kohler', name: 'Kohler luxe set', brand: 'Kohler', category: 'sanitary', unit: 'bathroom allowance', tier: 'Premium', rate: 65000 },
];

const round = (value) => Math.round(value * 100) / 100;

export function rateCardsFor(city, quality) {
  const cityFactor = CITY_FACTORS[city] ?? 1;
  return RATE_CATEGORIES.map((category) => ({
    key: category.key,
    name: category.name,
    kind: category.kind,
    unit: category.unit,
    city,
    quality,
    rate: round(category.rate[quality] * cityFactor),
    lowFactor: category.lowFactor,
    highFactor: category.highFactor,
    effectiveDate: RATE_CARD_EFFECTIVE_DATE,
    source: RATE_CARD_SOURCE,
  }));
}

export function buildRateCards() {
  return Object.keys(CITY_FACTORS).flatMap((city) => QUALITY_LEVELS.flatMap((quality) => rateCardsFor(city, quality)));
}

export function materialsFor(city) {
  const cityFactor = CITY_FACTORS[city] ?? 1;
  return MATERIAL_CATALOG.map((material) => ({
    ...material,
    rate: round(material.rate * cityFactor),
    effectiveDate: RATE_CARD_EFFECTIVE_DATE,
    source: RATE_CARD_SOURCE,
  }));
}
