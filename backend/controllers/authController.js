// backend/src/controllers/authController.js
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

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
    });
  } catch (err) {
    next(err);
  }
}