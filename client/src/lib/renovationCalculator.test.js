import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateRenovationEstimate, validateMeasurements } from './renovationCalculator.js';

const standardRoom = { length: 14, width: 12, height: 10, city: 'Pune', renovationType: 'Full room renovation', quality: 'Standard' };

test('validates plausible room measurements and rejects out-of-range dimensions', () => {
  assert.equal(validateMeasurements(standardRoom).valid, true);
  assert.equal(validateMeasurements({ ...standardRoom, length: 2 }).errors.length, 'Room length must be between 3 and 60 ft.');
  assert.match(validateMeasurements({ ...standardRoom, height: 21 }).errors.height, /between 7 and 20 ft/);
  assert.match(validateMeasurements({ ...standardRoom, length: 60, width: 60 }).errors.length, /2,000 sq. ft. or less/);
  assert.match(validateMeasurements({ ...standardRoom, city: 'Not a city' }).errors.city, /Choose a city/);
  assert.match(validateMeasurements({ ...standardRoom, openingsArea: -1 }).errors.openingsArea, /between 0 and 500/);
  assert.match(validateMeasurements({ ...standardRoom, openingsArea: 600 }).errors.openingsArea, /between 0 and 500/);
  assert.match(validateMeasurements({ ...standardRoom, length: 3, width: 3, openingsArea: 130 }).errors.openingsArea, /cannot be larger/);
});

test('subtracts door and window openings from wall, paint and painting-labour quantities', () => {
  const base = calculateRenovationEstimate(standardRoom);
  const withOpenings = calculateRenovationEstimate({ ...standardRoom, openingsArea: 40 });
  assert.equal(withOpenings.dimensions.grossWallArea, 520);
  assert.equal(withOpenings.dimensions.wallArea, 480);
  assert.equal(withOpenings.dimensions.openingsArea, 40);
  assert.equal(withOpenings.rows.find((row) => row.key === 'painter').quantity, 480);
  assert.ok(withOpenings.rows.find((row) => row.key === 'paint').quantity < base.rows.find((row) => row.key === 'paint').quantity);
});

test('calculates wall paint, floor waste, allowances and low/expected/high totals', () => {
  const result = calculateRenovationEstimate(standardRoom);
  assert.equal(result.valid, true);
  assert.deepEqual(result.dimensions, { floorArea: 168, wallArea: 520, grossWallArea: 520, openingsArea: 0 });
  assert.equal(result.rows.find((row) => row.key === 'paint').quantity, 11.4);
  assert.equal(result.rows.find((row) => row.key === 'flooring').quantity, 184.8);
  assert.equal(result.rows.find((row) => row.key === 'tiles').quantity, 0);
  const contingency = result.rows.find((row) => row.key === 'contingency');
  const tax = result.rows.find((row) => row.key === 'taxes');
  assert.equal(contingency.expected, contingency.quantity * contingency.rate);
  assert.equal(tax.expected, tax.quantity * tax.rate);
  assert.ok(contingency.quantity * contingency.rate > result.totals.subtotal * 0.09);
  assert.ok(tax.quantity * tax.rate > result.totals.subtotal * 0.17);
  assert.ok(result.totals.low < result.totals.expected);
  assert.ok(result.totals.expected < result.totals.high);
  assert.ok(result.shoppingList.some((item) => item.key === 'paint'));
});

test('splits labour into painter, carpenter, electrician, plumber and installation lines', () => {
  const result = calculateRenovationEstimate(standardRoom);
  for (const key of ['painter', 'carpenter', 'electrician', 'installation', 'transport']) {
    assert.ok(result.rows.find((row) => row.key === key), `${key} row should exist`);
  }
  assert.equal(result.rows.find((row) => row.key === 'plumber').quantity, 0);
  const bathroom = calculateRenovationEstimate({ ...standardRoom, renovationType: 'Bathroom renovation' });
  assert.equal(bathroom.rows.find((row) => row.key === 'plumber').quantity, 1);
  assert.ok(bathroom.shoppingList.some((item) => item.key === 'sanitary'));
});

test('applies kitchen and bathroom scope quantities without double-counting the floor', () => {
  const kitchen = calculateRenovationEstimate({ ...standardRoom, renovationType: 'Kitchen renovation' });
  const bath = calculateRenovationEstimate({ ...standardRoom, renovationType: 'Bathroom renovation' });
  assert.ok(kitchen.rows.find((row) => row.key === 'tiles').quantity > 0);
  assert.equal(kitchen.rows.find((row) => row.key === 'flooring').quantity, 184.8);
  assert.ok(bath.rows.find((row) => row.key === 'tiles').quantity > kitchen.rows.find((row) => row.key === 'tiles').quantity);
  assert.equal(bath.rows.find((row) => row.key === 'furniture').quantity, 0);
});

test('uses dated API rate-card rates when supplied and falls back per category', () => {
  const rateCard = {
    effectiveDate: '2026-11-01',
    source: 'Test rate card',
    categories: [
      { key: 'flooring', rate: 500, lowFactor: 0.8, highFactor: 1.2 },
      { key: 'paint', rate: 100, lowFactor: 0.9, highFactor: 1.1 },
    ],
  };
  const result = calculateRenovationEstimate(standardRoom, { rateCard });
  const flooring = result.rows.find((row) => row.key === 'flooring');
  const paint = result.rows.find((row) => row.key === 'paint');
  const tiles = result.rows.find((row) => row.key === 'tiles');
  assert.equal(flooring.rate, 500);
  assert.equal(flooring.lowRate, 400);
  assert.equal(paint.rate, 100);
  assert.equal(tiles.rate, 105);
  assert.match(result.assumptions.join(' '), /2026-11-01/);
});

test('edited quantity and unit rate flow through the estimate and shopping list', () => {
  const result = calculateRenovationEstimate(standardRoom, {
    quantityOverrides: { flooring: 100, taxes: 0 },
    rateOverrides: { flooring: 200 },
  });
  const flooring = result.rows.find((row) => row.key === 'flooring');
  assert.equal(flooring.quantity, 100);
  assert.equal(flooring.rate, 200);
  assert.equal(flooring.expected, 20_000);
  assert.equal(result.rows.find((row) => row.key === 'taxes').quantity, 0);
  assert.equal(result.shoppingList.find((item) => item.key === 'flooring').quantity, 100);
});

test('city and quality choices change assumed rates', () => {
  const basicPune = calculateRenovationEstimate({ ...standardRoom, quality: 'Basic' });
  const premiumMumbai = calculateRenovationEstimate({ ...standardRoom, city: 'Mumbai', quality: 'Premium' });
  assert.ok(premiumMumbai.totals.expected > basicPune.totals.expected);
});

test('rejects non-finite or negative rate and quantity overrides', () => {
  assert.equal(calculateRenovationEstimate(standardRoom, { rateOverrides: { paint: -5 } }).valid, false);
  assert.equal(calculateRenovationEstimate(standardRoom, { quantityOverrides: { flooring: 'many' } }).valid, false);
});

test('rejects inherited object property names as city, scope, or quality values', () => {
  const result = calculateRenovationEstimate({ ...standardRoom, city: '__proto__', renovationType: 'constructor', quality: 'toString' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.city);
  assert.ok(result.errors.renovationType);
  assert.ok(result.errors.quality);
});
