import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { ApiError } from "./errors";

const JWT_SECRET = process.env.JWT_SECRET ?? "esp-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

export function requireAuth(req: NextRequest): JwtPayload {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid authorization header");
  }
  return verifyToken(authHeader.slice(7));
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
