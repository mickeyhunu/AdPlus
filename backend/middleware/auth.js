// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 토큰 payload 어디에 있든 userNo를 보장해서 세팅
    const userNo = decoded.sub ?? decoded.userNo ?? decoded.id; // id는 구형 호환
    if (!userNo) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.user = {
      userNo,
      username: decoded.username,
      nickName: decoded.nickName, // 토큰에 있으면 전달
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}
