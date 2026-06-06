import axios from 'axios';

const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        // On récupère la variable que vous venez de valider
        const url = process.env.REACT_APP_API_URL;
        // On s'assure d'ajouter /api à la fin si la variable ne le contient pas
        return url ? `${url}/api` : 'https://backendmemoire.onrender.com/api';
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

// Intercepteur pour nettoyer les requêtes et éviter les doublons de /api
API.interceptors.request.use((config) => {
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