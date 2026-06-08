import React, { useRef, useState, useEffect } from 'react';
import { 
    Box, Paper, Typography, Button, Stack, Grid, 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    CircularProgress, Zoom, Fade, useMediaQuery,
    IconButton // 🔥 Ajouté ici pour corriger l'erreur de compilation Render
} from '@mui/material';
import { Delete, CloudUpload, Draw, CheckCircle, Close } from '@mui/icons-material';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';

const SignatureView = ({ userData, setUserData, setSnackbar, isMobile = false }) => {
    const [openDrawDialog, setOpenDrawDialog] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [loadingProfil, setLoadingProfil] = useState(true);
    const sigPad = useRef({});
    const fileInputRef = useRef(null);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;

    // 🔄 Récupération du profil au chargement du composant (avec Token)
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('accessToken');
                
                if (!token) {
                    console.error("Token manquant dans SignatureView");
                    setLoadingProfil(false);
                    return;
                }

                const response = await axios.get('https://backendmemoire.onrender.com/api/utilisateur/mon-profil', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.data) {
                    setUserData(response.data);
                }
            } catch (error) {
                console.error("Erreur vérification signature:", error);
            } finally {
                setLoadingProfil(false);
            }
        };

        fetchUserProfile();
    }, [setUserData]);

    const handleClear = () => {
        sigPad.current.clear();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 1 * 1024 * 1024) {
                setSnackbar({ open: true, message: "L'image est trop volumineuse. Taille maximale: 1MB", severity: 'error' });
                return;
            }
            if (!file.type.startsWith('image/')) {
                setSnackbar({ open: true, message: "Veuillez sélectionner une image valide (PNG ou JPEG)", severity: 'error' });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                handleSaveSignatureBackend(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // 💾 Sauvegarde globale de la signature (avec Token)
    const handleSaveSignatureBackend = async (base64Data) => {
        setUploading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('accessToken');

            if (!token) {
                setSnackbar({ open: true, message: "❌ Session expirée. Veuillez vous reconnecter.", severity: 'error' });
                setUploading(false);
                return;
            }

            await axios.post('https://backendmemoire.onrender.com/api/utilisateur/sauvegarder-signature', 
                { imageSignature: base64Data },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setUserData({ ...userData, imageSignature: base64Data });
            setOpenDrawDialog(false);
            setSnackbar({ open: true, message: "✅ Signature enregistrée avec succès", severity: 'success' });
        } catch (error) {
            console.error("Erreur save signature:", error);
            setSnackbar({ open: true, message: "❌ Erreur lors de l'enregistrement de la signature", severity: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const handleSaveDraw = () => {
        if (sigPad.current.isEmpty()) {
            setSnackbar({ open: true, message: "Veuillez dessiner votre signature avant d'enregistrer", severity: 'warning' });
            return;
        }
        const dataUrl = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
        handleSaveSignatureBackend(dataUrl);
    };

    const handleDeleteSignature = async () => {
        setUploading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('accessToken');

            await axios.post('https://backendmemoire.onrender.com/api/utilisateur/sauvegarder-signature', 
                { imageSignature: null },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setUserData({ ...userData, imageSignature: null });
            setSnackbar({ open: true, message: "✅ Signature supprimée", severity: 'success' });
        } catch (error) {
            console.error("Erreur suppression signature:", error);
            setSnackbar({ open: true, message: "❌ Erreur lors de la suppression de la signature", severity: 'error' });
        } finally {
            setUploading(false);
        }
    };

    if (loadingProfil) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <CircularProgress sx={{ color: '#0b1e39' }} />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: '1200px', mx: 'auto', width: '100%', px: { xs: 1, sm: 2 } }}>
            <Fade in={true} timeout={500}>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3, md: 5 }, borderRadius: '20px', border: '1px solid #E2E8F0' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                            <Typography variant={mobile ? "h6" : "h5"} fontWeight="800">Ma Signature Graphique</Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                                Cette image sera apposée visuellement sur vos documents signés électroniquement.
                            </Typography>
                        </Box>
                    </Stack>

                    <Grid container spacing={4} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Box 
                                sx={{ 
                                    border: '2px dashed #CBD5E1',
                                    borderRadius: '16px',
                                    height: '220px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: '#F8FAFC',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                }}
                            >
                                {userData.imageSignature ? (
                                    <Zoom in={true}>
                                        <img 
                                            src={userData.imageSignature} 
                                            alt="Signature électronique" 
                                            style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain' }}
                                        />
                                    </Zoom>
                                ) : (
                                    <Stack alignItems="center" spacing={1} sx={{ color: '#94A3B8' }}>
                                        <Draw sx={{ fontSize: 48, opacity: 0.5 }} />
                                        <Typography variant="body2">Aucune signature enregistrée</Typography>
                                    </Stack>
                                )}
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Stack spacing={2} sx={{ width: '100%' }}>
                                <Button 
                                    variant="contained" 
                                    startIcon={<Draw />}
                                    onClick={() => setOpenDrawDialog(true)}
                                    disabled={uploading}
                                    sx={{ 
                                        bgcolor: '#0b1e39', 
                                        py: 1.5, 
                                        borderRadius: '10px',
                                        '&:hover': { bgcolor: '#1a2f4c' }
                                    }}
                                >
                                    Dessiner ma signature
                                </Button>
                                
                                <Button 
                                    variant="outlined" 
                                    startIcon={<CloudUpload />}
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={uploading}
                                    sx={{ 
                                        color: '#0b1e39', 
                                        borderColor: '#CBD5E1',
                                        py: 1.5, 
                                        borderRadius: '10px',
                                        '&:hover': { borderColor: '#0b1e39', bgcolor: '#F8FAFC' }
                                    }}
                                >
                                    Téléverser une image de signature
                                </Button>

                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={handleFileChange}
                                />

                                {userData.imageSignature && (
                                    <Button 
                                        variant="text" 
                                        color="error"
                                        startIcon={<Delete />}
                                        onClick={handleDeleteSignature}
                                        disabled={uploading}
                                        sx={{ py: 1 }}
                                    >
                                        Supprimer la signature actuelle
                                    </Button>
                                )}
                            </Stack>
                        </Grid>
                    </Grid>
                </Paper>
            </Fade>

            {/* Dialog de Dessin */}
            <Dialog 
                open={openDrawDialog} 
                onClose={() => setOpenDrawDialog(false)}
                maxWidth="sm"
                fullWidth
                disableEnforceFocus
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
                    <Typography fontWeight="bold">Dessiner votre signature</Typography>
                    <IconButton onClick={() => setOpenDrawDialog(false)} size="small">
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: '#F8FAFC', py: 3 }}>
                    <Box sx={{ border: '1px solid #CBD5E1', borderRadius: '12px', bgcolor: 'white', overflow: 'hidden', mt: 1 }}>
                        <SignatureCanvas 
                            ref={sigPad}
                            penColor="black"
                            canvasProps={{
                                width: mobile ? 320 : 550,
                                height: 200,
                                className: 'sigCanvas'
                            }}
                        />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                        Utilisez votre souris ou votre écran tactile pour signer à l'intérieur du cadre blanc.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid #E2E8F0' }}>
                    <Button onClick={handleClear} startIcon={<Delete />} color="inherit">
                        Effacer
                    </Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button onClick={() => setOpenDrawDialog(false)} color="inherit">
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleSaveDraw} 
                        variant="contained" 
                        startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                        disabled={uploading}
                        sx={{ bgcolor: '#0b1e39', '&:hover': { bgcolor: '#1a2f4c' } }}
                    >
                        Confirmer
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SignatureView;