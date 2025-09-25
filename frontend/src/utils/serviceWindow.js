// src/utils/serviceWindow.js
// 공통 서비스 이용 기간 계산 및 포맷 도우미

export function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value, options) {
  const date = parseDateValue(value);
  if (!date) return null;
  const locale = "ko-KR";
  const formatterOptions = options || { dateStyle: "medium", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat(locale, formatterOptions).format(date);
  } catch (err) {
    if (typeof date.toLocaleString === "function") {
      return date.toLocaleString(locale);
    }
    return date.toISOString();
  }
}

function resolveStart(input) {
  if (!input || typeof input !== "object") return null;
  return (
    input.serviceStartAt ??
    input.startAt ??
    input.start ??
    null
  );
}

function resolveEnd(input) {
  if (!input || typeof input !== "object") return null;
  return (
    input.serviceEndAt ??
    input.endAt ??
    input.end ??
    null
  );
}

function resolveAvailability(input) {
  if (!input || typeof input !== "object") return undefined;
  return (
    input.serviceAvailable ??
    input.available ??
    input.isAvailable
  );
}

export function computeServiceWindow(input) {
  const start = parseDateValue(resolveStart(input));
  const end = parseDateValue(resolveEnd(input));
  const now = new Date();
  const computedAvailable = (!start || now >= start) && (!end || now <= end);
  const explicitAvailable = resolveAvailability(input);
  const available = explicitAvailable ?? computedAvailable;

  let status = "available";
  if (!available) {
    if (start && now < start) status = "scheduled";
    else if (end && now > end) status = "expired";
    else status = "unavailable";
  }

  return { available, status, start, end };
}

export default computeServiceWindow;