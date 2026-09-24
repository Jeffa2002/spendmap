# Spendmap

A privacy-first personal-finance planner for turning a household's income and
spending into a clear cash-flow plan and explainable savings opportunities.

## Product boundary

Spendmap is a budgeting and comparison aid, not financial advice. It never
opens, switches, or applies for products on a person's behalf. Recommendations
must disclose their assumptions, source and review date.

## First release

1. Enter income, pay frequency, accounts and recurring/variable expenses.
2. Normalise all cash flow to a fortnightly and monthly view.
3. Show a cash-flow forecast, category breakdown and upcoming commitments.
4. Identify candidate savings using user-confirmed alternatives and a curated
   Australian comparison catalogue.
5. Produce a plain-English report with every calculation explained.

## Privacy model

- Local-first profile and transaction data; no bank credentials in v1.
- CSV import is optional and remains an explicit user action.
- No advertising, data brokerage, behavioural tracking or sale of finance data.
- Aggregated product catalogue data is separate from a person's financial data.

## Public demo

The public demo is deployed with GitHub Pages. It contains illustrative sample
figures and catalogue entries only. Any profile created in the browser is held
in that browser's local storage; clearing site data removes it.

## Roadmap

- **Foundation (current):** domain model, normalisation and explainable
  opportunity engine.
- **Planner:** web capture flow, category management and reporting dashboard.
- **Comparisons:** source-reviewed Australian household service deals with
  eligibility, location and pricing caveats.
- **Imports:** local CSV parsing, reconciliation and user-reviewed rules.
- **Optional connections:** only after a security/privacy review and explicit
  user consent.
