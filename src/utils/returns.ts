export function calculateOrderReturnValue(order: any): number {
  const items = order?.items || [];
  const recordedRefund = items.reduce((sum: number, item: any) => {
    return sum + (Number(item.refunded_amount) || 0);
  }, 0);

  if (recordedRefund > 0) return recordedRefund;

  const itemsSum = items.reduce((sum: number, item: any) => {
    return sum + ((Number(item.quantity) || 0) * (Number(item.sale_price) || 0));
  }, 0);
  const discountRatio = itemsSum > 0 ? (Number(order?.total) || 0) / itemsSum : 1;

  return items.reduce((sum: number, item: any) => {
    return sum + ((Number(item.returned_quantity) || 0) * (Number(item.sale_price) || 0));
  }, 0) * discountRatio;
}
