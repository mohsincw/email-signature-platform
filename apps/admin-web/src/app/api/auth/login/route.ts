import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.adminUser.findUnique({
      where: { email: String(email).toLowerCase() },
    });
    if (!user) throw new ApiError(401, "Invalid email or password");

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new ApiError(401, "Invalid email or password");

    const token = signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
