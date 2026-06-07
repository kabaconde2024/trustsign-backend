// components/superadmin/AdminCertificats.js - Version Alignée (Cookies & Token)
import React, { useState, useEffect } from 'react';
import { 
    Box, Grid, Card, CardContent, Typography, Stack, 
    Avatar, LinearProgress, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, Chip,
    Tooltip, useMediaQuery, Button, Dialog, DialogTitle, 
    DialogContent, IconButton as MuiIconButton
} from '@mui/material';
import { 
    VerifiedUser, Pending, Shield, FactCheck, 
    Cancel, Close as CloseIcon
} from '@mui/icons-material';
import API from '../../services/api';  // ← Transmet automatiquement les cookies/tokens

const AdminCertificats = ({ setSnackbar, isMobile = false, isTablet = false }) => {
    const [certStats, setCertStats] = useState({
        totalCertificates: 0,
        activeCertificates: 0,
        pendingCertificates: 0,
        revokedCertificates: 0
    });
    const [certificatesList, setCertificatesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openActionDialog, setOpenActionDialog] = useState(false);
    const [certificatSelectionne, setCertificatSelectionne] = useState(null);
    const [actionType, setActionType] = useState(''); // 'approve' ou 'revoke'

    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;

    // Même abstraction que StatsView : l'instance API porte les cookies/tokens de session
    const fetchAPI = async (endpoint) => {
        try {
            const response = await API.get(endpoint);
            return response.data;
        } catch (error) {
            console.error(`Erreur fetch ${endpoint}:`, error);
            throw error;
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Les cookies de session/tokens sont joints automatiquement ici
            const [statsRes, listRes] = await Promise.all([
                fetchAPI('/admin/pki/stats'),
                fetchAPI('/admin/pki/certificats')
            ]);

            setCertStats({
                totalCertificates: statsRes.total || 0,
                activeCertificates: statsRes.active || 0,
                pendingCertificates: statsRes.pending || 0,
                revokedCertificates: statsRes.revoked || 0
            });
            setCertificatesList(listRes || []);
        } catch (error) {
            console.error("Erreur chargement données PKI:", error);
            if (setSnackbar) {
                setSnackbar({ open: true, message: "Erreur d'authentification ou de chargement", severity: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [setSnackbar]);

    const handleOpenAction = (certificat, type) => {
        setCertificatSelectionne(certificat);
        setActionType(type);
        setOpenActionDialog(true);
    };

    const handleProcessAction = async (id, statusAction) => {
        try {
            // Appel PUT utilisant la même instance API sécurisée par cookie/token
            await API.put(`/admin/pki/certificats/${id}`, { status: statusAction });
            
            if (setSnackbar) {
                setSnackbar({ 
                    open: true, 
                    message: `Action '${statusAction}' exécutée avec succès`, 
                    severity: 'success' 
                });
            }
            setOpenActionDialog(false);
            loadData(); // Rafraîchissement automatique du registre
        } catch (error) {
            console.error("Erreur lors de la modification du statut:", error);
            if (setSnackbar) {
                setSnackbar({ open: true, message: "Action non autorisée ou erreur serveur", severity: 'error' });
            }
        }
    };

    const statCards = [
        { title: "Total Certificats", value: certStats.totalCertificates, icon: <Shield />, color: "#1a237e", bg: "#e8eaf6" },
        { title: "Certificats Actifs", value: certStats.activeCertificates, icon: <VerifiedUser />, color: "#2e7d32", bg: "#e8f5e9" },
        { title: "En Attente", value: certStats.pendingCertificates, icon: <Pending />, color: "#ed6c02", bg: "#fff4e5" },
        { title: "Révoqués", value: certStats.revokedCertificates, icon: <Cancel />, color: "#d32f2f", bg: "#ffebee" }
    ];

    const getStatusChip = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': case 'actif':
                return <Chip icon={<VerifiedUser />} label="Actif" size="small" color="success" variant="outlined" />;
            case 'pending': case 'en attente':
                return <Chip icon={<Pending />} label="En attente" size="small" color="warning" variant="outlined" />;
            case 'revoked': case 'révoqué':
                return <Chip icon={<Cancel />} label="Révoqué" size="small" color="error" variant="outlined" />;
            default:
                return <Chip label={status || "Inconnu"} size="small" variant="outlined" />;
        }
    };

    if (loading) return <LinearProgress />;

    return (
        <Box sx={{ px: { xs: 0, sm: 1 } }}>
            <Typography variant={mobile ? "h6" : "h5"} fontWeight="800" sx={{ mb: mobile ? 2 : 4, color: '#1a237e' }}>
                Gestion de la PKI & Certificats
            </Typography>
            
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: '#64748b', fontSize: mobile ? '0.8rem' : '0.9rem' }}>
                Vue d'ensemble
            </Typography>
            <Grid container spacing={mobile ? 2 : 3} sx={{ mb: mobile ? 3 : 5 }}>
                {statCards.map((card, idx) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
                        <Card sx={{ borderRadius: '16px', boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>
                            <CardContent sx={{ p: mobile ? 1.5 : 2 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box>
                                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: mobile ? '0.65rem' : '0.75rem' }}>
                                            {card.title}
                                        </Typography>
                                        <Typography variant={mobile ? "h5" : "h4"} fontWeight="bold" sx={{ color: card.color }}>
                                            {card.value}
                                        </Typography>
                                    </Box>
                                    <Avatar sx={{ bgcolor: card.bg, color: card.color, width: mobile ? 40 : 48, height: mobile ? 40 : 48 }}>
                                        {card.icon}
                                    </Avatar>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Typography variant={mobile ? "subtitle1" : "h6"} fontWeight="bold" sx={{ mb: 2, color: '#1a237e' }}>
                Registre des Certificats
            </Typography>
            
            {mobile ? (
                /* Layout Cartes pour Mobile */
                <Stack spacing={2}>
                    {certificatesList.length === 0 ? (
                        <Paper sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="textSecondary">Aucun certificat trouvé</Typography>
                        </Paper>
                    ) : (
                        certificatesList.map((cert, idx) => (
                            <Paper key={idx} sx={{ p: 2, borderRadius: '12px' }}>
                                <Stack spacing={1}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        {getStatusChip(cert.status)}
                                        <Typography variant="caption" color="textSecondary">
                                            {new Date(cert.dateCreation || cert.date).toLocaleDateString()}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" fontWeight="bold">{cert.commonName || cert.user}</Typography>
                                    <Typography variant="caption" color="textSecondary">Email : {cert.email || 'N/A'}</Typography>
                                    
                                    {cert.status?.toLowerCase() === 'pending' && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="success"
                                            onClick={() => handleOpenAction(cert, 'approve')}
                                            sx={{ mt: 1, borderRadius: 2, textTransform: 'none' }}
                                        >
                                            Valider la demande
                                        </Button>
                                    )}
                                    {(cert.status?.toLowerCase() === 'active' || cert.status?.toLowerCase() === 'actif') && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            onClick={() => handleOpenAction(cert, 'revoke')}
                                            sx={{ mt: 1, borderRadius: 2, textTransform: 'none' }}
                                        >
                                            Révoquer
                                        </Button>
                                    )}
                                </Stack>
                            </Paper>
                        ))
                    )}
                </Stack>
            ) : (
                /* Layout Tableau pour Desktop/Tablette */
                <TableContainer component={Paper} sx={{ borderRadius: '12px', overflowX: 'auto' }}>
                    <Table sx={{ minWidth: 650 }}>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><b>Statut</b></TableCell>
                                <TableCell><b>Utilisateur (CN)</b></TableCell>
                                <TableCell><b>Adresse Email</b></TableCell>
                                <TableCell><b>Date d'émission</b></TableCell>
                                <TableCell align="right"><b>Actions</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {certificatesList.length === 0 ? (
                                <TableRow><TableCell colSpan={5} align="center">Aucun certificat dans le registre</TableCell></TableRow>
                            ) : (
                                certificatesList.map((cert, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{getStatusChip(cert.status)}</TableCell>
                                        <TableCell>{cert.commonName || cert.user}</TableCell>
                                        <TableCell>{cert.email || 'N/A'}</TableCell>
                                        <TableCell>{new Date(cert.dateCreation || cert.date).toLocaleDateString()}</TableCell>
                                        <TableCell align="right">
                                            {cert.status?.toLowerCase() === 'pending' && (
                                                <Button 
                                                    size="small" 
                                                    variant="contained" 
                                                    color="success" 
                                                    onClick={() => handleOpenAction(cert, 'approve')}
                                                    sx={{ borderRadius: '8px', textTransform: 'none' }}
                                                >
                                                    Approuver
                                                </Button>
                                            )}
                                            {(cert.status?.toLowerCase() === 'active' || cert.status?.toLowerCase() === 'actif') && (
                                                <Button 
                                                    size="small" 
                                                    variant="outlined" 
                                                    color="error" 
                                                    onClick={() => handleOpenAction(cert, 'revoke')}
                                                    sx={{ borderRadius: '8px', textTransform: 'none' }}
                                                >
                                                    Révoquer
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Boîte de Dialogue pour les Actions (Validation / Révocation) */}
            <Dialog 
                open={openActionDialog} 
                onClose={() => setOpenActionDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '16px', margin: mobile ? '16px' : '32px' } }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0', pb: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                        {actionType === 'approve' ? "Approbation du certificat" : "Révocation du certificat"}
                    </Typography>
                    <MuiIconButton onClick={() => setOpenActionDialog(false)} size="small">
                        <CloseIcon />
                    </MuiIconButton>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    {certificatSelectionne && (
                        <Stack spacing={3} sx={{ mt: 1 }}>
                            <Typography variant="body1">
                                Êtes-vous sûr de vouloir {actionType === 'approve' ? "générer et approuver" : "révoquer définitivement"} le certificat pour : 
                                <br /><strong>{certificatSelectionne.commonName || certificatSelectionne.user}</strong> ({certificatSelectionne.email}) ?
                            </Typography>
                            <Stack direction="row" spacing={2} justifyContent="flex-end">
                                <Button variant="text" color="inherit" onClick={() => setOpenActionDialog(false)} sx={{ textTransform: 'none' }}>
                                    Annuler
                                </Button>
                                <Button 
                                    variant="contained" 
                                    color={actionType === 'approve' ? "success" : "error"}
                                    onClick={() => handleProcessAction(certificatSelectionne.id, actionType === 'approve' ? 'active' : 'revoked')}
                                    sx={{ borderRadius: '8px', textTransform: 'none' }}
                                >
                                    Confirmer
                                </Button>
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default AdminCertificats;