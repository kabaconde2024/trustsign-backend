import axios from 'axios';

/**
 * Détermine dynamiquement l'URL de base de l'API.
 * Évite les doublons invisibles de '/api' en production ou en local.
 */
const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        const url = process.env.REACT_APP_API_URL;
        if (url) {
            // Nettoie les slashes de fin avant d'ajouter proprement /api
            const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
            return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
        }
        return 'https://backendmemoire.onrender.com/api';
    }
    // En développement local
    return 'http://localhost:8080/api';
};

const API = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true, // Capital pour envoyer le cookie SameSite=None en production
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

/**
 * INTERCEPTEUR DE REQUÊTE
 * Empêche le dédoublement du préfixe `/api` si une requête est écrite sous la forme API.get('/api/chemin')
 */
API.interceptors.request.use(
    (config) => {
        if (config.url) {
            // Cas 1 : L'URL commence exactement par '/api/' (ex: '/api/auth/check')
            if (config.url.startsWith('/api/')) {
                config.url = config.url.substring(5); // Enlève '/api/' en entier pour ne laisser que 'auth/check'
            }
            // Cas 2 : L'URL est exactement égale à '/api' ou '/api/'
            else if (config.url === '/api' || config.url === '/api/') {
                config.url = '';
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * INTERCEPTEUR DE RÉPONSE
 * Gère proprement l'expiration de la session sans briser les validations initiales de PrivateRoute
 */
API.interceptors.response.use(
    (response) => response,
    (error) => {
        // Si le serveur répond 401 (Non autorisé / Session expirée)
        if (error.response?.status === 401) {
            localStorage.clear();
            
            // Suppression propre du cookie côté client au cas où
            document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            
            // Évitez window.location.href = '/' si vous êtes déjà sur la page de connexion,
            // pour ne pas forcer une réinitialisation de l'état de React Router au mauvais moment.
            if (!window.location.pathname.includes('/connexion')) {
                window.location.href = '/connexion';
            }
        }
        return Promise.reject(error);
    }
);

export default API;