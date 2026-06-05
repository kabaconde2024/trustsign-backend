// src/pages/Simple/SignatureSimplePage.jsx
// Version SIMPLE UNIQUEMENT - Pas de code PKI
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogTitle, DialogContent, DialogActions, Alert, Typography, Button, Box, CircularProgress } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';
import ResumeDocument from '../../components/IA/ResumeDocument';
import DetecteurFalsification from '../../components/IA/DetecteurFalsification';
import * as pdfjsLib from 'pdfjs-dist';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

// Configuration du worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Gestionnaire pour l'erreur ResizeObserver
const handleResizeObserverError = (e) => {
    if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.stopImmediatePropagation();
        return true;
    }
    return false;
};

window.addEventListener('error', handleResizeObserverError);

const SignatureSimplePage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const sigCanvas = useRef(null);
    const viewerRef = useRef(null);
    const [totalPages, setTotalPages] = useState(1);
    
    const [invitation, setInvitation] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [accepted, setAccepted] = useState(false);
    const [signatureMode, setSignatureMode] = useState('draw');
    const [signatureText, setSignatureText] = useState('');
    const [uploadedImage, setUploadedImage] = useState(null);
    const [otp, setOtp] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [showPositionSelector, setShowPositionSelector] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [downloadedFileName, setDownloadedFileName] = useState('');
    
    // États pour le résumé IA
    const [contenuDocument, setContenuDocument] = useState('');
    const [nomDocument, setNomDocument] = useState('');
    const [showResume, setShowResume] = useState(false);
    const [resumeLoading, setResumeLoading] = useState(false);
    
    // 🆕 État pour le détecteur de falsification
    const [fichierBlob, setFichierBlob] = useState(null);
    
    // États pour le dialogue d'erreur
    const [errorDialog, setErrorDialog] = useState({
        open: false,
        title: '',
        message: '',
        details: null
    });
    
    // Responsive states
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024 && window.innerWidth > 768);

    // Créer l'instance du plugin
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            setIsTablet(window.innerWidth <= 1024 && window.innerWidth > 768);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // DEBUG: Surveiller les changements d'état
    useEffect(() => {
        console.log("🔍 ÉTATS RESUME:", {
            showResume,
            resumeLoading,
            contenuLength: contenuDocument?.length,
            nomDocument
        });
    }, [showResume, resumeLoading, contenuDocument, nomDocument]);

    // 🆕 Convertir le PDF en fichier pour le détecteur de falsification
    useEffect(() => {
        const convertirPdfEnFichier = async () => {
            if (pdfUrl && nomDocument) {
                try {
                    const response = await fetch(pdfUrl);
                    const blob = await response.blob();
                    const fichier = new File([blob], nomDocument, { type: 'application/pdf' });
                    setFichierBlob(fichier);
                    console.log("✅ PDF converti en fichier pour analyse de falsification");
                } catch (error) {
                    console.error("❌ Erreur conversion PDF:", error);
                }
            }
        };
        convertirPdfEnFichier();
    }, [pdfUrl, nomDocument]);

    const textToImage = (text) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = isMobile ? 200 : 300;
            canvas.height = isMobile ? 70 : 100;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = isMobile ? '20px "Dancing Script", cursive' : '30px "Dancing Script", cursive';
            ctx.fillStyle = 'black';
            ctx.fillText(text, 10, isMobile ? 40 : 60);
            resolve(canvas.toDataURL('image/png'));
        });
    };

    const handleCloseErrorDialog = () => {
        setErrorDialog({ open: false, title: '', message: '', details: null });
    };

    const extraireTexteDuPDF = async (url) => {
        try {
            console.log("📄 Extraction du texte depuis:", url);
            
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    'Accept': 'application/pdf'
                }
            });
            
            const arrayBuffer = response.data;
            
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            console.log(`✅ PDF chargé: ${pdf.numPages} pages`);
            
            let texteComplet = '';
            const maxPages = Math.min(pdf.numPages, 3);
            
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                texteComplet += pageText + '\n';
                console.log(`📝 Page ${i} extraite (${pageText.length} caractères)`);
            }
            
            const resultat = texteComplet.substring(0, 3000);
            console.log(`✅ Extraction terminée: ${resultat.length} caractères`);
            
            if (resultat.length < 50) {
                return "Document sans texte extractible (peut être scanné ou composé d'images).";
            }
            
            return resultat;
            
        } catch (error) {
            console.error("❌ Erreur extraction:", error);
            return "Le texte du document n'a pas pu être extrait automatiquement. Utilisez le bouton 'Générer' pour essayer l'analyse IA.";
        }
    };

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                console.log("1️⃣ Récupération des détails de l'invitation...");
                const res = await axios.get(`http://localhost:8080/api/signature/details/${token}`);
                
                if (res.data.dateExpiration && new Date(res.data.dateExpiration) < new Date()) {
                    alert("Cette invitation a expiré. Veuillez contacter l'expéditeur pour une nouvelle invitation.");
                    navigate('/');
                    return;
                }
                
                setInvitation(res.data);
                setSignatureText(`${res.data.prenomSignataire} ${res.data.nomSignataire}`);
                const pdfUrlTemp = `http://localhost:8080/api/signature/apercu/${token}`;
                setPdfUrl(pdfUrlTemp);
                setNomDocument(res.data.nomDocument || 'document.pdf');
                
                console.log("2️⃣ Activation de l'affichage du résumé...");
                setShowResume(true);
                setResumeLoading(true);
                
                console.log("3️⃣ Tentative d'extraction du texte...");
                try {
                    const texte = await extraireTexteDuPDF(pdfUrlTemp);
                    console.log("4️⃣ Texte extrait, longueur:", texte.length);
                    setContenuDocument(texte);
                } catch (extractError) {
                    console.warn("5️⃣ Extraction échouée, mais le composant s'affichera quand même");
                    setContenuDocument("");
                } finally {
                    setResumeLoading(false);
                    console.log("6️⃣ Chargement terminé, showResume=", true, "resumeLoading=", false);
                }
                
            } catch (err) {
                console.error("Erreur:", err);
                alert("Erreur lors du chargement des détails de la signature");
                setResumeLoading(false);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [token, navigate]);

    const handlePdfClick = (event) => {
        if (!showPositionSelector) return;

        const clientX = event.clientX;
        const clientY = event.clientY;
        const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
        
        const pageLayer = elementsAtPoint.find(el => 
            el.classList.contains('rpv-core__page-layer') || 
            el.classList.contains('rpv-core__inner-page')
        );

        if (!pageLayer) {
            alert("Cliquez bien sur le document (la zone blanche).");
            return;
        }

        let pageIndex = null;

        const attr = pageLayer.getAttribute('data-page-index');
        if (attr !== null) {
            pageIndex = parseInt(attr, 10);
        } else {
            const parentWithIndex = pageLayer.closest('[data-page-index]');
            if (parentWithIndex) {
                pageIndex = parseInt(parentWithIndex.getAttribute('data-page-index'), 10);
            }
        }

        if (pageIndex === null || isNaN(pageIndex)) {
            const allPageLayers = Array.from(document.querySelectorAll('.rpv-core__page-layer'));
            const foundIndex = allPageLayers.indexOf(pageLayer.closest('.rpv-core__page-layer') || pageLayer);
            if (foundIndex !== -1) {
                pageIndex = foundIndex;
            }
        }

        if (pageIndex === null || isNaN(pageIndex)) {
            alert("Erreur technique : Impossible de lire le numéro de page.");
            return;
        }

        const actualPageNumber = pageIndex + 1;
        const rect = pageLayer.getBoundingClientRect();
        
        const xPx = clientX - rect.left;
        const yPx = clientY - rect.top;

        console.log(`🎯 Cible verrouillée ! Page: ${actualPageNumber}, X: ${xPx}, Y: ${yPx}`);

        setSelectedPosition({ 
            x: xPx,
            y: yPx,
            pageNumber: actualPageNumber,
            containerWidth: rect.width,
            containerHeight: rect.height
        });
        
        setShowPositionSelector(false);
    };

    const handleSendOtp = async () => {
        if (!invitation?.emailDestinataire) {
            alert("Adresse email non trouvée");
            return;
        }
        
        try {
            setLoading(true);
            await axios.post(`http://localhost:8080/api/signature/send-otp?token=${token}`);
            setIsOtpSent(true);
            alert(`✅ Code de sécurité envoyé à : ${invitation.emailDestinataire}`);
        } catch (err) {
            alert("❌ Erreur lors de l'envoi de l'email.");
        } finally {
            setLoading(false);
        }
    };

    const downloadFile = (blob, fileName) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);
    };

    const handleSimpleSign = async () => {
        console.log("=== DÉBUT SIGNATURE SIMPLE ===");
        
        if (!accepted) {
            alert("Veuillez accepter les termes de signature");
            return;
        }
        
        if (!selectedPosition) {
            alert("Veuillez d'abord sélectionner l'emplacement de la signature");
            return;
        }
        
        if (!isOtpSent) {
            alert("Veuillez d'abord demander un code OTP");
            return;
        }
        
        if (!otp || otp.length < 4) {
            alert("Veuillez saisir un code OTP valide (4 chiffres minimum)");
            return;
        }
        
        let signatureImage = null;
        
        if (signatureMode === 'draw' && sigCanvas.current) {
            const canvas = sigCanvas.current.getCanvas();
            if (!canvas) {
                alert("Veuillez dessiner votre signature avant de continuer.");
                return;
            }
            const context = canvas.getContext('2d');
            const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const hasDrawing = Array.from(pixelData).some(value => value !== 0);
            
            if (!hasDrawing) {
                alert("Veuillez dessiner votre signature avant de continuer.");
                return;
            }
            
            signatureImage = canvas.toDataURL('image/png');
            console.log("Signature dessinée récupérée");
        } else if (signatureMode === 'text') {
            if (!signatureText || signatureText.trim() === '') {
                alert("Veuillez saisir votre nom pour la signature.");
                return;
            }
            signatureImage = await textToImage(signatureText);
            console.log("Signature texte convertie en image");
        } else if (uploadedImage) {
            signatureImage = uploadedImage;
            console.log("Signature image chargée");
        } else {
            alert("Veuillez fournir une signature (dessinée, texte ou image).");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                token: token,
                otp: otp,
                nom: signatureText,
                email: invitation.emailDestinataire,
                x: selectedPosition.x,
                y: selectedPosition.y,
                pageNumber: selectedPosition.pageNumber,
                displayWidth: selectedPosition.containerWidth,
                displayHeight: selectedPosition.containerHeight,
                signatureImage: signatureImage
            };

            const response = await axios.post(
                'http://localhost:8080/api/signature/valider-simple', 
                payload, 
                { responseType: 'blob' }
            );

            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/pdf')) {
                const fileName = `Signé_${invitation.nomDocument || 'document'}.pdf`;
                setDownloadedFileName(fileName);
                downloadFile(response.data, fileName);
                setShowSuccessModal(true);
            } else {
                throw new Error("Le fichier reçu n'est pas un PDF valide");
            }
        } catch (err) {
            console.error("Erreur signature:", err);
            
            let errorMessage = "";
            let errorDetails = null;
            
            if (err.response && err.response.data) {
                if (err.response.data instanceof Blob) {
                    try {
                        const text = await err.response.data.text();
                        try {
                            const errorJson = JSON.parse(text);
                            errorMessage = errorJson.erreur || errorJson.message || text;
                            errorDetails = errorJson;
                        } catch {
                            errorMessage = text;
                        }
                    } catch (e) {
                        errorMessage = err.response.statusText;
                    }
                } 
                else if (typeof err.response.data === 'object') {
                    errorMessage = err.response.data.erreur || err.response.data.message || JSON.stringify(err.response.data);
                    errorDetails = err.response.data;
                } 
                else {
                    errorMessage = err.response.data;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            if (errorMessage.includes("limite") || errorMessage.includes("signature atteinte") || errorMessage.includes("Limite de signature")) {
                setErrorDialog({
                    open: true,
                    title: "📊 Limite de signature atteinte",
                    message: errorMessage,
                    details: "Vous avez atteint votre quota quotidien de signatures. Veuillez réessayer demain."
                });
            } else {
                setErrorDialog({
                    open: true,
                    title: "❌ Signature impossible",
                    message: errorMessage,
                    details: errorDetails?.message || "Vérifiez vos informations et réessayez."
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        navigate('/');
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("L'image est trop volumineuse. Taille maximale: 2MB");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result);
                setSignatureMode('upload');
            };
            reader.readAsDataURL(file);
        }
    };

    const clearSignature = () => {
        if (sigCanvas.current) {
            sigCanvas.current.clear();
        }
    };

    if (!invitation) return <div style={{ padding: '50px', textAlign: 'center' }}>Chargement sécurisé...</div>;

    const isSignButtonDisabled = loading;

    const bannerStyles = {
        backgroundColor: 'white',
        padding: isMobile ? '10px 15px' : '10px 40px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: isMobile ? '10px' : '0'
    };

    const logoStyles = { height: isMobile ? '25px' : '35px' };
    const infoTextStyles = { fontSize: isMobile ? '10px' : '13px', textAlign: isMobile ? 'left' : 'right' };
    const mainContainerStyles = { display: 'flex', flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' };
    const pdfContainerStyles = { flex: isMobile ? '1' : '2.5', backgroundColor: '#525659', padding: isMobile ? '10px' : '20px', overflowY: 'auto', cursor: showPositionSelector ? 'crosshair' : 'default', minHeight: isMobile ? '400px' : 'auto' };
    const signaturePanelStyles = { flex: isMobile ? '1' : '1', backgroundColor: 'white', borderLeft: isMobile ? 'none' : '1px solid #ddd', borderTop: isMobile ? '1px solid #ddd' : 'none', display: 'flex', flexDirection: 'column', padding: isMobile ? '15px' : '25px', overflowY: 'auto', maxHeight: isMobile ? '60vh' : 'auto' };
    const titleStyles = { fontSize: isMobile ? '18px' : '24px', marginBottom: '15px' };
    const successModalStyles = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: isMobile ? '20px' : '0' };
    const modalContentStyles = { backgroundColor: 'white', borderRadius: '12px', padding: isMobile ? '20px' : '30px', maxWidth: isMobile ? '90%' : '400px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'fadeIn 0.3s ease' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f4f7f9' }}>
            
            {showSuccessModal && (
                <div style={successModalStyles}>
                    <div style={modalContentStyles}>
                        <div style={{ fontSize: isMobile ? '40px' : '50px', marginBottom: '15px' }}>✅</div>
                        <h2 style={{ color: '#28a745', marginBottom: '10px', fontSize: isMobile ? '20px' : '24px' }}>Signature réussie !</h2>
                        <p style={{ marginBottom: '15px', color: '#666', fontSize: isMobile ? '12px' : '14px' }}>Le document <strong>{downloadedFileName}</strong> a été signé avec succès.</p>
                        <p style={{ marginBottom: '20px', fontSize: isMobile ? '11px' : '14px', color: '#888' }}>Le fichier a été téléchargé automatiquement.</p>
                        <button onClick={handleCloseSuccessModal} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: isMobile ? '10px 20px' : '12px 24px', borderRadius: '6px', fontSize: isMobile ? '14px' : '16px', cursor: 'pointer', fontWeight: 'bold', width: isMobile ? '100%' : 'auto' }}>Retour à l'accueil</button>
                    </div>
                </div>
            )}

            <Dialog open={errorDialog.open} onClose={handleCloseErrorDialog} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fff3e0' }}>
                    <ErrorOutline sx={{ color: '#ff9800' }} />
                    <Typography variant="h6" component="span">{errorDialog.title}</Typography>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mt: 2, mb: 2, whiteSpace: 'pre-wrap' }}>{errorDialog.message}</Typography>
                    {errorDialog.details && <Alert severity="info" sx={{ mt: 2, borderRadius: '8px' }}>{errorDialog.details}</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCloseErrorDialog} variant="contained" sx={{ bgcolor: '#1a237e' }}>Compris</Button>
                </DialogActions>
            </Dialog>

            <div style={bannerStyles}>
                <img src="/logo-ngsign.png" alt="NGSign" style={logoStyles} />
                <div style={infoTextStyles}>
                    <strong>{invitation.nomDocument}</strong><br/>
                    <span style={{ color: '#666' }}>ID: {token.substring(0, 8)}...</span>
                    {invitation.dateExpiration && (
                        <div style={{ color: new Date(invitation.dateExpiration) < new Date() ? '#dc3545' : '#ffc107', fontSize: isMobile ? '8px' : '10px', marginTop: '2px' }}>
                            ⏰ Expire le: {new Date(invitation.dateExpiration).toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            {/* RÉSUMÉ IA */}
            {resumeLoading && (
                <Box sx={{ mt: 2, mb: 2, mx: isMobile ? 1 : 3, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>Préparation du document...</Typography>
                </Box>
            )}
            
            {showResume && !resumeLoading && (
                <Box sx={{ mt: 2, mb: 2, mx: isMobile ? 1 : 3 }}>
                    <ResumeDocument 
                        contenu={contenuDocument || ""}
                        nomFichier={nomDocument}
                        onResumeGenere={(resume) => console.log('✅ Résumé généré:', resume)}
                    />
                </Box>
            )}

            {/* 🆕 DÉTECTEUR DE FALSIFICATION */}
            {showResume && !resumeLoading && fichierBlob && (
                <Box sx={{ mt: 2, mb: 2, mx: isMobile ? 1 : 3 }}>
                    <DetecteurFalsification 
                        fichier={fichierBlob}
                        onAnalyseComplete={(resultat) => {
                            console.log('🔍 Analyse falsification terminée:', resultat);
                            if (resultat.scoreIntegrite < 50) {
                                // Alerte silencieuse dans la console
                                console.warn('⚠️ Document suspect détecté! Score:', resultat.scoreIntegrite);
                            }
                        }}
                    />
                </Box>
            )}

            <div style={mainContainerStyles}>
                <div style={pdfContainerStyles} onClick={handlePdfClick}>
                    <div ref={viewerRef} style={{ backgroundColor: 'white', maxWidth: '900px', margin: '0 auto', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', position: 'relative' }}>
                        {pdfUrl && (
                            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                                <Viewer 
                                    fileUrl={pdfUrl} 
                                    plugins={[defaultLayoutPluginInstance]}
                                    onDocumentLoad={(e) => {
                                        console.log("Document chargé, pages:", e.doc.numPages);
                                        setTotalPages(e.doc.numPages);
                                    }}
                                />
                            </Worker>
                        )}
                    </div>
                </div>

                <div style={signaturePanelStyles}>
                    <h3 style={titleStyles}>Finaliser la signature</h3>
                    
                    <div style={{ border: '1px solid #eee', padding: isMobile ? '10px' : '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        <label style={{ display: 'flex', cursor: 'pointer', gap: '10px', fontSize: isMobile ? '12px' : '14px' }}>
                            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                            Je reconnais avoir lu le document et j'accepte les termes de signature électronique
                        </label>
                    </div>

                    {accepted && (
                        <div>
                            <button onClick={() => setShowPositionSelector(true)} style={{ ...primaryBtnStyle(isMobile), backgroundColor: selectedPosition ? '#28a745' : '#ffc107', color: selectedPosition ? 'white' : 'black', marginBottom: '10px', fontSize: isMobile ? '12px' : '14px', padding: isMobile ? '10px' : '12px' }}>
                                {selectedPosition ? `✅ Emplacement sélectionné (Page ${selectedPosition.pageNumber})` : "📍 Cliquez ici pour choisir l'emplacement"}
                            </button>
                            
                            {showPositionSelector && (
                                <div style={{ backgroundColor: '#fff3cd', padding: '8px', borderRadius: '4px', marginBottom: '15px', fontSize: isMobile ? '10px' : '12px', textAlign: 'center', color: '#856404' }}>
                                    🔍 Mode sélection - Naviguez vers la page souhaitée et cliquez DIRECTEMENT sur le document PDF
                                </div>
                            )}
                            
                            {selectedPosition && (
                                <div style={{ backgroundColor: '#d4edda', padding: '8px', borderRadius: '4px', marginBottom: '15px', fontSize: isMobile ? '10px' : '12px', textAlign: 'center', color: '#155724' }}>
                                    ✓ Signature placée sur la page {selectedPosition.pageNumber} à X:{Math.round(selectedPosition.x)}px Y:{Math.round(selectedPosition.y)}px
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '5px' : '10px', marginBottom: '15px' }}>
                                <button onClick={() => setSignatureMode('draw')} style={{ ...btnIconStyle, backgroundColor: signatureMode === 'draw' ? '#e9ecef' : '#fff', padding: isMobile ? '6px 10px' : '8px 12px', fontSize: isMobile ? '14px' : '18px' }}>✏️</button>
                                <button onClick={() => setSignatureMode('text')} style={{ ...btnIconStyle, backgroundColor: signatureMode === 'text' ? '#e9ecef' : '#fff', padding: isMobile ? '6px 10px' : '8px 12px', fontSize: isMobile ? '14px' : '18px' }}>📝 Texte</button>
                                <label style={{ ...btnIconStyle, cursor: 'pointer', backgroundColor: signatureMode === 'upload' ? '#e9ecef' : '#fff', padding: isMobile ? '6px 10px' : '8px 12px', fontSize: isMobile ? '14px' : '18px' }}>
                                    🖼️ <input type="file" hidden onChange={handleImageUpload} accept="image/*" />
                                </label>
                            </div>

                            <div style={{ border: '1px solid #ddd', height: isMobile ? '120px' : '140px', backgroundColor: '#fafafa', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto' }}>
                                {signatureMode === 'draw' && (
                                    <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{ width: isMobile ? 250 : 350, height: isMobile ? 100 : 130 }} />
                                )}
                                {signatureMode === 'text' && (
                                    <input style={{ fontFamily: '"Dancing Script", cursive', fontSize: isMobile ? '20px' : '28px', border: 'none', background: 'transparent', textAlign: 'center', width: '90%', outline: 'none' }} value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder="Votre signature" />
                                )}
                                {signatureMode === 'upload' && uploadedImage && <img src={uploadedImage} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%' }} />}
                                {signatureMode === 'upload' && !uploadedImage && <span style={{ color: '#999', fontSize: isMobile ? '10px' : '12px' }}>Cliquez sur l'icône 🖼️ pour importer une image</span>}
                            </div>
                            
                            {signatureMode === 'draw' && (
                                <button onClick={clearSignature} style={{ background: 'none', border: 'none', fontSize: isMobile ? '10px' : '11px', color: '#888', width: '100%', marginTop: '5px', cursor: 'pointer' }}>Effacer le dessin</button>
                            )}

                            <div style={{ marginTop: '25px' }}>
                                {!isOtpSent ? (
                                    <button onClick={handleSendOtp} style={primaryBtnStyle(isMobile)} disabled={loading}>
                                        {loading ? "Envoi en cours..." : "📱 Recevoir le code par Email"}
                                    </button>
                                ) : (
                                    <>
                                        <p style={{ fontSize: isMobile ? '10px' : '12px', textAlign: 'center', color: '#666' }}>Entrez le code reçu à l'adresse {invitation.emailDestinataire}</p>
                                        <input type="text" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} style={otpInputStyle(isMobile)} autoFocus />
                                        <button onClick={handleSendOtp} style={{ background: 'none', border: 'none', color: '#007bff', fontSize: isMobile ? '10px' : '12px', width: '100%', cursor: 'pointer', marginBottom: '15px' }}>Renvoyer le code</button>
                                        
                                        <div style={{ backgroundColor: '#f8f9fa', padding: isMobile ? '8px' : '10px', borderRadius: '4px', marginBottom: '15px', fontSize: isMobile ? '10px' : '11px' }}>
                                            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Prérequis avant signature :</p>
                                            <ul style={{ margin: 0, paddingLeft: isMobile ? '15px' : '20px' }}>
                                                <li style={{ color: accepted ? '#28a745' : '#dc3545' }}>✓ Acceptation des termes</li>
                                                <li style={{ color: selectedPosition ? '#28a745' : '#dc3545' }}>✓ Emplacement de signature choisi</li>
                                                <li style={{ color: isOtpSent ? '#28a745' : '#dc3545' }}>✓ Code OTP reçu</li>
                                                <li style={{ color: otp.length >= 4 ? '#28a745' : '#dc3545' }}>✓ Code OTP saisi ({otp.length}/4)</li>
                                            </ul>
                                        </div>
                                        
                                        <button onClick={handleSimpleSign} disabled={isSignButtonDisabled} style={{ ...primaryBtnStyle(isMobile), backgroundColor: '#28a745', color: 'white', fontSize: isMobile ? '14px' : '16px', padding: isMobile ? '12px' : '15px' }}>
                                            {loading ? "Signature en cours..." : "✅ SIGNER LE DOCUMENT"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: isMobile ? '9px' : '11px', color: '#28a745', paddingTop: '20px' }}>
                        🛡️ Conformité ISO 27005 - Sécurisé par TrustSign
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .rpv-core__viewer { cursor: ${showPositionSelector ? 'crosshair' : 'default'}; }
                .rpv-core__page-layer canvas { cursor: ${showPositionSelector ? 'crosshair' : 'default'}; }
                @media (max-width: 768px) { .rpv-core__viewer { zoom: 0.8; } }
                @media (max-width: 480px) { .rpv-core__viewer { zoom: 0.6; } }
            `}</style>
        </div>
    );
};

const btnIconStyle = {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: '#fff'
};

const primaryBtnStyle = (isMobile) => ({
    width: '100%',
    padding: isMobile ? '10px' : '12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s'
});

const otpInputStyle = (isMobile) => ({
    width: '100%',
    padding: isMobile ? '10px' : '12px',
    fontSize: isMobile ? '16px' : '20px',
    textAlign: 'center',
    letterSpacing: isMobile ? '3px' : '6px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    marginBottom: '10px'
});

export default SignatureSimplePage;