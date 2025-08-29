// backend/src/controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = "7d";

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

    // const ok = await bcrypt.compare(password, user.password); // 해시 비교 복구
    // if (!ok) {
    //   return res.status(401).json({ message: "Invalid credentials" });
    // }

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
      "SELECT userNo, username, nickName, createdAt FROM USERS WHERE userNo=? LIMIT 1",
      [userNo]
    );
    if (!row) return res.status(404).json({ message: "Not found" });

    return res.json(row);
  } catch (err) {
    next(err);
  }
}