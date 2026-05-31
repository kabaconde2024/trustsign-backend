// frontend/src/components/AutoSignature/AutoSignatureDocument.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, Button, Typography, Paper, CircularProgress, Stack, Zoom, Alert, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { CloudUpload, Download, HistoryEdu, CheckCircleOutline, PictureAsPdf, Warning, ErrorOutline } from '@mui/icons-material';
import ResumeDocument from '../IA/ResumeDocument';
import DetecteurFalsification from '../IA/DetecteurFalsification';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_BASE_URL = 'http://localhost:8080/api';

const AutoSignatureDocument = ({ setSnackbar, isMobile = false }) => {
    const [file, setFile] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [loading, setLoading] = useState(false);
    const [signedFileUrl, setSignedFileUrl] = useState(null);
    const [coords, setCoords] = useState({ x: 100, y: 100, page: 1, displayPageHeight: 0 });
    const [hasSignature, setHasSignature] = useState(null);
    const [checkingSignature, setCheckingSignature] = useState(true);
    
    // États pour le résumé
    const [contenuDocument, setContenuDocument] = useState('');
    const [nomDocument, setNomDocument] = useState('');
    const [showResume, setShowResume] = useState(false);
    
    // États pour les dialogues d'erreur
    const [errorDialog, setErrorDialog] = useState({
        open: false,
        title: '',
        message: '',
        details: null
    });
    
    const contentRef = useRef(null);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const mobile = isMobile || isSmallScreen;

    // Fonction pour calculer le hash SHA-256 d'un fichier
    const calculateFileHash = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const buffer = event.target.result;
                    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    resolve(hashHex);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const extraireTexteDuPDF = async (file) => {
        try {
            const url = URL.createObjectURL(file);
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let texteComplet = '';
            const maxPages = Math.min(pdf.numPages, 5);
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                texteComplet += pageText + '\n';
            }
            URL.revokeObjectURL(url);
            return texteComplet.substring(0, 8000);
        } catch (error) {
            console.error("Erreur extraction texte:", error);
            return "Impossible d'extraire le texte du PDF pour le résumé.";
        }
    };

    const handleFileChange = async (selectedFile) => {
        if (selectedFile) {
            setFile(selectedFile);
            setSignedFileUrl(null);
            setNomDocument(selectedFile.name);
            setShowResume(false);
            const texte = await extraireTexteDuPDF(selectedFile);
            setContenuDocument(texte);
            setShowResume(true);
        }
    };

    const checkUserSignature = async () => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/utilisateur/mon-profil`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.imageSignature && data.imageSignature !== '') {
                    setHasSignature(true);
                } else {
                    setHasSignature(false);
                }
            } else {
                setHasSignature(false);
            }
        } catch (error) {
            console.error("❌ Erreur vérification signature:", error);
            setHasSignature(false);
        } finally {
            setCheckingSignature(false);
        }
    };

    useEffect(() => {
        checkUserSignature();
    }, []);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        console.log(`📄 Document chargé: ${numPages} pages`);
    };

    const handleCaptureCoords = (e) => {
        if (signedFileUrl || loading) return;

        const rect = contentRef.current.getBoundingClientRect();
        const pageElements = contentRef.current.querySelectorAll('.react-pdf__Page');
        
        let currentPage = 1;
        let localY = e.clientY - rect.top;
        let pHeight = 0;

        for (let i = 0; i < pageElements.length; i++) {
            const pRect = pageElements[i].getBoundingClientRect();
            if (e.clientY >= pRect.top && e.clientY <= pRect.bottom) {
                currentPage = i + 1;
                localY = e.clientY - pRect.top;
                pHeight = pRect.height;
                break;
            }
        }

        const newCoords = {
            x: e.clientX - rect.left,
            y: localY,
            page: currentPage,
            displayPageHeight: pHeight
        };
        
        setCoords(newCoords);
        console.log("📍 Position de signature enregistrée:", newCoords);
    };

    const handleCloseErrorDialog = () => {
        setErrorDialog({ open: false, title: '', message: '', details: null });
    };

    const showErrorDialog = (statusCode, errorData) => {
        let title = "❌ Signature impossible";
        let message = "";
        let details = null;
        
        switch (statusCode) {
            case 401:
                title = "🔒 Non authentifié";
                message = "Vous devez être connecté pour signer un document.";
                break;
            case 403:
                title = "⛔ Accès refusé";
                message = errorData.erreur || "Vous n'êtes pas autorisé à signer ce document.";
                details = "Ce document appartient à un autre utilisateur.";
                break;
            case 409:
                if (errorData.documentExistantId) {
                    title = "📄 Document déjà signé";
                    message = errorData.erreur || "Un document avec le même contenu a déjà été signé.";
                    details = {
                        documentId: errorData.documentExistantId,
                        dateSignature: errorData.dateSignature,
                        info: errorData.message
                    };
                } else if (errorData.erreur && errorData.erreur.includes("modifié")) {
                    title = "⚠️ Intégrité du document";
                    message = errorData.erreur;
                    details = "Le document a été modifié depuis son téléchargement.";
                } else {
                    title = "❌ Signature refusée";
                    message = errorData.erreur || "Opération impossible.";
                }
                break;
            case 400:
                title = "⚠️ Données invalides";
                message = errorData.erreur || "Vérifiez vos informations.";
                break;
            default:
                title = "❌ Erreur technique";
                message = errorData.erreur || "Une erreur inattendue s'est produite.";
        }
        
        setErrorDialog({
            open: true,
            title,
            message,
            details
        });
        
        setSnackbar({ open: true, message, severity: 'error' });
    };

    const handleAutoSign = async () => {
        if (!file) return;
        
        if (!hasSignature) {
            setSnackbar({ open: true, message: "❌ Vous n'avez pas de signature enregistrée.", severity: 'error' });
            return;
        }
        
        setLoading(true);
        
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            const fileHash = await calculateFileHash(file);
            console.log("🔐 Hash calculé côté client:", fileHash);
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileHash', fileHash);
            
            const uploadResponse = await fetch(`${API_BASE_URL}/documents/upload`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: formData
            });
            
            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
            }
            
            const uploadData = await uploadResponse.json();
            console.log("✅ Document uploadé avec ID:", uploadData.id);
            
            const signResponse = await fetch(`${API_BASE_URL}/signature/appliquer-auto-signature?documentId=${uploadData.id}&x=${coords.x}&y=${coords.y}&pageNumber=${coords.page}&displayWidth=${mobile ? 400 : 800}&displayHeight=${coords.displayPageHeight}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            const contentType = signResponse.headers.get('content-type');
            
            if (!signResponse.ok) {
                let errorData = {};
                try {
                    if (contentType && contentType.includes('application/json')) {
                        errorData = await signResponse.json();
                    } else {
                        const errorText = await signResponse.text();
                        errorData = { erreur: errorText };
                    }
                } catch (e) {
                    errorData = { erreur: `Erreur ${signResponse.status}: ${signResponse.statusText}` };
                }
                
                try {
                    await fetch(`${API_BASE_URL}/documents/supprimer/${uploadData.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
                    });
                } catch (cleanupError) {
                    console.warn("Nettoyage non critique:", cleanupError);
                }
                
                showErrorDialog(signResponse.status, errorData);
                return;
            }
            
            const blob = await signResponse.blob();
            const url = URL.createObjectURL(blob);
            setSignedFileUrl(url);
            setSnackbar({ open: true, message: "✅ Document signé avec succès !", severity: 'success' });
            
            console.log("✅ Document signé conservé en BDD avec ID:", uploadData.id);
            
        } catch (err) {
            console.error("Erreur:", err);
            showErrorDialog(500, { erreur: err.message });
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        return () => { if (signedFileUrl) URL.revokeObjectURL(signedFileUrl); };
    }, [signedFileUrl]);

    if (!checkingSignature && !hasSignature) {
        return (
            <Box sx={{ maxWidth: '1000px', mx: 'auto', p: { xs: 2, sm: 3 } }}>
                <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: '24px', textAlign: 'center' }}>
                    <Warning sx={{ fontSize: { xs: 60, sm: 80 }, color: '#ff9800', mb: 2 }} />
                    <Typography variant={mobile ? "h6" : "h5"} fontWeight="bold" sx={{ mb: 2 }}>Signature manuscrite requise</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>Vous devez d'abord créer votre signature manuscrite.</Typography>
                    <Button variant="contained" onClick={() => window.location.href = '/user-dashboard?tab=ma-signature'} sx={{ bgcolor: '#1a237e' }}>
                        Créer ma signature
                    </Button>
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: '1000px', mx: 'auto', p: { xs: 2, sm: 3 } }}>
            {/* DIALOGUE D'ERREUR PERSONNALISÉ */}
            <Dialog
                open={errorDialog.open}
                onClose={handleCloseErrorDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '20px', p: 1 }
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                    <ErrorOutline sx={{ color: '#d32f2f', fontSize: 28 }} />
                    <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
                        {errorDialog.title}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText component="div" sx={{ mb: 2 }}>
                        <Typography variant="body1" sx={{ color: '#333', fontWeight: 500, mb: 2 }}>
                            {errorDialog.message}
                        </Typography>
                        
                        {errorDialog.details && typeof errorDialog.details === 'object' && (
                            <Box sx={{ 
                                mt: 2, 
                                p: 2, 
                                bgcolor: '#f5f5f5', 
                                borderRadius: '12px',
                                border: '1px solid #e0e0e0'
                            }}>
                                {errorDialog.details.documentId && (
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        <strong>📌 ID du document existant :</strong> {errorDialog.details.documentId}
                                    </Typography>
                                )}
                                {errorDialog.details.dateSignature && (
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        <strong>📅 Date de signature :</strong> {new Date(errorDialog.details.dateSignature).toLocaleString()}
                                    </Typography>
                                )}
                                {errorDialog.details.info && (
                                    <Typography variant="body2" sx={{ color: '#666', mt: 1, fontStyle: 'italic' }}>
                                        ℹ️ {errorDialog.details.info}
                                    </Typography>
                                )}
                                {!errorDialog.details.documentId && !errorDialog.details.dateSignature && typeof errorDialog.details === 'string' && (
                                    <Typography variant="body2" sx={{ color: '#666' }}>
                                        ℹ️ {errorDialog.details}
                                    </Typography>
                                )}
                            </Box>
                        )}
                        
                        {errorDialog.title === "⛔ Accès refusé" && (
                            <Alert severity="warning" sx={{ mt: 2, borderRadius: '10px' }}>
                                Vous ne pouvez signer que vos propres documents.
                            </Alert>
                        )}
                        
                        {errorDialog.title === "📄 Document déjà signé" && (
                            <Alert severity="info" sx={{ mt: 2, borderRadius: '10px' }}>
                                Un document identique a déjà été signé. Veuillez utiliser un document différent.
                            </Alert>
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                        onClick={() => {
                            handleCloseErrorDialog();
                            setFile(null);
                            setSignedFileUrl(null);
                            setNumPages(null);
                            setShowResume(false);
                        }} 
                        variant="contained"
                        sx={{ bgcolor: '#1a237e', borderRadius: '25px', px: 3 }}
                    >
                        Compris
                    </Button>
                </DialogActions>
            </Dialog>

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: '24px', textAlign: 'center' }}>
                
                <Box sx={{ mb: 4 }}>
                    <Typography variant={mobile ? "h5" : "h4"} sx={{ fontWeight: 800, color: '#1a237e', mb: 1 }}>
                        Auto-Signature
                    </Typography>
                    <Typography variant="body2" color="textSecondary">Cliquez sur le PDF pour positionner votre signature</Typography>
                    {hasSignature && (
                        <Alert severity="success" sx={{ mt: 2, borderRadius: '12px' }}>
                            ✅ Signature manuscrite trouvée
                        </Alert>
                    )}
                </Box>

                {!file && (
                    <Box component="label" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: { xs: '200px', sm: '250px' }, border: '2px dashed #1976d2', borderRadius: '20px', bgcolor: '#f0f7ff', cursor: 'pointer', transition: 'all 0.3s ease', '&:hover': { bgcolor: '#e3f2fd' } }}>
                        <CloudUpload sx={{ fontSize: { xs: 40, sm: 60 }, color: '#1976d2', mb: 2 }} />
                        <Typography variant={mobile ? "body1" : "h6"} sx={{ color: '#1976d2', fontWeight: 600 }}>Charger le PDF</Typography>
                        <Typography variant="caption" color="textSecondary">Format PDF uniquement</Typography>
                        <input type="file" hidden accept="application/pdf" onChange={(e) => { const selectedFile = e.target.files[0]; if (selectedFile) { handleFileChange(selectedFile); } }} />
                    </Box>
                )}

                {/* 🆕 Résumé IA du document */}
                {showResume && file && contenuDocument && (
                    <Box sx={{ mt: 3, mb: 2 }}>
                        <ResumeDocument 
                            contenu={contenuDocument}
                            nomFichier={nomDocument}
                            onResumeGenere={(resume) => console.log('Résumé généré', resume)}
                        />
                    </Box>
                )}

                {/* 🆕 Détecteur de falsification */}
                {showResume && file && (
                    <Box sx={{ mt: 2, mb: 2 }}>
                        <DetecteurFalsification 
                            fichier={file}
                            onAnalyseComplete={(resultat) => {
                                console.log('🔍 Analyse falsification terminée:', resultat);
                                if (resultat.scoreIntegrite < 50) {
                                    setSnackbar({ 
                                        open: true, 
                                        message: "⚠️ ALERTE: Document suspect détecté! Vérifiez l'analyse de sécurité avant signature.", 
                                        severity: 'warning' 
                                    });
                                } else if (resultat.scoreIntegrite >= 90) {
                                    setSnackbar({ 
                                        open: true, 
                                        message: "✅ Document intègre - Sécurité vérifiée", 
                                        severity: 'success' 
                                    });
                                }
                            }}
                        />
                    </Box>
                )}

                {file && (
                    <Box sx={{ mt: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, px: 2, flexWrap: 'wrap', gap: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <PictureAsPdf color="error" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                    {file.name.length > (mobile ? 30 : 50) ? file.name.substring(0, mobile ? 30 : 50) + '...' : file.name}
                                </Typography>
                            </Stack>
                            {!signedFileUrl && (
                                <Button size="small" onClick={() => { setFile(null); setSignedFileUrl(null); setNumPages(null); setShowResume(false); }} color="error">
                                    Changer
                                </Button>
                            )}
                        </Stack>

                        <Box sx={{ height: { xs: '50vh', sm: '65vh' }, overflowY: 'auto', border: '1px solid #d1d1d1', bgcolor: '#525659', borderRadius: '12px' }}>
                            <Box ref={contentRef} onClick={!signedFileUrl ? handleCaptureCoords : undefined} sx={{ position: 'relative', cursor: !signedFileUrl ? 'crosshair' : 'default', display: 'inline-block', py: 2 }}>
                                <Document file={signedFileUrl || file} onLoadSuccess={onDocumentLoadSuccess} onLoadError={(error) => { console.error("Erreur PDF:", error); setSnackbar({ open: true, message: "Erreur chargement PDF", severity: 'error' }); }}>
                                    {Array.from(new Array(numPages), (el, index) => (<Page key={`p_${index + 1}`} pageNumber={index + 1} width={mobile ? 350 : 800} className="pdf-page-shadow" renderTextLayer={false} renderAnnotationLayer={false} sx={{ mb: 2 }} />))}
                                </Document>

                                {!signedFileUrl && coords.page && (
                                    <Box sx={{ position: 'absolute', left: coords.x - 70, top: (coords.page - 1) * (coords.displayPageHeight + 16) + coords.y - 25, width: '140px', height: '50px', border: '2px solid #1976d2', borderRadius: '4px', bgcolor: 'rgba(25, 118, 210, 0.15)', backdropFilter: 'blur(2px)', pointerEvents: 'none', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="caption" sx={{ color: '#0d47a1', fontWeight: 800, fontSize: '0.65rem' }}>Position signature</Typography>
                                        <HistoryEdu sx={{ fontSize: 18, color: '#0d47a1' }} />
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        <Box sx={{ mt: 4 }}>
                            {!signedFileUrl ? (
                                <Zoom in={!!file}>
                                    <Button variant="contained" onClick={handleAutoSign} disabled={loading} fullWidth={mobile} sx={{ borderRadius: '50px', px: { xs: 3, sm: 6 }, py: { xs: 1, sm: 1.5 }, fontSize: { xs: '0.875rem', sm: '1.1rem' } }} startIcon={loading ? <CircularProgress size={24} /> : <HistoryEdu />}>
                                        {loading ? "Traitement..." : "Appliquer ma signature"}
                                    </Button>
                                </Zoom>
                            ) : (
                                <Stack direction="column" spacing={2} alignItems="center">
                                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main', fontWeight: 700 }}>
                                        <CheckCircleOutline /> Document prêt
                                    </Typography>
                                    <Button variant="contained" color="success" href={signedFileUrl} download={`Signe_${file.name}`} fullWidth={mobile} sx={{ borderRadius: '50px', px: { xs: 3, sm: 6 } }} startIcon={<Download />}>
                                        Télécharger le PDF signé
                                    </Button>
                                </Stack>
                            )}
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default AutoSignatureDocument;