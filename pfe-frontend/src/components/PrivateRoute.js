import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import API from '../services/api'; // <--- ASSUREZ-VOUS DE METTRE LE BON CHEMIN VERS VOTRE FICHIER API.JS

const PrivateRoute = ({ children, allowedRoles }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const verifierAuthentification = async () => {
            try {
                // On utilise l'instance API globale (qui cible automatiquement Render en prod)
                const response = await API.get('/auth/check');
                
                if (response.data && response.data.authenticated) {
                    setIsAuthenticated(true);
                    setUserRole(response.data.role);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("[Auth] Erreur lors de la vérification du cookie:", error);
                setIsAuthenticated(false);
            }
        };

        verifierAuthentification();
    }, []);

    // Gestion du chargement pendant la vérification
    if (isAuthenticated === null) {
        return <div>Chargement...</div>; 
    }

    // Si pas authentifié, redirection vers la page de connexion
    if (!isAuthenticated) {
        return <Navigate to={`/connexion?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    }

    // Si le rôle n'est pas autorisé, redirection vers une page d'erreur ou d'accueil
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/non-autorise" replace />;
    }

    return children;
};

export default PrivateRoute;