// src/components/IA/DetecteurFalsification.jsx
import React, { useState, useEffect } from 'react';
import {
    Box, Card, CardContent, Typography, Button, CircularProgress,
    Alert, Chip, Divider, Stack, Paper, LinearProgress, Grid,
    Accordion, AccordionSummary, AccordionDetails, IconButton
} from '@mui/material';
import {
    Security, Warning, CheckCircle, ErrorOutline, ExpandMore,
    Description, Verified, Dangerous, Close, Refresh
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

const DetecteurFalsification = ({ fichier, onAnalyseComplete }) => {
    const [analyseEnCours, setAnalyseEnCours] = useState(false);
    const [resultat, setResultat] = useState(null);
    const [erreur, setErreur] = useState(null);
    const [analyseActive, setAnalyseActive] = useState(false); // Nouveau : pour fermer/réduire
    const [hashOriginal, setHashOriginal] = useState(null);

    // Calculer le hash original au chargement du fichier
    useEffect(() => {
        const calculerHashOriginal = async () => {
            if (fichier) {
                try {
                    const buffer = await fichier.arrayBuffer();
                    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    setHashOriginal(hashHex);
                    console.log("✅ Hash original calculé:", hashHex.substring(0, 16) + "...");
                } catch (error) {
                    console.error("Erreur calcul hash:", error);
                }
            }
        };
        calculerHashOriginal();
    }, [fichier]);

    const analyserDocument = async () => {
        if (!fichier) {
            setErreur("Aucun document à analyser");
            return;
        }

        setAnalyseEnCours(true);
        setErreur(null);
        setAnalyseActive(true);

        const formData = new FormData();
        formData.append('fichier', fichier);
        
        // Ajouter le hash original si disponible
        if (hashOriginal) {
            formData.append('hashOriginal', hashOriginal);
        }

        try {
            const reponse = await axios.post(
                `${API_BASE_URL}/ia/securite/analyser-falsification`,
                formData,
                { 
                    headers: { 'Content-Type': 'multipart/form-data' },
                    withCredentials: true
                }
            );

            setResultat(reponse.data);
            if (onAnalyseComplete) {
                onAnalyseComplete(reponse.data);
            }
        } catch (err) {
            console.error("Erreur analyse:", err);
            setErreur(err.response?.data?.erreur || "Erreur lors de l'analyse du document");
        } finally {
            setAnalyseEnCours(false);
        }
    };

    const fermerAnalyse = () => {
        setResultat(null);
        setErreur(null);
        setAnalyseActive(false);
    };

    const reinitialiser = () => {
        setResultat(null);
        setErreur(null);
        setAnalyseActive(false);
        analyserDocument();
    };

    const getCouleurScore = (score) => {
        if (score >= 90) return '#4caf50';
        if (score >= 70) return '#ff9800';
        if (score >= 50) return '#f44336';
        return '#d32f2f';
    };

    const getIconeScore = (score) => {
        if (score >= 90) return <CheckCircle sx={{ color: '#4caf50', fontSize: 48 }} />;
        if (score >= 70) return <Verified sx={{ color: '#ff9800', fontSize: 48 }} />;
        if (score >= 50) return <Warning sx={{ color: '#f44336', fontSize: 48 }} />;
        return <Dangerous sx={{ color: '#d32f2f', fontSize: 48 }} />;
    };

    const getCouleurSeverite = (severite) => {
        switch(severite) {
            case 'CRITIQUE': return '#d32f2f';
            case 'ELEVEE': return '#f44336';
            case 'MOYENNE': return '#ff9800';
            default: return '#9e9e9e';
        }
    };

    const getLibelleConfiance = (niveau) => {
        switch(niveau) {
            case 'EXCELLENT': return { texte: 'Excellent', couleur: '#4caf50' };
            case 'BON': return { texte: 'Bon', couleur: '#4caf50' };
            case 'MOYEN': return { texte: 'Moyen', couleur: '#ff9800' };
            default: return { texte: 'Faible', couleur: '#f44336' };
        }
    };

    return (
        <Card sx={{ borderRadius: 3, mb: 2, overflow: 'hidden' }}>
            <Box sx={{ bgcolor: '#1a237e', color: 'white', p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Security />
                        <Typography variant="subtitle1" fontWeight="bold">
                            🔒 Détection de falsification
                        </Typography>
                        <Chip 
                            label="Sécurité avancée" 
                            size="small" 
                            sx={{ bgcolor: '#ffc107', color: '#1a237e' }}
                        />
                    </Stack>
                    {analyseActive && (
                        <IconButton 
                            size="small" 
                            onClick={fermerAnalyse}
                            sx={{ color: 'white' }}
                            title="Fermer l'analyse"
                        >
                            <Close fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            </Box>

            <CardContent>
                {!analyseActive && !resultat && !analyseEnCours && !erreur && (
                    <Button 
                        variant="outlined" 
                        onClick={analyserDocument}
                        startIcon={<Security />}
                        sx={{ width: '100%', py: 1.5 }}
                    >
                        Analyser l'intégrité du document
                    </Button>
                )}

                {analyseEnCours && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CircularProgress size={40} />
                        <Typography sx={{ mt: 2, color: '#666' }}>
                            Analyse en cours...
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            Vérification de l'empreinte, des métadonnées et de la structure PDF
                        </Typography>
                    </Box>
                )}

                {erreur && (
                    <Alert 
                        severity="error"
                        action={
                            <Button color="inherit" size="small" onClick={reinitialiser}>
                                Réessayer
                            </Button>
                        }
                    >
                        {erreur}
                    </Alert>
                )}

                {resultat && (
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                        {/* Score principal */}
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                            {getIconeScore(resultat.scoreIntegrite)}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" color="textSecondary">
                                    Score d'intégrité
                                </Typography>
                                <Typography variant="h3" sx={{ fontWeight: 'bold', color: getCouleurScore(resultat.scoreIntegrite) }}>
                                    {resultat.scoreIntegrite}%
                                </Typography>
                                <LinearProgress 
                                    variant="determinate" 
                                    value={resultat.scoreIntegrite} 
                                    sx={{ 
                                        mt: 1, 
                                        height: 8, 
                                        borderRadius: 4,
                                        bgcolor: '#e0e0e0',
                                        '& .MuiLinearProgress-bar': {
                                            bgcolor: getCouleurScore(resultat.scoreIntegrite)
                                        }
                                    }}
                                />
                            </Box>
                        </Stack>

                        {/* Niveau de confiance */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                            <Chip 
                                label={`Confiance: ${getLibelleConfiance(resultat.niveauConfiance).texte}`}
                                sx={{ 
                                    bgcolor: `${getLibelleConfiance(resultat.niveauConfiance).couleur}20`,
                                    color: getLibelleConfiance(resultat.niveauConfiance).couleur,
                                    fontWeight: 'bold'
                                }}
                            />
                            {resultat.hashCorrespond !== undefined && (
                                <Chip 
                                    label={resultat.hashCorrespond ? "✅ Hash OK" : "❌ Hash modifié"}
                                    size="small"
                                    sx={{ 
                                        bgcolor: resultat.hashCorrespond ? '#4caf5020' : '#f4433620',
                                        color: resultat.hashCorrespond ? '#4caf50' : '#f44336'
                                    }}
                                />
                            )}
                            {resultat.aSignaturesExistantes && (
                                <Chip 
                                    label={`📜 ${resultat.nombreSignaturesExistantes} signature(s) existante(s)`}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                            <Button 
                                size="small" 
                                startIcon={<Refresh />}
                                onClick={reinitialiser}
                                sx={{ ml: 'auto' }}
                            >
                                Nouvelle analyse
                            </Button>
                        </Stack>

                        <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                            {resultat.messageConfiance}
                        </Typography>

                        <Divider sx={{ my: 1.5 }} />

                        {/* Anomalies détectées */}
                        {resultat.anomalies && resultat.anomalies.length > 0 && (
                            <>
                                <Typography variant="subtitle2" sx={{ mb: 1, color: '#e65100' }}>
                                    ⚠️ Anomalies détectées ({resultat.anomalies.length})
                                </Typography>
                                <Stack spacing={1}>
                                    {resultat.anomalies.map((anomalie, idx) => (
                                        <Accordion key={idx} sx={{ boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                                            <AccordionSummary expandIcon={<ExpandMore />}>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Chip 
                                                        label={anomalie.severite}
                                                        size="small"
                                                        sx={{ 
                                                            bgcolor: `${getCouleurSeverite(anomalie.severite)}20`,
                                                            color: getCouleurSeverite(anomalie.severite),
                                                            fontSize: '10px',
                                                            height: '20px'
                                                        }}
                                                    />
                                                    <Typography variant="body2">{anomalie.description}</Typography>
                                                </Stack>
                                            </AccordionSummary>
                                            {anomalie.details && (
                                                <AccordionDetails>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {anomalie.details}
                                                    </Typography>
                                                </AccordionDetails>
                                            )}
                                        </Accordion>
                                    ))}
                                </Stack>
                            </>
                        )}

                        {/* Métadonnées PDF */}
                        {(resultat.createur || resultat.producteur || resultat.versionPdf) && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    📄 Métadonnées PDF
                                </Typography>
                                <Grid container spacing={1}>
                                    {resultat.versionPdf && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="textSecondary">Version PDF:</Typography>
                                            <Typography variant="body2">{resultat.versionPdf}</Typography>
                                        </Grid>
                                    )}
                                    {resultat.nombrePages && (
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="textSecondary">Nombre de pages:</Typography>
                                            <Typography variant="body2">{resultat.nombrePages}</Typography>
                                        </Grid>
                                    )}
                                    {resultat.createur && (
                                        <Grid item xs={12}>
                                            <Typography variant="caption" color="textSecondary">Créé par:</Typography>
                                            <Typography variant="body2">{resultat.createur}</Typography>
                                        </Grid>
                                    )}
                                    {resultat.producteur && (
                                        <Grid item xs={12}>
                                            <Typography variant="caption" color="textSecondary">Produit par:</Typography>
                                            <Typography variant="body2">{resultat.producteur}</Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </>
                        )}

                        {/* Recommandations */}
                        {resultat.recommandations && resultat.recommandations.length > 0 && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    📋 Recommandations
                                </Typography>
                                <Stack spacing={0.5}>
                                    {resultat.recommandations.map((recommandation, idx) => (
                                        <Typography key={idx} variant="body2" sx={{ fontSize: '13px', py: 0.5 }}>
                                            {recommandation}
                                        </Typography>
                                    ))}
                                </Stack>
                            </>
                        )}

                        {/* Empreinte du document */}
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="caption" color="textSecondary" sx={{ wordBreak: 'break-all' }}>
                            Empreinte numérique (SHA-256):
                            <br />
                            <strong>{resultat.hashActuel}</strong>
                            {resultat.hashOriginal && resultat.hashOriginal !== resultat.hashActuel && (
                                <>
                                    <br />
                                    <span style={{ color: '#f44336' }}>
                                        Original: {resultat.hashOriginal}
                                    </span>
                                </>
                            )}
                        </Typography>

                        {/* Bouton de fermeture en bas */}
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button 
                                size="small" 
                                color="secondary"
                                onClick={fermerAnalyse}
                                startIcon={<Close />}
                            >
                                Fermer l'analyse
                            </Button>
                        </Box>
                    </Paper>
                )}
            </CardContent>
        </Card>
    );
};

export default DetecteurFalsification;