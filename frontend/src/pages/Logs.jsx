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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-';
  }
  try {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (err) {
    return date.toISOString();
  }
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
        const list = Array.isArray(data) ? data : [];
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white shadow rounded-xl p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">로그 조회</h1>
          <p className="mt-2 text-sm text-blue-700">
            로그인 아이디별로 광고를 선택하고, 선택한 광고에 대한 접속 로그를 확인합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
          <div>
            <label htmlFor="log-ad-select" className="block text-sm font-semibold text-blue-900">
              광고 선택
            </label>
            <select
              id="log-ad-select"
              className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-blue-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100"
              value={selected}
              disabled={adsLoading || !ads.length}
              onChange={(e) => setSelected(e.target.value)}
            >
              {ads.map((item, index) => {
                const userAdNo = item?.userAdNo ?? '';
                const name = item?.adName ? ` · ${item.adName}` : '';
                const key = userAdNo || `ad-${item?.adSeq ?? index}`;
                return (
                  <option key={key} value={userAdNo} disabled={!userAdNo}>
                    {userAdNo || '(미지정)'}{name}{!userAdNo ? ' · 로그 조회 불가' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="text-sm text-blue-600 min-h-[1.75rem] flex items-center">
            {infoMessage}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-xl overflow-hidden">
        {selectedAd && (
          <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/60 text-sm text-blue-800 flex flex-wrap gap-2">
            <span className="font-semibold">광고번호: {selectedAd.userAdNo || '(미지정)'}</span>
            {selectedAd.adName && <span>· {selectedAd.adName}</span>}
            {selectedAd.adDomain && <span>· {selectedAd.adDomain}</span>}
          </div>
        )}

        {logsLoading ? (
          <div className="p-6 text-sm text-blue-700">로그를 불러오는 중입니다...</div>
        ) : logsError ? (
          <div className="p-6 text-sm text-red-600">{logsError}</div>
        ) : !selected ? (
          <div className="p-6 text-sm text-blue-700">광고를 선택하면 로그가 표시됩니다.</div>
        ) : !logs.length ? (
          <div className="p-6 text-sm text-blue-700">표시할 로그가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-100 text-sm text-left">
              <thead className="bg-blue-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-blue-900">로그 코드</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-blue-900">광고번호</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-blue-900">접속 IP</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-blue-900">접속 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {logs.map((item) => {
                  const key = item?.logKey || `${item?.userAdNo ?? ''}-${item?.createdAt ?? ''}-${item?.rawIp ?? ''}`;
                  return (
                    <tr key={key} className="hover:bg-blue-50/50">
                      <td className="px-4 py-3 font-mono text-blue-900">{item?.logKey || '-'}</td>
                      <td className="px-4 py-3 text-blue-900">{item?.userAdNo || '-'}</td>
                      <td className="px-4 py-3 text-blue-800">{item?.rawIp || '-'}</td>
                      <td className="px-4 py-3 text-blue-800">{formatDateTime(item?.createdAt)}</td>
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
