// src/api/logs.js
import api from './index';

export const fetchAdLogs = (params = {}) => api.get('/logs', { params });

export default fetchAdLogs;