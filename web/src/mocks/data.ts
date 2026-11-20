import type { Category, TransactionItem, TransactionPage } from '@/api/types'

export const mockCategories: Category[] = [
  { id: 'dining', name: 'Dining Out', type: 'Expense' },
  { id: 'groceries', name: 'Groceries', type: 'Expense' },
  { id: 'rent', name: 'Rent', type: 'Expense' },
  { id: 'freelance', name: 'Freelance', type: 'Income' },
  { id: 'salary', name: 'Salary', type: 'Income' },
]

export const mockTransactions: TransactionItem[] = [
  {
    id: '01935a3c-0000-7000-8000-000000000001',
    date: '2026-11-18',
    description: 'Sushi Ran',
    amount: 9_800,
    currency: 'USD',
    type: 'Expense',
    categoryId: 'dining',
    categoryName: 'Dining Out',
    version: 1,
  },
  {
    id: '01935a3c-0000-7000-8000-000000000002',
    date: '2026-11-01',
    description: 'Payroll — Northwind Traders',
    amount: 485_000,
    currency: 'USD',
    type: 'Income',
    categoryId: 'salary',
    categoryName: 'Salary',
    version: 1,
  },
  {
    id: '01935a3c-0000-7000-8000-000000000003',
    date: '2026-11-01',
    description: 'Rent — Maple Court Apartments',
    amount: 165_000,
    currency: 'USD',
    type: 'Expense',
    categoryId: 'rent',
    categoryName: 'Rent',
    version: 3,
  },
]

export function pageOf(
  items: TransactionItem[],
  { page = 1, pageSize = 25, totalCount = items.length } = {},
): TransactionPage {
  return { items, page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) }
}
