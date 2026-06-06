import axios from 'axios';

const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        // En production, on cible directement l'URL publique du backend.
        // On y ajoute /api pour centraliser la base URL.
        const url = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;
        return `${url}/api`;
    }
    // En développement local
    return 'http://localhost:8080/api';
};

const API = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// Intercepteur ajusté : évite d'ajouter un doublon de '/api' 
// puisque la baseURL le contient déjà désormais.
API.interceptors.request.use((config) => {
    // Si la requête commence par /api, on nettoie pour éviter d'avoir /api/api/...
    if (config.url.startsWith('/api')) {
        config.url = config.url.replace('/api', '');
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