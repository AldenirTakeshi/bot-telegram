export interface CreateFixedCostDto {
  name: string;
  amount: number;
  isCreditCard: boolean;
  dayOfMonth?: number;
}
