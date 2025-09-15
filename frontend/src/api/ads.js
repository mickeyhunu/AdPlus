// src/api/ads.js
import api from './index';

// 내 광고 목록
export const myAds = (params = {}) => api.get('/ads/my', { params });

// 광고 통계
export const fetchStats = (arg = 7, bucket, ad) => {
  let params = {};
  if (typeof arg === 'number') {
    params.days = arg;
    if (bucket) params.bucket = bucket;
    if (ad && ad !== 'ALL') params.ad = ad;
  } else if (arg && typeof arg === 'object') {
    const { days = 7, bucket: b, ad: a } = arg;
    params.days = days;
    if (b) params.bucket = b;
    if (a && a !== 'ALL') params.ad = a;
  } else {
    params.days = 7;
  }
  return api.get('/ads/stats', { params });
};

// 광고 상세 (필요시)
export const adDetail = (adSeq) => api.get(`/ads/${adSeq}`);

// 광고 생성
export const adCreate = (body) => api.post('/ads', body);

// 광고 수정
export const adUpdate = (adSeq, body) => api.put(`/ads/${adSeq}`, body);

// 다중 삭제 (연관 데이터 포함 삭제)
export const adBulkDelete = (adSeqList) => api.post('/ads/bulk-delete', { adSeqList });
