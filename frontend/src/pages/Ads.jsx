// src/pages/Ads.jsx
import { useEffect, useMemo, useState } from 'react';
import { myAds, adCreate, adUpdate, adBulkDelete } from '../api/ads';

// 도메인/코드 맵
const DOMAIN_ITEMS = [
  { label: '오피가이드', value: '오피가이드', code: 'og' },
  { label: '오피스타',   value: '오피스타',   code: 'os' },
  { label: '기타',       value: '기타',       code: 'au' },
];

function domainToCode(domain) {
  const f = DOMAIN_ITEMS.find(d => d.value === domain);
  return f ? f.code : 'au';
}

function getUserNo() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.userNo ?? u?.id ?? null;
  } catch { return null; }
}

// adCode 생성기: `${domainCode}_${userNo}_${adSeq}`
function deriveSeqParts(value, fallbackCode) {
  const candidates = [];
  if (value !== undefined && value !== null) {
    const str = String(value).trim();
    if (str) candidates.push(str);
  }
  if (fallbackCode !== undefined && fallbackCode !== null) {
    const codePart = String(fallbackCode)
      .split('_')
      .filter(Boolean)
      .pop();
    if (codePart) candidates.push(codePart);
  }

  let raw = '';
  for (const candidate of candidates) {
    if (!candidate) continue;
    raw = candidate;
    break;
  }

  if (raw && typeof raw === 'string' && raw.toLowerCase() === 'nan') {
    raw = '';
  }

  const match = raw.match(/(\d+)(?!.*\d)/);
  let numeric = null;
  if (match) {
    const parsed = Number(match[1]);
    if (!Number.isNaN(parsed)) numeric = parsed;
  }
  if (numeric === null) {
    const direct = Number(raw);
    if (!Number.isNaN(direct)) numeric = direct;
  }

  const display = numeric ?? (raw || '');
  const key = raw || (display !== '' ? String(display) : '');
  return { key, numeric, display };
}

function deriveSeqFromItem(item = {}) {
  const fields = [
    'adSeq',
    'userAdNo',
    'userAdSeq',
    'adNo',
    'adSeqNo',
    'adId',
    'id',
    'seq',
  ];
  for (const field of fields) {
    const value = item?.[field];
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (!str) continue;
    return deriveSeqParts(str, item?.adCode);
  }
  return deriveSeqParts(undefined, item?.adCode);
}

// adCode 생성기: `${domainCode}_${userNo}_${adSeq}`
function buildAdCode(adDomain, userNo, adSeq) {
  const code = domainToCode(adDomain);
  const { display } = deriveSeqParts(adSeq);
  const seqPart = display ?? '';
  return `${code}_${userNo ?? ''}_${seqPart ?? ''}`;
}

export default function Ads() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState(new Set()); // adSeq Set
  const [current, setCurrent] = useState(null); // 편집 대상(객체)
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await myAds();
      // 대시보드 규격: userAdNo, adName …
      const list = Array.isArray(data) ? data : (data?.ads || []);
      const normalized = list.map(item => {
        const seqInfo = deriveSeqFromItem(item);
        const adSeq = seqInfo.key !== undefined && seqInfo.key !== null
          ? String(seqInfo.key)
          : '';
        const displayValue = seqInfo.display === '' || seqInfo.display === undefined
          ? adSeq
          : seqInfo.display;
        const labelValue = (displayValue === undefined || displayValue === null || displayValue === '')
          ? '-'
          : displayValue;
        return {
          adSeq,
          adSeqDisplay: displayValue,
          adSeqNumber: seqInfo.numeric,
          adSeqLabel: labelValue,
          adName: item.adName ?? item.name ?? '',
          adDomain: item.adDomain ?? '기타',
          adCode: item.adCode ?? '',
        };
      });
      normalized.sort((a, b) => {
        const aNum = a.adSeqNumber;
        const bNum = b.adSeqNumber;
        if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
        if (aNum != null && bNum == null) return -1;
        if (aNum == null && bNum != null) return 1;
        return String(a.adSeq).localeCompare(String(b.adSeq));
      });
      setRows(normalized);
      setSelectedKeys(prev => {
        if (prev.size === 0) return prev;
        const prevKeys = new Set();
        prev.forEach(value => {
          if (value === undefined || value === null) return;
          const str = String(value);
          if (str) prevKeys.add(str);
        });
        const next = new Set();
        for (const row of normalized) {
          if (prevKeys.has(row.adSeq)) next.add(row.adSeq);
        }
        return next;
      });
      setCurrent(prev => {
        if (!prev) return null;
        return normalized.find(r => r.adSeq === prev.adSeq) || null;
      });
      return normalized;
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // 전체선택
  const selectableKeys = useMemo(
    () => rows.map(r => r.adSeq).filter(key => key !== ''),
    [rows],
  );
  const allChecked = useMemo(
    () => selectableKeys.length > 0 && selectableKeys.every(key => selectedKeys.has(key)),
    [selectableKeys, selectedKeys],
  );
  const toggleAll = (checked) => {
    if (checked) setSelectedKeys(new Set(selectableKeys));  
    else setSelectedKeys(new Set());
  };
  const toggleOne = (adSeq, checked) => {
    const key = adSeq !== undefined && adSeq !== null ? String(adSeq) : '';
    if (!key) return;
    const s = new Set(selectedKeys);
    if (checked) s.add(key); else s.delete(key);
    setSelectedKeys(s);
  };

  // 생성 폼 상태
  const [newForm, setNewForm] = useState({ adName: '', adDomain: '기타' });

  // 저장(수정)
  const saveCurrent = async () => {
    if (!current) return;
    if (!current.adSeq) {
      alert('광고 번호 정보를 확인할 수 없습니다. 새로고침 후 다시 시도하세요.');
      return;
    }
    const latestUserNo = getUserNo();
    const seqForCode = current.adSeqDisplay ?? current.adSeq;
    const body = {
      adName: current.adName,
      adDomain: current.adDomain,
      // adCode는 서버 저장 전에 클라에서 생성해 전달 (요청사항)
      adCode: buildAdCode(current.adDomain, latestUserNo, seqForCode),
    };
    await adUpdate(current.adSeq, body);
    await load();
    alert('저장되었습니다.');
  };

  // 생성
  const createNew = async () => {
    if (!newForm.adName?.trim()) { alert('광고명을 입력하세요.'); return; }
    // 1) 우선 생성 (서버가 adSeq 발급)
    const { data } = await adCreate({ adName: newForm.adName, adDomain: newForm.adDomain });
    const createdInfo = deriveSeqFromItem(data || {});
    const createdKey = createdInfo.key !== undefined && createdInfo.key !== null
      ? String(createdInfo.key)
      : '';
    const createdDisplay = createdInfo.display === '' || createdInfo.display === undefined
      ? createdKey
      : createdInfo.display;
    if (!createdKey) {
      // 서버가 생성된 광고를 응답하지 않는 경우 목록 재조회로 대체
      await load();
      setCreating(false);
      setNewForm({ adName: '', adDomain: '기타' });
      return;
    }
    // 2) adCode 생성 후 즉시 업데이트 (요청한 규칙 적용)
    const latestUserNo = getUserNo();
    const seqForCode = createdDisplay ?? createdKey;
    const code = buildAdCode(newForm.adDomain, latestUserNo, seqForCode);
    await adUpdate(createdKey, { adCode: code });
    const refreshed = await load();
    
    setCreating(false);
    setNewForm({ adName: '', adDomain: '기타' });
  };

  // 다중 삭제
  const bulkDelete = async () => {
    if (selectedKeys.size === 0) { alert('선택된 광고가 없습니다.'); return; }
    const ids = Array.from(selectedKeys)
      .map(id => (id === undefined || id === null ? '' : String(id)))
      .filter(id => id !== '');
    if (ids.length === 0) { alert('선택된 광고가 없습니다.'); return; }
    const ok = confirm(
      `선택한 ${ids.length}개 광고를 삭제합니다.\n\n⚠ 주의: 이 작업은 되돌릴 수 없으며,\n연관 데이터도 모두 삭제됩니다.\n계속하시겠습니까?`
    );
    if (!ok) return;
    await adBulkDelete(ids);
    setSelectedKeys(new Set());
    if (current && ids.includes(current.adSeq)) setCurrent(null);
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">광고 관리</h2>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2 text-sm" onClick={load}>새로고침</button>
          <button className="rounded bg-slate-800 text-white px-3 py-2 text-sm" onClick={()=>setCreating(true)}>+ 신규 광고</button>
          <button
            className="rounded bg-red-600 text-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={selectedKeys.size===0}
            onClick={bulkDelete}
          >
            선택 삭제
          </button>
        </div>
      </div>

      {/* 본문: 좌 리스트 / 우 상세 */}
      <div className="mt-4 rounded-xl border bg-white p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 리스트 */}
        <div className="overflow-x-auto border rounded-xl">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e)=>toggleAll(e.target.checked)}
                  />
                </th>
                <th className="p-2">광고번호</th>
                <th className="p-2">광고이름</th>
                <th className="p-2">광고 도메인</th>
                <th className="p-2">광고 코드</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-4" colSpan={5}>불러오는 중…</td></tr>
              ) : rows.length===0 ? (
                <tr><td className="p-4" colSpan={5}>데이터 없음</td></tr>
              ) : rows.map((r, idx) => {
                  const checked = selectedKeys.has(r.adSeq);
                  const rowKey = r.adSeq || r.adCode || `row-${idx}`;
                  return (
                    <tr key={rowKey} className={`border-b hover:bg-slate-50 ${current?.adSeq===r.adSeq ? 'bg-blue-50/40' : ''}`}>
                      <td className="p-2">
                        <input type="checkbox" checked={checked} onChange={(e)=>toggleOne(r.adSeq, e.target.checked)} />
                      </td>
                      <td className="p-2">
                        <button className="underline" onClick={()=>setCurrent(r)} title="상세/수정 열기">
                          {r.adSeqLabel}
                        </button>
                      </td>
                      <td className="p-2">{r.adName}</td>
                      <td className="p-2">{r.adDomain}</td>
                      <td className="p-2 font-mono">{r.adCode || '-'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 상세/수정 */}
        <div className="border rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">상세 / 수정</h3>
          {!current ? (
            <p className="text-slate-500 text-sm">좌측에서 광고를 선택하세요.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 items-center">
                <label className="text-sm text-slate-600">광고번호</label>
                <div className="col-span-2">{current.adSeqLabel}</div>

                <label className="text-sm text-slate-600">광고이름</label>
                <input
                  className="col-span-2 border rounded px-3 py-2"
                  value={current.adName}
                  onChange={e=>setCurrent({...current, adName: e.target.value})}
                  placeholder="광고명"
                />

                <label className="text-sm text-slate-600">광고 도메인</label>
                <select
                  className="col-span-2 border rounded px-3 py-2"
                  value={current.adDomain}
                  onChange={e=>{
                    const nextDomain = e.target.value;
                    const latestUserNo = getUserNo();
                    const seqForCode = current.adSeqDisplay ?? current.adSeq;
                    const nextCode = current.adSeq
                      ? buildAdCode(nextDomain, latestUserNo, seqForCode)
                      : current.adCode ?? '';
                    setCurrent({...current, adDomain: nextDomain, adCode: nextCode});
                  }}
                >
                  {DOMAIN_ITEMS.map(d=>(
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>

                <label className="text-sm text-slate-600">광고 코드</label>
                <input
                  className="col-span-2 border rounded px-3 py-2 font-mono bg-slate-50"
                  value={current.adCode ?? ''}
                  readOnly
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-2 rounded border" onClick={()=>setCurrent(null)}>닫기</button>
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={saveCurrent}>저장</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 신규 생성 모달 */}
      {creating && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold mb-3">신규 광고 생성</h3>
            <div className="space-y-3">
              <label className="block text-sm text-slate-600 mb-1">광고이름</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={newForm.adName}
                onChange={e=>setNewForm({...newForm, adName: e.target.value})}
                placeholder="예) 메인 배너"
              />
              <label className="block text-sm text-slate-600 mb-1">광고 도메인</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={newForm.adDomain}
                onChange={e=>setNewForm({...newForm, adDomain: e.target.value})}
              >
                {DOMAIN_ITEMS.map(d=>(
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                생성 후 서버가 부여한 광고번호(adSeq)를 기반으로&nbsp;
                <code className="font-mono">adCode</code>를 <code className="font-mono">{`{og|os|au}_${'{userNo}'}_${'{adSeq}'}`}</code> 형태로 자동 설정합니다.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-2 rounded border" onClick={()=>setCreating(false)}>취소</button>
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={createNew}>생성</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
