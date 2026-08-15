// src/lib/midtrans.ts
// Midtrans Snap API client & signature verification

export interface SnapTransactionDetails {
  order_id: string;
  gross_amount: number;
}

export interface SnapCustomerDetails {
  first_name: string;
  email: string;
}

export interface SnapItemDetails {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface SnapExpiry {
  unit: "minutes" | "hours" | "days";
  duration: number;
}

export interface SnapTransactionParams {
  transaction_details: SnapTransactionDetails;
  customer_details?: SnapCustomerDetails;
  item_details?: SnapItemDetails[];
  expiry?: SnapExpiry;
  enabled_payments?: string[];
}

export interface SnapResponse {
  token: string;
  redirect_url: string;
  error_messages?: string[];
}

export interface MidtransWebhookPayload {
  transaction_time: string;
  transaction_status: "settlement" | "capture" | "pending" | "expire" | "cancel" | "deny" | string;
  transaction_id: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  gross_amount: string;
  fraud_status?: string;
  [key: string]: any;
}

export function isMidtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

export function assertMidtransConfigured(): void {
  if (!isMidtransConfigured()) {
    console.warn("MIDTRANS_SERVER_KEY not set — automated payment features disabled");
  } else {
    const mode = process.env.MIDTRANS_IS_PRODUCTION === "true" ? "PRODUCTION" : "SANDBOX";
    console.log(`Midtrans configured (${mode})`);
  }
}

const getSnapBaseUrl = (): string => {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
};

export async function createSnapTransaction(params: SnapTransactionParams): Promise<SnapResponse> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured");
  }

  const authHeader = `Basic ${Buffer.from(serverKey + ":").toString("base64")}`;
  const response = await fetch(`${getSnapBaseUrl()}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(params),
  });

  const data = (await response.json()) as SnapResponse;

  if (!response.ok) {
    const errorMsg = data.error_messages?.join(", ") || `Midtrans API error (HTTP ${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;

  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const hash = new Bun.CryptoHasher("sha512").update(payload).digest("hex");
  return hash.toLowerCase() === signatureKey.toLowerCase();
}
