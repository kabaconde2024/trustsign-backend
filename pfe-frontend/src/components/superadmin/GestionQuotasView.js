// frontend/src/components/superadmin/GestionQuotasView.jsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Chip,
    LinearProgress,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
    CircularProgress,
    Stack,
    Avatar,
    Alert
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Warning as WarningIcon,
    Person as PersonIcon,
    CalendarToday as CalendarTodayIcon,
    DateRange as DateRangeIcon,
    EventNote as EventNoteIcon
} from '@mui/icons-material';

const API_BASE_URL = 'http://localhost:8080/api';

// 🔧 FONCTION POUR LES REQUÊTES AVEC COOKIES (comme dans ConfigurationView)
const fetchAPI = async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',  // ⚠️ CRUCIAL : Envoie les cookies HttpOnly
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

const GestionQuotasView = ({ setSnackbar, isMobile }) => {
    const [loading, setLoading] = useState(false);
    const [quotas, setQuotas] = useState([]);
    const [statistiques, setStatistiques] = useState(null);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newLimite, setNewLimite] = useState(20);
    const [openResetDialog, setOpenResetDialog] = useState(false);
    const [userToReset, setUserToReset] = useState(null);

    // Récupérer tous les utilisateurs avec leurs quotas
    const fetchAllQuotas = async () => {
        setLoading(true);
        try {
            // 🔧 Récupérer la liste des utilisateurs AVEC COOKIES
            const users = await fetchAPI('/admin/utilisateurs');
            
            // Récupérer le quota pour chaque utilisateur
            const quotasData = await Promise.all(
                users.map(async (user) => {
                    try {
                        const quota = await fetchAPI(`/signature/quota/utilisateur/${user.id}`);
                        return { ...user, quota };
                    } catch (error) {
                        console.warn(`Erreur quota pour user ${user.id}:`, error);
                        return { ...user, quota: null };
                    }
                })
            );
            
            setQuotas(quotasData);
            
            // Récupérer les statistiques globales
            const stats = await fetchAPI('/signature/quota/statistiques');
            setStatistiques(stats);
            
        } catch (error) {
            console.error("Erreur chargement quotas:", error);
            if (error.message === 'HTTP 403') {
                setSnackbar({ open: true, message: "Accès non autorisé. Droits Super Admin requis.", severity: 'error' });
            } else {
                setSnackbar({ open: true, message: "Erreur chargement des quotas", severity: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllQuotas();
    }, []);

    // Réinitialiser le quota d'un utilisateur
    const handleResetQuota = async () => {
        if (!userToReset) return;
        
        try {
            await fetchAPI(`/signature/quota/reinitialiser/${userToReset.id}`, {
                method: 'DELETE'
            });
            
            setSnackbar({ open: true, message: `Quota réinitialisé pour ${userToReset.prenom} ${userToReset.nom}`, severity: 'success' });
            fetchAllQuotas();
            
        } catch (error) {
            setSnackbar({ open: true, message: error.message || 'Erreur lors de la réinitialisation', severity: 'error' });
        } finally {
            setOpenResetDialog(false);
            setUserToReset(null);
        }
    };

    // Modifier la limite d'un utilisateur
    const handleModifierLimite = async () => {
        if (!selectedUser || newLimite < 1 || newLimite > 500) return;
        
        try {
            await fetchAPI(`/signature/quota/modifier-limite/${selectedUser.id}?limite=${newLimite}`, {
                method: 'PUT'
            });
            
            setSnackbar({ open: true, message: `Limite modifiée à ${newLimite} pour ${selectedUser.prenom} ${selectedUser.nom}`, severity: 'success' });
            fetchAllQuotas();
            setOpenEditDialog(false);
            setSelectedUser(null);
            
        } catch (error) {
            setSnackbar({ open: true, message: error.message || 'Erreur lors de la modification', severity: 'error' });
        }
    };

    const getProgressColor = (pourcentage) => {
        if (pourcentage >= 80) return 'error';
        if (pourcentage >= 60) return 'warning';
        return 'primary';
    };

    if (loading && quotas.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: isMobile ? 1 : 2 }}>
            {/* En-tête */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 700, color: '#1a237e' }}>
                    📊 Gestion des Quotas de Signature
                </Typography>
                <Button 
                    variant="outlined" 
                    startIcon={<RefreshIcon />} 
                    onClick={fetchAllQuotas}
                    size={isMobile ? "small" : "medium"}
                >
                    Actualiser
                </Button>
            </Box>

            {/* Cartes Statistiques */}
            {statistiques && (
                <Grid container spacing={isMobile ? 1.5 : 2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="caption" color="textSecondary">Signatures aujourd'hui</Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{statistiques.totalSignaturesAujourdhui || 0}</Typography>
                                    </Box>
                                    <CalendarTodayIcon sx={{ fontSize: 40, color: '#1a237e', opacity: 0.7 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="caption" color="textSecondary">Signatures cette semaine</Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{statistiques.totalSignaturesCetteSemaine || 0}</Typography>
                                    </Box>
                                    <DateRangeIcon sx={{ fontSize: 40, color: '#1a237e', opacity: 0.7 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="caption" color="textSecondary">Signatures ce mois</Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{statistiques.totalSignaturesCeMois || 0}</Typography>
                                    </Box>
                                    <EventNoteIcon sx={{ fontSize: 40, color: '#1a237e', opacity: 0.7 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="caption" color="textSecondary">Utilisateurs actifs</Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{statistiques.utilisateursActifsCeMois || 0}</Typography>
                                    </Box>
                                    <PersonIcon sx={{ fontSize: 40, color: '#1a237e', opacity: 0.7 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Tableau des utilisateurs */}
            <Card sx={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8f9fa' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Utilisateurs et leurs quotas
                    </Typography>
                </Box>
                <TableContainer component={Paper} elevation={0}>
                    <Table sx={{ minWidth: 650 }} size={isMobile ? "small" : "medium"}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                <TableCell>Utilisateur</TableCell>
                                <TableCell align="center">Signatures aujourd'hui</TableCell>
                                <TableCell align="center">Limite</TableCell>
                                <TableCell align="center">Progression</TableCell>
                                <TableCell align="center">Semaine</TableCell>
                                <TableCell align="center">Mois</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {quotas.map((user) => {
                                const quota = user.quota;
                                const pourcentage = quota?.pourcentageAujourdhui || 0;
                                const estLimiteAtteinte = quota?.resteAujourdhui === 0;
                                
                                return (
                                    <TableRow key={user.id} hover>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                                <Avatar sx={{ bgcolor: '#1a237e', width: 32, height: 32, fontSize: '0.9rem' }}>
                                                    {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {user.prenom} {user.nom}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {user.email}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    fontWeight: estLimiteAtteinte ? 700 : 400,
                                                    color: estLimiteAtteinte ? '#d32f2f' : 'inherit'
                                                }}
                                            >
                                                {quota?.signaturesAujourdhui || 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={quota?.limiteQuotidienne || 20}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontWeight: 600 }}
                                            />
                                        </TableCell>
                                        <TableCell align="center" sx={{ minWidth: 150 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <LinearProgress 
                                                    variant="determinate" 
                                                    value={Math.min(pourcentage, 100)}
                                                    sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                                                    color={getProgressColor(pourcentage)}
                                                />
                                                <Typography variant="caption" sx={{ minWidth: 40 }}>
                                                    {Math.round(pourcentage)}%
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2">
                                                {quota?.signaturesCetteSemaine || 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2">
                                                {quota?.signaturesCeMois || 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                                <Tooltip title="Modifier limite">
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setNewLimite(quota?.limiteQuotidienne || 20);
                                                            setOpenEditDialog(true);
                                                        }}
                                                        sx={{ color: '#1976d2' }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Réinitialiser le quota">
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => {
                                                            setUserToReset(user);
                                                            setOpenResetDialog(true);
                                                        }}
                                                        sx={{ color: '#d32f2f' }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Dialog Modification Limite */}
            <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    Modifier la limite quotidienne
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" gutterBottom>
                            Utilisateur: <strong>{selectedUser?.prenom} {selectedUser?.nom}</strong>
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                            Email: <strong>{selectedUser?.email}</strong>
                        </Typography>
                        <TextField
                            fullWidth
                            label="Nouvelle limite quotidienne"
                            type="number"
                            value={newLimite}
                            onChange={(e) => setNewLimite(parseInt(e.target.value))}
                            inputProps={{ min: 1, max: 500 }}
                            sx={{ mt: 2 }}
                            helperText="Limite entre 1 et 500 signatures par jour"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEditDialog(false)}>Annuler</Button>
                    <Button onClick={handleModifierLimite} variant="contained" sx={{ bgcolor: '#1a237e' }}>
                        Enregistrer
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Réinitialisation Quota */}
            <Dialog open={openResetDialog} onClose={() => setOpenResetDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon sx={{ color: '#ff9800' }} />
                    Réinitialiser le quota
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Êtes-vous sûr de vouloir réinitialiser le quota de <strong>{userToReset?.prenom} {userToReset?.nom}</strong> ?
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        Cette action remettra le compteur de signatures d'aujourd'hui à zéro.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenResetDialog(false)}>Annuler</Button>
                    <Button onClick={handleResetQuota} variant="contained" color="error">
                        Réinitialiser
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default GestionQuotasView;