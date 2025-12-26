/**
 * LunchMoney API Types
 * Based on https://lunchmoney.dev/
 */

// Category types
export interface Category {
  id: number;
  name: string;
  description: string | null;
  is_income: boolean;
  exclude_from_budget: boolean;
  exclude_from_totals: boolean;
  archived: boolean;
  archived_on: string | null;
  updated_at: string;
  created_at: string;
  is_group: boolean;
  group_id: number | null;
  order: number | null;
  children?: Category[];
}

export interface CategoryGroup {
  id: number;
  name: string;
  description: string | null;
  is_income: boolean;
  exclude_from_budget: boolean;
  exclude_from_totals: boolean;
  archived: boolean;
  archived_on: string | null;
  updated_at: string;
  created_at: string;
  is_group: true;
  group_id: null;
  order: number | null;
  children: Category[];
}

// Budget types
export interface BudgetDataEntry {
  budget_month: string; // "YYYY-MM-DD"
  budget_to_base: number;
  budget_amount: number | null;
  budget_currency: string | null;
  spending_to_base: number;
  num_transactions: number;
}

export interface BudgetConfigEntry {
  config_id: number;
  cadence: string;
  amount: number;
  currency: string;
  to_base: number;
  auto_suggest: string;
}

export interface Budget {
  category_name: string;
  category_id: number;
  category_group_name: string | null;
  group_id: number | null;
  is_group: boolean;
  is_income: boolean;
  exclude_from_budget: boolean;
  exclude_from_totals: boolean;
  data: BudgetDataEntry[];
  config: BudgetConfigEntry | null;
  order: number;
  archived: boolean;
  recurring: RecurringExpense[] | null;
}

export interface RecurringExpense {
  id: number;
  start_date: string;
  end_date: string | null;
  cadence: string;
  payee: string;
  amount: number;
  currency: string;
  to_base: number;
}

// User info
export interface User {
  user_id: number;
  user_name: string;
  user_email: string;
  account_id: number;
  budget_name: string;
  primary_currency: string;
  api_key_label: string | null;
}

// API error response
export interface ApiError {
  error: string;
  message?: string;
}

// API response types
export interface GetBudgetsResponse {
  [categoryId: string]: Budget;
}

export interface GetCategoriesResponse {
  categories: Category[];
}

export interface GetUserResponse extends User {}
