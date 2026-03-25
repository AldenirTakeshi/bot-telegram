export type IntentType =
  | 'REGISTER_EXPENSE'
  | 'QUERY_BALANCE'
  | 'CAN_I_BUY'
  | 'SETUP_CEILING'
  | 'ADD_FIXED'
  | 'UPDATE_CARD'
  | 'MONTHLY_REPORT'
  | 'LIST_EXPENSES'
  | 'LIST_FIXED'
  | 'DELETE_LAST'
  | 'UNKNOWN';

export interface ParsedIntent {
  intent: IntentType;
  category?: string;
  amount?: number;
  description?: string;
  fixedName?: string;
  dayOfMonth?: number;
  period?: 'today' | 'week' | 'month';
  confidence: 'high' | 'low';
}
