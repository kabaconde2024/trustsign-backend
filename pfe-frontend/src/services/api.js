import axios from 'axios';

const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        return process.env.REACT_APP_API_URL || 'https://backendmemoire.onrender.com';
    }
    return 'http://localhost:8080';
};

const API = axios.create({
    baseURL: getBaseURL(),
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// ⚠️ INTERCEPTEUR OBLIGATOIRE - Ajoute le token à chaque requête
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    console.log('[API] Token présent:', !!token);  // ← DEBUG
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[API] Authorization header ajouté');
    }
    return config;
});

// Intercepteur pour ajouter /api si nécessaire
API.interceptors.request.use((config) => {
    if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
        config.url = `/api${config.url}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn('[API] Authentification error, clearing token');
            localStorage.clear();
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default API;