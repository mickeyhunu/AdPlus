import { pool } from "../config/db.js";
import { normalizeIp } from "../utils/ip.js";

export async function fetchUserExcludedIps(executor, userNo) {
  if (!userNo) return [];
  const target = executor && typeof executor.query === "function" ? executor : pool;
  const [rows] = await target.query(
    `SELECT ipAddress
       FROM USER_EXCLUDED_IPS
      WHERE userNo = ?
      ORDER BY excludedIpId ASC`,
    [userNo]
  );
  return rows
    .map((row) => normalizeIp(row.ipAddress))
    .filter((ip) => typeof ip === "string" && ip.length > 0);
}