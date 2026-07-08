export async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function verifyTokenHash(token, expectedHash) {
  const actualHash = await hashToken(token);
  return timingSafeEqual(actualHash, expectedHash);
}

export function tokenPrefix(token) {
  return token.slice(0, 13);
}

export function generateToken(randomValues = crypto.getRandomValues.bind(crypto)) {
  const bytes = new Uint8Array(32);
  randomValues(bytes);
  return `cfpi_${base64UrlEncode(bytes)}`;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function timingSafeEqual(left, right) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}
