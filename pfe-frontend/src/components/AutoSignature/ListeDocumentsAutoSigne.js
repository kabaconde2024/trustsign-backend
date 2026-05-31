import React, { useState, useEffect } from 'react';
import { Download, Delete, PictureAsPdf, Description, CalendarToday, CheckCircle } from '@mui/icons-material';
import axios from 'axios';
import { 
  Box, Button, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Stack, useMediaQuery, 
  Card, CardContent, Grid, Chip, IconButton, Tooltip, 
  Fade, Badge, Avatar, Divider, alpha
} from '@mui/material';

const CalendarTodayIcon = CalendarToday;

const ListeDocumentsAutoSignes = ({ setSnackbar, isMobile = false }) => {
    const [documents, setDocuments] = useState([]);
    const [downloading, setDownloading] = useState({});
    const [deleting, setDeleting] = useState({});

    const API_BASE_URL = 'http://localhost:8080/api/documents';
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const isTablet = useMediaQuery('(max-width:960px)');
    const mobile = isMobile || isSmallScreen;

    const fetchDocuments = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/liste-signes-auto`, { withCredentials: true });
            setDocuments(res.data);
        } catch (e) {
            console.error("Erreur:", e);
            setSnackbar({ open: true, message: "Erreur lors du chargement", severity: 'error' });
        }
    };

    useEffect(() => { fetchDocuments(); }, []);

    const handleDelete = async (id) => {
        if (window.confirm("Supprimer définitivement ce document ?")) {
            setDeleting(prev => ({ ...prev, [id]: true }));
            try {
                await axios.delete(`${API_BASE_URL}/supprimer/${id}`, { withCredentials: true });
                setSnackbar({ open: true, message: "Document supprimé", severity: 'info' });
                fetchDocuments();
            } catch (e) {
                setSnackbar({ open: true, message: "Erreur suppression", severity: 'error' });
            } finally {
                setDeleting(prev => ({ ...prev, [id]: false }));
            }
        }
    };

    const handleDownload = async (id, nom) => {
        setDownloading(prev => ({ ...prev, [id]: true }));
        try {
            const response = await axios.get(`${API_BASE_URL}/download/${id}`, { 
                responseType: 'blob', 
                withCredentials: true 
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const nomFichier = nom.endsWith('.pdf') ? nom : `${nom}.pdf`;
            link.setAttribute('download', nomFichier);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setSnackbar({ open: true, message: "Téléchargement réussi", severity: 'success' });
        } catch (e) {
            setSnackbar({ open: true, message: "Erreur téléchargement", severity: 'error' });
        } finally {
            setDownloading(prev => ({ ...prev, [id]: false }));
        }
    };

    const truncateFileName = (fileName, maxLength) => {
        if (!fileName) return 'Document PDF';
        if (fileName.length <= maxLength) return fileName;
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 3) + '...';
        return `${truncatedName}.${extension}`;
    };

    const stats = {
        total: documents.length
    };

    // Version Mobile - Cartes
    if (mobile) {
        return (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
                {/* En-tête */}
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h6" fontWeight="800" sx={{ color: '#0b1e39', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Description sx={{ color: '#1a237e' }} />
                        Mes Documents Signés
                        <Badge badgeContent={stats.total} color="primary" sx={{ '& .MuiBadge-badge': { fontWeight: 600 } }} />
                    </Typography>
                    <Chip size="small" label={`📄 ${stats.total} document(s)`} variant="outlined" />
                </Box>

                <Stack spacing={2}>
                    {documents.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                            <Typography variant="body1" color="textSecondary">📭 Aucun document signé trouvé.</Typography>
                        </Paper>
                    ) : (
                        documents.map((doc, index) => {
                            const maxLength = 30;
                            const displayName = truncateFileName(doc.nomFichier, maxLength);
                            const isDownloading = downloading[doc.id];
                            const isDeleting = deleting[doc.id];

                            return (
                                <Fade key={doc.id} in timeout={index * 100}>
                                    <Card sx={{ 
                                        borderRadius: 3, 
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Stack spacing={1.5}>
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Avatar sx={{ bgcolor: '#ffebee', width: 44, height: 44 }}>
                                                        <PictureAsPdf sx={{ color: '#d32f2f' }} />
                                                    </Avatar>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Tooltip title={doc.nomFichier} placement="top" arrow>
                                                            <Typography variant="subtitle2" fontWeight="700" sx={{ wordBreak: 'break-word' }}>
                                                                {displayName}
                                                            </Typography>
                                                        </Tooltip>
                                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                                            <CalendarTodayIcon sx={{ fontSize: 12, color: '#64748b' }} />
                                                            <Typography variant="caption" color="textSecondary">
                                                                {doc.dateCreation ? new Date(doc.dateCreation).toLocaleDateString('fr-FR') : 'N/A'}
                                                            </Typography>
                                                        </Stack>
                                                    </Box>
                                                    <Chip 
                                                        icon={<CheckCircle sx={{ fontSize: 14 }} />}
                                                        label="Signé" 
                                                        size="small" 
                                                        color="success"
                                                        sx={{ fontWeight: 600, borderRadius: 2 }}
                                                    />
                                                </Stack>

                                                <Divider />

                                                <Stack direction="row" spacing={1}>
                                                    <Button 
                                                        size="small" 
                                                        variant="contained" 
                                                        startIcon={<Download />} 
                                                        onClick={() => handleDownload(doc.id, doc.nomFichier)} 
                                                        disabled={isDownloading}
                                                        fullWidth
                                                        sx={{ 
                                                            bgcolor: '#1976d2', 
                                                            borderRadius: 2,
                                                            textTransform: 'none',
                                                            '&:hover': { bgcolor: '#1565c0' }
                                                        }}
                                                    >
                                                        {isDownloading ? "Téléchargement..." : "Télécharger"}
                                                    </Button>
                                                    <Button 
                                                        size="small" 
                                                        variant="outlined" 
                                                        color="error" 
                                                        startIcon={<Delete />} 
                                                        onClick={() => handleDelete(doc.id)}
                                                        disabled={isDeleting}
                                                        fullWidth
                                                        sx={{ borderRadius: 2, textTransform: 'none' }}
                                                    >
                                                        {isDeleting ? "Suppression..." : "Supprimer"}
                                                    </Button>
                                                </Stack>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Fade>
                            );
                        })
                    )}
                </Stack>
            </Box>
        );
    }

    // Version Tablette et Desktop - Grille
    const getGridColumns = () => {
        if (isTablet) return 2;
        return 3;
    };

    return (
        <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
            {/* En-tête avec statistiques */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0b1e39', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Description sx={{ color: '#1a237e' }} />
                    Mes Documents Signés
                    <Badge badgeContent={stats.total} color="primary" sx={{ '& .MuiBadge-badge': { fontWeight: 600 } }} />
                </Typography>
                
                <Stack direction="row" spacing={1}>
                    <Chip size="small" label={`📄 ${stats.total} document(s)`} variant="outlined" />
                    <Chip size="small" label="✅ Auto-signature" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32' }} />
                </Stack>
            </Box>

            {documents.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                    <Typography variant="h6" color="textSecondary">📭 Aucun document signé trouvé.</Typography>
                </Paper>
            ) : (
                <Grid container spacing={3}>
                    {documents.map((doc, index) => {
                        const maxLength = isTablet ? 35 : 45;
                        const displayName = truncateFileName(doc.nomFichier, maxLength);
                        const isDownloading = downloading[doc.id];
                        const isDeleting = deleting[doc.id];

                        return (
                            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                                <Fade in timeout={index * 100}>
                                    <Card sx={{ 
                                        height: '100%',
                                        borderRadius: 3, 
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.12)' },
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <CardContent sx={{ p: 3, flex: 1 }}>
                                            {/* En-tête */}
                                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                                <Avatar sx={{ bgcolor: '#ffebee', width: 48, height: 48 }}>
                                                    <PictureAsPdf sx={{ color: '#d32f2f', fontSize: 28 }} />
                                                </Avatar>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Tooltip title={doc.nomFichier} placement="top" arrow>
                                                        <Typography variant="subtitle1" fontWeight="700" sx={{ 
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {displayName}
                                                        </Typography>
                                                    </Tooltip>
                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                                        <CalendarTodayIcon sx={{ fontSize: 12, color: '#64748b' }} />
                                                        <Typography variant="caption" color="textSecondary">
                                                            {doc.dateCreation ? new Date(doc.dateCreation).toLocaleDateString('fr-FR') : 'N/A'}
                                                        </Typography>
                                                    </Stack>
                                                </Box>
                                                <Chip 
                                                    icon={<CheckCircle sx={{ fontSize: 14 }} />}
                                                    label="Signé" 
                                                    size="small" 
                                                    color="success"
                                                    sx={{ fontWeight: 600, borderRadius: 2, flexShrink: 0 }}
                                                />
                                            </Stack>

                                            <Divider sx={{ my: 2 }} />

                                            {/* Informations supplémentaires */}
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                                                    ID: {doc.id}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary" display="block">
                                                    Type: Auto-signature HSM/Local
                                                </Typography>
                                            </Box>

                                            {/* Actions */}
                                            <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                                                <Button 
                                                    size="small" 
                                                    variant="contained"
                                                    startIcon={<Download />} 
                                                    onClick={() => handleDownload(doc.id, doc.nomFichier)} 
                                                    disabled={isDownloading}
                                                    fullWidth
                                                    sx={{ 
                                                        bgcolor: '#1976d2', 
                                                        borderRadius: 2,
                                                        textTransform: 'none',
                                                        '&:hover': { bgcolor: '#1565c0' }
                                                    }}
                                                >
                                                    {isDownloading ? "Téléchargement..." : "Télécharger"}
                                                </Button>
                                                <Button 
                                                    size="small" 
                                                    variant="outlined" 
                                                    color="error" 
                                                    startIcon={<Delete />} 
                                                    onClick={() => handleDelete(doc.id)}
                                                    disabled={isDeleting}
                                                    fullWidth
                                                    sx={{ borderRadius: 2, textTransform: 'none' }}
                                                >
                                                    {isDeleting ? "Suppression..." : "Supprimer"}
                                                </Button>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Fade>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Légende */}
            {documents.length > 0 && (
                <Paper 
                    elevation={0} 
                    sx={{ 
                        mt: 4, 
                        p: 2, 
                        bgcolor: '#f8fafc', 
                        borderRadius: 3, 
                        border: '1px solid #e2e8f0'
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#0b1e39' }}>
                            Informations :
                        </Typography>
                        <Chip size="small" label="Auto-signature avec HSM" variant="outlined" />
                        <Chip size="small" label="Document signé électroniquement" variant="outlined" />
                        <Chip size="small" label="Format PDF certifié" variant="outlined" />
                    </Stack>
                </Paper>
            )}
        </Box>
    );
};

export default ListeDocumentsAutoSignes;