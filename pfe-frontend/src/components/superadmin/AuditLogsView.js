import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, TextField, MenuItem,
    Stack, CircularProgress, Alert, TablePagination, useMediaQuery, 
    Card, CardContent, Button, Dialog, DialogTitle, DialogContent,
    Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CloseIcon from '@mui/icons-material/Close';

const AuditLogsView = ({ setSnackbar, isMobile = false, isTablet = false }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterEventType, setFilterEventType] = useState('');
    const [filterUserEmail, setFilterUserEmail] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    // ⭐ ÉTATS POUR L'ANALYSE IA
    const [openAnalyseDialog, setOpenAnalyseDialog] = useState(false);
    const [documentSelectionne, setDocumentSelectionne] = useState(null);
    
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;

    const eventTypes = ['SIGNATURE_DOCUMENT', 'ENVOI_INVITATION', 'GENERATION_CERTIFICAT', 'DEMANDE_CERTIFICAT', 'APPROBATION_CERTIFICAT', 'RENOUVELLEMENT_CERTIFICAT', 'VALIDATION_OTP', 'AUTO_SIGNATURE', 'INSCRIPTION', 'CONNEXION', 'ACTIVATION_COMPTE'];

    const getStatusColor = (status) => {
        switch(status) { case 'SUCCESS': return 'success'; case 'FAILED': return 'error'; case 'PENDING': return 'warning'; default: return 'default'; }
    };

    const getEventTypeLabel = (type) => {
        const labels = { 'SIGNATURE_DOCUMENT': 'Signature document', 'ENVOI_INVITATION': 'Envoi invitation', 'GENERATION_CERTIFICAT': 'Génération certificat', 'DEMANDE_CERTIFICAT': 'Demande certificat', 'APPROBATION_CERTIFICAT': 'Approbation certificat', 'RENOUVELLEMENT_CERTIFICAT': 'Renouvellement certificat', 'VALIDATION_OTP': 'Validation OTP', 'AUTO_SIGNATURE': 'Auto-signature', 'INSCRIPTION': 'Inscription', 'CONNEXION': 'Connexion', 'ACTIVATION_COMPTE': 'Activation compte' };
        return labels[type] || type;
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let url = 'http://localhost:8080/api/admin/audit/logs';
            const params = [];
            if (filterUserEmail) params.push(`userEmail=${encodeURIComponent(filterUserEmail)}`);
            if (filterEventType) params.push(`eventType=${filterEventType}`);
            if (params.length > 0) url += '?' + params.join('&');
            const response = await axios.get(url, { withCredentials: true });
            setLogs(response.data);
        } catch (error) {
            console.error('Erreur chargement logs:', error);
            if (setSnackbar) setSnackbar({ open: true, message: 'Erreur chargement des logs', severity: 'error' });
        } finally { setLoading(false); }
    };

    // ⭐ FONCTION POUR OUVRIR L'ANALYSE D'UN DOCUMENT
    const handleOpenAnalyse = (document) => {
        setDocumentSelectionne(document);
        setOpenAnalyseDialog(true);
    };

    useEffect(() => { fetchLogs(); }, [filterEventType, filterUserEmail]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <Box sx={{ px: { xs: 0, sm: 1 } }}>
            <Paper elevation={0} sx={{ p: mobile ? 2 : 3, borderRadius: 3 }}>
                <Stack direction={mobile ? "column" : "row"} justifyContent="space-between" alignItems={mobile ? "flex-start" : "center"} mb={3} spacing={2}>
                    <Typography variant={mobile ? "h6" : "h5"} fontWeight="bold">📋 Journalisation des signatures (Audit)</Typography>
                    <IconButton onClick={fetchLogs} disabled={loading} size={mobile ? "small" : "medium"}><RefreshIcon /></IconButton>
                </Stack>

                <Stack direction={mobile ? "column" : "row"} spacing={2} mb={3}>
                    <TextField label="Type d'événement" select value={filterEventType} onChange={(e) => setFilterEventType(e.target.value)} size="small" fullWidth={mobile} sx={{ minWidth: mobile ? 'auto' : 250 }}><MenuItem value="">Tous</MenuItem>{eventTypes.map(type => (<MenuItem key={type} value={type}>{getEventTypeLabel(type)}</MenuItem>))}</TextField>
                    <TextField label="Email utilisateur" value={filterUserEmail} onChange={(e) => setFilterUserEmail(e.target.value)} placeholder="exemple@email.com" size="small" fullWidth={mobile} sx={{ minWidth: mobile ? 'auto' : 250 }} />
                </Stack>

                {loading ? <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box> : logs.length === 0 ? <Alert severity="info">Aucun log trouvé</Alert> : mobile ? (
                    <Stack spacing={2}>
                        {logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log) => (
                            <Card key={log.id} sx={{ p: 2 }}>
                                <Stack spacing={1}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Chip label={getEventTypeLabel(log.eventType)} size="small" variant="outlined" />
                                        <Chip label={log.status || 'UNKNOWN'} size="small" color={getStatusColor(log.status)} icon={log.status === 'SUCCESS' ? <CheckCircleIcon /> : log.status === 'FAILED' ? <ErrorIcon /> : <PendingIcon />} />
                                    </Stack>
                                    <Typography variant="caption" color="textSecondary">{formatDate(log.timestamp)}</Typography>
                                    <Typography variant="body2"><strong>{log.userEmail || '-'}</strong></Typography>
                                    <Typography variant="caption">{log.documentName || '-'}</Typography>
                                    {log.signatureType && <Chip label={log.signatureType} size="small" variant="outlined" />}
                                    <Typography variant="caption" color="textSecondary">{log.details || '-'}</Typography>
                                    {/* ⭐ BOUTON ANALYSE IA */}
                                    {log.documentId && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<AnalyticsIcon />}
                                            onClick={() => handleOpenAnalyse({ id: log.documentId, nomFichier: log.documentName || 'Document' })}
                                            sx={{ mt: 1, borderRadius: 2, textTransform: 'none' }}
                                        >
                                            Analyser avec l'IA
                                        </Button>
                                    )}
                                </Stack>
                            </Card>
                        ))}
                    </Stack>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: '70vh' }}>
                            <Table size="small" stickyHeader>
                                <TableHead><TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Événement</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Utilisateur</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Document</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Type signature</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Détails</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Analyse IA</TableCell></TableRow></TableHead>
                                <TableBody>
                                    {logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log) => (
                                        <TableRow key={log.id} hover>
                                            <TableCell>{formatDate(log.timestamp)}</TableCell>
                                            <TableCell><Chip label={getEventTypeLabel(log.eventType)} size="small" variant="outlined" /></TableCell>
                                            <TableCell>{log.userEmail || '-'}</TableCell>
                                            <TableCell>{log.documentName || '-'}</TableCell>
                                            <TableCell>{log.signatureType ? <Chip label={log.signatureType} size="small" variant="outlined" /> : '-'}</TableCell>
                                            <TableCell><Chip label={log.status || 'UNKNOWN'} size="small" color={getStatusColor(log.status)} icon={log.status === 'SUCCESS' ? <CheckCircleIcon /> : log.status === 'FAILED' ? <ErrorIcon /> : <PendingIcon />} /></TableCell>
                                            <TableCell><Typography variant="caption">{log.details || '-'}</Typography></TableCell>
                                            <TableCell>
                                                {log.documentId && (
                                                    <Tooltip title="Analyser le document avec l'IA">
                                                        <IconButton
                                                            size="small"
                                                            color="secondary"
                                                            onClick={() => handleOpenAnalyse({ id: log.documentId, nomFichier: log.documentName || 'Document' })}
                                                        >
                                                            <AnalyticsIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination rowsPerPageOptions={[10, 20, 50, 100]} component="div" count={logs.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(e, newPage) => setPage(newPage)} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} labelRowsPerPage="Lignes par page" />
                    </>
                )}
            </Paper>

            {/* ⭐ DIALOG POUR L'ANALYSE IA DU DOCUMENT */}
            <Dialog 
                open={openAnalyseDialog} 
                onClose={() => setOpenAnalyseDialog(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        margin: mobile ? '16px' : '32px',
                        width: mobile ? 'calc(100% - 32px)' : 'auto',
                        borderRadius: '16px',
                        maxHeight: '90vh'
                    }
                }}
            >
                <DialogTitle sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    pb: 1,
                    borderBottom: '1px solid #e0e0e0'
                }}>
                    <Typography variant="h6" fontWeight="700">
                        Analyse IA du document
                    </Typography>
                    <IconButton onClick={() => setOpenAnalyseDialog(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
                  
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default AuditLogsView;