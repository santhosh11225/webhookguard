import dns from 'node:dns';
import net from 'node:net';

export class SsrfBlockedError extends Error {
  readonly isSsrfBlocked = true;
  readonly blockedHostname: string;
  readonly reason?: string;

  constructor(hostname: string, reason?: string) {
    const isCloudMeta =
      hostname.startsWith('169.254') ||
      hostname.includes('metadata.google.internal') ||
      hostname.includes('metadata.internal') ||
      hostname.includes('100.100.100.200');

    const msg = isCloudMeta
      ? `SSRF Protection: Access to cloud instance metadata (${hostname}) is strictly prohibited.`
      : `SSRF Protection: Access to restricted destination (${hostname}) is strictly prohibited${reason ? `: ${reason}` : '.'}`;

    super(msg);
    this.name = 'SsrfBlockedError';
    this.blockedHostname = hostname;
    this.reason = reason;
  }
}

export interface SsrfValidationOptions {
  allowLocalNetworks?: boolean;
}

export function isRestrictedIpv4(ip: string, allowLocal = false): { restricted: boolean; reason: string } {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return { restricted: true, reason: 'Malformed IPv4 address' };
  }
  const [b0, b1, b2, b3] = parts;

  // 0.0.0.0/8 - Unspecified / current network
  if (b0 === 0) return { restricted: true, reason: 'Current network / unspecified address (0.0.0.0/8)' };

  // Loopback 127.0.0.0/8
  if (b0 === 127) {
    if (!allowLocal) return { restricted: true, reason: 'Loopback address (127.0.0.0/8)' };
  }

  // Link-Local / Cloud Metadata 169.254.0.0/16
  if (b0 === 169 && b1 === 254) {
    return { restricted: true, reason: 'Link-local / Cloud instance metadata (169.254.0.0/16)' };
  }

  // Private RFC 1918
  if (b0 === 10) {
    if (!allowLocal) return { restricted: true, reason: 'Private network (10.0.0.0/8)' };
  }
  if (b0 === 172 && b1 >= 16 && b1 <= 31) {
    if (!allowLocal) return { restricted: true, reason: 'Private network (172.16.0.0/12)' };
  }
  if (b0 === 192 && b1 === 168) {
    if (!allowLocal) return { restricted: true, reason: 'Private network (192.168.0.0/16)' };
  }

  // Carrier-grade NAT 100.64.0.0/10
  if (b0 === 100 && b1 >= 64 && b1 <= 127) {
    if (!allowLocal) return { restricted: true, reason: 'Carrier-grade NAT (100.64.0.0/10)' };
  }

  // Alibaba Cloud metadata 100.100.100.200
  if (b0 === 100 && b1 === 100 && b2 === 100 && b3 === 200) {
    return { restricted: true, reason: 'Alibaba Cloud metadata (100.100.100.200)' };
  }

  // Broadcast
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) {
    return { restricted: true, reason: 'Broadcast address (255.255.255.255)' };
  }

  // Multicast 224.0.0.0/4
  if (b0 >= 224 && b0 <= 239) return { restricted: true, reason: 'Multicast address (224.0.0.0/4)' };

  // Reserved 240.0.0.0/4
  if (b0 >= 240) return { restricted: true, reason: 'Reserved address (240.0.0.0/4)' };

  return { restricted: false, reason: '' };
}

export function parseIpv6Blocks(ip: string): number[] {
  let clean = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (clean.includes('.')) {
    const lastColon = clean.lastIndexOf(':');
    const ipv4Part = clean.slice(lastColon + 1);
    const octets = ipv4Part.split('.').map(Number);
    if (octets.length === 4 && octets.every((o) => !isNaN(o) && o >= 0 && o <= 255)) {
      const hex1 = ((octets[0] << 8) | octets[1]).toString(16);
      const hex2 = ((octets[2] << 8) | octets[3]).toString(16);
      clean = clean.slice(0, lastColon) + ':' + hex1 + ':' + hex2;
    }
  }
  const parts = clean.split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const missing = 8 - (left.length + right.length);
  const middle = new Array(Math.max(0, missing)).fill('0');
  const blocks = [...left, ...middle, ...right].map((b) => parseInt(b || '0', 16));
  return blocks;
}

export function isRestrictedIpv6(ip: string, allowLocal = false): { restricted: boolean; reason: string } {
  const blocks = parseIpv6Blocks(ip);
  if (blocks.length !== 8 || blocks.some((b) => isNaN(b) || b < 0 || b > 0xffff)) {
    return { restricted: true, reason: 'Malformed IPv6 address' };
  }

  // :: (Unspecified)
  if (blocks.every((b) => b === 0)) {
    return { restricted: true, reason: 'Unspecified IPv6 address (::)' };
  }

  // ::1 (Loopback)
  if (blocks.slice(0, 7).every((b) => b === 0) && blocks[7] === 1) {
    if (!allowLocal) return { restricted: true, reason: 'IPv6 Loopback (::1)' };
  }

  // fe80::/10 (Link-Local)
  if ((blocks[0] & 0xffc0) === 0xfe80) {
    return { restricted: true, reason: 'IPv6 Link-Local (fe80::/10)' };
  }

  // fc00::/7 (Unique Local Address - RFC 4193, includes fc00:: and fd00::)
  if ((blocks[0] & 0xfe00) === 0xfc00) {
    if (!allowLocal) return { restricted: true, reason: 'IPv6 Unique Local / Private (fc00::/7)' };
  }

  // IPv4-mapped IPv6 ::ffff:0:0/96
  if (blocks.slice(0, 5).every((b) => b === 0) && blocks[5] === 0xffff) {
    const ipv4 = [blocks[6] >> 8, blocks[6] & 0xff, blocks[7] >> 8, blocks[7] & 0xff].join('.');
    const mappedRes = isRestrictedIpv4(ipv4, allowLocal);
    if (mappedRes.restricted) {
      return { restricted: true, reason: `IPv4-mapped IPv6 pointing to restricted ${ipv4}: ${mappedRes.reason}` };
    }
  }

  // Multicast ff00::/8
  if ((blocks[0] & 0xff00) === 0xff00) {
    return { restricted: true, reason: 'IPv6 Multicast (ff00::/8)' };
  }

  return { restricted: false, reason: '' };
}

/**
 * Stage 1 Validation: Validates URL protocol, checks hostnames and IP literals synchronously
 * BEFORE any DNS resolution and BEFORE any network request.
 */
export function validateHostOrIpPreDns(
  rawUrl: string,
  options: SsrfValidationOptions = {}
): { parsedUrl: URL; cleanHost: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid target URL: "${rawUrl}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
  }

  const rawHost = parsed.hostname.toLowerCase();
  const cleanHost = rawHost.replace(/^\[|\]$/g, '');

  // 1. Check known metadata / restricted hostnames
  const isCloudMetadataHost =
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'metadata.internal' ||
    cleanHost.endsWith('.metadata.google.internal') ||
    cleanHost.endsWith('.metadata.internal') ||
    cleanHost === '169.254.169.254' ||
    cleanHost.startsWith('169.254.') ||
    cleanHost === '100.100.100.200';

  if (isCloudMetadataHost) {
    throw new SsrfBlockedError(cleanHost, 'Cloud instance metadata is strictly prohibited');
  }

  const isLocalHost = cleanHost === 'localhost' || cleanHost.endsWith('.localhost');
  if (isLocalHost && !options.allowLocalNetworks) {
    throw new SsrfBlockedError(cleanHost, 'Loopback hostname is strictly prohibited');
  }

  // 2. Check IP literals (IPv4 or IPv6)
  const ipFamily = net.isIP(cleanHost);
  if (ipFamily === 4) {
    const res = isRestrictedIpv4(cleanHost, options.allowLocalNetworks);
    if (res.restricted) {
      throw new SsrfBlockedError(cleanHost, res.reason);
    }
  } else if (ipFamily === 6) {
    const res = isRestrictedIpv6(cleanHost, options.allowLocalNetworks);
    if (res.restricted) {
      throw new SsrfBlockedError(cleanHost, res.reason);
    }
  }

  return { parsedUrl: parsed, cleanHost };
}

/**
 * Full Pre-Flight Validation: Stage 1 (IP literals / hostnames) + Stage 2 (DNS resolution check)
 * Strictly verifies destination BEFORE any socket / network connection is made.
 */
export async function validateTargetUrl(
  rawUrl: string,
  options: SsrfValidationOptions = {}
): Promise<URL> {
  const { parsedUrl, cleanHost } = validateHostOrIpPreDns(rawUrl, options);

  // If cleanHost is already an IP literal, it passed the IP checks; no DNS resolution needed
  if (net.isIP(cleanHost) !== 0) {
    return parsedUrl;
  }

  // Domain name: Resolve DNS pre-flight and verify every resolved IP
  try {
    const addresses = await dns.promises.lookup(cleanHost, { all: true });
    for (const addr of addresses) {
      if (addr.family === 4) {
        const res = isRestrictedIpv4(addr.address, options.allowLocalNetworks);
        if (res.restricted) {
          throw new SsrfBlockedError(
            cleanHost,
            `Hostname resolves to restricted IPv4 (${addr.address}): ${res.reason}`
          );
        }
      } else if (addr.family === 6) {
        const res = isRestrictedIpv6(addr.address, options.allowLocalNetworks);
        if (res.restricted) {
          throw new SsrfBlockedError(
            cleanHost,
            `Hostname resolves to restricted IPv6 (${addr.address}): ${res.reason}`
          );
        }
      }
    }
  } catch (err: any) {
    if (err instanceof SsrfBlockedError || err.isSsrfBlocked) {
      throw err;
    }
    // DNS resolution failure (e.g. ENOTFOUND): rethrow
    throw err;
  }

  return parsedUrl;
}
