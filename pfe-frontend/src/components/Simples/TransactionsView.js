import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, Typography, Grid, Card, CardContent, Chip, Stack, 
  IconButton, Tooltip, Dialog, useMediaQuery, Avatar, 
  Divider, Paper, Fade, Badge, Tooltip as MuiTooltip
} from '@mui/material';
import Description from '@mui/icons-material/Description';
import PhoneIcon from '@mui/icons-material/Phone';
import DownloadIcon from '@mui/icons-material/GetApp';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SimpleIcon from '@mui/icons-material/EditNote';
import PkiIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FilePresentIcon from '@mui/icons-material/FilePresent';

import VerificationReport from './VerificationReport';

const TransactionsView = ({ invitations, loading, onDocumentClick }) => {
  
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [currentVerificationResult, setCurrentVerificationResult] = useState(null);
  const [downloading, setDownloading] = useState({});
  
  const isMobile = useMediaQuery('(max-width:600px)');
  const isTablet = useMediaQuery('(max-width:960px)');

  // Statistiques
  const stats = {
    total: invitations?.length || 0,
    signes: invitations?.filter(i => i.statut === "SIGNE" || i.dateSignature).length || 0,
    enAttente: invitations?.filter(i => i.statut !== "SIGNE" && !i.dateSignature).length || 0,
    pki: invitations?.filter(i => {
      const type = i.type_signature || i.typeSignature || i.type;
      return type?.toLowerCase() === 'pki';
    }).length || 0
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    try {
      if (Array.isArray(dateValue)) {
        const [y, m, d, h = 0, min = 0] = dateValue;
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(d)}/${pad(m)}/${y} ${pad(h)}:${pad(min)}`;
      }
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
               ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      return '—';
    } catch {
      return '—';
    }
  };

  const handleDocumentClick = (invitation) => {
    if (onDocumentClick) {
      const documentInfo = {
        id: invitation.documentId || invitation.id,
        nomFichier: invitation.nomFichier || invitation.documentNom || 'Document',
        nomDocument: invitation.nomFichier || invitation.documentNom || 'Document',
        typeSignature: invitation.typeSignature || invitation.type_signature
      };
      onDocumentClick(documentInfo);
    }
  };

  const handleDownload = async (documentId, nomFichier, typeSignature) => {
    setDownloading(prev => ({ ...prev, [documentId]: true }));
    try {
      const endpoint = `http://localhost:8080/api/documents/download-signe/${documentId}`;
      const response = await axios.get(endpoint, {
        responseType: 'blob',
        withCredentials: true
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const prefix = typeSignature === 'pki' ? 'SIGNE_PKI_' : 'SIGNE_';
      link.setAttribute('download', `${prefix}${nomFichier || 'document.pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      alert("Erreur lors du téléchargement");
    } finally {
      setDownloading(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const verifierSignature = async (documentId, nomFichier, typeSignature) => {
    try {
      const response = await axios.post(
        'http://localhost:8080/api/documents/verifier-document-signe',
        { documentId: documentId, typeSignature: typeSignature },
        { withCredentials: true }
      );
      setCurrentVerificationResult(response.data);
      setOpenReportDialog(true);
    } catch (error) {
      console.error("Erreur vérification:", error);
      alert("Erreur lors de la vérification");
    }
  };

  const getSignatureType = (invitation) => {
    let type = invitation.type_signature || invitation.typeSignature || invitation.type;
    if (!type) {
      const fileName = invitation.nomFichier || invitation.documentNom || '';
      type = (fileName.includes('PKI') || fileName.includes('SIGNE_PKI')) ? 'pki' : 'simple';
    }
    const typeLower = String(type).toLowerCase();
    if (typeLower === 'pki' || typeLower === 'pkcs11') {
      return { 
        label: 'PKI', 
        icon: <PkiIcon sx={{ fontSize: 16 }} />, 
        color: '#2e7d32', 
        bgcolor: '#e8f5e9',
        value: 'pki' 
      };
    }
    return { 
      label: 'Simple', 
      icon: <SimpleIcon sx={{ fontSize: 16 }} />, 
      color: '#1976d2', 
      bgcolor: '#e3f2fd',
      value: 'simple' 
    };
  };

  // Fonction pour tronquer le nom du fichier
  const truncateFileName = (fileName, maxLength) => {
    if (!fileName) return 'Document PDF';
    if (fileName.length <= maxLength) return fileName;
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 3) + '...';
    return `${truncatedName}.${extension}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Typography>Chargement des transactions...</Typography>
      </Box>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="textSecondary">📭 Aucune transaction trouvée</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto', width: '100%', px: { xs: 1, sm: 2, md: 0 } }}>
      
      {/* En-tête avec statistiques */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight="800" sx={{ color: '#0b1e39', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description sx={{ color: '#1a237e' }} />
          Transactions
          <Badge badgeContent={stats.total} color="primary" sx={{ '& .MuiBadge-badge': { fontWeight: 600 } }} />
        </Typography>
        
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`📄 ${stats.total} total`} variant="outlined" />
          <Chip size="small" label={`✅ ${stats.signes} signés`} sx={{ bgcolor: '#e8f5e9', color: '#2e7d32' }} />
          <Chip size="small" label={`⏳ ${stats.enAttente} attente`} sx={{ bgcolor: '#fff3e0', color: '#ed6c02' }} />
          <Chip size="small" label={`🔐 ${stats.pki} PKI`} sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }} />
        </Stack>
      </Box>
      
      {/* Grille de cartes */}
      <Grid container spacing={3}>
        {invitations.map((t, index) => {
          const nom = t.nom_signataire || t.nomSignataire || "";
          const prenom = t.prenom_signataire || t.prenomSignataire || "";
          const email = t.email_destinataire || t.emailDestinataire || "N/A";
          const telephone = t.telephone_signataire || t.telephoneSignataire || "N/A";
          const docNom = t.nomFichier || t.documentNom || "Document PDF";
          const docId = t.documentId;
          const dateInvitation = t.dateInvitation;
          const dateSignature = t.dateSignature;
          const estSigne = t.statut === "SIGNE" || !!dateSignature;
          const isDownloading = downloading[docId];
          const signatureType = getSignatureType(t);
          const typeValue = signatureType.value;

          // Définir la longueur max selon l'appareil
          const maxFileNameLength = isMobile ? 20 : isTablet ? 30 : 40;
          const displayFileName = truncateFileName(docNom, maxFileNameLength);

          return (
            <Grid item xs={12} sm={6} md={4} key={t.id || index}>
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
                    {/* En-tête de la carte */}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                        <Avatar sx={{ bgcolor: signatureType.bgcolor, width: 48, height: 48, flexShrink: 0 }}>
                          <FilePresentIcon sx={{ color: signatureType.color }} />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <MuiTooltip title={docNom} placement="top" arrow>
                            <Typography 
                              variant="subtitle1" 
                              fontWeight="700" 
                              sx={{ 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word'
                              }}
                            >
                              {displayFileName}
                            </Typography>
                          </MuiTooltip>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <PersonIcon sx={{ fontSize: 12 }} />
                            {`${prenom} ${nom}`.trim() || "Signataire inconnu"}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip 
                        icon={estSigne ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <ScheduleIcon sx={{ fontSize: 14 }} />}
                        label={estSigne ? "Signé" : "En attente"} 
                        color={estSigne ? "success" : "warning"} 
                        size="small"
                        sx={{ fontWeight: 600, borderRadius: 2, flexShrink: 0, ml: 1 }}
                      />
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    {/* Informations */}
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Chip 
                          icon={signatureType.icon}
                          label={signatureType.label} 
                          size="small" 
                          sx={{ bgcolor: signatureType.bgcolor, color: signatureType.color, fontWeight: 600, borderRadius: 2 }}
                        />
                      </Stack>

                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <EmailIcon sx={{ fontSize: 16, color: '#64748b' }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email}
                        </Typography>
                      </Stack>

                      {telephone !== "N/A" && (
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <PhoneIcon sx={{ fontSize: 16, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{telephone}</Typography>
                        </Stack>
                      )}

                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CalendarTodayIcon sx={{ fontSize: 16, color: '#64748b' }} />
                        <Typography variant="caption" color="textSecondary">
                          Invitation: {formatDate(dateInvitation)}
                        </Typography>
                      </Stack>

                      {dateSignature && (
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                          <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 500 }}>
                            Signature: {formatDate(dateSignature)}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>

                    {/* Actions */}
                    {estSigne && docId && (
                      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 3, pt: 1 }}>
                        <Tooltip title="Télécharger le document signé">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDownload(docId, docNom, typeValue)} 
                            disabled={isDownloading}
                            sx={{ bgcolor: '#e3f2fd', borderRadius: 2, '&:hover': { bgcolor: '#bbdefb' } }}
                          >
                            <DownloadIcon sx={{ color: '#1976d2' }} />
                          </IconButton>
                        </Tooltip>
                        
                        {typeValue === 'pki' && (
                          <Tooltip title="Vérifier la signature numérique PKI">
                            <IconButton 
                              size="small" 
                              onClick={() => verifierSignature(docId, docNom, typeValue)}
                              sx={{ bgcolor: '#e8f5e9', borderRadius: 2, '&:hover': { bgcolor: '#c8e6c9' } }}
                            >
                              <VerifiedUserIcon sx={{ color: '#2e7d32' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Fade>
            </Grid>
          );
        })}
      </Grid>

      {/* Légende des types de signature */}
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
        <Stack direction={isMobile ? "column" : "row"} spacing={2} alignItems={isMobile ? "flex-start" : "center"} flexWrap="wrap">
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0b1e39', minWidth: 120 }}>
            Types de signature :
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <Chip icon={<SimpleIcon />} label="Signature Simple" size="small" sx={{ bgcolor: '#e3f2fd', fontWeight: 600 }} />
            <Chip icon={<PkiIcon />} label="Signature PKI" size="small" sx={{ bgcolor: '#e8f5e9', fontWeight: 600 }} />
          </Stack>
        </Stack>
      </Paper>

      <Dialog 
        open={openReportDialog} 
        onClose={() => setOpenReportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <VerificationReport 
          verificationResult={currentVerificationResult}
          onClose={() => setOpenReportDialog(false)}
        />
      </Dialog>
    </Box>
  );
};

export default TransactionsView;