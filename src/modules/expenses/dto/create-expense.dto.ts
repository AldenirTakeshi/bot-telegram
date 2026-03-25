export interface CreateExpenseDto {
  category: string;
  description?: string;
  amount: number;
  sourcePhone?: string;
}
