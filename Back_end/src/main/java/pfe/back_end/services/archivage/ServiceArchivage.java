package pfe.back_end.services.archivage;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import pfe.back_end.modeles.entites.ArchiveDocument;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.NiveauArchive;
import pfe.back_end.modeles.entites.StatutArchive;
import pfe.back_end.repositories.sql.ArchiveRepository;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.services.timestamp.ServiceHorodatage;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class ServiceArchivage {

    @Autowired
    private ArchiveRepository archiveRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private ServiceHorodatage serviceHorodatage;
    @Value("${archivage.dossier.base:/data/archives}")
    private String dossierArchives;

    @Value("${archivage.duree.conservation.ans:10}")
    private int dureeConservationAns;

    private static final String HASH_ALGO = "SHA-256";


    public ArchiveDocument archiverDocument(Long documentId, NiveauArchive niveau) throws Exception {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document non trouvé: " + documentId));

        if (archiveRepository.findByDocumentId(documentId).isPresent()) {
            throw new RuntimeException("Document déjà archivé");
        }

        byte[] contenu = lireFichierDocument(document);

        byte[] pdfArchive = convertirEnFormatArchive(contenu);

        String hash = calculerHash(pdfArchive);

        String jetonTimestamp = null;
        LocalDateTime dateHorodatage = null;

        if (serviceHorodatage != null && serviceHorodatage.isEnabled()) {
            try {
                MessageDigest digest = MessageDigest.getInstance(HASH_ALGO);
                byte[] hashBytes = digest.digest(pdfArchive);
                byte[] tokenBytes = serviceHorodatage.getTimestamp(hashBytes);

                if (tokenBytes != null) {
                    jetonTimestamp = serviceHorodatage.jetonEnBase64(tokenBytes);
                    dateHorodatage = LocalDateTime.now();
                    System.out.println("Jeton horodaté ajouté à l'archive pour document id: " + documentId);
                } else {
                    System.out.println("Horodatage non disponible pour l'archive");
                }
            } catch (Exception e) {
                System.err.println("Erreur lors de l'horodatage de l'archive: " + e.getMessage());
            }
        }

        String chemin = sauvegarderFichierArchive(pdfArchive, document);

        ArchiveDocument archive = ArchiveDocument.builder()
                .document(document)
                .archiveReference(genererReferenceArchive(document))
                .cheminStockage(chemin)
                .hashArchive(hash)
                .niveau(niveau)
                .statut(StatutArchive.ACTIF)
                .dateArchivage(LocalDateTime.now())
                .dateExpiration(LocalDateTime.now().plusYears(dureeConservationAns))
                .tailleArchive(formatTaille(pdfArchive.length))
                .formatArchive("PDF/A-3")
                .certificatArchive(genererCertificatArchive(document))
                .preuveConservation(genererPreuveConservation(pdfArchive, hash, jetonTimestamp))  // ← MODIFIÉ
                .jetonTimestamp(jetonTimestamp)
                .dateHorodatage(dateHorodatage)
                .build();

        return archiveRepository.save(archive);
    }


    public byte[] recupererArchive(Long documentId) throws Exception {
        ArchiveDocument archive = archiveRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new RuntimeException("Archive non trouvée"));

        if (archive.getStatut() == StatutArchive.SUPPRIME) {
            throw new RuntimeException("Archive supprimée");
        }

        Path path = Paths.get(archive.getCheminStockage());
        return Files.readAllBytes(path);
    }


    public void supprimerArchive(Long archiveId) throws Exception {
        ArchiveDocument archive = archiveRepository.findById(archiveId)
                .orElseThrow(() -> new RuntimeException("Archive non trouvée"));

        if (archive.getDateExpiration().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("L'archive n'est pas encore expirée");
        }

        Path path = Paths.get(archive.getCheminStockage());
        Files.deleteIfExists(path);

        archive.setStatut(StatutArchive.SUPPRIME);
        archive.setDateSuppression(LocalDateTime.now());
        archiveRepository.save(archive);
    }


    public int purgerArchivesExpirees() {
        List<ArchiveDocument> archivesExpirees = archiveRepository.findArchivesExpirees(LocalDateTime.now());
        int compteur = 0;

        for (ArchiveDocument archive : archivesExpirees) {
            try {
                supprimerArchive(archive.getId());
                compteur++;
                System.out.println("Archive purgée: " + archive.getArchiveReference());
            } catch (Exception e) {
                System.err.println("❌ Erreur purge archive " + archive.getId() + ": " + e.getMessage());
            }
        }

        return compteur;
    }


    public byte[] exporterArchiveComplete(Long documentId) throws Exception {
        ArchiveDocument archive = archiveRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new RuntimeException("Archive non trouvée"));

        byte[] contenu = recupererArchive(documentId);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {

            zos.putNextEntry(new ZipEntry("document.pdf"));
            zos.write(contenu);
            zos.closeEntry();

            zos.putNextEntry(new ZipEntry("metadonnees.json"));
            String json = String.format("""
                {
                    "reference": "%s",
                    "dateArchivage": "%s",
                    "dateExpiration": "%s",
                    "hash": "%s",
                    "taille": "%s",
                    "niveau": "%s",
                    "jetonTimestamp": "%s",
                    "dateHorodatage": "%s"
                }
                """,
                    archive.getArchiveReference(),
                    archive.getDateArchivage(),
                    archive.getDateExpiration(),
                    archive.getHashArchive(),
                    archive.getTailleArchive(),
                    archive.getNiveau(),
                    archive.getJetonTimestamp() != null ? archive.getJetonTimestamp() : "null",
                    archive.getDateHorodatage() != null ? archive.getDateHorodatage() : "null"
            );
            zos.write(json.getBytes());
            zos.closeEntry();

            zos.putNextEntry(new ZipEntry("preuve_conservation.txt"));
            zos.write(archive.getPreuveConservation().getBytes());
            zos.closeEntry();

            if (archive.getJetonTimestamp() != null) {
                zos.putNextEntry(new ZipEntry("jeton_horodate.tsr"));
                byte[] tokenBytes = Base64.getDecoder().decode(archive.getJetonTimestamp());
                zos.write(tokenBytes);
                zos.closeEntry();
            }
        }

        return baos.toByteArray();
    }


    public Map<String, Object> verifierIntegriteArchive(Long documentId) throws Exception {
        ArchiveDocument archive = archiveRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new RuntimeException("Archive non trouvée"));

        Map<String, Object> resultat = new HashMap<>();
        resultat.put("reference", archive.getArchiveReference());
        resultat.put("statut", archive.getStatut().toString());
        resultat.put("dateArchivage", archive.getDateArchivage());
        resultat.put("dateExpiration", archive.getDateExpiration());
        resultat.put("dateHorodatage", archive.getDateHorodatage());
        resultat.put("hasToken", archive.getJetonTimestamp() != null);

        byte[] contenu = recupererArchive(documentId);
        String hashActuel = calculerHash(contenu);

        boolean integre = hashActuel.equals(archive.getHashArchive());
        resultat.put("integre", integre);
        resultat.put("message", integre ? "Archive intègre" : "Archive corrompue");

        boolean expiree = archive.getDateExpiration().isBefore(LocalDateTime.now());
        resultat.put("expiree", expiree);

        if (archive.getJetonTimestamp() != null && serviceHorodatage != null) {
            try {
                Map<String, Object> tokenInfos = serviceHorodatage.getInfosToken(archive.getJetonTimestamp());
                resultat.put("tokenValide", tokenInfos.get("valide"));
                resultat.put("tokenDate", tokenInfos.get("date"));
            } catch (Exception e) {
                resultat.put("tokenValide", false);
                resultat.put("tokenErreur", e.getMessage());
            }
        }

        return resultat;
    }


    public List<Map<String, Object>> listerToutesLesArchives() {
        List<ArchiveDocument> archives = archiveRepository.findAll();

        return archives.stream().map(archive -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", archive.getId());
            item.put("reference", archive.getArchiveReference());
            item.put("documentId", archive.getDocument().getId());
            item.put("documentNom", archive.getDocument().getNomFichier());
            item.put("dateArchivage", archive.getDateArchivage());
            item.put("dateExpiration", archive.getDateExpiration());
            item.put("hashArchive", archive.getHashArchive());
            item.put("tailleArchive", archive.getTailleArchive());
            item.put("niveau", archive.getNiveau().toString());
            item.put("statut", archive.getStatut().toString());
            item.put("certificatArchive", archive.getCertificatArchive());
            item.put("hasToken", archive.getJetonTimestamp() != null);
            item.put("dateHorodatage", archive.getDateHorodatage());
            return item;
        }).collect(Collectors.toList());
    }


    public List<Map<String, Object>> listerDocumentsNonArchives() {
        List<Document> documentsSignes = documentRepository.findByEstSigneTrue();

        List<Long> archivedDocIds = archiveRepository.findAll().stream()
                .map(archive -> archive.getDocument().getId())
                .collect(Collectors.toList());

        return documentsSignes.stream()
                .filter(doc -> !archivedDocIds.contains(doc.getId()))
                .map(doc -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", doc.getId());
                    item.put("nom", doc.getNomFichier());
                    item.put("dateCreation", doc.getDateCreation());
                    item.put("estSigne", doc.isEstSigne());
                    return item;
                })
                .collect(Collectors.toList());
    }


    private byte[] lireFichierDocument(Document document) throws Exception {
        if (document.getContenu() != null && document.getContenu().length > 0) {
            System.out.println("✅ Contenu BLOB trouvé en base: " + document.getContenu().length + " bytes");
            return document.getContenu();
        }

        if (document.getCheminStockage() != null && !document.getCheminStockage().isEmpty()) {
            Path path = Paths.get(document.getCheminStockage());
            if (Files.exists(path)) {
                System.out.println("Fichier trouvé au chemin: " + document.getCheminStockage());
                return Files.readAllBytes(path);
            } else {
                System.out.println("Chemin stockage spécifié mais fichier inexistant: " + document.getCheminStockage());
            }
        }

        throw new RuntimeException(
                String.format("Impossible de lire le contenu du document ID %d (%s). " +
                                "Ni contenu BLOB ni fichier physique trouvé.",
                        document.getId(), document.getNomFichier())
        );
    }

    private byte[] convertirEnFormatArchive(byte[] contenu) throws Exception {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(contenu);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            PdfReader reader = new PdfReader(bais);
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(reader, writer);

            pdfDoc.getDocumentInfo().setTitle("Document Archivé");
            pdfDoc.getDocumentInfo().setCreator("TrustSign Archive");
            pdfDoc.getDocumentInfo().setSubject("Document signé et archivé légalement");
            pdfDoc.getDocumentInfo().setKeywords("Archive, Signature, Legal, TrustSign");

            pdfDoc.close();

            return baos.toByteArray();
        }
    }

    private String calculerHash(byte[] donnees) throws Exception {
        MessageDigest digest = MessageDigest.getInstance(HASH_ALGO);
        byte[] hash = digest.digest(donnees);
        return Base64.getEncoder().encodeToString(hash);
    }

    private String sauvegarderFichierArchive(byte[] contenu, Document document) throws Exception {
        Path dossier = Paths.get(dossierArchives);
        if (!Files.exists(dossier)) {
            Files.createDirectories(dossier);
        }

        String nomFichier = String.format("%d_%s.pdf",
                document.getId(),
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        );

        Path chemin = dossier.resolve(nomFichier);
        Files.write(chemin, contenu);

        return chemin.toString();
    }

    private String genererReferenceArchive(Document document) {
        return String.format("ARCH-%d-%s",
                document.getId(),
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        );
    }

    private String formatTaille(long octets) {
        if (octets < 1024) return octets + " o";
        if (octets < 1024 * 1024) return String.format("%.2f Ko", octets / 1024.0);
        return String.format("%.2f Mo", octets / (1024.0 * 1024));
    }

    private String genererCertificatArchive(Document document) {
        return String.format("""
            CERTIFICAT D'ARCHIVAGE
            Document ID: %d
            Archivé le: %s
            Valide jusqu'au: %s
            Niveau: ARCHIVAGE LEGAL
            """,
                document.getId(),
                LocalDateTime.now(),
                LocalDateTime.now().plusYears(dureeConservationAns)
        );
    }

    private String genererPreuveConservation(byte[] contenu, String hash, String jetonTimestamp) {
        String tokenInfo = "";
        if (jetonTimestamp != null) {
            tokenInfo = String.format("""
            
            JETON HORODATÉ :
            Le document a été horodaté avec un jeton TSA valide.
            Token: %s...
            """, jetonTimestamp.substring(0, Math.min(100, jetonTimestamp.length())));
        }

        return String.format("""
            PREUVE DE CONSERVATION
            Hash du document: %s
            Date de l'empreinte: %s
            Algorithme: SHA-256
            Cette preuve atteste que le document n'a pas été altéré depuis son archivage.
            %s
            """,
                hash,
                LocalDateTime.now(),
                tokenInfo
        );
    }
}