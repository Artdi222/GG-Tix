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
  start_time?: string;
  unit: "minutes" | "hours" | "days";
  duration: number;
}

export interface SnapTransactionParams {
  transaction_details: SnapTransactionDetails;
  customer_details?: SnapCustomerDetails;
  item_details?: SnapItemDetails[];
  expiry?: SnapExpiry;
  enabled_payments?: string[];
  callbacks?: { finish: string; error: string };
  gopay?: { enable_callback: boolean; callback_url: string };
  shopeepay?: { callback_url: string };
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
    signal: AbortSignal.timeout(15000),
  });

  const data = (await response.json()) as SnapResponse;

  if (!response.ok) {
    const errorMsg = data.error_messages?.join(", ") || `Midtrans API error (HTTP ${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

/** Authenticated server-to-server lookup. A missing transaction is not a gateway outage. */
export async function getTransactionStatus(orderId: string): Promise<MidtransWebhookPayload | null> {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error('Payment gateway is not configured');
  const base = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
  const response = await fetch(`${base}/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(key + ':').toString('base64')}` },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json() as MidtransWebhookPayload;
  if (response.status === 404 && data.status_code === '404') return null;
  if (!response.ok || !data.transaction_status || !data.order_id) {
    throw new Error(`Gagal memeriksa pembayaran di Midtrans (HTTP ${response.status}). Coba lagi.`);
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
