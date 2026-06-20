export interface FixtureOrderItem {
  sku: string;
  quantity: number;
}

export const INVENTORY_FIXTURES = {
  reservedReferencePrefix: "inv_res_",
};

export const PAYMENT_FIXTURES = {
  transactionPrefix: "pay_txn_",
  declineReason: "Mock payment decline scenario",
};

export const FULFILLMENT_FIXTURES = {
  shipmentPrefix: "ship_",
};
