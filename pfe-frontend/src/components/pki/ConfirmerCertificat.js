import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';

const API_BASE_URL = 'http://localhost:8080';

const ConfirmerCertificat = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);
    const hasExecuted = useRef(false);

    useEffect(() => {
        if (!token || hasExecuted.current) return;
        hasExecuted.current = true;

        const confirmer = async () => {
            try {
                console.log("🔍 Confirmation du token:", token);
                const response = await fetch(`${API_BASE_URL}/api/admin/pki/confirmer-identite?token=${token}`, {
                    credentials: 'include'
                });
                const data = await response.json();
                console.log("📡 Réponse:", data);
                setResult(data);
            } catch (error) {
                console.error("❌ Erreur:", error);
                setResult({ status: 'error', message: "Erreur de connexion" });
            } finally {
                setLoading(false);
            }
        };

        confirmer();
    }, [token]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={40} />
                <Typography sx={{ ml: 2 }}>Vérification en cours...</Typography>
            </Box>
        );
    }

    // ✅ ACCEPTE PLUSIEURS CAS DE SUCCÈS
    const isSuccess = result?.status === 'success' || result?.status === 'already_confirmed';

    if (!isSuccess) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f5f5f5' }}>
                <Paper sx={{ maxWidth: 500, p: 4, textAlign: 'center', borderRadius: 3 }}>
                    <Error sx={{ fontSize: 80, color: '#f44336', mb: 2 }} />
                    <Typography variant="h5" gutterBottom color="error">
                        Confirmation échouée
                    </Typography>
                    <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                        {result?.message || result?.error || "Une erreur s'est produite"}
                    </Typography>
                    <Button 
                        variant="contained" 
                        onClick={() => navigate('/')}
                        sx={{ bgcolor: '#1a237e' }}
                    >
                        Retour à l'accueil
                    </Button>
                </Paper>
            </Box>
        );
    }

    // ✅ PAGE DE SUCCÈS
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f5f5f5' }}>
            <Paper sx={{ maxWidth: 500, p: 4, textAlign: 'center', borderRadius: 3 }}>
                <Box sx={{ mb: 2 }}>
                    <div style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: '50%', 
                        backgroundColor: '#4caf50', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        margin: '0 auto'
                    }}>
                        <CheckCircle sx={{ fontSize: 50, color: 'white' }} />
                    </div>
                </Box>
                
                <Typography variant="h5" gutterBottom sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                    Identité confirmée !
                </Typography>
                
                <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
                    Votre identité a été confirmée avec succès.
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 3, color: '#1a237e' }}>
                    ✅ Un administrateur va maintenant pouvoir approuver votre demande de certificat.
                    <br />
                    Vous serez notifié par email une fois le certificat généré.
                </Typography>
                
                <Button 
                    variant="contained" 
                    onClick={() => navigate('/user-dashboard')}
                    sx={{ bgcolor: '#1a237e', px: 4, py: 1.5, borderRadius: 2 }}
                >
                    Retour au tableau de bord
                </Button>
            </Paper>
        </Box>
    );
};

export default ConfirmerCertificat;