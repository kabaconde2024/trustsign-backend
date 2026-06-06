import axios from 'axios';

// URL en dur pour tester
const API_BASE_URL = 'https://backendmemoire.onrender.com';

const API = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// Intercepteur pour ajouter /api si nécessaire
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
        config.url = `/api${config.url}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default API;