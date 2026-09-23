import { amountForPeriod } from '../domain/finance.mjs';

/**
 * Generates explainable, non-binding savings candidates. An opportunity is
 * emitted only where the profile has an explicitly comparable expense and a
 * current, eligible alternative supplied by a reviewed catalogue.
 */
export function identifyOpportunities(expenses, alternatives, today = new Date()) {
  const byCategory = new Map(alternatives.filter((item) => item.available !== false).map((item) => [item.category, item]));
  return expenses.flatMap((expense) => {
    const alternative = byCategory.get(expense.category);
    if (!alternative || alternative.monthlyCost >= amountForPeriod(expense.amount, expense.frequency, 'monthly')) return [];
    const current = amountForPeriod(expense.amount, expense.frequency, 'monthly');
    const saving = current - alternative.monthlyCost;
    return [{
      category: expense.category,
      monthlySaving: Number(saving.toFixed(2)),
      annualSaving: Number((saving * 12).toFixed(2)),
      confidence: alternative.confidence ?? 'estimate',
      rationale: `${expense.name} is currently about $${current.toFixed(2)}/month; ${alternative.name} is listed at $${alternative.monthlyCost.toFixed(2)}/month.`,
      source: alternative.source,
      reviewedAt: alternative.reviewedAt ?? today.toISOString().slice(0, 10),
      caveats: alternative.caveats ?? ['Confirm eligibility, location, inclusions and contract terms before switching.'],
    }];
  }).sort((a, b) => b.monthlySaving - a.monthlySaving);
}
