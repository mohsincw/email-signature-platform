import { describe, it, expect, vi, beforeEach } from "vitest";
import { SendersService } from "../src/senders/senders.service";
import { NotFoundException } from "@nestjs/common";

function mockPrisma() {
  return {
    sender: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as any;
}

describe("SendersService", () => {
  let service: SendersService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new SendersService(prisma);
  });

  it("findAll returns mapped senders", async () => {
    prisma.sender.findMany.mockResolvedValue([
      {
        id: "1",
        email: "a@test.com",
        name: "Alice",
        title: null,
        phone: null,
        phone2: null,
        enabled: true,
        imageKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("a@test.com");
  });

  it("findById throws NotFoundException for missing sender", async () => {
    prisma.sender.findUnique.mockResolvedValue(null);
    await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
  });

  it("create returns new sender with phone", async () => {
    const sender = {
      id: "1",
      email: "ben@chaiiwala.co.uk",
      name: "ben robinson",
      title: "Marketing Executive",
      phone: "+44 (0) 7398 840 817",
      phone2: null,
      enabled: true,
      imageKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.sender.create.mockResolvedValue(sender);

    const result = await service.create({
      email: "ben@chaiiwala.co.uk",
      name: "ben robinson",
      title: "Marketing Executive",
      phone: "+44 (0) 7398 840 817",
    });
    expect(result.email).toBe("ben@chaiiwala.co.uk");
    expect(result.phone).toBe("+44 (0) 7398 840 817");
  });

  it("findByEmail returns null for unknown email", async () => {
    prisma.sender.findUnique.mockResolvedValue(null);
    const result = await service.findByEmail("unknown@test.com");
    expect(result).toBeNull();
  });
});
