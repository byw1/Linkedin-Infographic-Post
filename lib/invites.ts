import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";

const DEFAULT_TTL_DAYS = 14;

export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export interface CreateInviteInput {
  createdById: string;
  email?: string | null;
  role?: "user" | "admin";
  note?: string | null;
  ttlDays?: number;
}

export async function createInvite(input: CreateInviteInput) {
  const ttl = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);
  return prisma.invite.create({
    data: {
      token: generateInviteToken(),
      email: input.email ?? null,
      role: input.role ?? "user",
      note: input.note ?? null,
      createdById: input.createdById,
      expiresAt,
    },
  });
}

export class InviteError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "expired" | "used" | "email_mismatch" | "email_taken",
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export async function findValidInvite(token: string) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) throw new InviteError("Invite not found.", "not_found");
  if (invite.usedAt) throw new InviteError("Invite has already been used.", "used");
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new InviteError("Invite has expired.", "expired");
  }
  return invite;
}

export interface RedeemInput {
  token: string;
  email: string;
  password: string;
  name?: string;
}

export async function redeemInvite(input: RedeemInput) {
  const invite = await findValidInvite(input.token);
  const email = input.email.trim().toLowerCase();

  if (invite.email && invite.email.toLowerCase() !== email) {
    throw new InviteError(
      `This invite was issued for ${invite.email}.`,
      "email_mismatch",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new InviteError("A user with that email already exists.", "email_taken");

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name?.trim() || null,
        passwordHash,
        role: invite.role,
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedById: user.id },
    });
    return user;
  });
}
