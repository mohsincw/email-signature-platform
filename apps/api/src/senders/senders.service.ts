import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient, type Sender } from "@esp/database";
import type { SenderDto } from "@esp/shared-types";
import { CreateSenderDto, UpdateSenderDto } from "./senders.dto";

@Injectable()
export class SendersService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<SenderDto[]> {
    const senders = await this.prisma.sender.findMany({
      orderBy: { name: "asc" },
    });
    return senders.map((s) => this.toDto(s));
  }

  async findById(id: string): Promise<SenderDto> {
    const sender = await this.prisma.sender.findUnique({ where: { id } });
    if (!sender) throw new NotFoundException("Sender not found");
    return this.toDto(sender);
  }

  async findByEmail(email: string): Promise<SenderDto | null> {
    const sender = await this.prisma.sender.findUnique({ where: { email } });
    return sender ? this.toDto(sender) : null;
  }

  async create(dto: CreateSenderDto): Promise<SenderDto> {
    const sender = await this.prisma.sender.create({ data: dto });
    return this.toDto(sender);
  }

  async update(id: string, dto: UpdateSenderDto): Promise<SenderDto> {
    await this.findById(id);
    const sender = await this.prisma.sender.update({
      where: { id },
      data: dto,
    });
    return this.toDto(sender);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.sender.delete({ where: { id } });
  }

  async getUploadUrl(id: string): Promise<{ uploadUrl: string; key: string }> {
    await this.findById(id);
    const key = `signatures/${id}/${Date.now()}.png`;
    // TODO: Generate real presigned URL using S3 client
    const uploadUrl = `${process.env.S3_ENDPOINT ?? "http://localhost:9000"}/${process.env.S3_BUCKET ?? "signatures"}/${key}?presigned=placeholder`;
    return { uploadUrl, key };
  }

  private toDto(sender: Sender): SenderDto {
    const publicUrl = process.env.S3_PUBLIC_URL ?? "http://localhost:9000/signatures";
    return {
      id: sender.id,
      email: sender.email,
      name: sender.name,
      title: sender.title,
      phone: sender.phone,
      phone2: sender.phone2,
      enabled: sender.enabled,
      imageKey: sender.imageKey,
      imageUrl: sender.imageKey ? `${publicUrl}/${sender.imageKey}` : null,
      createdAt: sender.createdAt.toISOString(),
      updatedAt: sender.updatedAt.toISOString(),
    };
  }
}
