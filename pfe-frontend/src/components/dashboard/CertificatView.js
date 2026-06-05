import React, { useState, useEffect } from 'react';
import { 
    Box, Paper, Typography, Button, Stack, Chip, Alert, 
    Card, CardContent, Grid, LinearProgress, useMediaQuery,
    Divider, Fade, Zoom, Collapse, Avatar, Badge,
    Tooltip, IconButton
} from '@mui/material';
import { 
    CardMembership, Download, HourglassBottom, Refresh, 
    CheckCircle, Pending, Error as ErrorIcon, Info,
    Security, VerifiedUser, Schedule, Warning as WarningIcon,
    Close as CloseIcon, Visibility, FileDownload,
    History, Timer, AssignmentTurnedIn
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const MotionPaper = motion(Paper);
const MotionCard = motion(Card);

const CertificatView = ({ currentStatus, onStatusRefresh, setSnackbar, isMobile = false }) => {
    const [loading, setLoading] = useState(false);
    const [renewLoading, setRenewLoading] = useState(false);
    const [certInfo, setCertInfo] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;

    useEffect(() => {
        const fetchCertificat = async () => {
            // 🔥 CORRECTION : Récupérer les infos même si EXPIRED
            if (currentStatus === 'ACTIVE' || currentStatus === 'EXPIRED') {
                try {
                    const res = await axios.get('http://localhost:8080/api/utilisateur/pki/mon-statut', { withCredentials: true });
                    setCertInfo(res.data);
                    if (res.data.dateExpiration) {
                        const expirationDate = new Date(res.data.dateExpiration);
                        const now = new Date();
                        setIsExpired(expirationDate < now);
                    }
                } catch (err) {
                    console.error("Erreur certificat:", err);
                }
            } else {
                setCertInfo(null);
                setIsExpired(false);
            }
        };
        fetchCertificat();
    }, [currentStatus]);

    const handleRequest = async () => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8080/api/utilisateur/pki/request-certificate', {}, { withCredentials: true });
            setSnackbar({ open: true, message: "✅ Votre demande de certificat a été transmise avec succès.", severity: 'success' });
            if (onStatusRefresh) onStatusRefresh();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.erreur || "Une erreur est survenue";
            setSnackbar({ open: true, message: `❌ ${errorMsg}`, severity: 'error' });
        } finally { setLoading(false); }
    };

    const handleRenew = async () => {
        setRenewLoading(true);
        try {
            await axios.post('http://localhost:8080/api/utilisateur/pki/renouveler-certificat', {}, { withCredentials: true });
            setSnackbar({ open: true, message: "✅ Votre demande de renouvellement a été enregistrée.", severity: 'success' });
            if (onStatusRefresh) onStatusRefresh();
        } catch (error) {
            setSnackbar({ open: true, message: `❌ ${error.response?.data?.message || "Erreur lors du renouvellement"}`, severity: 'error' });
        } finally { setRenewLoading(false); }
    };

    const handleDownload = () => {
        if (certInfo?.certificatPem) {
            const file = new Blob([certInfo.certificatPem], { type: 'text/plain' });
            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = "certificat_trustsign.pem";
            link.click();
            URL.revokeObjectURL(url);
            setSnackbar({ open: true, message: "📄 Téléchargement du certificat démarré", severity: 'info' });
        }
    };

    const formaterDate = (dateSource) => {
        if (!dateSource) return "Non définie";
        try {
            const date = new Date(dateSource);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            }
            return "Date invalide";
        } catch (e) { return "Non disponible"; }
    };

    const getDaysUntilExpiration = () => {
        if (!certInfo?.dateExpiration) return null;
        const expiration = new Date(certInfo.dateExpiration);
        const now = new Date();
        const diffTime = expiration - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const daysUntilExpiration = getDaysUntilExpiration();
    const isNearExpiration = daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 0;
    const isActive = currentStatus === 'ACTIVE';
    const isPending = currentStatus === 'PENDING';
    const isNone = !currentStatus || currentStatus === 'NONE' || currentStatus === 'null' || currentStatus === '';
    // 🔥 CORRECTION : Gérer correctement l'état EXPIRED
    const isExpiredStatus = currentStatus === 'EXPIRED';
    const showExpired = (isActive && isExpired) || isExpiredStatus;

    // États personnalisés avec animations
    const statusConfig = {
        ACTIVE: {
            icon: <VerifiedUser sx={{ fontSize: 40 }} />,
            color: '#4caf50',
            bgGradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
            title: 'Certificat Actif',
            subtitle: 'Votre identité numérique est certifiée et sécurisée'
        },
        PENDING: {
            icon: <Schedule sx={{ fontSize: 40 }} />,
            color: '#ff9800',
            bgGradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            title: 'Demande en cours',
            subtitle: 'Votre dossier est en cours de vérification'
        },
        EXPIRED: {
            icon: <WarningIcon sx={{ fontSize: 40 }} />,
            color: '#f44336',
            bgGradient: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
            title: 'Certificat Expiré',
            subtitle: 'Veuillez renouveler votre certificat'
        },
        NONE: {
            icon: <CardMembership sx={{ fontSize: 40 }} />,
            color: '#9e9e9e',
            bgGradient: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)',
            title: 'Aucun certificat',
            subtitle: 'Commencez par demander votre certificat numérique'
        }
    };

    const currentStatusConfig = showExpired ? statusConfig.EXPIRED : 
                                isActive ? statusConfig.ACTIVE : 
                                isPending ? statusConfig.PENDING : 
                                statusConfig.NONE;

    return (
        <Box sx={{ maxWidth: '1000px', mx: 'auto', width: '100%', px: { xs: 1, sm: 2 } }}>
            <AnimatePresence mode="wait">
                <MotionPaper
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    elevation={0}
                    sx={{ 
                        borderRadius: '32px', 
                        overflow: 'hidden',
                        background: currentStatusConfig.bgGradient,
                        border: `1px solid ${currentStatusConfig.color}30`
                    }}
                >
                    {/* Header avec animation */}
                    <Box sx={{ 
                        p: { xs: 3, sm: 4 },
                        background: `linear-gradient(135deg, ${currentStatusConfig.color} 0%, ${currentStatusConfig.color}CC 100%)`,
                        color: 'white'
                    }}>
                        <Stack direction={mobile ? "column" : "row"} justifyContent="space-between" alignItems={mobile ? "center" : "flex-start"} spacing={2}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Zoom in={true} timeout={500}>
                                    <Avatar sx={{ 
                                        width: 64, 
                                        height: 64, 
                                        bgcolor: 'rgba(255,255,255,0.2)',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        {currentStatusConfig.icon}
                                    </Avatar>
                                </Zoom>
                                <Box>
                                    <Typography variant={mobile ? "h6" : "h4"} fontWeight="800">
                                        {currentStatusConfig.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        {currentStatusConfig.subtitle}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Chip
                                icon={showExpired ? <ErrorIcon /> : isActive ? <CheckCircle /> : isPending ? <Pending /> : <Info />}
                                label={showExpired ? "EXPIRÉ" : isActive ? "ACTIF" : isPending ? "EN ATTENTE" : "NON GÉNÉRÉ"}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    '& .MuiChip-icon': { color: 'white' }
                                }}
                                size={mobile ? "small" : "medium"}
                            />
                        </Stack>
                    </Box>

                    {/* Contenu principal */}
                    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
                        {/* État PENDING */}
                        {isPending && (
                            <Fade in={true}>
                                <Box>
                                    <Alert 
                                        severity="warning" 
                                        sx={{ 
                                            mb: 3, 
                                            borderRadius: '16px',
                                            '& .MuiAlert-icon': { alignItems: 'center' }
                                        }}
                                        icon={<Pending sx={{ fontSize: 28 }} />}
                                    >
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Demande en cours de traitement
                                        </Typography>
                                        <Typography variant="body2">
                                            Un administrateur va vérifier votre identité sous 24-48 heures.
                                        </Typography>
                                    </Alert>

                                    <Card sx={{ p: 2, borderRadius: '20px', mb: 3, bgcolor: '#ffffff' }}>
                                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                                            📋 Progression du traitement
                                        </Typography>
                                        <LinearProgress 
                                            variant="determinate" 
                                            value={45} 
                                            sx={{ 
                                                height: 8, 
                                                borderRadius: 4,
                                                mb: 2,
                                                bgcolor: '#ffe0b2',
                                                '& .MuiLinearProgress-bar': { bgcolor: '#ff9800' }
                                            }} 
                                        />
                                        <Grid container spacing={2} sx={{ mt: 1 }}>
                                            <Grid item xs={12} sm={4}>
                                                <Box sx={{ textAlign: 'center', p: 1 }}>
                                                    <CheckCircle sx={{ color: '#4caf50', fontSize: 24 }} />
                                                    <Typography variant="caption" display="block">Demande reçue</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={4}>
                                                <Box sx={{ textAlign: 'center', p: 1 }}>
                                                    <Pending sx={{ color: '#ff9800', fontSize: 24 }} />
                                                    <Typography variant="caption" display="block">Vérification en cours</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={4}>
                                                <Box sx={{ textAlign: 'center', p: 1, opacity: 0.5 }}>
                                                    <VerifiedUser sx={{ fontSize: 24 }} />
                                                    <Typography variant="caption" display="block">Certificat généré</Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Card>

                                    <Box sx={{ bgcolor: '#fff3e0', p: 2, borderRadius: '16px' }}>
                                        <Typography variant="body2" color="textSecondary" align="center">
                                            ⏳ Délai moyen : 24-48 heures
                                        </Typography>
                                    </Box>
                                </Box>
                            </Fade>
                        )}

                        {/* 🔥 État EXPIRÉ - AVEC BOUTON DE RENOUVELLEMENT */}
                        {showExpired && (
                            <Fade in={true}>
                                <Box>
                                    <Alert 
                                        severity="error" 
                                        sx={{ 
                                            mb: 3, 
                                            borderRadius: '16px',
                                            '& .MuiAlert-icon': { alignItems: 'center' }
                                        }}
                                        icon={<WarningIcon sx={{ fontSize: 28 }} />}
                                    >
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Certificat expiré
                                        </Typography>
                                        <Typography variant="body2">
                                            Votre certificat n'est plus valide. Veuillez le renouveler dès maintenant.
                                        </Typography>
                                    </Alert>

                                    <Card sx={{ p: 3, borderRadius: '24px', mb: 3, bgcolor: '#ffebee' }}>
                                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                            <HourglassBottom sx={{ fontSize: 48, color: '#f44336' }} />
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold" color="error">
                                                    Expiré le {formaterDate(certInfo?.dateExpiration)}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    Vous ne pouvez plus signer de documents avec ce certificat.
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Card>

                                    {/* 🔥 BOUTON DE RENOUVELLEMENT POUR EXPIRÉ */}
                                    <Button 
                                        variant="contained" 
                                        onClick={handleRenew} 
                                        disabled={renewLoading} 
                                        startIcon={renewLoading ? <HourglassBottom /> : <Refresh />}
                                        fullWidth
                                        sx={{ 
                                            bgcolor: '#f44336', 
                                            color: 'white', 
                                            fontWeight: 'bold',
                                            py: 1.5,
                                            '&:hover': { bgcolor: '#d32f2f' }
                                        }}
                                    >
                                        {renewLoading ? "Traitement en cours..." : "🔄 Renouveler mon certificat"}
                                    </Button>
                                </Box>
                            </Fade>
                        )}

                        {/* État ACTIF (non expiré) */}
                        {isActive && !isExpired && !isExpiredStatus && (
                            <Fade in={true}>
                                <Box>
                                    <Alert 
                                        severity="success" 
                                        sx={{ 
                                            mb: 3, 
                                            borderRadius: '16px',
                                            '& .MuiAlert-icon': { alignItems: 'center' }
                                        }}
                                        icon={<CheckCircle sx={{ fontSize: 28 }} />}
                                    >
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Certificat valide et opérationnel
                                        </Typography>
                                        <Typography variant="body2">
                                            Votre identité numérique est certifiée et sécurisée.
                                        </Typography>
                                    </Alert>

                                    <MotionCard
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.2 }}
                                        sx={{ p: 3, borderRadius: '24px', mb: 3, bgcolor: '#ffffff' }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#1a237e' }}>
                                                Détails du certificat
                                            </Typography>
                                            <Tooltip title="Voir les détails complets">
                                                <IconButton size="small" onClick={() => setShowDetails(!showDetails)}>
                                                    {showDetails ? <CloseIcon /> : <Visibility />}
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>

                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: '16px' }}>
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                                        <History sx={{ fontSize: 20, color: '#64748b' }} />
                                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Date d'émission</Typography>
                                                    </Stack>
                                                    <Typography variant="body1" fontWeight="600">
                                                        {formaterDate(certInfo?.dateEmission)}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Box sx={{ 
                                                    bgcolor: isNearExpiration ? '#fff3e0' : '#f8fafc', 
                                                    p: 2, 
                                                    borderRadius: '16px',
                                                    border: isNearExpiration ? '1px solid #ff9800' : 'none'
                                                }}>
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                                        <Timer sx={{ fontSize: 20, color: isNearExpiration ? '#ff9800' : '#64748b' }} />
                                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Date d'expiration</Typography>
                                                    </Stack>
                                                    <Typography variant="body1" fontWeight="600" sx={{ color: isNearExpiration ? '#ff9800' : '#1e293b' }}>
                                                        {formaterDate(certInfo?.dateExpiration)}
                                                        {isNearExpiration && (
                                                            <Chip 
                                                                label={`Expire dans ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''}`} 
                                                                size="small" 
                                                                color="warning" 
                                                                sx={{ ml: 1, fontWeight: 'bold' }} 
                                                            />
                                                        )}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>

                                        <Collapse in={showDetails}>
                                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e2e8f0' }}>
                                                <Typography variant="subtitle2" gutterBottom>Informations supplémentaires</Typography>
                                                <Grid container spacing={1}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="textSecondary">Type de certificat</Typography>
                                                        <Typography variant="body2">X.509 v3</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="textSecondary">Algorithme</Typography>
                                                        <Typography variant="body2">RSA 2048 bits</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="textSecondary">Format</Typography>
                                                        <Typography variant="body2">PEM</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="textSecondary">Conformité</Typography>
                                                        <Typography variant="body2">eIDAS / ISO 27005</Typography>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </Collapse>
                                    </MotionCard>

                                    <Stack direction={mobile ? "column" : "row"} spacing={2}>
                                        <Button 
                                            variant="contained" 
                                            onClick={handleRenew} 
                                            disabled={renewLoading} 
                                            startIcon={renewLoading ? <HourglassBottom /> : <Refresh />}
                                            fullWidth
                                            sx={{ 
                                                bgcolor: '#ffc107', 
                                                color: '#0b1e39', 
                                                fontWeight: 'bold',
                                                py: 1.5,
                                                '&:hover': { bgcolor: '#ffb300' }
                                            }}
                                        >
                                            {renewLoading ? "Traitement en cours..." : "🔄 Renouveler mon certificat"}
                                        </Button>
                                        <Button 
                                            variant="outlined" 
                                            startIcon={<FileDownload />} 
                                            onClick={handleDownload}
                                            fullWidth
                                            sx={{ 
                                                borderColor: '#0b1e39', 
                                                color: '#0b1e39', 
                                                fontWeight: 'bold', 
                                                py: 1.5,
                                                '&:hover': { borderColor: '#ffc107', bgcolor: '#fff8e1' }
                                            }}
                                        >
                                            📄 Télécharger (.pem)
                                        </Button>
                                    </Stack>
                                </Box>
                            </Fade>
                        )}

                        {/* État NONE */}
                        {isNone && (
                            <Fade in={true}>
                                <Box>
                                    <Alert 
                                        severity="info" 
                                        sx={{ 
                                            mb: 3, 
                                            borderRadius: '16px',
                                            '& .MuiAlert-icon': { alignItems: 'center' }
                                        }}
                                        icon={<Info sx={{ fontSize: 28 }} />}
                                    >
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            Aucun certificat numérique
                                        </Typography>
                                        <Typography variant="body2">
                                            Générez votre certificat pour commencer à signer des documents électroniques.
                                        </Typography>
                                    </Alert>

                                    <Card sx={{ p: 3, borderRadius: '24px', mb: 3, bgcolor: '#f5f5f5', textAlign: 'center' }}>
                                        <CardMembership sx={{ fontSize: 64, color: '#9e9e9e', mb: 2, opacity: 0.5 }} />
                                        <Typography variant="body2" color="textSecondary" gutterBottom>
                                            La demande de certificat est gratuite et prend moins de 5 minutes.
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            Un administrateur validera votre identité sous 24-48 heures.
                                        </Typography>
                                    </Card>

                                    <Button 
                                        variant="contained" 
                                        onClick={handleRequest} 
                                        disabled={loading} 
                                        startIcon={loading ? <HourglassBottom /> : <AssignmentTurnedIn />}
                                        fullWidth
                                        sx={{ 
                                            bgcolor: '#ffc107', 
                                            color: '#0b1e39', 
                                            fontWeight: 'bold',
                                            py: 1.5,
                                            '&:hover': { bgcolor: '#ffb300' }
                                        }}
                                    >
                                        {loading ? "Génération en cours..." : "📜 Demander mon certificat"}
                                    </Button>
                                </Box>
                            </Fade>
                        )}
                    </Box>
                </MotionPaper>
            </AnimatePresence>

            {/* Footer */}
            <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    🛡️ Infrastructure PKI sécurisée - Conformité eIDAS & ISO 27005
                </Typography>
            </Box>
        </Box>
    );
};

export default CertificatView;