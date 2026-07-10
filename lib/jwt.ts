import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "./env";

// JWT utilita pro session a view tokeny. Knihovna `jose` funguje i v Edge
// Runtime. `verify*` funkce vrací null místo vyhazování výjimky. (Vzor vratky.)
//
// Po expert review: session token (cookie) a view token (v URL) podepisuje
// stejný JWT_SECRET, proto MUSÍ nést claim `typ` a každé ověření kontroluje
// správný typ — view token uniklý z URL (logy, historie) nejde použít jako
// session a naopak.
const ALG = "HS256";

// Klouzavá relace: token žije SESSION_TTL (okno nečinnosti). Proxy při aktivitě
// vydá čerstvý token, když je stávající starší než SESSION_REISSUE_AFTER_SEC.
export const SESSION_TTL = "8h";
export const SESSION_TTL_SEC = 8 * 60 * 60;
export const SESSION_REISSUE_AFTER_SEC = 30 * 60;

// View token: krátkodobý, jen na čtení konkrétní verze dokumentu (M5).
export const VIEW_TOKEN_TTL = "1h";

export type SessionPayload = { typ: "session"; userId: number; iat: number };
export type ViewPayload = {
  typ: "view";
  userId: number;
  versionId: number;
  iat: number;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

async function signJwt(
  payload: Record<string, unknown>,
  expiresIn: string,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

async function verifyJwt<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as T;
  } catch {
    return null;
  }
}

export async function signSessionToken(userId: number): Promise<string> {
  return signJwt({ typ: "session", userId }, SESSION_TTL);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  const payload = await verifyJwt<SessionPayload>(token);
  if (!payload || payload.typ !== "session") return null;
  return payload;
}

export async function signViewToken(
  userId: number,
  versionId: number,
): Promise<string> {
  return signJwt({ typ: "view", userId, versionId }, VIEW_TOKEN_TTL);
}

export async function verifyViewToken(
  token: string,
): Promise<ViewPayload | null> {
  const payload = await verifyJwt<ViewPayload>(token);
  if (!payload || payload.typ !== "view") return null;
  return payload;
}
