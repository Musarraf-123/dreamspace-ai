import { Router } from 'express';
import { z } from 'zod';
import RateCard from '../models/RateCard.js';
import Material from '../models/Material.js';
import {
  CITY_FACTORS, QUALITY_LEVELS, RATE_CARD_EFFECTIVE_DATE, RATE_CARD_SOURCE, RATE_CATEGORIES, materialsFor, rateCardsFor,
} from '../data/rateCatalog.js';

const router = Router();
const querySchema = z.object({
  city: z.enum(Object.keys(CITY_FACTORS)),
  quality: z.enum(QUALITY_LEVELS),
});
const tierOrder = { Basic: 1, Standard: 2, Premium: 3 };
const categoryNames = Object.fromEntries(RATE_CATEGORIES.map((category) => [category.key, category.name]));
const round = (value) => Math.round(value * 100) / 100;

function slimCard(card) {
  return {
    key: card.key, name: card.name, kind: card.kind, unit: card.unit,
    rate: card.rate, lowFactor: card.lowFactor, highFactor: card.highFactor,
  };
}

function slimMaterial(material, cityFactor, quality) {
  if (tierOrder[material.tier] > tierOrder[quality]) return null;
  return {
    sku: material.sku,
    name: material.name,
    brand: material.brand,
    category: material.category,
    categoryName: categoryNames[material.category] || material.category,
    unit: material.unit,
    tier: material.tier,
    rate: round(Number(material.rate) * cityFactor),
    effectiveDate: material.effectiveDate,
  };
}

router.get('/', async (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a supported city and quality level.' });
  const { city, quality } = parsed.data;
  const cityFactor = CITY_FACTORS[city];
  let categories;
  let materials;
  let effectiveDate = RATE_CARD_EFFECTIVE_DATE;
  let source = RATE_CARD_SOURCE;
  try {
    const [cards, rows] = await Promise.all([
      RateCard.find({ city, quality }).lean(),
      Material.find({}).lean(),
    ]);
    categories = cards.length ? cards.map(slimCard) : rateCardsFor(city, quality);
    materials = (rows.length ? rows : materialsFor(city))
      .map((material) => slimMaterial(material, cityFactor, quality))
      .filter(Boolean);
    if (cards[0]?.effectiveDate) effectiveDate = cards[0].effectiveDate;
    if (cards[0]?.source) source = cards[0].source;
  } catch {
    categories = rateCardsFor(city, quality);
    materials = materialsFor(city).map((material) => slimMaterial(material, cityFactor, quality)).filter(Boolean);
  }
  return res.json({ data: { city, quality, effectiveDate, source, categories, materials } });
});

export default router;
