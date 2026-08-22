import { AppError } from "../lib/errors";
import { signToken, signRefreshToken, verifyRefreshToken } from "../lib/auth";
import * as adminRepo from "../repositories/admin.repository";
import * as customerRepo from "../repositories/customer.repository";

export async function adminLogin(email: string, password: string) {
  const admin = await adminRepo.findAdminByEmail(email);
  if (!admin) {
    throw new AppError("Invalid email or password", 401);
  }

  const isValidPassword = await Bun.password.verify(password, admin.passwordHash);
  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = await signToken({ sub: admin.id, role: "admin", adminRole: admin.role, email: admin.email, name: admin.name });
  const refreshToken = await signRefreshToken({ sub: admin.id, role: "admin", adminRole: admin.role, email: admin.email, name: admin.name });

  return {
    token,
    refreshToken,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
}

export async function customerRegister(name: string, email: string, password: string) {
  const existing = await customerRepo.findCustomerByEmail(email);
  if (existing) {
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await Bun.password.hash(password);
  const customer = await customerRepo.createCustomer({
    name,
    email,
    passwordHash,
  });

  const token = await signToken({ sub: customer.id, role: "customer" });
  const refreshToken = await signRefreshToken({ sub: customer.id, role: "customer" });

  return {
    token,
    refreshToken,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: "customer" as const,
    },
  };
}

export async function customerLogin(email: string, password: string) {
  const customer = await customerRepo.findCustomerByEmail(email);
  if (!customer) {
    throw new AppError("Invalid email or password", 401);
  }

  const isValidPassword = await Bun.password.verify(password, customer.passwordHash);
  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = await signToken({ sub: customer.id, role: "customer" });
  const refreshToken = await signRefreshToken({ sub: customer.id, role: "customer" });

  return {
    token,
    refreshToken,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: "customer" as const,
    },
  };
}

export async function getMe(userId: string, role: "admin" | "customer") {
  if (role === "admin") {
    const admin = await adminRepo.findAdminById(userId);
    if (!admin) throw new AppError("User not found", 404);
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
  } else {
    const customer = await customerRepo.findCustomerById(userId);
    if (!customer) throw new AppError("User not found", 404);
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: "customer" as const,
    };
  }
}

export async function updateProfile(userId: string, role: "admin" | "customer", data: { name?: string; email?: string }) {
  if (role === "admin") {
    const admin = await adminRepo.findAdminById(userId);
    if (!admin) throw new AppError("Admin not found", 404);

    if (data.email && data.email !== admin.email) {
      const existing = await adminRepo.findAdminByEmail(data.email);
      if (existing) {
        throw new AppError("Email already in use", 409);
      }
    }

    return await adminRepo.updateAdmin(userId, data);
  } else {
    const customer = await customerRepo.findCustomerById(userId);
    if (!customer) throw new AppError("Customer not found", 404);

    if (data.email && data.email !== customer.email) {
      const existing = await customerRepo.findCustomerByEmail(data.email);
      if (existing) {
        throw new AppError("Email already in use", 409);
      }
    }

    return await customerRepo.updateCustomer(userId, data);
  }
}

export async function changePassword(
  userId: string,
  role: "admin" | "customer",
  currentPassword: string,
  newPassword: string
) {
  if (role === "admin") {
    const admin = await adminRepo.findAdminById(userId);
    if (!admin) throw new AppError("Admin not found", 404);

    const isValid = await Bun.password.verify(currentPassword, admin.passwordHash);
    if (!isValid) {
      throw new AppError("Kata sandi saat ini salah.", 400);
    }

    const passwordHash = await Bun.password.hash(newPassword);
    await adminRepo.updateAdmin(userId, { passwordHash });
  } else {
    const customer = await customerRepo.findCustomerById(userId);
    if (!customer) throw new AppError("Customer not found", 404);

    const isValid = await Bun.password.verify(currentPassword, customer.passwordHash);
    if (!isValid) {
      throw new AppError("Kata sandi saat ini salah.", 400);
    }

    const passwordHash = await Bun.password.hash(newPassword);
    await customerRepo.updateCustomer(userId, { passwordHash });
  }
  return true;
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken);

  const newToken = await signToken({
    sub: payload.sub,
    role: payload.role,
    ...(payload.adminRole ? { adminRole: payload.adminRole } : {}),
  });

  return { token: newToken };
}
