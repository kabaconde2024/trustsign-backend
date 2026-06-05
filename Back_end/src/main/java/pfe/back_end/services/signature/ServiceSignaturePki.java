package pfe.back_end.services.signature;

import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.pdf.*;
import com.itextpdf.signatures.*;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.util.encoders.Hex;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import pfe.back_end.services.hsm.ServiceGestionClesHSM;
import pfe.back_end.services.notification.ServiceSmsOtp;
import pfe.back_end.services.authentification.ConvertisseurCoordonneesPdf;
import pfe.back_end.services.timestamp.ServiceHorodatage;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.StatutDocument;
import pfe.back_end.modeles.entites.Utilisateur;

import java.io.*;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ServiceSignaturePki {

    @Autowired
    private ServiceSmsOtp serviceSmsOtp;

    @Autowired
    private ServiceGestionClesHSM serviceHSM;

    @Autowired
    private ServiceHorodatage serviceHorodatage;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private ServiceLimitationSignature serviceLimitationSignature;

    private static final float SIGNATURE_WIDTH = 180;
    private static final float SIGNATURE_HEIGHT = 80;

    static {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    public byte[] signerDocumentPki(byte[] pdfBytes, String nom, String email, String otp,
                                    float x, float y, int pageNumber,
                                    float displayWidth, float displayHeight,
                                    String aliasUtilisateur, Long documentId,
                                    Utilisateur utilisateur) throws Exception {

        // 1. Vérification OTP
        if (!serviceSmsOtp.verifyOtp(email, otp)) {
            System.err.println("OTP invalide pour: " + email);
            throw new RuntimeException("Code OTP invalide pour la signature PKI");
        }

        System.out.println("OTP valide pour: " + email);


        if (utilisateur != null && !serviceLimitationSignature.peutSigner(utilisateur)) {
            ServiceLimitationSignature.QuotaInfo quota = serviceLimitationSignature.getQuotaInfo(utilisateur);
            System.err.println(" REFUS : Limite de signature atteinte pour " + utilisateur.getEmail());
            throw new RuntimeException(String.format(
                    "Limite de signature atteinte. Vous avez signé %d documents aujourd'hui (limite: %d). Réessayez demain.",
                    quota.signaturesAujourdhui, quota.limiteQuotidienne
            ));
        }

        float[] coords;
        int targetPage;
        try (PdfReader readerInfo = new PdfReader(new ByteArrayInputStream(pdfBytes));
             PdfDocument pdfDocInfo = new PdfDocument(readerInfo)) {

            targetPage = Math.max(1, Math.min(pageNumber, pdfDocInfo.getNumberOfPages()));
            float pdfWidth = pdfDocInfo.getPage(targetPage).getPageSize().getWidth();
            float pdfHeight = pdfDocInfo.getPage(targetPage).getPageSize().getHeight();

            coords = ConvertisseurCoordonneesPdf.versEspacePdfCentree(
                    x, y, pdfWidth, pdfHeight, displayWidth, displayHeight, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
        }

        PrivateKey privateKey = serviceHSM.recupererClePrivee(aliasUtilisateur);
        X509Certificate certificat = serviceHSM.recupererCertificat(aliasUtilisateur);

        if (privateKey == null || certificat == null) {
            throw new RuntimeException("Identité numérique introuvable dans le HSM pour l'alias: " + aliasUtilisateur);
        }

        Certificate[] chaineCertificats = new Certificate[]{certificat};
        byte[] pdfSigne;

        try (ByteArrayInputStream bais = new ByteArrayInputStream(pdfBytes);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            PdfReader reader = new PdfReader(bais);
            PdfSigner signer = new PdfSigner(reader, baos, new StampingProperties().useAppendMode());

            Rectangle rect = new Rectangle(coords[0], coords[1], SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
            PdfSignatureAppearance appearance = signer.getSignatureAppearance();

            appearance.setPageRect(rect)
                    .setPageNumber(targetPage)
                    .setReason("Signature électronique qualifiée (ISO 27005)")
                    .setLocation("Gabès, Tunisie")
                    .setSignatureCreator("Protected Consulting PKI Infrastructure");

            String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
            String texteSignature = String.format(
                    "Signé numériquement par :\n%s\nDate : %s\nIdentité vérifiée via SoftHSM2",
                    nom, dateStr
            );

            appearance.setLayer2Text(texteSignature);
            appearance.setLayer2FontSize(7);

            IExternalDigest digest = new BouncyCastleDigest();
            IExternalSignature signature = new IExternalSignature() {
                @Override
                public String getHashAlgorithm() { return DigestAlgorithms.SHA256; }

                @Override
                public String getEncryptionAlgorithm() { return "RSA"; }

                @Override
                public byte[] sign(byte[] message) {
                    try {
                        java.security.Signature sig = java.security.Signature.getInstance("SHA256withRSA", serviceHSM.getFournisseurPKCS11());
                        sig.initSign(privateKey);
                        sig.update(message);
                        return sig.sign();
                    } catch (Exception e) {
                        throw new RuntimeException("Échec de la signature matérielle HSM: " + e.getMessage(), e);
                    }
                }
            };

            signer.signDetached(digest, signature, chaineCertificats, null, null, null, 0, PdfSigner.CryptoStandard.CADES);
            pdfSigne = baos.toByteArray();
            System.out.println("Document signé via HSM avec succès.");
        }

        try (PdfReader testReader = new PdfReader(new ByteArrayInputStream(pdfSigne));
             PdfDocument testDoc = new PdfDocument(testReader)) {
            SignatureUtil testUtil = new SignatureUtil(testDoc);
            List<String> sigNames = testUtil.getSignatureNames();
            System.out.println("Signatures trouvées: " + sigNames.size());

            if (!sigNames.isEmpty()) {
                PdfPKCS7 testPkcs7 = testUtil.readSignatureData(sigNames.get(0));
                boolean testIntegrity = testPkcs7.verifySignatureIntegrityAndAuthenticity();
                System.out.println("Vérification intégrité immédiate: " + testIntegrity);
            }
        }

        if (serviceHorodatage != null && serviceHorodatage.isEnabled()) {
            try {
                MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
                byte[] hashDocument = sha256.digest(pdfSigne);
                byte[] tokenHorodatage = serviceHorodatage.getTimestamp(hashDocument);

                if (tokenHorodatage != null) {
                    String tokenBase64 = serviceHorodatage.jetonEnBase64(tokenHorodatage);
                    sauvegarderInformationsSignature(documentId, tokenBase64, pdfSigne);
                    System.out.println("Horodatage stocké en BDD");
                } else {
                    System.err.println(" Réponse TSA vide");
                    sauvegarderInformationsSignature(documentId, null, pdfSigne);
                }
            } catch (Exception e) {
                System.err.println("Erreur Horodatage: " + e.getMessage());
                sauvegarderInformationsSignature(documentId, null, pdfSigne);
            }
        } else {
            sauvegarderInformationsSignature(documentId, null, pdfSigne);
        }

        //3. Enregistrer la signature dans le quota
        if (utilisateur != null) {
            serviceLimitationSignature.enregistrerSignature(utilisateur);
            System.out.println(" Signature PKI enregistrée dans le quota pour " + utilisateur.getEmail());
        }

        return pdfSigne;
    }

    private void sauvegarderInformationsSignature(Long documentId, String tokenBase64, byte[] pdfSigne) {
        if (documentId == null) return;

        Optional<Document> optDoc = documentRepository.findById(documentId);
        optDoc.ifPresent(doc -> {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] hashBytes = digest.digest(pdfSigne);
                String hashDocumentHex = Hex.toHexString(hashBytes);

                String signaturePkiBase64 = extraireSignaturePKIBrute(pdfSigne);

                doc.setHashSha256(hashDocumentHex);
                doc.setHashDocument(hashDocumentHex);
                doc.setSignatureNumerique(signaturePkiBase64);

                if (tokenBase64 != null) {
                    doc.setJetonTimestamp(tokenBase64);
                    doc.setDateHorodatage(LocalDateTime.now());
                }

                doc.setEstSigne(true);
                doc.setStatut(StatutDocument.SIGNE);

                documentRepository.save(doc);

                System.out.println("Informations stockées en BDD");
                System.out.println("   Hash: " + hashDocumentHex);
                System.out.println("   Signature PKI: " + (signaturePkiBase64 != null ? "OK (" + signaturePkiBase64.length() + " chars)" : "NON"));
            } catch (Exception e) {
                System.err.println(" Erreur sauvegarde: " + e.getMessage());
            }
        });
    }

    private String extraireSignaturePKIBrute(byte[] pdfSigne) {
        try (PdfReader reader = new PdfReader(new ByteArrayInputStream(pdfSigne));
             PdfDocument pdfDoc = new PdfDocument(reader)) {

            SignatureUtil signatureUtil = new SignatureUtil(pdfDoc);
            List<String> signatureNames = signatureUtil.getSignatureNames();

            if (signatureNames == null || signatureNames.isEmpty()) {
                System.out.println(" Aucune signature trouvée");
                return null;
            }

            String signatureName = signatureNames.get(0);
            PdfPKCS7 pkcs7 = signatureUtil.readSignatureData(signatureName);

            if (pkcs7 != null) {
                byte[] encodedSignature = pkcs7.getEncodedPKCS7();
                if (encodedSignature != null && encodedSignature.length > 0) {
                    String signatureBase64 = Base64.getEncoder().encodeToString(encodedSignature);
                    System.out.println(" Signature PKI brute extraite (taille: " + signatureBase64.length() + " chars)");
                    return signatureBase64;
                }
            }
            return null;

        } catch (Exception e) {
            System.err.println(" Erreur extraction signature: " + e.getMessage());
            return null;
        }
    }
}