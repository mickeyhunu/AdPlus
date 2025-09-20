// backend/src/controllers/adsController.js
import { pool } from "../config/db.js";

/* ───────────────────────── 공통(KST) 포맷 도우미 ───────────────────────── */
function nowKST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}
function fmt(d, s) { // s:'ymd','ymdhm','ymdh','ym','isoWeek'
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  if (s === "ymd")   return `${yyyy}-${mm}-${dd}`;
  if (s === "ymdhm") return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  if (s === "ymdh")  return `${yyyy}-${mm}-${dd} ${hh}:00`;
  if (s === "ym")    return `${yyyy}-${mm}`;
  if (s === "isoWeek") {
    const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((u - yearStart) / 86400000 + 1) / 7);
    return `${u.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return "";
}

/* ───────────────────────── 버킷 경계로 내림 ───────────────────────── */
function floorToBucket(d, bucket) {
  const x = new Date(d);
  switch (bucket) {
    case "1m":  x.setSeconds(0, 0); return x;
    case "5m":  x.setSeconds(0, 0); x.setMinutes(Math.floor(x.getMinutes()/5)*5); return x;
    case "10m": x.setSeconds(0, 0); x.setMinutes(Math.floor(x.getMinutes()/10)*10); return x;
    case "30m": x.setSeconds(0, 0); x.setMinutes(Math.floor(x.getMinutes()/30)*30); return x;
    case "1h":  x.setMinutes(0, 0, 0); return x;
    case "1d":  x.setHours(0, 0, 0, 0); return x;
    default:    return x;
  }
}

/* ───────────────────────── 라벨 생성기(KST) ───────────────────────── */
function buildLabels(start, end, bucket) {
  const labels = [];
  const cur = new Date(start.getTime());
  const floor = (m, unit) => m - (m % unit);

  switch (bucket) {
    case "1m": {
      cur.setSeconds(0, 0);
      while (cur <= end) { labels.push(fmt(cur, "ymdhm")); cur.setMinutes(cur.getMinutes() + 1); }
      break;
    }
    case "5m": {
      cur.setSeconds(0, 0); cur.setMinutes(floor(cur.getMinutes(), 5));
      while (cur <= end) { labels.push(fmt(cur, "ymdhm")); cur.setMinutes(cur.getMinutes() + 5); }
      break;
    }
    case "10m": {
      cur.setSeconds(0, 0); cur.setMinutes(floor(cur.getMinutes(), 10));
      while (cur <= end) { labels.push(fmt(cur, "ymdhm")); cur.setMinutes(cur.getMinutes() + 10); }
      break;
    }
    case "30m": {
      cur.setSeconds(0, 0); cur.setMinutes(floor(cur.getMinutes(), 30));
      while (cur <= end) { labels.push(fmt(cur, "ymdhm")); cur.setMinutes(cur.getMinutes() + 30); }
      break;
    }
    case "1h": {
      cur.setMinutes(0, 0, 0);
      while (cur <= end) { labels.push(fmt(cur, "ymdh")); cur.setHours(cur.getHours() + 1); }
      break;
    }
    case "1d": {
      cur.setHours(0, 0, 0, 0);
      while (cur <= end) { labels.push(fmt(cur, "ymd")); cur.setDate(cur.getDate() + 1); }
      break;
    }
    case "1w": {
      const day = cur.getDay() || 7;
      cur.setDate(cur.getDate() - (day - 1)); cur.setHours(0, 0, 0, 0);
      while (cur <= end) { labels.push(fmt(cur, "isoWeek")); cur.setDate(cur.getDate() + 7); }
      break;
    }
    case "1mo":
    default: {
      cur.setDate(1); cur.setHours(0, 0, 0, 0);
      while (cur <= end) { labels.push(fmt(cur, "ym")); cur.setMonth(cur.getMonth() + 1); }
      break;
    }
  }
  return labels;
}

/* ───────────────────────── SQL 버킷식(KST: UTC→+09) ─────────────────────────
   ※ DB의 createdAt이 이미 KST라면 CONVERT_TZ를 제거하거나 '+09:00'→'+00:00'을
   적절히 조정하세요.
   const base = `CONVERT_TZ(l.createdAt, '+00:00', '+09:00')`;
-------------------------------------------------------------------------- */

/* ───────────────────────── SQL 버킷식(KST 그대로 사용) ───────────────────────── */
function sqlBucketExpr(bucket) {
  const base = "l.createdAt";
  switch (bucket) {
    case "1m":  return `DATE_FORMAT(${base}, '%Y-%m-%d %H:%i')`;
    case "5m":  return `DATE_FORMAT(DATE_SUB(${base}, INTERVAL MOD(MINUTE(${base}),5)  MINUTE), '%Y-%m-%d %H:%i')`;
    case "10m": return `DATE_FORMAT(DATE_SUB(${base}, INTERVAL MOD(MINUTE(${base}),10) MINUTE), '%Y-%m-%d %H:%i')`;
    case "30m": return `CONCAT(DATE_FORMAT(${base}, '%Y-%m-%d %H:'), LPAD(FLOOR(MINUTE(${base})/30)*30, 2, '0'))`;
    case "1h":  return `DATE_FORMAT(${base}, '%Y-%m-%d %H:00')`;
    case "1d":  return `DATE_FORMAT(${base}, '%Y-%m-%d')`;
    case "1w":  return `DATE_FORMAT(${base}, '%x-W%v')`;
    case "1mo":
    default:    return `DATE_FORMAT(${base}, '%Y-%m')`;
  }
}

/* ───────────────────────── 내 광고 목록 ───────────────────────── */
export async function listMyAds(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await pool.query(
      `SELECT adSeq, userAdNo, adName, adDomain, adCode
         FROM ADS
        WHERE userNo = ?
        ORDER BY createdAt DESC`,
      [userNo]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

/* ───────────────────────── 광고 로그 조회 ───────────────────────── */
export async function listAdLogs(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const rawUserAdNo = String(req.query.userAdNo || "").trim();
    if (!rawUserAdNo) {
      return res.status(400).json({ message: "userAdNo is required" });
    }

    const [[ad]] = await pool.query(
      `SELECT userAdNo
         FROM ADS
        WHERE userNo = ? AND userAdNo = ?
        LIMIT 1`,
      [userNo, rawUserAdNo]
    );
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    const limitRaw = Number(req.query.limit || 200);
    const offsetRaw = Number(req.query.offset || 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 200;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

    const [rows] = await pool.query(
      `SELECT logKey, userAdNo, rawIp, createdAt
         FROM AD_LOGS
        WHERE userAdNo = ?
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?`,
      [rawUserAdNo, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM AD_LOGS
        WHERE userAdNo = ?`,
      [rawUserAdNo]
    );

    const total = Number(countRow?.total ?? 0);
    return res.json({
      userAdNo: rawUserAdNo,
      logs: rows,
      meta: {
        limit,
        offset,
        total,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (err) { next(err); }
}

/* ───────────────────────── 통계(분 단위~) ───────────────────────── */
export async function getAdsStats(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const days   = Math.max(1, Number(req.query.days || 7));
    const bucket = String(req.query.bucket || "1h");          // '1m' | '5m' | '10m' | '30m' | '1h' | ...
    const adFilter = String(req.query.ad || "").trim();       // userAdNo. "ALL"/"" → 전체

    // 내가 볼 수 있는 광고
    const [ads] = await pool.query(
      `SELECT adSeq, userAdNo, adName FROM ADS WHERE userNo = ?`,
      [userNo]
    );
    if (!ads.length) return res.json({ labels: [], series: [] });

    const allUserAdNos = ads.map(a => a.userAdNo);
    let target = allUserAdNos;
    if (adFilter && adFilter !== "ALL") {
      if (!allUserAdNos.includes(adFilter)) return res.json({ labels: [], series: [] });
      target = [adFilter];
    }

    // ▼ 날짜 기준 범위: (오늘- (days-1)) 자정 ~ 오늘 23:59 → 버킷 경계로 내림
    const now = nowKST();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 0, 0);
    const end = floorToBucket(endOfToday, bucket);

    // SQL: KST 변환 후 start~end 사이만 집계
    const expr = sqlBucketExpr(bucket);
    const placeholders = target.map(() => "?").join(",");
    const params = [
      ...target,
      `${fmt(start, "ymd")} 00:00:00`,
      // end+1단계 직전까지 포함시키기 위해 끝 경계도 문자열 생성
      (bucket === "1d") ? `${fmt(end, "ymd")} 23:59:59` :
      (bucket === "1h") ? `${fmt(end, "ymdh").slice(0, 13)}:59:59` :
                          `${fmt(end, "ymdhm")}:59`,
    ];

    const sql = `
      SELECT l.userAdNo, ${expr} AS bucketKey, COUNT(*) AS cnt
        FROM AD_LOGS l
       WHERE l.userAdNo IN (${placeholders})
         AND CONVERT_TZ(l.createdAt, '+00:00', '+09:00') BETWEEN ? AND ?
       GROUP BY l.userAdNo, bucketKey
       ORDER BY bucketKey ASC
    `;
    const [rows] = await pool.query(sql, params);

    // 라벨(자정~오늘 23:59) 생성 및 매핑
    const labels = buildLabels(start, end, bucket);
    const idx = new Map(labels.map((k, i) => [k, i]));
    const seriesMap = new Map(target.map(t => [t, Array(labels.length).fill(0)]));

    for (const r of rows) {
      const pos = idx.get(String(r.bucketKey));
      if (pos === undefined) continue;
      const arr = seriesMap.get(r.userAdNo);
      if (arr) arr[pos] = Number(r.cnt);
    }

    // 라벨이 1개만 생겨도 라인 보이도록 최소 2개 보장
    if (labels.length < 2) {
      const prev = new Date(end);
      if (bucket === "1m")      prev.setMinutes(prev.getMinutes() - 1);
      else if (bucket === "5m") prev.setMinutes(prev.getMinutes() - 5);
      else if (bucket === "10m")prev.setMinutes(prev.getMinutes() - 10);
      else if (bucket === "30m")prev.setMinutes(prev.getMinutes() - 30);
      else if (bucket === "1h") prev.setHours(prev.getHours() - 1);
      else if (bucket === "1d") prev.setDate(prev.getDate() - 1);

      const head =
        bucket === "1d" ? fmt(prev, "ymd") :
        bucket === "1h" ? fmt(prev, "ymdh") :
                          fmt(prev, "ymdhm");

      labels.unshift(head);
      for (const k of seriesMap.keys()) seriesMap.get(k).unshift(0);
    }

    const series = Array.from(seriesMap.entries()).map(([userAdNo, data]) => {
      const meta = ads.find(a => a.userAdNo === userAdNo);
      const displayName = meta?.adName
        || (meta?.adSeq !== undefined && meta?.adSeq !== null ? String(meta.adSeq) : userAdNo);
      return {
        userAdNo,
        adSeq: meta?.adSeq ?? null,
        name: displayName, // 차트 라벨용
        data,
      };
    });

    return res.json({ labels, series });
  } catch (err) { next(err); }
}

/* ───────────────────────── 광고 상세 ───────────────────────── */
export async function getAdDetail(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });
    const rawAdSeq = String(req.params.adSeq || "").trim();
    if (!rawAdSeq) return res.status(400).json({ message: "Invalid adSeq" });
    const bySeq = /^\d+$/.test(rawAdSeq);
    const params = bySeq ? [userNo, Number(rawAdSeq)] : [userNo, rawAdSeq];
    const [[row]] = await pool.query(
      `SELECT adSeq, userAdNo, adName, adDomain, adCode
         FROM ADS
        WHERE userNo = ? AND ${bySeq ? "adSeq = ?" : "userAdNo = ?"}
        LIMIT 1`,
      params
    );
    if (!row) return res.status(404).json({ message: "Not found" });
    return res.json(row);
  } catch (err) { next(err); }
}

/* ───────────────────────── 광고 생성 ───────────────────────── */
export async function createAd(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });

    const { adName = "", adDomain = "", adCode = "" } = req.body || {};
    const nameValue   = String(adName ?? "").trim();
    const domainValue = String(adDomain ?? "").trim();
    const codeValue   = String(adCode ?? "").trim(); // ADS.adCode NOT NULL 대응

    const conn = await pool.getConnection();
    const lockName = `ads_user_${userNo}`;

    try {
      await conn.beginTransaction();

      // 동시성 방지: 사용자 단위 어드바이저리 락
      const [[lockRow]] = await conn.query("SELECT GET_LOCK(?, 5) AS ok", [lockName]);
      if (Number(lockRow?.ok) !== 1) {
        throw Object.assign(new Error("Cannot acquire user lock"), { status: 503 });
      }

      // (핵심) 해당 사용자 광고를 adSeq 오름차순으로 잠그고 읽음
      const [seqRows] = await conn.query(
        `SELECT adSeq
           FROM ADS
          WHERE userNo = ?
          ORDER BY adSeq ASC
          FOR UPDATE`,
        [userNo]
      );

      // 1부터 순차로 스캔하며 첫 번째 빈 번호 찾기
      let adSeq = 1;
      for (const r of seqRows) {
        const v = Number(r.adSeq);
        if (v < adSeq) continue;     // 중복/이상치 방어
        if (v === adSeq) adSeq++;    // 기대값과 같으면 다음 번호로
        else break;                  // (v > adSeq)면 adSeq가 첫 빈 번호
      }

      let userAdNo = `${userNo}_${adSeq}`;

      // 유니크 충돌(아주 드물게 발생 가능) 대비해 최대 5회 재시도
      let createdRow = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await conn.query(
            `INSERT INTO ADS (userAdNo, userNo, adSeq, adName, adDomain, adCode, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [userAdNo, userNo, adSeq, nameValue, domainValue, codeValue]
          );

          const [[created]] = await conn.query(
            `SELECT adSeq, userAdNo, adName, adDomain, adCode
               FROM ADS
              WHERE userNo = ? AND adSeq = ?
              LIMIT 1`,
            [userNo, adSeq]
          );
          createdRow = created ?? {
            adSeq,
            userAdNo,
            adName: nameValue,
            adDomain: domainValue,
            adCode: codeValue,
          };
          break;
        } catch (e) {
          if (e?.code === "ER_DUP_ENTRY") {
            // 혹시라도 충돌나면 다음 번호로 밀고 재시도
            adSeq += 1;
            userAdNo = `${userNo}_${adSeq}`;
            continue;
          }
          throw e;
        }
      }

      if (!createdRow) {
        throw Object.assign(new Error("Failed to allocate adSeq"), { status: 409 });
      }

      await conn.commit();
      return res.status(201).json(createdRow);
    } catch (e) {
      await conn.rollback();
      if (e?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Duplicate ad detected. Please try again." });
      }
      return next(e);
    } finally {
      try { await conn.query("SELECT RELEASE_LOCK(?)", [lockName]); } catch {}
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

/* ───────────────────────── 광고 수정 ───────────────────────── */
export async function updateAd(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });
    const rawAdSeq = String(req.params.adSeq || "").trim();
    if (!rawAdSeq) return res.status(400).json({ message: "Invalid adSeq" });
    const bySeq = /^\d+$/.test(rawAdSeq);
    const fields = {};
    const { adName, adDomain, adCode } = req.body || {};
    if (adName !== undefined) fields.adName = adName;
    if (adDomain !== undefined) fields.adDomain = adDomain;
    if (adCode !== undefined) fields.adCode = adCode;
    if (Object.keys(fields).length === 0) return res.status(400).json({ message: "No fields" });
    const setSql = Object.keys(fields).map(k => `${k}=?`).join(", ");
    const params = [...Object.values(fields), userNo, bySeq ? Number(rawAdSeq) : rawAdSeq]
    const [result] = await pool.query(
      `UPDATE ADS SET ${setSql} WHERE userNo = ? AND ${bySeq ? "adSeq = ?" : "userAdNo = ?"}`,
      params
    );
    return res.json({ updated: result.affectedRows });
  } catch (err) { next(err); }
}

/* ───────────────────────── 광고 다중 삭제 ───────────────────────── */
export async function bulkDeleteAds(req, res, next) {
  try {
    const userNo = req.user?.userNo ?? req.user?.id;
    if (!userNo) return res.status(401).json({ message: "Unauthorized" });
    const list = Array.isArray(req.body?.adSeqList) ? req.body.adSeqList : [];
    if (list.length === 0) return res.json({ deleted: 0 });
    
    const seqIds = [];
    const rawUserAdNos = new Set();
    for (const item of list) {
      const value = String(item ?? "").trim();
      if (!value) continue;
      if (/^\d+$/.test(value)) seqIds.push(Number(value));
      else rawUserAdNos.add(value);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const confirmed = new Set();
      if (seqIds.length > 0) {
        const seqPlaceholders = seqIds.map(() => "?").join(",");
        const [rows] = await conn.query(
          `SELECT userAdNo
             FROM ADS
            WHERE userNo = ? AND adSeq IN (${seqPlaceholders})`,
          [userNo, ...seqIds]
        );
        for (const row of rows) {
          if (row?.userAdNo) confirmed.add(row.userAdNo);
        }
      }

      if (rawUserAdNos.size > 0) {
        const listUserAdNos = Array.from(rawUserAdNos);
        const placeholdersUser = listUserAdNos.map(() => "?").join(",");
        const [rows] = await conn.query(
          `SELECT userAdNo
             FROM ADS
            WHERE userNo = ? AND userAdNo IN (${placeholdersUser})`,
          [userNo, ...listUserAdNos]
        );
        for (const row of rows) {
          if (row?.userAdNo) confirmed.add(row.userAdNo);
        }
      }

      const finalUserAdNos = Array.from(confirmed).filter(Boolean);
      if (finalUserAdNos.length === 0) {
        await conn.commit();
        return res.json({ deleted: 0 });
      }

      const placeholders = finalUserAdNos.map(() => "?").join(",");
      await conn.query(`DELETE FROM AD_LOGS WHERE userAdNo IN (${placeholders})`, finalUserAdNos);
      await conn.query(`DELETE FROM AD_LOGS_SEQUENCES WHERE userAdNo IN (${placeholders})`, finalUserAdNos);
      const [result] = await conn.query(
        `DELETE FROM ADS WHERE userNo = ? AND userAdNo IN (${placeholders})`,
        [userNo, ...finalUserAdNos]
      );

      await conn.commit();
      return res.json({ deleted: result.affectedRows });
    } catch (e) {
      await conn.rollback();
      return next(e);
    } finally {
      conn.release();
    }
  } catch (err) { next(err); }
}