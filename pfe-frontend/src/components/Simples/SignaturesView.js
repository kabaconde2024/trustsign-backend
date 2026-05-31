// frontend/src/components/Simples/SignaturesView.jsx
import React, { useState } from 'react';
import { Box, Typography, Button, Stack, IconButton, useMediaQuery } from '@mui/material';
import { Description, Close, ArrowForward } from '@mui/icons-material';
import ResumeDocument from '../IA/ResumeDocument';

const SignaturesView = ({ 
    getRootProps, 
    getInputProps, 
    isDragActive, 
    open, 
    uploadedFiles, 
    removeFile, 
    nextStep,
    isMobile = false,
    isTablet = false
}) => {
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;
    
    // État pour stocker le contenu texte du premier fichier
    const [contenuDocument, setContenuDocument] = useState('');
    const [nomDocument, setNomDocument] = useState('');
    
    // Extraire le texte du fichier uploadé
    const extraireTexteFichier = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (file.type === 'text/plain') {
                    resolve(e.target.result);
                } else {
                    // Pour PDF, extraction approximative
                    const texte = e.target.result;
                    if (typeof texte === 'string') {
                        resolve(texte.substring(0, 8000));
                    } else {
                        const bytes = new Uint8Array(e.target.result);
                        let texteLisible = '';
                        for (let i = 0; i < Math.min(bytes.length, 8000); i++) {
                            if (bytes[i] >= 32 && bytes[i] <= 126) {
                                texteLisible += String.fromCharCode(bytes[i]);
                            }
                        }
                        resolve(texteLisible);
                    }
                }
            };
            reader.onerror = () => resolve('');
            if (file.type === 'application/pdf') {
                reader.readAsBinaryString(file);
            } else {
                reader.readAsText(file);
            }
        });
    };
    
    // Quand un fichier est uploadé, extraire son texte
    const handleFileChange = async (files) => {
        if (files && files.length > 0) {
            const file = files[0];
            setNomDocument(file.name);
            const texte = await extraireTexteFichier(file);
            setContenuDocument(texte);
        }
    };
    
    // Modifier le comportement du dropzone pour capturer les fichiers
    const originalOnDrop = getRootProps().onDrop;
    const customOnDrop = async (acceptedFiles) => {
        if (originalOnDrop) originalOnDrop(acceptedFiles);
        if (acceptedFiles && acceptedFiles.length > 0) {
            await handleFileChange(acceptedFiles);
        }
    };
    
    return (
        <Box sx={{ 
            bgcolor: '#fff', 
            borderRadius: '8px', 
            minHeight: { xs: 'auto', sm: '80vh' }, 
            p: { xs: 2, sm: 3, md: 4 }, 
            display: 'flex', 
            flexDirection: 'column' 
        }}>
            <Typography 
                variant={mobile ? "h5" : "h4"} 
                align="center" 
                fontWeight="700" 
                sx={{ color: '#2c3e50', mb: { xs: 3, sm: 5 } }}
            >
                Nouvelle transaction
            </Typography>

            {/* Zone de drop */}
            <Box 
                {...getRootProps({
                    onClick: (e) => { e.stopPropagation(); open(); },
                    onDrop: customOnDrop
                })} 
                sx={{ 
                    border: '2px dashed #ffc107', 
                    borderRadius: '8px', 
                    p: { xs: 3, sm: 4, md: 6 }, 
                    textAlign: 'center',
                    bgcolor: isDragActive ? '#fffdf0' : '#fafafa',
                    cursor: 'pointer',
                    mx: 'auto',
                    width: '100%',
                    maxWidth: '1000px',
                    minHeight: { xs: '200px', sm: '300px' },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: '#fffcf0', borderColor: '#0b1e39' }
                }}
            >
                <input {...getInputProps()} />
                <Box sx={{ mb: 2 }}>
                    <Description sx={{ fontSize: { xs: 50, sm: 80 }, color: '#95a5a6' }} />
                </Box>
                <Typography variant={mobile ? "body1" : "h6"} sx={{ fontWeight: '600', color: '#34495e' }}>
                    Cliquez ici pour sélectionner vos documents <span style={{ color: '#f1c40f' }}>PDF</span>
                </Typography>
                {!mobile && (
                    <Typography variant="body2" sx={{ color: '#95a5a6', mt: 1 }}>
                        Vous pouvez ajouter plusieurs documents
                    </Typography>
                )}
            </Box>

            <Box sx={{ mt: 4, mx: 'auto', width: '100%', maxWidth: '1000px' }}>
                {/* ⭐ AFFICHAGE DU RÉSUMÉ IA */}
                {uploadedFiles.length > 0 && nomDocument && (
                    <ResumeDocument 
                        contenu={contenuDocument}
                        nomFichier={nomDocument}
                        onResumeGenere={(resume) => console.log('Résumé généré', resume)}
                    />
                )}
                
                {uploadedFiles.length > 0 ? (
                    <Box sx={{ 
                        p: { xs: 2, sm: 3 }, 
                        bgcolor: '#ffffff', 
                        borderRadius: '12px', 
                        border: '2px solid #E2E8F0', 
                        boxShadow: '0px 4px 10px rgba(0,0,0,0.05)' 
                    }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: '#0b1e39' }}>
                            Document(s) sélectionnés ({uploadedFiles.length}) :
                        </Typography>
                        <Stack spacing={1} sx={{ mb: 3 }}>
                            {uploadedFiles.map((file, index) => (
                                <Box key={index} sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    p: 1.5, 
                                    bgcolor: '#f8f9fa', 
                                    borderRadius: '8px', 
                                    border: '1px solid #eee',
                                    flexWrap: 'wrap',
                                    gap: 1
                                }}>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Description sx={{ color: '#e74c3c' }} />
                                        <Box>
                                            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                                {file.name.length > (mobile ? 30 : 50) ? file.name.substring(0, mobile ? 30 : 50) + '...' : file.name}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">{(file.size / 1024).toFixed(2)} Ko</Typography>
                                        </Box>
                                    </Stack>
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeFile(index); }}>
                                        <Close fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                        </Stack>
                        <Button 
                            variant="contained" 
                            fullWidth 
                            onClick={nextStep} 
                            sx={{ 
                                py: { xs: 1, sm: 1.5 }, 
                                bgcolor: '#ffc107', 
                                color: '#0b1e39', 
                                fontWeight: 'bold', 
                                '&:hover': { bgcolor: '#e6af06' },
                                fontSize: { xs: '0.875rem', sm: '1rem' }
                            }}
                            endIcon={<ArrowForward />}
                        >
                            Suivant
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                        <Typography variant="body2" sx={{ color: '#95a5a6', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            Plusieurs documents peuvent être <b>signés</b> dans une même transaction
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default SignaturesView;
