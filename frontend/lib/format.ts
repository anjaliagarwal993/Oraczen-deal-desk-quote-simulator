/** Display only. Amounts arrive as integer cents from the API. */
export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export const formatDate = (iso: string) => new Date(iso).toLocaleString();
