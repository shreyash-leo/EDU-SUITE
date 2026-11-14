import { randomBytes, timingSafeEqual } from "node:crypto";
if (typeof require("node:crypto").argon2 !== "function") {
  throw new Error(
    `Unsupported Node runtime ${process.version}. PLAN EDU SUITE requires Node 24.11 or newer with built-in Argon2. Switch Node versions and restart the API.`,
  );
}
// Node 24's built-in Argon2id; PHC-compatible encoding, no native addon dependency.
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    const crypto = require("node:crypto");
    crypto.argon2(
      "argon2id",
      {
        message: password,
        nonce: salt,
        parallelism: 4,
        tagLength: 32,
        memory: 65536,
        passes: 3,
      },
      (error: Error | null, result: Buffer) =>
        error ? reject(error) : resolve(result),
    );
  });
export const argon2id = "argon2id";
export async function hash(password: string, _options?: unknown) {
  const salt = randomBytes(16);
  const digest = await derive(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=4$${salt.toString("base64").replace(/=+$/, "")}$${digest.toString("base64").replace(/=+$/, "")}`;
}
export async function verify(encoded: string, password: string) {
  const parts = encoded.split("$");
  if (
    parts.length !== 6 ||
    parts[1] !== "argon2id" ||
    parts[2] !== "v=19" ||
    parts[3] !== "m=65536,t=3,p=4"
  )
    return false;
  const salt = Buffer.from(parts[4], "base64"),
    expected = Buffer.from(parts[5], "base64");
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(expected, actual);
}
