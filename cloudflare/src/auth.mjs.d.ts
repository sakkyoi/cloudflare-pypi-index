export function hashToken(token: string): Promise<string>;
export function verifyTokenHash(token: string, expectedHash: string): Promise<boolean>;
export function tokenPrefix(token: string): string;
export function generateToken(randomValues?: (array: Uint8Array) => Uint8Array): string;
