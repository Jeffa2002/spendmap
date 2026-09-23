import { normaliseProfile } from './domain/finance.mjs';
import { identifyOpportunities } from './engine/opportunities.mjs';

const profile = normaliseProfile({
  incomes: [{ name: 'Salary', amount: 3200, frequency: 'fortnightly' }],
  expenses: [
    { name: 'Mobile plan', category: 'mobile', amount: 69, frequency: 'monthly' },
    { name: 'Internet', category: 'internet', amount: 95, frequency: 'monthly' },
  ],
});
const opportunities = identifyOpportunities(profile.expenses, [
  { category: 'mobile', name: 'Comparable SIM-only plan', monthlyCost: 35, confidence: 'estimate', source: 'Curated catalogue' },
]);
console.log(JSON.stringify({ ...profile, opportunities }, null, 2));
