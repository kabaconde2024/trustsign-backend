import axios from 'axios';

const getBaseURL = () => {
    if (process.env.NODE_ENV === 'production') {
        return `${process.env.REACT_APP_API_URL}/api`;
    }
    return 'http://localhost:8080/api';
    
};

const API = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
    headers: {
        'Accept': 'application/json'
    }
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