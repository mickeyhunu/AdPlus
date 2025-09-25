export function normalizeIp(raw) {
  if (raw === undefined || raw === null) return "";
  let value = String(raw).trim();
  if (!value) return "";

  // IPv6 zone identifier 제거 (예: fe80::1%eth0)
  const percentIndex = value.indexOf("%");
  if (percentIndex !== -1) {
    value = value.slice(0, percentIndex);
  }

  if (value.startsWith("::ffff:")) {
    const candidate = value.slice(7);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)) {
      value = candidate;
    }
  }

  return value.toLowerCase();
}

export function buildIpVariants(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    variants.add(`::ffff:${normalized}`);
  }
  return Array.from(variants);
}