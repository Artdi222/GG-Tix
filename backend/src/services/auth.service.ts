import { AppError } from "../lib/errors";
import { signToken } from "../lib/auth";
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

  const token = await signToken({ sub: admin.id, role: "admin" });

  return {
    token,
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

  return {
    token,
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

  return {
    token,
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
