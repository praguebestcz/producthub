import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "crypto";
import { getEncKey } from "@/lib/env";

// Šifrování tajemství v DB (Anthropic API klíč) — AES-256-GCM.
// Po db-security-expert review (2026-07-20):
//  - šifrovací klíč odvozen z env SECRET_ENC_KEY přes HKDF-SHA256 se samostatným
//    labelem (ne z JWT_SECRET, ten se rotuje);
//  - náhodné 12B IV na každé šifrování; authTag (16B) se ukládá a při dešifrování
//    se nastaví PŘED final() → ověří se integrita (zmanipulovaný ciphertext selže);
//  - formát „v1:iv:authTag:ciphertext" (base64) — prefix verze umožní budoucí
//    rotaci šifrovacího klíče.

const VERSION = "v1";

// 32B AES klíč z SECRET_ENC_KEY (HKDF, separátní info label).
function derivedKey(): Buffer {
  const ikm = Buffer.from(getEncKey(), "utf-8");
  const out = hkdfSync(
    "sha256",
    ikm,
    Buffer.alloc(0),
    Buffer.from("producthub-ai-key-enc"),
    32,
  );
  return Buffer.from(out);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

export function decryptSecret(enc: string): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Neznámý formát šifrovaného tajemství.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    derivedKey(),
    Buffer.from(ivB64, "base64"),
  );
  // setAuthTag MUSÍ být před final() — jinak se integrita neověří.
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf-8");
}
