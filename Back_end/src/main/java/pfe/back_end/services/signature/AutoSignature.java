package pfe.back_end.services.signature;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import org.bouncycastle.util.encoders.Hex;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import pfe.back_end.services.authentification.ConvertisseurCoordonneesPdf;
import pfe.back_end.services.timestamp.ServiceHorodatage;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.modeles.entites.Document;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class AutoSignature {

    @Autowired
    private ImageSignature imageSignature;

    @Autowired
    private ServiceHorodatage serviceHorodatage;

    @Autowired
    private DocumentRepository documentRepository;

    private static final float SIGNATURE_WIDTH = 180;
    private static final float SIGNATURE_HEIGHT = 150;


    public byte[] signerDocumentAuto(byte[] pdfBytes, byte[] imageSignatureBytes, String nom, String email,
                                     float x, float y, int pageNumber,
                                     float displayWidth, float displayHeight,
                                     Long documentId) throws Exception {

        PdfReader readerInfo = new PdfReader(new ByteArrayInputStream(pdfBytes));
        PdfDocument pdfDocInfo = new PdfDocument(readerInfo);
        int targetPage = Math.max(1, Math.min(pageNumber, pdfDocInfo.getNumberOfPages()));
        float pdfWidth = pdfDocInfo.getPage(targetPage).getPageSize().getWidth();
        float pdfHeight = pdfDocInfo.getPage(targetPage).getPageSize().getHeight();
        pdfDocInfo.close();

        float[] coords = convertirCoordonnees(x, y, pdfWidth, pdfHeight, displayWidth, displayHeight);


        byte[] pdfSigne = imageSignature.ajouterSignatureImageDepuisByte(
                pdfBytes, imageSignatureBytes, nom, email, targetPage, coords[0], coords[1]);

        System.out.println("Auto-signature ajoutée pour: " + nom + " (" + email + ") - Page " + targetPage);

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(pdfSigne);
        String hashHex = Hex.toHexString(hashBytes);

        System.out.println("Empreinte SHA-256 du document signé: " + hashHex);

        //  CORRECTION : Ajouter l'empreinte dans les métadonnées du PDF UNIQUEMENT
        // NE PAS sauvegarder en BDD ici - cela écraserait le hash original !
        pdfSigne = ajouterEmpreinteMetadonnee(pdfSigne, hashHex, nom, email);

        if (serviceHorodatage != null && serviceHorodatage.isEnabled()) {
            try {
                byte[] tokenHorodatage = serviceHorodatage.getTimestamp(hashBytes);

                if (tokenHorodatage != null) {
                    String tokenBase64 = serviceHorodatage.jetonEnBase64(tokenHorodatage);
                    System.out.println("Horodatage ajouté à l'auto-signature pour: " + nom);


                    pdfSigne = ajouterHorodatageMetadonnee(pdfSigne, tokenBase64, nom);

                    // Sauvegarder l'horodatage en base de données (sans toucher au hash)
                    sauvegarderHorodatageEnBDD(documentId, tokenBase64);

                } else {
                    System.out.println("Horodatage non disponible pour auto-signature (optionnel)");
                }
            } catch (Exception e) {
                System.err.println("Erreur horodatage (auto-signature, optionnel): " + e.getMessage());
            }
        } else {
            System.out.println("Service d'horodatage désactivé - Auto-signature sans horodatage");
        }

        return pdfSigne;
    }

    /*
      CORRIGÉE : Sauvegarde UNIQUEMENT l'horodatage, ne touche PAS au hash original
     */
    private void sauvegarderHorodatageEnBDD(Long documentId, String tokenBase64) {
        if (documentId != null && documentRepository != null) {
            try {
                Optional<Document> optDoc = documentRepository.findById(documentId);
                if (optDoc.isPresent()) {
                    Document doc = optDoc.get();
                    doc.setJetonTimestamp(tokenBase64);
                    doc.setDateHorodatage(LocalDateTime.now());
                    documentRepository.save(doc);
                    System.out.println("Horodatage sauvegardé en BDD pour document ID: " + documentId);
                }
            } catch (Exception e) {
                System.err.println(" Erreur sauvegarde horodatage: " + e.getMessage());
            }
        }
    }


    private byte[] ajouterEmpreinteMetadonnee(byte[] pdfBytes, String hashHex, String nom, String email) throws Exception {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(pdfBytes);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            PdfReader reader = new PdfReader(bais);
            PdfDocument pdfDoc = new PdfDocument(reader, new PdfWriter(baos));

            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureEmpreinteSHA256", hashHex);
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureEmpreinteDate", LocalDateTime.now().toString());
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureSignataire", nom);
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureEmail", email);
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureVersion", "2.0");

            pdfDoc.close();

            System.out.println("Empreinte ajoutée aux métadonnées du PDF");
            return baos.toByteArray();
        }
    }

    private float[] convertirCoordonnees(float xFront, float yFront,
                                         float pdfWidth, float pdfHeight,
                                         float frontWidth, float frontHeight) {

        float[] coordsFinales = ConvertisseurCoordonneesPdf.versEspacePdfCentree(
                xFront, yFront, pdfWidth, pdfHeight,
                frontWidth, frontHeight, SIGNATURE_WIDTH, SIGNATURE_HEIGHT
        );

        System.out.println("LOGS DE CONVERSION AUTO-SIGNATURE ");
        System.out.println("Clic Front: (" + xFront + ", " + yFront + ")");
        System.out.println("Position PDF calculée: X=" + coordsFinales[0] + ", Y=" + coordsFinales[1]);

        return coordsFinales;
    }


    private byte[] ajouterHorodatageMetadonnee(byte[] pdfBytes, String tokenBase64, String nom) throws Exception {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(pdfBytes);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            PdfReader reader = new PdfReader(bais);
            PdfDocument pdfDoc = new PdfDocument(reader, new PdfWriter(baos));

            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureHorodatageToken", tokenBase64);
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureHorodatageDate", LocalDateTime.now().toString());
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureHorodatageType", "AUTO");
            pdfDoc.getDocumentInfo().setMoreInfo("AutoSignatureNom", nom != null ? nom : "Inconnu");

            pdfDoc.close();

            return baos.toByteArray();
        }
    }


    public boolean verifierIntegriteDocument(byte[] pdfSigne, String hashOriginal) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(pdfSigne);
        String hashActuel = Hex.toHexString(hashBytes);

        boolean estIntegre = hashActuel.equals(hashOriginal);

        if (estIntegre) {
            System.out.println("Vérification d'intégrité : OK - Document authentique");
        } else {
            System.out.println("Vérification d'intégrité : ÉCHEC - Document modifié");
            System.out.println("   Hash attendu: " + hashOriginal);
            System.out.println("   Hash actuel : " + hashActuel);
        }

        return estIntegre;
    }
}