// Minimal IPv4 CIDR math — just enough to validate pool ranges don't
// overlap. No external dependency; this project keeps its dependency list
// lean (see package.json).

function ipToInt(ip: string): number {
  const parts = ip.trim().split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`"${ip}" is not a valid IPv4 address.`);
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function parseCidr(cidr: string): { base: number; prefix: number; first: number; last: number } {
  const [ip, prefixRaw] = cidr.trim().split("/");
  const prefix = prefixRaw ? parseInt(prefixRaw, 10) : 32;
  if (!ip || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`"${cidr}" is not a valid CIDR range (expected e.g. 10.20.0.0/21).`);
  }
  const addr = ipToInt(ip);
  const maskBits = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const base = (addr & maskBits) >>> 0;
  const hostBits = 32 - prefix;
  const size = hostBits >= 32 ? 0x100000000 : Math.pow(2, hostBits);
  const last = (base + size - 1) >>> 0;
  return { base, prefix, first: base, last };
}

export function cidrsOverlap(a: string, b: string): boolean {
  const ra = parseCidr(a);
  const rb = parseCidr(b);
  return ra.first <= rb.last && rb.first <= ra.last;
}
