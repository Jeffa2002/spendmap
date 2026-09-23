import test from 'node:test';
import assert from 'node:assert/strict';
import { amountForPeriod, normaliseProfile } from '../src/domain/finance.mjs';
import { identifyOpportunities } from '../src/engine/opportunities.mjs';

test('normalises weekly, fortnightly and monthly cash flow', () => {
  assert.equal(amountForPeriod(1000, 'fortnightly', 'monthly'), 2166.6666666666665);
  const profile = normaliseProfile({ incomes: [{ amount: 1000, frequency: 'fortnightly' }], expenses: [{ amount: 500, frequency: 'monthly' }] });
  assert.equal(profile.monthlyExpenses, 500);
  assert.equal(profile.monthlySurplus, 1666.6666666666665);
});

test('only emits transparent savings opportunities', () => {
  const opportunities = identifyOpportunities([{ name: 'Phone', category: 'mobile', amount: 60, frequency: 'monthly' }], [{ category: 'mobile', name: 'Alternative', monthlyCost: 35, source: 'Catalogue' }]);
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].monthlySaving, 25);
  assert.match(opportunities[0].rationale, /Phone/);
});
