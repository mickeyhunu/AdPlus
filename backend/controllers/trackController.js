// backend/src/controllers/trackController.js
import { pool } from "../config/db.js";

function getKstDateParts() {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return { dayISO: `${y}-${m}-${d}`, dayCompact: `${y}${m}${d}` };
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

/**
 * GET /api/track?adCode=og_2_1   // 이 형태만 허용
 * logKey = YYYYMMDD_adCode_seq(4)
 * seq은 (createdDay, userAdNo) 별로 1부터 증가
 */
export async function trackByAdCode(req, res, next) {
  try {
    const adCode = String(req.query.adCode || "").trim();
    if (!adCode) return res.status(400).json({ message: "adCode required" });

    // adCode → userAdNo 매핑
    const [[ad]] = await pool.query(
      "SELECT userAdNo FROM ADS WHERE adCode=? LIMIT 1",
      [adCode]
    );
    if (!ad) return res.status(404).json({ message: "ad not found" });

    const userAdNo = ad.userAdNo;        // 예: '2_1'
    const ip = getClientIp(req);
    const { dayISO, dayCompact } = getKstDateParts();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 날짜+userAdNo 별 시퀀스 증가 (원자적)
      await conn.query(
        `INSERT INTO AD_LOGS_SEQUENCES (createdDay, userAdNo, nextSeq)
         VALUES (?, ?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE nextSeq = LAST_INSERT_ID(nextSeq + 1)`,
        [dayISO, userAdNo]
      );
      const [[{ seq }]] = await conn.query("SELECT LAST_INSERT_ID() AS seq");

      // logKey = YYYYMMDD_adCode_0001
      const logKey = `${dayCompact}_${adCode}_${String(seq).padStart(4, "0")}`;

      await conn.query(
        "INSERT INTO AD_LOGS (logKey, userAdNo, rawIp) VALUES (?,?,?)",
        [logKey, userAdNo, ip]
      );

      await conn.commit();
      return res.status(204).end();
    } catch (e) {
      await conn.rollback();

      // 드물게 충돌 시 1회 재시도
      if (e?.code === "ER_DUP_ENTRY") {
        try {
          await conn.beginTransaction();
          await conn.query(
            `INSERT INTO AD_LOGS_SEQUENCES (createdDay, userAdNo, nextSeq)
             VALUES (?, ?, LAST_INSERT_ID(1))
             ON DUPLICATE KEY UPDATE nextSeq = LAST_INSERT_ID(nextSeq + 1)`,
            [dayISO, userAdNo]
          );
          const [[{ seq }]] = await conn.query("SELECT LAST_INSERT_ID() AS seq");
          const logKey = `${dayCompact}_${adCode}_${String(seq).padStart(4, "0")}`;
          await conn.query(
            "INSERT INTO AD_LOGS (logKey, userAdNo, rawIp) VALUES (?,?,?)",
            [logKey, userAdNo, ip]
          );
          await conn.commit();
          return res.status(204).end();
        } catch (e2) {
          await conn.rollback();
          return next(e2);
        }
      }

      return next(e);
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}
