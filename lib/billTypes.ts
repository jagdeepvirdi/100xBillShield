// The bill types the database allows (see billshield-migration-bill-types.sql) and how they read on screen.
export const BILL_TYPE_LABELS = {
  lpg: "LPG",
  electricity: "Electricity",
  broadband: "Broadband",
  phone: "Phone",
  restaurant: "Restaurant or food",
  shopping: "Shopping or retail",
  receipt: "Purchase receipt",
  other: "Other",
} as const;

// Restaurant bills, shop purchases and receipts are paid once: no plan was promised and there is no
// earlier bill from the same company to compare with.
export const isOneOff = (type: string) => type === "restaurant" || type === "shopping" || type === "receipt";

export type BillType = keyof typeof BILL_TYPE_LABELS;
export const BILL_TYPES = Object.keys(BILL_TYPE_LABELS) as [BillType, ...BillType[]];
