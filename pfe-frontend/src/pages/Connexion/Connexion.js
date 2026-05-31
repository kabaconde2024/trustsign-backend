import React, { useState } from 'react';
import { 
    Box, TextField, Button, Alert, InputAdornment, 
    CircularProgress, Typography, Link, Divider, useMediaQuery,
    Stack  // ✅ AJOUTER Stack ici
} from '@mui/material';
import { Lock, Email, Security } from '@mui/icons-material';
import API from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import GoogleLoginNative from '../../components/GoogleLoginNative';

const Connexion = ({ onSwitch, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [motDePasse, setMotDePasse] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isMfaRequired, setIsMfaRequired] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorKey, setErrorKey] = useState(0);
    
    const navigate = useNavigate();
    const location = useLocation();

    const isMobile = useMediaQuery('(max-width:600px)');
    const isSmallMobile = useMediaQuery('(max-width:380px)');

    const query = new URLSearchParams(location.search);
    const redirectPath = query.get('redirect');

    const fieldStyle = {
        input: { color: '#000' },
        label: { color: '#000', fontWeight: 600 },
        "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: 'rgba(0, 0, 0, 0.2)' },
            "&:hover fieldset": { borderColor: '#000' },
            "&.Mui-focused fieldset": { borderColor: '#3b82f6' }
        }
    };

    const redirectUserByRole = (role) => {
        if (redirectPath && redirectPath !== '/' && !redirectPath.includes('/connexion')) {
            navigate(decodeURIComponent(redirectPath));
            return;
        }

        const activeRole = role || localStorage.getItem('role'); 

        if (activeRole === 'SUPER_ADMIN') navigate('/super-admin-dashboard');
        else if (activeRole === 'ADMIN_ENTREPRISE') navigate('/admin-dashboard');
        else if (activeRole === 'EMPLOYE') navigate('/employe-dashboard');
        else if (activeRole === 'UTILISATEUR') navigate('/user-dashboard');
        else navigate('/user-dashboard');
    };

    const handleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await API.post('/connexion', { 
                email: email.trim().toLowerCase(), 
                motDePasse 
            });
            
            if (response.data.necessiteMfa) {
                setIsMfaRequired(true);
                setError('');
            } else {
                localStorage.setItem('role', response.data.role);
                localStorage.setItem('user_info', JSON.stringify({
                    prenom: response.data.prenom,
                    nom: response.data.nom,
                    email: email
                }));
                
                if (onLoginSuccess) onLoginSuccess();
                setTimeout(() => redirectUserByRole(response.data.role), 1000);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.erreur || err.response?.data?.message || "Identifiants incorrects.";
            setError(errorMessage);
            setErrorKey(prev => prev + 1);
        } finally { 
            setLoading(false); 
        }
    };

    const handleVerifyOtp = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await API.post('/verifier-otp', { 
                email: email.trim().toLowerCase(), 
                code: otpCode.trim() 
            });
            
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user_info', JSON.stringify({
                prenom: response.data.prenom,
                nom: response.data.nom,
                email: response.data.email
            }));

            if (onLoginSuccess) onLoginSuccess();
            setTimeout(() => redirectUserByRole(response.data.role), 1000);
        } catch (err) {
            const errorMessage = err.response?.data?.erreur || "Code OTP invalide ou expiré.";
            setError(errorMessage);
            setErrorKey(prev => prev + 1);
        } finally { 
            setLoading(false); 
        }
    };

    const handleGoogleSuccess = async (googleData) => {
        setLoading(true);
        setError('');
        try {
            const response = await API.post('/auth/google', { token: googleData.credential });

            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user_info', JSON.stringify({
                prenom: response.data.prenom,
                nom: response.data.nom,
                email: response.data.email
            }));

            if (onLoginSuccess) onLoginSuccess();
            setTimeout(() => redirectUserByRole(response.data.role), 1000);
        } catch (err) {
            const errorMessage = err.response?.data?.erreur || "Échec de la connexion avec Google.";
            setError(errorMessage);
            setErrorKey(prev => prev + 1);
        } finally { 
            setLoading(false); 
        }
    };

    const getAlertSeverity = () => {
        if (!error) return "error";
        if (error.includes("inactif") || error.includes("suspendu") || error.includes("supprimé")) {
            return "warning";
        }
        return "error";
    };

    const handleRetour = () => {
        setIsMfaRequired(false);
        setError('');
        setOtpCode('');
    };

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
        if (error) setError('');
    };

    const handlePasswordChange = (e) => {
        setMotDePasse(e.target.value);
        if (error) setError('');
    };

    const handleOtpChange = (e) => {
        setOtpCode(e.target.value);
        if (error) setError('');
    };

    return (
        <Box sx={{ 
            p: { xs: 2.5, sm: 3, md: 4 }, 
            bgcolor: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(15px)', 
            borderRadius: { xs: 4, sm: 6 },
            maxWidth: { xs: '100%', sm: 500, md: 550 },
            mx: 'auto',
            width: '100%'
        }}>
            <Box sx={{ mb: { xs: 2, sm: 3, md: 4 }, textAlign: 'center' }}>
                <Typography 
                    variant={isMobile ? "h5" : "h4"} 
                    fontWeight="900" 
                    sx={{ 
                        color: '#000', 
                        mb: 1,
                        fontSize: isSmallMobile ? '1.25rem' : 'inherit'
                    }}
                >
                    {isMfaRequired ? "SÉCURITÉ" : "CONNEXION"}
                </Typography>
                <Box sx={{ 
                    width: { xs: 40, sm: 60 }, 
                    height: 4, 
                    bgcolor: '#3b82f6', 
                    mx: 'auto', 
                    borderRadius: 2 
                }} />
            </Box>

            {error && (
                <Alert 
                    key={errorKey}
                    severity={getAlertSeverity()} 
                    sx={{ 
                        mb: { xs: 2, sm: 3 }, 
                        borderRadius: '12px',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        animation: 'shake 0.5s ease-in-out',
                        '@keyframes shake': {
                            '0%, 100%': { transform: 'translateX(0)' },
                            '25%': { transform: 'translateX(-5px)' },
                            '75%': { transform: 'translateX(5px)' }
                        }
                    }}
                >
                    {error}
                </Alert>
            )}

            {loading && !error && (
                <Alert 
                    severity="info" 
                    sx={{ 
                        mb: { xs: 2, sm: 3 }, 
                        borderRadius: '12px',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <CircularProgress size={16} />
                        <span>Connexion en cours...</span>
                    </Stack>
                </Alert>
            )}

            {!isMfaRequired ? (
                <Box>
                    <Box sx={{ mb: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center' }}>
                        <GoogleLoginNative onSuccess={handleGoogleSuccess} />
                    </Box>
                    <Divider sx={{ mb: { xs: 2, sm: 3 } }}>
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: '#000', 
                                fontWeight: 600, 
                                px: 1,
                                fontSize: { xs: '0.65rem', sm: '0.75rem' }
                            }}
                        >
                            OU AVEC EMAIL
                        </Typography>
                    </Divider>
                    <TextField 
                        fullWidth 
                        label="Email" 
                        margin="normal" 
                        required 
                        value={email}
                        onChange={handleEmailChange}
                        disabled={loading}
                        InputProps={{ 
                            startAdornment: <InputAdornment position="start"><Email sx={{ color: '#000', fontSize: isMobile ? 20 : 24 }} /></InputAdornment> 
                        }}
                        sx={fieldStyle}
                        size={isMobile ? "small" : "medium"}
                    />
                    <TextField 
                        fullWidth 
                        label="Mot de passe" 
                        type="password" 
                        margin="normal" 
                        required 
                        value={motDePasse}
                        onChange={handlePasswordChange}
                        disabled={loading}
                        InputProps={{ 
                            startAdornment: <InputAdornment position="start"><Lock sx={{ color: '#000', fontSize: isMobile ? 20 : 24 }} /></InputAdornment> 
                        }}
                        sx={fieldStyle}
                        size={isMobile ? "small" : "medium"}
                    />
                    <Button 
                        fullWidth 
                        variant="contained" 
                        onClick={handleLogin} 
                        disabled={loading}
                        sx={{ 
                            mt: { xs: 2, sm: 3 }, 
                            py: { xs: 1.5, sm: 2 }, 
                            bgcolor: '#1c1212', 
                            fontWeight: '900', 
                            fontSize: { xs: '0.875rem', sm: '1rem' },
                            "&:hover": { bgcolor: '#333' } 
                        }}
                    >
                        {loading ? <CircularProgress size={isMobile ? 20 : 24} color="inherit" /> : "Se connecter"}
                    </Button>
                    <Box sx={{ 
                        mt: { xs: 2, sm: 3 }, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: { xs: 0.5, sm: 1 }, 
                        alignItems: 'center' 
                    }}>
                        <Link 
                            onClick={() => !loading && navigate('/mot-de-passe-oublie')} 
                            sx={{ 
                                cursor: loading ? 'default' : 'pointer', 
                                color: '#3b82f6', 
                                fontWeight: 700, 
                                fontSize: { xs: '0.7rem', sm: '0.85rem' }, 
                                textDecoration: 'none',
                                opacity: loading ? 0.5 : 1,
                                '&:hover': { textDecoration: loading ? 'none' : 'underline' }
                            }}
                        >
                            Mot de passe oublié ?
                        </Link>
                        <Link 
                            onClick={() => !loading && (onSwitch ? onSwitch() : navigate('/inscription'))} 
                            sx={{ 
                                cursor: loading ? 'default' : 'pointer', 
                                color: '#000', 
                                fontWeight: 700, 
                                fontSize: { xs: '0.7rem', sm: '0.85rem' }, 
                                opacity: loading ? 0.5 : 0.7, 
                                textDecoration: 'none',
                                '&:hover': { textDecoration: loading ? 'none' : 'underline', opacity: loading ? 0.5 : 1 }
                            }}
                        >
                            Pas de compte ? Créer un profil
                        </Link>
                    </Box>
                </Box>
            ) : (
                <Box>
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            mb: { xs: 2, sm: 3 }, 
                            textAlign: 'center', 
                            color: '#000',
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            wordBreak: 'break-word'
                        }}
                    >
                        Entrez le code envoyé à <strong>{email}</strong>
                    </Typography>
                    <TextField 
                        fullWidth 
                        label="Code OTP" 
                        margin="normal" 
                        required 
                        value={otpCode}
                        onChange={handleOtpChange}
                        disabled={loading}
                        InputProps={{ 
                            startAdornment: <InputAdornment position="start"><Security sx={{ color: '#000', fontSize: isMobile ? 20 : 24 }} /></InputAdornment>,
                            inputProps: { 
                                maxLength: 6,
                                style: { 
                                    textAlign: 'center', 
                                    letterSpacing: isMobile ? '2px' : '4px', 
                                    fontSize: isMobile ? '1.1rem' : '1.25rem',
                                    fontWeight: 600
                                }
                            }
                        }}
                        sx={fieldStyle}
                        size={isMobile ? "small" : "medium"}
                    />
                    <Button 
                        fullWidth 
                        variant="contained" 
                        onClick={handleVerifyOtp} 
                        disabled={loading}
                        sx={{ 
                            mt: { xs: 2, sm: 3 }, 
                            py: { xs: 1.5, sm: 2 }, 
                            bgcolor: '#3b82f6', 
                            fontWeight: '900',
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                        }}
                    >
                        {loading ? <CircularProgress size={isMobile ? 20 : 24} color="inherit" /> : "Vérifier le code"}
                    </Button>
                    <Button 
                        fullWidth 
                        variant="text" 
                        onClick={handleRetour}
                        disabled={loading}
                        sx={{ 
                            mt: 1, 
                            color: '#000', 
                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                        }}
                    >
                        Retour
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default Connexion;