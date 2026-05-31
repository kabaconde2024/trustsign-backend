import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Paper, Grid, TextField, Button, 
    Switch, FormControlLabel, Divider, Alert, Stack, Card,
    Chip, Tooltip, useMediaQuery, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { Save, Security, Email, Storage, Refresh, CheckCircle, Cancel, Info, Timer, CalendarToday } from '@mui/icons-material';

// URL de l'API backend
const API_BASE_URL = 'http://localhost:8080';

const ConfigurationView = ({ setSnackbar, isMobile = false, isTablet = false }) => {
    const [config, setConfig] = useState({
        pkiCertificatDureeMinutes: 365,
        signatureExpirationJours: 7,
        signatureExpirationMinutes: 1, // ✅ NOUVEAU : pour le test en minutes
        expirationMode: 'minutes', // ✅ NOUVEAU : 'minutes' ou 'days'
        emailNotifications: true,
        smsEnabled: true,
        mfaObligatoire: false,
        otpExpirationMinutes: 10,
        otpLongueur: 6,
        mfaCodeExpirationMinutes: 1
    });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;

    // Fonction pour les requêtes API avec cookie
    const fetchAPI = async (endpoint, options = {}) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
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

    useEffect(() => { 
        fetchConfig(); 
    }, []);

    const fetchConfig = async () => {
        try {
            const data = await fetchAPI('/api/admin/config');
            setConfig({
                ...config,
                ...data,
                expirationMode: data.expirationMode || 'minutes' // ✅ Utiliser le mode retourné par l'API
            });
        } catch (error) { 
            console.error("Erreur chargement config:", error);
            if (setSnackbar) {
                setSnackbar({ open: true, message: "Erreur chargement de la configuration", severity: 'error' });
            }
        }
    };

    const saveConfig = async () => {
        setLoading(true);
        setSaved(false);
        try {
            // ✅ Préparer les données à envoyer selon le mode
            const configToSend = {
                ...config,
                // Envoyer la bonne valeur selon le mode sélectionné
                signatureExpirationMinutes: config.expirationMode === 'minutes' ? config.signatureExpirationMinutes : undefined,
                signatureExpirationJours: config.expirationMode === 'days' ? config.signatureExpirationJours : undefined
            };
            
            // Nettoyer les undefined
            Object.keys(configToSend).forEach(key => 
                configToSend[key] === undefined && delete configToSend[key]
            );
            
            await fetchAPI('/api/admin/config', {
                method: 'POST',
                body: JSON.stringify(configToSend)
            });
            setSnackbar({ open: true, message: "✅ Configuration sauvegardée avec succès", severity: 'success' });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error("Erreur sauvegarde:", error);
            setSnackbar({ open: true, message: "❌ Erreur lors de la sauvegarde", severity: 'error' });
        } finally { 
            setLoading(false); 
        }
    };

    // ✅ Fonction pour obtenir le texte d'aide selon le mode
    const getExpirationHelperText = () => {
        if (config.expirationMode === 'minutes') {
            return "⏰ TEST MODE: Le lien expirera après ce nombre de MINUTES (actuellement: " + config.signatureExpirationMinutes + " min)";
        }
        return "📅 Nombre de jours avant expiration du lien de signature (actuellement: " + config.signatureExpirationJours + " jours)";
    };

    // ✅ Fonction pour obtenir la valeur d'expiration affichée
    const getExpirationValue = () => {
        if (config.expirationMode === 'minutes') {
            return config.signatureExpirationMinutes;
        }
        return config.signatureExpirationJours;
    };

    // ✅ Fonction pour mettre à jour l'expiration
    const handleExpirationChange = (value) => {
        if (config.expirationMode === 'minutes') {
            setConfig({...config, signatureExpirationMinutes: parseInt(value) || 1});
        } else {
            setConfig({...config, signatureExpirationJours: parseInt(value) || 7});
        }
    };

    return (
        <Box sx={{ px: { xs: 0, sm: 1 } }}>
            <Typography variant={mobile ? "h6" : "h5"} fontWeight="800" sx={{ mb: mobile ? 2 : 4, color: '#1a237e' }}>
                Configuration système
            </Typography>

            {saved && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>Configuration sauvegardée avec succès !</Alert>}

            {/* ✅ ALERTE DE TEST */}
            {config.expirationMode === 'minutes' && config.signatureExpirationMinutes <= 5 && (
                <Alert severity="warning" sx={{ mb: 3, borderRadius: '12px' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Timer />
                        <Typography variant="body2">
                            ⚠️ MODE TEST ACTIF: Les liens de signature expirent après <strong>{config.signatureExpirationMinutes} minute(s)</strong>.
                            Après validation, passez en mode "Jours" pour une utilisation normale.
                        </Typography>
                    </Stack>
                </Alert>
            )}

            <Grid container spacing={mobile ? 2 : 3}>
                {/* Configuration PKI */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: mobile ? 2 : 3, borderRadius: '16px' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                            <Security sx={{ color: '#ffc107' }} />
                            <Typography variant={mobile ? "subtitle1" : "h6"} fontWeight="bold">Configuration PKI</Typography>
                            <Chip label="Certificats X.509" size="small" variant="outlined" />
                        </Stack>
                        <TextField 
                            fullWidth 
                            label="Durée de validité du certificat" 
                            type="number" 
                            value={config.pkiCertificatDureeMinutes} 
                            onChange={(e) => setConfig({...config, pkiCertificatDureeMinutes: parseInt(e.target.value)})} 
                            sx={{ mb: 2 }} 
                            size={mobile ? "small" : "medium"} 
                            helperText="⏰ Durée de validité des certificats numériques (en minutes)" 
                            InputProps={{ endAdornment: <Typography variant="caption" color="textSecondary">minutes</Typography> }} 
                        />
                        <Alert severity="info" sx={{ mt: 2, borderRadius: '8px' }}>
                            <Typography variant="caption">💡 Un certificat expiré ne peut plus être utilisé pour signer des documents.</Typography>
                        </Alert>
                    </Paper>
                </Grid>

                {/* Configuration Signatures - AVEC SÉLECTEUR MINUTES/JOURS */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: mobile ? 2 : 3, borderRadius: '16px' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                            <Email sx={{ color: '#ffc107' }} />
                            <Typography variant={mobile ? "subtitle1" : "h6"} fontWeight="bold">Configuration Signatures</Typography>
                        </Stack>
                        
                        {/* ✅ SÉLECTEUR MODE EXPIRATION */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                                Mode d'expiration des invitations
                            </Typography>
                            <ToggleButtonGroup
                                value={config.expirationMode}
                                exclusive
                                onChange={(e, newMode) => newMode && setConfig({...config, expirationMode: newMode})}
                                size="small"
                                fullWidth
                                sx={{ mb: 2 }}
                            >
                                <ToggleButton value="minutes" aria-label="minutes">
                                    <Timer sx={{ mr: 1 }} fontSize="small" />
                                    MINUTES (TEST)
                                </ToggleButton>
                                <ToggleButton value="days" aria-label="jours">
                                    <CalendarToday sx={{ mr: 1 }} fontSize="small" />
                                    JOURS (PRODUCTION)
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        {/* Champ d'expiration dynamique */}
                        <TextField 
                            fullWidth 
                            label={config.expirationMode === 'minutes' ? "Expiration (minutes)" : "Expiration (jours)"}
                            type="number" 
                            value={getExpirationValue()} 
                            onChange={(e) => handleExpirationChange(e.target.value)} 
                            sx={{ mb: 3 }} 
                            size={mobile ? "small" : "medium"} 
                            helperText={getExpirationHelperText()}
                            InputProps={{ 
                                endAdornment: (
                                    <Typography variant="caption" color="textSecondary">
                                        {config.expirationMode === 'minutes' ? 'minutes' : 'jours'}
                                    </Typography>
                                ),
                                inputProps: { 
                                    min: config.expirationMode === 'minutes' ? 1 : 1,
                                    max: config.expirationMode === 'minutes' ? 1440 : 365
                                }
                            }} 
                            color={config.expirationMode === 'minutes' && config.signatureExpirationMinutes <= 5 ? "warning" : "primary"}
                        />

                        {/* Affichage de l'équivalence */}
                        {config.expirationMode === 'minutes' && (
                            <Alert severity="info" sx={{ mb: 2, borderRadius: '8px' }}>
                                <Typography variant="caption">
                                    ⏱️ {config.signatureExpirationMinutes} minute(s) = {(config.signatureExpirationMinutes / 1440).toFixed(4)} jour(s)
                                </Typography>
                            </Alert>
                        )}
                        {config.expirationMode === 'days' && (
                            <Alert severity="info" sx={{ mb: 2, borderRadius: '8px' }}>
                                <Typography variant="caption">
                                    📅 {config.signatureExpirationJours} jour(s) = {config.signatureExpirationJours * 1440} minutes
                                </Typography>
                            </Alert>
                        )}

                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>Notifications</Typography>
                        <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Box>
                                    <Typography variant="body2"><strong>Notifications par email</strong></Typography>
                                    <Typography variant="caption" color="textSecondary">Envoi d'emails pour les invitations</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip label={config.emailNotifications ? "ACTIVÉ" : "DÉSACTIVÉ"} size="small" color={config.emailNotifications ? "success" : "default"} />
                                    <Switch checked={config.emailNotifications} onChange={(e) => setConfig({...config, emailNotifications: e.target.checked})} color="success" />
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Box>
                                    <Typography variant="body2"><strong>Envoi SMS OTP</strong></Typography>
                                    <Typography variant="caption" color="textSecondary">Code de vérification par SMS</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip label={config.smsEnabled ? "ACTIVÉ" : "DÉSACTIVÉ"} size="small" color={config.smsEnabled ? "success" : "default"} />
                                    <Switch checked={config.smsEnabled} onChange={(e) => setConfig({...config, smsEnabled: e.target.checked})} color="success" />
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Box>
                                    <Typography variant="body2"><strong>MFA obligatoire</strong></Typography>
                                    <Typography variant="caption" color="textSecondary">Authentification multi-facteurs</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip label={config.mfaObligatoire ? "ACTIVÉ" : "DÉSACTIVÉ"} size="small" color={config.mfaObligatoire ? "warning" : "default"} />
                                    <Switch checked={config.mfaObligatoire} onChange={(e) => setConfig({...config, mfaObligatoire: e.target.checked})} color="warning" />
                                </Box>
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Configuration MFA */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: mobile ? 2 : 3, borderRadius: '16px' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                            <Security sx={{ color: '#ff9800' }} />
                            <Typography variant={mobile ? "subtitle1" : "h6"} fontWeight="bold">Configuration MFA</Typography>
                            <Chip label="Code de connexion" size="small" variant="outlined" />
                        </Stack>
                        <TextField 
                            fullWidth 
                            label="Expiration du code MFA" 
                            type="number" 
                            value={config.mfaCodeExpirationMinutes} 
                            onChange={(e) => setConfig({...config, mfaCodeExpirationMinutes: parseInt(e.target.value)})} 
                            sx={{ mb: 2 }} 
                            size={mobile ? "small" : "medium"} 
                            helperText="⏰ Durée de validité du code MFA envoyé par email (en minutes)" 
                            InputProps={{ 
                                endAdornment: <Typography variant="caption" color="textSecondary">minutes</Typography>,
                                inputProps: { min: 1, max: 30 }
                            }} 
                        />
                        <Alert severity="info" sx={{ mt: 2, borderRadius: '8px' }}>
                            <Typography variant="caption">💡 Un code MFA à durée très courte (1-2 minutes) renforce la sécurité.</Typography>
                        </Alert>
                    </Paper>
                </Grid>

                {/* Configuration OTP */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: mobile ? 2 : 3, borderRadius: '16px' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                            <Storage sx={{ color: '#ffc107' }} />
                            <Typography variant={mobile ? "subtitle1" : "h6"} fontWeight="bold">Configuration OTP</Typography>
                            <Tooltip title="Paramètres des codes de vérification">
                                <Info sx={{ fontSize: 18, color: '#94a3b8', cursor: 'help' }} />
                            </Tooltip>
                        </Stack>
                        <Grid container spacing={mobile ? 2 : 3}>
                            <Grid item xs={12} sm={6}>
                                <TextField 
                                    fullWidth 
                                    label="Expiration du code OTP" 
                                    type="number" 
                                    value={config.otpExpirationMinutes || 10} 
                                    onChange={(e) => setConfig({...config, otpExpirationMinutes: parseInt(e.target.value)})} 
                                    size={mobile ? "small" : "medium"} 
                                    helperText="⏱️ Durée de validité du code OTP (en minutes)" 
                                    InputProps={{ endAdornment: <Typography variant="caption" color="textSecondary">minutes</Typography> }} 
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField 
                                    fullWidth 
                                    label="Longueur du code OTP" 
                                    type="number" 
                                    value={config.otpLongueur || 6} 
                                    onChange={(e) => setConfig({...config, otpLongueur: parseInt(e.target.value)})} 
                                    size={mobile ? "small" : "medium"} 
                                    helperText="🔢 Nombre de chiffres du code OTP (4 à 8)" 
                                    inputProps={{ min: 4, max: 8 }} 
                                />
                            </Grid>
                        </Grid>
                        <Alert severity="info" sx={{ mt: 3, borderRadius: '8px' }}>
                            <Typography variant="caption">💡 Les codes OTP sont envoyés par SMS et expirent après le délai configuré.</Typography>
                        </Alert>
                    </Paper>
                </Grid>

                {/* Actions */}
                <Grid item xs={12}>
                    <Stack direction={mobile ? "column" : "row"} spacing={2} justifyContent="flex-end">
                        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchConfig} disabled={loading} fullWidth={mobile}>
                            Réinitialiser
                        </Button>
                        <Button 
                            variant="contained" 
                            startIcon={<Save />} 
                            onClick={saveConfig} 
                            disabled={loading} 
                            sx={{ bgcolor: '#1a237e', px: mobile ? 2 : 4, py: 1.2 }} 
                            fullWidth={mobile}
                        >
                            {loading ? "Sauvegarde..." : "Sauvegarder"}
                        </Button>
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ConfigurationView;