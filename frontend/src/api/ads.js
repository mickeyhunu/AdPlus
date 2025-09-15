// src/api/ads.js
import api from '../api';

// 내 광고 목록 (대시보드와 동일 기준)
export const myAds = (params = {}) => api.get('/ads/my', { params });

// 광고 상세 (필요시)
export const adDetail = (adSeq) => api.get(`/ads/${adSeq}`);

// 광고 생성
export const adCreate = (body) => api.post('/ads', body);

// 광고 수정
export const adUpdate = (adSeq, body) => api.put(`/ads/${adSeq}`, body);

// 다중 삭제 (연관 데이터 포함 삭제)
export const adBulkDelete = (adSeqList) => api.post('/ads/bulk-delete', { adSeqList });
