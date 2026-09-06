export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "Nakit",
  bank: "Banka",
  credit_card: "Kredi kartı",
  pos: "POS",
  investment_cash: "Yatırım nakit hesabı",
  other: "Diğer",
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

export const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
