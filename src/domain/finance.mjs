export const PAY_PERIODS_PER_YEAR = Object.freeze({ weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1 });

export function amountForPeriod(amount, frequency, target = 'monthly') {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a non-negative number');
  const sourcePeriods = PAY_PERIODS_PER_YEAR[frequency];
  const targetPeriods = PAY_PERIODS_PER_YEAR[target];
  if (!sourcePeriods || !targetPeriods) throw new Error('Unsupported frequency');
  return (amount * sourcePeriods) / targetPeriods;
}

export function normaliseProfile({ incomes = [], expenses = [] }) {
  const normalise = (entry) => ({
    ...entry,
    monthlyAmount: amountForPeriod(entry.amount, entry.frequency, 'monthly'),
    fortnightlyAmount: amountForPeriod(entry.amount, entry.frequency, 'fortnightly'),
  });
  const monthlyIncome = incomes.reduce((total, entry) => total + normalise(entry).monthlyAmount, 0);
  const monthlyExpenses = expenses.reduce((total, entry) => total + normalise(entry).monthlyAmount, 0);
  return {
    incomes: incomes.map(normalise),
    expenses: expenses.map(normalise),
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus: monthlyIncome - monthlyExpenses,
  };
}
