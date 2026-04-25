import bcrypt from "bcryptjs";

const ROUNDS = 12;
const MIN_LENGTH = 8;

export class WeakPasswordError extends Error {
  constructor() {
    super(`Password must be at least ${MIN_LENGTH} characters.`);
    this.name = "WeakPasswordError";
  }
}

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < MIN_LENGTH) throw new WeakPasswordError();
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}
