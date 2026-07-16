export function formatMoney(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}
