// frontend/src/components/IA/ResumeDocument.jsx
import React, { useState } from 'react';
import {
    Box, Card, CardContent, Typography, Button, CircularProgress,
    Alert, Chip, Divider, Stack, Paper, Collapse, IconButton
} from '@mui/material';
import {
    Summarize, ExpandMore, ExpandLess, Description,
    Warning, CheckCircle, Info
} from '@mui/icons-material';
import axios from 'axios';

const API_IA_URL = process.env.REACT_APP_IA_API_URL || 'http://localhost:8000';

const ResumeDocument = ({ contenu, nomFichier, onResumeGenere }) => {
    const [chargement, setChargement] = useState(false);
    const [resume, setResume] = useState(null);
    const [expanded, setExpanded] = useState(true);
    const [erreur, setErreur] = useState(null);

    const genererResume = async () => {
        if (!contenu || contenu.length < 100) {
            setErreur("Contenu trop court pour générer un résumé");
            return;
        }

        setChargement(true);
        setErreur(null);

        try {
            const response = await axios.post(`${API_IA_URL}/api/ia/avancee/documents/resume`, {
                contenu: contenu.slice(0, 8000),
                nom_fichier: nomFichier
            });

            if (response.data.success) {
                setResume(response.data.resume);
                if (onResumeGenere) {
                    onResumeGenere(response.data.resume);
                }
            } else {
                setErreur(response.data.erreur || "Erreur lors de la génération");
            }
        } catch (err) {
            console.error("Erreur API:", err);
            setErreur("Erreur de connexion au service IA");
        } finally {
            setChargement(false);
        }
    };

    const getTypeColor = (type) => {
        switch(type) {
            case 'CONTRAT': return '#f44336';
            case 'FACTURE': return '#ff9800';
            case 'RAPPORT': return '#2196f3';
            case 'CV': return '#9c27b0';
            default: return '#757575';
        }
    };

    const getTypeIcon = (type) => {
        switch(type) {
            case 'CONTRAT': return <Warning sx={{ color: '#f44336' }} />;
            case 'FACTURE': return <Info sx={{ color: '#ff9800' }} />;
            default: return <Description />;
        }
    };

    return (
        <Card sx={{ borderRadius: 3, mb: 2, overflow: 'hidden' }}>
            <Box 
                sx={{ 
                    bgcolor: '#1a237e', 
                    color: 'white', 
                    p: 1.5,
                    cursor: 'pointer'
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Summarize />
                        <Typography variant="subtitle1" fontWeight="bold">
                            🤖 Résumé IA du document
                        </Typography>
                        <Chip 
                            label="Intelligent" 
                            size="small" 
                            sx={{ bgcolor: '#ffc107', color: '#1a237e' }}
                        />
                    </Stack>
                    <IconButton sx={{ color: 'white' }}>
                        {expanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                </Stack>
            </Box>

            <Collapse in={expanded}>
                <CardContent>
                    {!resume && !chargement && !erreur && (
                        <Button 
                            variant="outlined" 
                            onClick={genererResume}
                            startIcon={<Summarize />}
                            sx={{ width: '100%', py: 1.5 }}
                        >
                            Générer le résumé par IA
                        </Button>
                    )}

                    {chargement && (
                        <Box sx={{ textAlign: 'center', py: 3 }}>
                            <CircularProgress size={40} />
                            <Typography sx={{ mt: 2, color: '#666' }}>
                                Génération du résumé...
                            </Typography>
                        </Box>
                    )}

                    {erreur && (
                        <Alert severity="error">{erreur}</Alert>
                    )}

                    {resume && (
                        <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                {getTypeIcon(resume.type_document)}
                                {resume.type_document && resume.type_document !== 'AUTRE' && (
                                    <Chip 
                                        label={resume.type_document}
                                        size="small"
                                        sx={{ 
                                            bgcolor: `${getTypeColor(resume.type_document)}20`,
                                            color: getTypeColor(resume.type_document),
                                            fontWeight: 'bold'
                                        }}
                                    />
                                )}
                                <Typography variant="caption" color="textSecondary">
                                    Généré via {resume.source}
                                </Typography>
                            </Stack>
                            
                            <Divider sx={{ my: 1 }} />
                            
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {resume.resume}
                            </Typography>
                            
                            {resume.mots_cles_detectes && resume.mots_cles_detectes.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" color="textSecondary">
                                        Mots-clés détectés:
                                    </Typography>
                                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                                        {resume.mots_cles_detectes.slice(0, 8).map((mot, idx) => (
                                            <Chip key={idx} label={mot} size="small" variant="outlined" />
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </Paper>
                    )}
                </CardContent>
            </Collapse>
        </Card>
    );
};

// ⭐ EXPORT PAR DÉFAUT (CORRECT)
export default ResumeDocument;