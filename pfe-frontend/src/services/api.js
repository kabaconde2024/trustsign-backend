import axios from 'axios';

const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        return process.env.REACT_APP_API_URL;
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

// Intercepteur pour ajouter le token à chaque requête
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Ajoute /api si nécessaire
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