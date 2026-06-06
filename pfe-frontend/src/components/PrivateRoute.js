import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import API from '../services/api';

const PrivateRoute = ({ children, allowedRoles }) => {
    const [isAuthorized, setIsAuthorized] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const verifierAuthentification = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                
                if (!token) {
                    setIsAuthorized(false);
                    return;
                }
                
                const response = await API.get('/auth/check', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.data && response.data.authentifie) {
                    setIsAuthorized(true);
                    setUserRole(response.data.role);
                } else {
                    setIsAuthorized(false);
                }
            } catch (error) {
                console.error("[Auth] Erreur:", error);
                setIsAuthorized(false);
            }
        };

        verifierAuthentification();
    }, []);

    if (isAuthorized === null) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    if (!isAuthorized) {
        return <Navigate to={`/connexion?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/non-autorise" replace />;
    }

    return children;
};

export default PrivateRoute;