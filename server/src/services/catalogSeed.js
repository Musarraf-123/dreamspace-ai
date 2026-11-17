import RateCard from '../models/RateCard.js';
import Material from '../models/Material.js';
import { buildRateCards, MATERIAL_CATALOG, RATE_CARD_EFFECTIVE_DATE, RATE_CARD_SOURCE } from '../data/rateCatalog.js';

export async function seedCatalog() {
  const rateCards = buildRateCards();
  if (rateCards.length) {
    await RateCard.bulkWrite(rateCards.map((card) => ({
      updateOne: { filter: { city: card.city, quality: card.quality, key: card.key }, update: { $set: card }, upsert: true },
    })), { ordered: false });
  }
  if (MATERIAL_CATALOG.length) {
    await Material.bulkWrite(MATERIAL_CATALOG.map((material) => ({
      updateOne: {
        filter: { sku: material.sku },
        update: { $set: { ...material, effectiveDate: RATE_CARD_EFFECTIVE_DATE, source: RATE_CARD_SOURCE } },
        upsert: true,
      },
    })), { ordered: false });
  }
  return { rateCards: rateCards.length, materials: MATERIAL_CATALOG.length };
}
