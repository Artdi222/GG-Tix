/** Pending-order count shown in the sidebar; pages that change orders update it. */
export const usePendingOrdersCount = () => useState<number>('pending_orders_count', () => 0)
