import axios from 'axios';

const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        // Ne pas ajouter /api ici, il sera ajouté dans les appels
        return process.env.REACT_APP_API_URL;
    }
    return 'http://localhost:8080';
};

const API = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// Intercepteur pour ajouter /api à toutes les requêtes
API.interceptors.request.use((config) => {
    // Ajoute /api si ce n'est pas déjà fait
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
            document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default API;