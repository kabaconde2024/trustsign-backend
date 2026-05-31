// components/AuditIntelligenceDashboard.js - VERSION AVEC SÉLECTEUR DE VISUALISATION
import React, { useState, useEffect } from 'react';
import {
    Box, Grid, Card, CardContent, Typography, Paper,
    Chip, CircularProgress, Alert, Stack,
    Divider, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, useMediaQuery,
    Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tooltip, Button,
    LinearProgress, Avatar, Badge,
    Pagination, Skeleton, Fade, Zoom,
    ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
    TrendingUp, TrendingDown, Warning, Security,
    Refresh, Assessment, CheckCircle,
    Person, Block, Public,
    Speed, Timeline, Error as ErrorIcon,
    Info as InfoIcon, Close as CloseIcon,
    Shield, BugReport, Analytics, Dashboard,
    History, Star, VerifiedUser,
    PieChart as PieChartIcon, BarChart as BarChartIcon,
    ViewList as ViewListIcon
} from '@mui/icons-material';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    ResponsiveContainer, AreaChart, Area, Tooltip as RechartsTooltip,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import axios from 'axios';

const IA_API_URL = process.env.REACT_APP_IA_API_URL || 'http://localhost:8000';

// Constantes
const COLORS = {
    primary: '#1e3a5f',
    secondary: '#2c5f8a',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
    background: '#f8f9fc'
};

const RISK_LEVELS = {
    CRITIQUE: { color: '#d32f2f', bg: '#ffebee', icon: <ErrorIcon />, label: 'Critique' },
    ELEVE: { color: '#ff9800', bg: '#fff3e0', icon: <Warning />, label: 'Élevé' },
    MOYEN: { color: '#ffc107', bg: '#fff8e1', icon: <Security />, label: 'Moyen' },
    FAIBLE: { color: '#4caf50', bg: '#e8f5e9', icon: <VerifiedUser />, label: 'Faible' }
};

const AuditIntelligenceDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [selectedAnomaly, setSelectedAnomaly] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [chartType, setChartType] = useState('donut'); // 'donut', 'barHorizontal', 'barVertical', 'table'
    const isMobile = useMediaQuery('(max-width:900px)');

    useEffect(() => {
        fetchData();
        // Récupérer le type de graphique sauvegardé
        const savedChartType = localStorage.getItem('preferredChartType');
        if (savedChartType && ['donut', 'barHorizontal', 'barVertical', 'table'].includes(savedChartType)) {
            setChartType(savedChartType);
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const jours = 7;
            const [detection, resume] = await Promise.all([
                axios.get(`${IA_API_URL}/api/ia/avancee/detection-complete?jours=${jours}`),
                axios.get(`${IA_API_URL}/api/ia/avancee/attaques/resume?jours=${jours}`)
            ]);
            setData({
                detection: detection.data,
                resume: resume.data
            });
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    const handleChartTypeChange = (newType) => {
        if (newType) {
            setChartType(newType);
            localStorage.setItem('preferredChartType', newType);
        }
    };

    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3, mb: 3 }} />
                <Grid container spacing={3}>
                    {[1, 2, 3, 4].map(i => (
                        <Grid item xs={12} sm={6} md={3} key={i}>
                            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    const stats = data?.detection?.statistiques || {};
    const anomalies = data?.detection?.detections?.anomalies || [];
    const totalAnomalies = anomalies.length;
    const attaques = data?.resume?.attaques || [];
    const niveauGlobal = data?.resume?.niveau_risque_global || 'FAIBLE';

    // Données pour graphiques
    const pieData = [
        { name: 'Succès', value: stats.taux_succes || 0, color: COLORS.success },
        { name: 'Échecs', value: 100 - (stats.taux_succes || 0), color: COLORS.error }
    ];

    // Récupérer les données pour l'histogramme
    const getEventTypeData = () => {
        const types = stats.types_evenements || {};
        if (Object.keys(types).length === 0) return [];
        return Object.entries(types)
            .slice(0, 5)
            .map(([key, val]) => ({
                name: key.replace(/_/g, ' ').substring(0, 20),
                value: val
            }))
            .sort((a, b) => b.value - a.value);
    };
    const eventTypeData = getEventTypeData();
    const hasEventData = eventTypeData.length > 0;

    // ============================================
    // FONCTIONS DE RENDU POUR CHAQUE TYPE DE GRAPHIQUE
    // ============================================

    // 1. Diagramme en anneau (Donut Chart)
    const renderDonutChart = () => {
        const total = eventTypeData.reduce((sum, item) => sum + item.value, 0);
        const COLORS_CHART = ['#1e3a5f', '#2c5f8a', '#4a90c4', '#ff9800', '#f44336'];
        
        return (
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={eventTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                    >
                        {eventTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                        ))}
                    </Pie>
                    <RechartsTooltip 
                        formatter={(value, name, props) => [
                            `${value} événements (${((value / total) * 100).toFixed(1)}%)`, 
                            props.payload.name
                        ]}
                    />
                    <Legend 
                        layout="vertical" 
                        align="right" 
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(value) => value.length > 18 ? value.substring(0, 15) + '...' : value}
                    />
                </PieChart>
            </ResponsiveContainer>
        );
    };

    // 2. Diagramme à barres HORIZONTALES
    const renderHorizontalBarChart = () => {
        return (
            <ResponsiveContainer width="100%" height={280}>
                <BarChart 
                    data={eventTypeData} 
                    layout="vertical"
                    margin={{ left: 100, right: 30, top: 10, bottom: 10 }}
                    barSize={25}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={100}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                    />
                    <RechartsTooltip 
                        formatter={(value) => [`${value} événements`, 'Nombre']}
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    />
                    <Bar 
                        dataKey="value" 
                        fill={COLORS.primary} 
                        radius={[0, 8, 8, 0]}
                        label={{ position: 'right', formatter: (value) => value, fill: '#333', fontSize: 11 }}
                    />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    // 3. Diagramme à barres VERTICALES
    const renderVerticalBarChart = () => {
        return (
            <ResponsiveContainer width="100%" height={280}>
                <BarChart 
                    data={eventTypeData}
                    margin={{ left: 20, right: 20, top: 20, bottom: 60 }}
                    barSize={40}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                        height={60}
                        interval={0}
                        tickFormatter={(value) => value.length > 10 ? value.substring(0, 8) + '...' : value}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={(value) => [`${value} événements`, 'Nombre']} />
                    <Bar 
                        dataKey="value" 
                        fill={COLORS.primary} 
                        radius={[8, 8, 0, 0]}
                        label={{ position: 'top', formatter: (value) => value, fontSize: 11 }}
                    />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    // 4. Vue Tableau
    const renderTableView = () => {
        const total = eventTypeData.reduce((sum, item) => sum + item.value, 0);
        
        return (
            <TableContainer sx={{ maxHeight: 280 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                            <TableCell>Type d'événement</TableCell>
                            <TableCell align="right">Nombre</TableCell>
                            <TableCell align="right">Pourcentage</TableCell>
                            <TableCell align="center">Progression</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {eventTypeData.map((item, idx) => {
                            const percentage = ((item.value / total) * 100).toFixed(1);
                            return (
                                <TableRow key={idx} hover>
                                    <TableCell component="th" scope="row">
                                        <Typography variant="body2" fontWeight="medium">
                                            {item.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2">
                                            {item.value}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Chip 
                                            label={`${percentage}%`} 
                                            size="small" 
                                            sx={{ 
                                                bgcolor: percentage > 30 ? COLORS.primary + '20' : COLORS.info + '20',
                                                color: percentage > 30 ? COLORS.primary : COLORS.info,
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="center" sx={{ minWidth: 100 }}>
                                        <LinearProgress 
                                            variant="determinate" 
                                            value={parseFloat(percentage)} 
                                            sx={{ height: 6, borderRadius: 3 }}
                                            color={percentage > 30 ? "primary" : "info"}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: COLORS.background, minHeight: '100vh' }}>
            
            {/* HEADER */}
            <Zoom in={true}>
                <Paper sx={{ 
                    p: 3, mb: 4, borderRadius: 4,
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5f8a 100%)',
                    color: 'white'
                }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                        <Box>
                            <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Shield sx={{ fontSize: 40 }} />
                                Audit Intelligence
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                                Détection d'anomalies • Analyse comportementale • Alertes sécurité
                            </Typography>
                        </Box>
                        <Badge 
                            badgeContent={niveauGlobal} 
                            color={niveauGlobal === 'CRITIQUE' ? 'error' : niveauGlobal === 'ELEVE' ? 'warning' : 'success'}
                            sx={{ mt: { xs: 2, sm: 0 } }}
                        >
                            <Chip 
                                icon={RISK_LEVELS[niveauGlobal]?.icon || <Security />}
                                label={`Risque ${RISK_LEVELS[niveauGlobal]?.label || 'Inconnu'}`}
                                sx={{ 
                                    bgcolor: 'rgba(255,255,255,0.2)', 
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '1rem',
                                    py: 2
                                }}
                            />
                        </Badge>
                    </Stack>
                </Paper>
            </Zoom>

            {/* KPI CARDS */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {[
                    { title: 'Événements analysés', value: stats.total_evenements || 0, icon: <History />, color: COLORS.primary },
                    { title: 'Taux de succès', value: `${stats.taux_succes || 0}%`, icon: <CheckCircle />, color: COLORS.success },
                    { title: 'Anomalies', value: totalAnomalies, icon: <BugReport />, color: COLORS.warning },
                    { title: 'Attaques', value: data?.resume?.total_attaques || 0, icon: <Shield />, color: COLORS.error }
                ].map((kpi, idx) => (
                    <Grid item xs={6} md={3} key={idx}>
                        <Fade in={true} timeout={idx * 200}>
                            <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box>
                                            <Typography variant="caption" color="textSecondary">
                                                {kpi.title}
                                            </Typography>
                                            <Typography variant="h4" fontWeight="bold">
                                                {kpi.value}
                                            </Typography>
                                        </Box>
                                        <Avatar sx={{ bgcolor: `${kpi.color}15`, color: kpi.color, width: 48, height: 48 }}>
                                            {kpi.icon}
                                        </Avatar>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Fade>
                    </Grid>
                ))}
            </Grid>

            {/* GRAPHIQUES DOUBLE */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Graphique 1: Taux de succès */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="bold" gutterBottom>
                                Taux de succès
                            </Typography>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                        labelLine={true}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value) => `${value}%`} />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Graphique 2: Types d'événements AVEC SÉLECTEUR */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold">
                                    📈 Types d'événements
                                </Typography>
                                
                                {/* Sélecteur de type de graphique */}
                                <ToggleButtonGroup
                                    value={chartType}
                                    exclusive
                                    onChange={(e, newValue) => handleChartTypeChange(newValue)}
                                    size="small"
                                    aria-label="type de graphique"
                                >
                                    <ToggleButton value="donut" aria-label="camembert">
                                        <Tooltip title="Camembert / Anneau">
                                            <PieChartIcon fontSize="small" />
                                        </Tooltip>
                                    </ToggleButton>
                                    <ToggleButton value="barHorizontal" aria-label="barres horizontales">
                                        <Tooltip title="Barres horizontales">
                                            <BarChartIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                                        </Tooltip>
                                    </ToggleButton>
                                    <ToggleButton value="barVertical" aria-label="barres verticales">
                                        <Tooltip title="Barres verticales">
                                            <BarChartIcon fontSize="small" />
                                        </Tooltip>
                                    </ToggleButton>
                                    <ToggleButton value="table" aria-label="tableau">
                                        <Tooltip title="Vue tableau">
                                            <ViewListIcon fontSize="small" />
                                        </Tooltip>
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Stack>

                            {!hasEventData ? (
                                <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        Aucune donnée d'événement disponible
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    {chartType === 'donut' && renderDonutChart()}
                                    {chartType === 'barHorizontal' && renderHorizontalBarChart()}
                                    {chartType === 'barVertical' && renderVerticalBarChart()}
                                    {chartType === 'table' && renderTableView()}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* TABLEAU DES ANOMALIES */}
            <Card sx={{ borderRadius: 3, mb: 4 }}>
                <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">
                            ⚠️ Anomalies détectées
                            <Chip 
                                label={totalAnomalies} 
                                size="small" 
                                sx={{ ml: 1, bgcolor: COLORS.warning + '20', color: COLORS.warning }}
                            />
                        </Typography>
                        <Button startIcon={<Refresh />} size="small" onClick={fetchData}>
                            Actualiser
                        </Button>
                    </Stack>
                    <Divider sx={{ mb: 2 }} />

                    {anomalies.length === 0 ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Aucune anomalie détectée pendant la période analysée.
                        </Alert>
                    ) : (
                        <>
                            <TableContainer>
                                <Table size={isMobile ? "small" : "medium"}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Utilisateur</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell align="center">Score</TableCell>
                                            <TableCell align="center">Risque</TableCell>
                                            <TableCell align="center">Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {anomalies.slice((page - 1) * 5, page * 5).map((anomaly, idx) => {
                                            const risk = RISK_LEVELS[anomaly.niveau_risque] || RISK_LEVELS.MOYEN;
                                            return (
                                                <TableRow key={idx} hover>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        {new Date(anomaly.horodatage).toLocaleDateString()}
                                                        <Typography variant="caption" display="block" color="textSecondary">
                                                            {new Date(anomaly.horodatage).toLocaleTimeString()}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Avatar sx={{ width: 28, height: 28, bgcolor: COLORS.primary + '20' }}>
                                                                <Person sx={{ fontSize: 16, color: COLORS.primary }} />
                                                            </Avatar>
                                                            <Typography variant="body2">
                                                                {anomaly.email_utilisateur?.split('@')[0] || 'Inconnu'}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={anomaly.type_anomalie?.replace(/_/g, ' ') || 'Inconnu'}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '0.7rem' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title={`${(anomaly.score_anomalie * 100).toFixed(0)}%`}>
                                                            <LinearProgress 
                                                                variant="determinate" 
                                                                value={anomaly.score_anomalie * 100} 
                                                                sx={{ width: 80, height: 6, borderRadius: 3 }}
                                                                color={anomaly.score_anomalie > 0.7 ? "error" : "warning"}
                                                            />
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip 
                                                            label={risk.label}
                                                            size="small"
                                                            sx={{ bgcolor: risk.bg, color: risk.color, fontWeight: 'bold' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Button 
                                                            size="small" 
                                                            variant="outlined"
                                                            onClick={() => {
                                                                setSelectedAnomaly(anomaly);
                                                                setDetailOpen(true);
                                                            }}
                                                        >
                                                            Détails
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {anomalies.length > 5 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                                    <Pagination 
                                        count={Math.ceil(anomalies.length / 5)} 
                                        page={page} 
                                        onChange={(e, v) => setPage(v)}
                                        color="primary"
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ATTAQUES SECTION */}
            {attaques.length > 0 && (
                <Card sx={{ borderRadius: 3, mb: 4 }}>
                    <CardContent>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            🛡️ Attaques détectées
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            {attaques.map((attack, idx) => {
                                const risk = RISK_LEVELS[attack.niveau_risque] || RISK_LEVELS.MOYEN;
                                return (
                                    <Grid item xs={12} md={6} key={idx}>
                                        <Paper sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${risk.color}` }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Box>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {attack.type === 'BRUTE_FORCE' ? '🔐 Brute Force' : attack.type}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        Cible: {attack.cible}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        Tentatives: {attack.tentatives || attack.requetes}
                                                    </Typography>
                                                </Box>
                                                <Chip label={risk.label} sx={{ bgcolor: risk.bg, color: risk.color }} />
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Dialogue Détail Anomalie */}
            <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: COLORS.primary, color: 'white' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">Détail de l'anomalie</Typography>
                        <IconButton onClick={() => setDetailOpen(false)} sx={{ color: 'white' }}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedAnomaly && (
                        <Stack spacing={3}>
                            {/* Type d'événement */}
                            <Paper sx={{ p: 2, bgcolor: COLORS.primary + '10', borderRadius: 2, borderLeft: `4px solid ${COLORS.primary}` }}>
                                <Typography variant="caption" color="textSecondary">Type d'événement</Typography>
                                <Typography variant="h6" fontWeight="bold">
                                    {selectedAnomaly.type_evenement || selectedAnomaly.typeEvenement || 'Non spécifié'}
                                </Typography>
                            </Paper>

                            {/* Explication */}
                            <Paper sx={{ p: 2, bgcolor: '#f5f7fa', borderRadius: 2 }}>
                                <Typography variant="subtitle2" color="textSecondary">🔍 Explication</Typography>
                                <Typography variant="body1" sx={{ mt: 0.5 }}>
                                    {selectedAnomaly.explication || 'Aucune explication disponible'}
                                </Typography>
                            </Paper>

                            {/* Statistiques */}
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="textSecondary">Type d'anomalie</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                        {selectedAnomaly.type_anomalie?.replace(/_/g, ' ') || 'Inconnu'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="textSecondary">Niveau de risque</Typography>
                                    <Chip 
                                        label={selectedAnomaly.niveau_risque}
                                        size="small"
                                        sx={{ 
                                            bgcolor: RISK_LEVELS[selectedAnomaly.niveau_risque]?.bg || '#eeeeee',
                                            color: RISK_LEVELS[selectedAnomaly.niveau_risque]?.color || '#666666',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="textSecondary">Score d'anomalie</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LinearProgress 
                                            variant="determinate" 
                                            value={(selectedAnomaly.score_anomalie || 0) * 100} 
                                            sx={{ width: 100, height: 8, borderRadius: 4 }}
                                            color={selectedAnomaly.score_anomalie > 0.7 ? "error" : "warning"}
                                        />
                                        <Typography variant="body2" fontWeight="bold">
                                            {((selectedAnomaly.score_anomalie || 0) * 100).toFixed(0)}%
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="textSecondary">Statut</Typography>
                                    <Chip 
                                        label={selectedAnomaly.statut || 'INCONNU'}
                                        size="small"
                                        variant="outlined"
                                        color={selectedAnomaly.statut === 'SUCCESS' ? 'success' : 'error'}
                                    />
                                </Grid>
                            </Grid>

                            {/* Informations utilisateur */}
                            <Paper sx={{ p: 2, borderRadius: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>👤 Informations utilisateur</Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="textSecondary">Email</Typography>
                                        <Typography variant="body2">{selectedAnomaly.email_utilisateur || 'Non spécifié'}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="textSecondary">Adresse IP</Typography>
                                        <Typography variant="body2">{selectedAnomaly.adresse_ip || selectedAnomaly.adresseIP || 'Non spécifiée'}</Typography>
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Détails supplémentaires */}
                            {selectedAnomaly.details && (
                                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#fff8e1' }}>
                                    <Typography variant="subtitle2" gutterBottom>📋 Détails supplémentaires</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {typeof selectedAnomaly.details === 'object' 
                                            ? JSON.stringify(selectedAnomaly.details, null, 2)
                                            : selectedAnomaly.details}
                                    </Typography>
                                </Paper>
                            )}

                            {/* Recommandation */}
                            <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                <Typography variant="subtitle2" fontWeight="bold">💡 Recommandation</Typography>
                                <Typography variant="body2">
                                    {selectedAnomaly.niveau_risque === 'CRITIQUE' && "Bloquer immédiatement l'utilisateur et vérifier les accès"}
                                    {selectedAnomaly.niveau_risque === 'ELEVE' && "Surveiller attentivement les activités futures de cet utilisateur"}
                                    {selectedAnomaly.niveau_risque === 'MOYEN' && "Prendre note et surveiller les tendances"}
                                    {(!selectedAnomaly.niveau_risque || selectedAnomaly.niveau_risque === 'FAIBLE') && "Aucune action immédiate requise, surveillance standard"}
                                </Typography>
                            </Alert>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailOpen(false)} variant="contained">Fermer</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AuditIntelligenceDashboard;