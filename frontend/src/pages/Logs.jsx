// src/pages/Logs.jsx
import { useEffect, useMemo, useState } from 'react';
import { myAds } from '../api/ads';
import { fetchAdLogs } from '../api/logs';

const DEFAULT_LIMIT = 200;

function compareUserAdNo(a, b) {
  const av = a?.userAdNo ?? '';
  const bv = b?.userAdNo ?? '';
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
}

function sortAds(list) {
  if (!Array.isArray(list)) return [];
  const cloned = [...list];
  cloned.sort(compareUserAdNo);
  return cloned;
}

function extractAdsList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.ads)) return data.ads;
  return [];
}

function normalizeDateTimeString(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return '-';

  const isoMatch = trimmed.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})[T ]([0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.[0-9]+)?(?:Z)?$/);
  if (isoMatch) {
    const [, datePart, timePart] = isoMatch;
    return `${datePart} ${timePart}`;
  }

  return trimmed;
}

function formatAsKst(date) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    const { year, month, day, hour, minute, second } = map;
    if (year && month && day && hour && minute && second) {
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    return formatter.format(date).replace('T', ' ');
  } catch (err) {
    const utcMs = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
    const kst = new Date(utcMs + 9 * 60 * 60 * 1000);
    const yyyy = kst.getFullYear();
    const mm = String(kst.getMonth() + 1).padStart(2, '0');
    const dd = String(kst.getDate()).padStart(2, '0');
    const hh = String(kst.getHours()).padStart(2, '0');
    const mi = String(kst.getMinutes()).padStart(2, '0');
    const ss = String(kst.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }
}

function formatDateTime(value) {
  if (value === null || value === undefined) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date?.getTime?.())) {
    return formatAsKst(date);
  }

  if (typeof value === 'string') {
    return normalizeDateTimeString(value);
  }

  return normalizeDateTimeString(String(value));
}

export default function Logs() {
  const [ads, setAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsError, setAdsError] = useState(null);
  const [selected, setSelected] = useState('');

  const [logs, setLogs] = useState([]);
  const [logsMeta, setLogsMeta] = useState({ limit: DEFAULT_LIMIT, offset: 0, total: 0, hasMore: false });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);

  useEffect(() => {
    let active = true;
    const loadAds = async () => {
      setAdsLoading(true);
      setAdsError(null);
      try {
        const { data } = await myAds();
        if (!active) return;
        const list = extractAdsList(data);
        const ordered = sortAds(list);
        setAds(ordered);
        const firstUsable = ordered.find((item) => item?.userAdNo);
        setSelected((prev) => {
          if (prev && ordered.some((item) => item?.userAdNo === prev)) {
            return prev;
          }
          return firstUsable?.userAdNo ?? '';
        });
      } catch (err) {
        if (!active) return;
        const message = err?.response?.data?.message || '광고 목록을 불러오지 못했습니다.';
        setAdsError(message);
        setAds([]);
        setSelected('');
      } finally {
        if (active) setAdsLoading(false);
      }
    };
    loadAds();
    return () => {
      active = false;
    };
  }, []);

  const selectedAd = useMemo(() => ads.find((item) => item?.userAdNo === selected) || null, [ads, selected]);

  useEffect(() => {
    if (!selected) {
      setLogs([]);
      setLogsMeta({ limit: DEFAULT_LIMIT, offset: 0, total: 0, hasMore: false });
      setLogsError(null);
      return;
    }
    let active = true;
    const loadLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const { data } = await fetchAdLogs({ userAdNo: selected, limit: DEFAULT_LIMIT });
        if (!active) return;
        const list = Array.isArray(data?.logs)
          ? data.logs
          : Array.isArray(data)
            ? data
            : [];
        setLogs(list);
        const meta = data?.meta || {};
        const limitVal = Number(meta.limit);
        const offsetVal = Number(meta.offset);
        const totalVal = Number(meta.total);
        const computedHasMore =
          typeof meta.hasMore === 'boolean'
            ? meta.hasMore
            : (Number.isFinite(offsetVal) ? offsetVal : 0) + list.length < (Number.isFinite(totalVal) ? totalVal : list.length);
        setLogsMeta({
          limit: Number.isFinite(limitVal) ? limitVal : DEFAULT_LIMIT,
          offset: Number.isFinite(offsetVal) ? offsetVal : 0,
          total: Number.isFinite(totalVal) ? totalVal : list.length,
          hasMore: computedHasMore,
        });
      } catch (err) {
        if (!active) return;
        const message = err?.response?.data?.message || '로그를 불러오지 못했습니다.';
        setLogs([]);
        setLogsMeta({ limit: DEFAULT_LIMIT, offset: 0, total: 0, hasMore: false });
        setLogsError(message);
      } finally {
        if (active) setLogsLoading(false);
      }
    };
    loadLogs();
    return () => {
      active = false;
    };
  }, [selected]);

  const infoMessage = useMemo(() => {
    if (adsLoading) return '광고 목록을 불러오는 중입니다.';
    if (adsError) return adsError;
    if (!ads.length) return '등록된 광고가 없습니다.';
    if (!selected) return '광고를 선택하면 로그가 표시됩니다.';
    if (logsLoading) return '선택한 광고의 로그를 불러오는 중입니다.';
    if (logsError) return logsError;
    if (!logs.length) return '표시할 로그가 없습니다.';
    const latestCount = logs.length.toLocaleString();
    const totalCount = logsMeta.total.toLocaleString();
    const moreText = logsMeta.hasMore ? ' (더 많은 로그는 검색 조건을 조정해주세요.)' : '';
    return `총 ${totalCount}건 중 최신 ${latestCount}건을 표시합니다.${moreText}`;
  }, [ads.length, adsError, adsLoading, logs.length, logsError, logsLoading, logsMeta.hasMore, logsMeta.total, selected]);

  const infoTone = useMemo(() => {
    if (adsError || logsError) return 'text-red-600';
    if (adsLoading || logsLoading) return 'text-slate-500';
    return 'text-slate-600';
  }, [adsError, adsLoading, logsError, logsLoading]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">로그 조회</h2>
          <p className="mt-1 text-sm text-slate-600">
            로그인 아이디별로 광고를 선택하고, 선택한 광고에 대한 접속 로그를 확인합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <label htmlFor="log-ad-select" className="block text-sm font-semibold text-slate-700">
            광고 선택
          </label>
          <select
            id="log-ad-select"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            value={selected}
            disabled={adsLoading || !ads.length}
            onChange={(e) => setSelected(e.target.value)}
          >
            {ads.map((item, index) => {
              const userAdNo = item?.userAdNo ?? '';
              const name = item?.adName ? ` - ${item.adName}` : '';
              const key = userAdNo || `ad-${item?.adSeq ?? index}`;
              return (
                <option key={key} value={userAdNo} disabled={!userAdNo}>
                  {userAdNo || '(미지정)'}{name}{!userAdNo ? ' · 로그 조회 불가' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className={`rounded-xl border bg-white p-4 shadow-sm text-sm ${infoTone}`}>
          {infoMessage}
        </div>
      </div>

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        {selectedAd && (
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 text-sm text-slate-600 flex flex-wrap gap-2">          
            <span className="font-semibold">광고번호: {selectedAd.userAdNo || '(미지정)'}</span>
            {selectedAd.adName && <span className="font-semibold">- {selectedAd.adName}</span>}
            {selectedAd.adDomain && <span className="font-semibold">- {selectedAd.adDomain}</span>}
          </div>
        )}

        {logsLoading ? (
          <div className="p-6 text-sm text-slate-500">로그를 불러오는 중입니다...</div>
        ) : logsError ? (
          <div className="p-6 text-sm text-red-600">{logsError}</div>
        ) : !selected ? (
          <div className="p-6 text-sm text-slate-500">광고를 선택하면 로그가 표시됩니다.</div>
        ) : !logs.length ? (
          <div className="p-6 text-sm text-slate-500">표시할 로그가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-blue-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">로그 코드</th>
                  {/* <th scope="col" className="px-4 py-3 font-semibold text-slate-700">광고번호</th> */}
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">접속 IP</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">접속 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((item) => {
                  const key = item?.logKey || `${item?.userAdNo ?? ''}-${item?.createdAt ?? ''}-${item?.rawIp ?? ''}`;
                  return (
                    <tr key={key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-700">{item?.logKey || '-'}</td>
                      {/* <td className="px-4 py-3 text-slate-700">{item?.userAdNo || '-'}</td> */}
                      <td className="px-4 py-3 text-slate-600">{item?.rawIp || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(item?.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
