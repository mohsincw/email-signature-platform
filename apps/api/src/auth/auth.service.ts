import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@esp/database";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "esp-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async login(email: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  async createUser(email: string, password: string, name: string) {
    const hash = await bcrypt.hash(password, 12);
    return this.prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        password: hash,
        name,
      },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException("User not found");
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
