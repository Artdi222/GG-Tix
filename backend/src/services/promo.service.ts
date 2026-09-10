import * as promoRepo from "../repositories/promo.repository";
import * as categoryRepo from "../repositories/category.repository";
import { AppError } from "../lib/errors";

export interface ValidatePromoInput {
  code: string;
  customerId: string;
  eventId: string;
  categoryId: string;
  quantity: number;
}

export function calculateDiscount(
  subtotal: number,
  discountType: "fixed" | "percentage",
  discountValue: string,
  maxDiscountAmount?: string | null
): number {
  const value = parseFloat(discountValue);
  let discount = 0;

  if (discountType === "fixed") {
    discount = Math.min(value, subtotal);
  } else if (discountType === "percentage") {
    const rawDiscount = (subtotal * value) / 100;
    if (maxDiscountAmount && parseFloat(maxDiscountAmount) > 0) {
      discount = Math.min(rawDiscount, parseFloat(maxDiscountAmount));
    } else {
      discount = rawDiscount;
    }
  }

  // Ensure precision
  return Math.round(discount * 100) / 100;
}

export async function validatePromo(input: ValidatePromoInput) {
  const category = await categoryRepo.findCategoryById(input.categoryId);
  if (!category || category.eventId !== input.eventId) {
    throw new AppError("Kategori tiket tidak ditemukan untuk event ini.", 404);
  }

  const unitPrice = parseFloat(category.price);
  const subtotal = unitPrice * input.quantity;

  const voucher = await promoRepo.findVoucherByCode(input.code);
  if (!voucher || !voucher.isActive) {
    throw new AppError("Kode promo tidak ditemukan. Periksa kembali penulisan kode Anda.", 404, {
      code: "VOUCHER_NOT_FOUND",
    });
  }

  const now = new Date();
  if (voucher.startDate && now < new Date(voucher.startDate)) {
    throw new AppError("Masa berlaku kode promo ini belum dimulai.", 400, {
      code: "VOUCHER_NOT_STARTED",
    });
  }

  if (now > new Date(voucher.endDate)) {
    throw new AppError("Masa berlaku kode promo ini telah berakhir.", 400, {
      code: "VOUCHER_EXPIRED",
    });
  }

  if (voucher.quotaRemaining <= 0) {
    throw new AppError("Yah, kuota promo ini sudah habis terpakai.", 409, {
      code: "VOUCHER_QUOTA_EXCEEDED",
    });
  }

  if (voucher.eventId && voucher.eventId !== input.eventId) {
    throw new AppError("Kode promo ini tidak berlaku untuk konser yang dipilih.", 400, {
      code: "VOUCHER_EVENT_MISMATCH",
    });
  }

  const minOrder = parseFloat(voucher.minOrderAmount || "0");
  if (subtotal < minOrder) {
    const formattedMin = new Intl.NumberFormat("id-ID").format(minOrder);
    throw new AppError(`Minimal pembelian untuk promo ini adalah Rp ${formattedMin}.`, 400, {
      code: "VOUCHER_MIN_SPEND_NOT_MET",
    });
  }

  const customerUsages = await promoRepo.countCustomerUsages(input.customerId, voucher.id);
  if (customerUsages >= voucher.maxUsagePerCustomer) {
    throw new AppError("Anda telah mencapai batas pemakaian untuk kode promo ini.", 400, {
      code: "VOUCHER_CUSTOMER_LIMIT_REACHED",
    });
  }

  const discount = calculateDiscount(
    subtotal,
    voucher.discountType,
    voucher.discountValue,
    voucher.maxDiscountAmount
  );
  const total = Math.max(0, subtotal - discount);

  return {
    valid: true,
    voucherId: voucher.id,
    code: voucher.code,
    name: voucher.name,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    subtotalPrice: subtotal.toFixed(2),
    discountAmount: discount.toFixed(2),
    totalPrice: total.toFixed(2),
    minOrderAmount: voucher.minOrderAmount,
    message: "Kode promo berhasil digunakan!",
  };
}

export async function listVouchers(filters: promoRepo.VoucherQueryFilters) {
  return await promoRepo.findVouchers(filters);
}

export async function getVoucherById(id: string) {
  const voucher = await promoRepo.findVoucherById(id);
  if (!voucher) {
    throw new AppError("Voucher tidak ditemukan.", 404);
  }
  return voucher;
}

export async function createVoucher(createdBy: string, data: Omit<promoRepo.CreateVoucherInput, "createdBy">) {
  const existing = await promoRepo.findVoucherByCode(data.code);
  if (existing) {
    throw new AppError(`Kode voucher '${data.code.toUpperCase()}' sudah terdaftar. Gunakan kode lain.`, 409);
  }

  if (new Date(data.endDate) <= (data.startDate ? new Date(data.startDate) : new Date())) {
    throw new AppError("Tanggal berakhir harus setelah tanggal mulai.", 400);
  }

  return await promoRepo.createVoucher({
    ...data,
    createdBy,
  });
}

export async function updateVoucher(id: string, data: promoRepo.UpdateVoucherInput) {
  const voucher = await promoRepo.findVoucherById(id);
  if (!voucher) {
    throw new AppError("Voucher tidak ditemukan.", 404);
  }

  return await promoRepo.updateVoucher(id, data);
}

export async function toggleVoucher(id: string) {
  const updated = await promoRepo.toggleVoucher(id);
  if (!updated) {
    throw new AppError("Voucher tidak ditemukan.", 404);
  }
  return updated;
}

export async function deleteVoucher(id: string) {
  const usages = await promoRepo.getVoucherUsages(id, 1, 1);
  if (usages.pagination.totalCount > 0) {
    throw new AppError("Voucher yang sudah pernah digunakan tidak dapat dihapus. Nonaktifkan voucher sebagai gantinya.", 400);
  }

  const deleted = await promoRepo.deleteVoucher(id);
  if (!deleted) {
    throw new AppError("Voucher tidak ditemukan.", 404);
  }
  return { message: "Voucher berhasil dihapus." };
}

export async function getVoucherUsages(voucherId: string, page = 1, limit = 20) {
  await getVoucherById(voucherId);
  return await promoRepo.getVoucherUsages(voucherId, page, limit);
}

export async function getVoucherStats() {
  return await promoRepo.getVoucherStats();
}
