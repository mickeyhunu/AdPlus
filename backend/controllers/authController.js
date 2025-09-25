// backend/src/controllers/authController.js
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { normalizeIp } from "../utils/ip.js";
import { fetchUserExcludedIps } from "../services/userService.js";
import { isIP } from "net";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = "7d";

function toNullableNumber(value) {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function toDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeServiceAvailability(startAt, endAt) {
  const now = new Date();
  const start = toDateOrNull(startAt);
  const end = toDateOrNull(endAt);
  if (start && now < start) return { available: false, start, end };
  if (end && now > end) return { available: false, start, end };
  return { available: true, start, end };
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Bad request" });
    }

    const [rows] = await pool.query(
      "SELECT userNo, username, nickName, password FROM USERS WHERE username=? LIMIT 1",
      [username]
    );
    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    // 평문 비교
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { 
        sub: user.userNo,             // 표준 subject
        userNo: user.userNo,          // 호환용
        username: user.username,
        nickName: user.nickName,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({ token });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.sub ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const [[row]] = await pool.query(
      `SELECT userNo, username, nickName, createdAt, maxAdCount, serviceStartAt, serviceEndAt
        FROM USERS
      WHERE userNo=?
      LIMIT 1`,
      [userNo]
    );
    if (!row) return res.status(404).json({ message: "Not found" });

    const excludedIps = await fetchUserExcludedIps(pool, userNo);

    const maxAdCount = toNullableNumber(row.maxAdCount);
    const { available: serviceAvailable, start, end } =
      computeServiceAvailability(row.serviceStartAt, row.serviceEndAt);

    return res.json({
      userNo: row.userNo,
      username: row.username,
      nickName: row.nickName,
      createdAt: row.createdAt,
      maxAdCount,
      serviceStartAt: start,
      serviceEndAt: end,
      serviceAvailable,
      excludedIps,
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePassword(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.sub ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const { currentPassword = "", newPassword = "" } = req.body || {};
    const currentValue = String(currentPassword ?? "");
    const nextValue = String(newPassword ?? "");

    if (!currentValue || !nextValue) {
      return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 모두 입력해 주세요." });
    }

    if (nextValue.length < 4) {
      return res.status(400).json({ message: "새 비밀번호는 최소 4자 이상이어야 합니다." });
    }

    const [[row]] = await pool.query(
      `SELECT password FROM USERS WHERE userNo = ? LIMIT 1`,
      [userNo]
    );

    if (!row) {
      return res.status(404).json({ message: "사용자 정보를 찾을 수 없습니다." });
    }

    if (String(row.password ?? "") !== currentValue) {
      return res.status(400).json({ message: "현재 비밀번호가 일치하지 않습니다." });
    }

    if (currentValue === nextValue) {
      return res.status(400).json({ message: "새 비밀번호가 기존 비밀번호와 동일합니다." });
    }

    await pool.query(
      `UPDATE USERS SET password = ? WHERE userNo = ? LIMIT 1`,
      [nextValue, userNo]
    );

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function updateExcludedIps(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.sub ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const requested = Array.isArray(req.body?.ips) ? req.body.ips : [];
    const normalizedSet = new Map();

    for (const item of requested) {
      const normalized = normalizeIp(item);
      if (!normalized) continue;

      if (isIP(normalized) === 0) {
        return res.status(400).json({ message: `유효한 IP 형식이 아닙니다: ${item}` });
      }

      if (!normalizedSet.has(normalized)) {
        normalizedSet.set(normalized, normalized);
      }
    }

    if (normalizedSet.size > 3) {
      return res.status(400).json({ message: "최대 3개의 IP만 등록할 수 있습니다." });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(`DELETE FROM USER_EXCLUDED_IPS WHERE userNo = ?`, [userNo]);

      if (normalizedSet.size > 0) {
        const placeholders = Array.from({ length: normalizedSet.size }, () => "(?, ?)").join(",");
        const params = [];
        for (const ip of normalizedSet.values()) {
          params.push(userNo, ip);
        }
        await conn.query(
          `INSERT INTO USER_EXCLUDED_IPS (userNo, ipAddress) VALUES ${placeholders}`,
          params
        );
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const excludedIps = await fetchUserExcludedIps(pool, userNo);
    return res.json({ excludedIps });
  } catch (err) {
    next(err);
  }
}