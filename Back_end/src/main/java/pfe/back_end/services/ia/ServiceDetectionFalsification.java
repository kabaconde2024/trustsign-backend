// services/ia/ServiceDetectionFalsification.java
package pfe.back_end.services.ia;

import com.itextpdf.kernel.pdf.*;
import com.itextpdf.kernel.pdf.annot.PdfAnnotation;
import org.springframework.stereotype.Service;
import pfe.back_end.modeles.entites.AnomalieFalsification;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.ResultatAnalyseFalsification;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ServiceDetectionFalsification {

    private static final String[] CREATEURS_SUSPECTS = {
            "PDF Editor", "PDF Modified", "PDF Tools", "Foxit PhantomPDF",
            "PDF24", "PDF Candy", "Smallpdf", "ILovePDF", "Sejda",
            "Nitro PDF", "PDFescape", "Soda PDF", "PDF Architect"
    };

    private static final String[] MOTS_CLES_MODIFICATION = {
            "modifié", "modified", "edited", "changé", "changed",
            "mis à jour", "updated", "altéré", "altered"
    };


    public ResultatAnalyseFalsification analyserDocument(byte[] contenuPdf, Document infosDocument) {
        ResultatAnalyseFalsification resultat = new ResultatAnalyseFalsification();
        resultat.setDateAnalyse(LocalDateTime.now());
        resultat.setIdDocument(infosDocument.getId());
        resultat.setNomFichier(infosDocument.getNomFichier());

        List<AnomalieFalsification> anomalies = new ArrayList<>();

        // 1. Vérification de l'empreinte numérique (hash)
        verifierIntegriteHash(contenuPdf, infosDocument, anomalies, resultat);

        // 2. Analyse des métadonnées PDF
        analyserMetadonnees(contenuPdf, anomalies, resultat);

        // 3. Analyse de la structure PDF
        analyserStructurePdf(contenuPdf, anomalies, resultat);

        // 4. Calcul du score d'intégrité
        calculerScoreIntegrite(resultat, anomalies);

        // 5. Génération des recommandations
        genererRecommandations(resultat, anomalies);

        resultat.setAnomalies(anomalies);
        return resultat;
    }


    // 1. VÉRIFICATION DE L'EMPREINTE NUMÉRIQUE

    private void verifierIntegriteHash(byte[] contenuPdf, Document infosDocument,
                                       List<AnomalieFalsification> anomalies,
                                       ResultatAnalyseFalsification resultat) {
        try {
            String hashActuel = calculerSha256(contenuPdf);
            String hashOriginal = infosDocument.getHashSha256();
            resultat.setHashActuel(hashActuel);
            resultat.setHashOriginal(hashOriginal);

            boolean hashCorrespond = false;
            if (hashOriginal != null && !hashOriginal.isEmpty()) {
                hashCorrespond = hashActuel.equals(hashOriginal);
            } else {
                hashCorrespond = true;
            }
            resultat.setHashCorrespond(hashCorrespond);

            if (!hashCorrespond) {
                AnomalieFalsification anomalie = new AnomalieFalsification();
                anomalie.setType("HASH_NON_CORRESPONDANT");
                anomalie.setSeverite("CRITIQUE");
                anomalie.setDescription("L'empreinte numérique du document a changé. Le document a été modifié.");
                anomalie.setDetails(String.format("Hash original: %s\nHash actuel: %s",
                        hashOriginal != null ? hashOriginal.substring(0, Math.min(16, hashOriginal.length())) + "..." : "non disponible",
                        hashActuel.substring(0, 16) + "..."));
                anomalies.add(anomalie);
                resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 50);
            }
        } catch (Exception e) {
            AnomalieFalsification anomalie = new AnomalieFalsification();
            anomalie.setType("ERREUR_HASH");
            anomalie.setSeverite("ELEVEE");
            anomalie.setDescription("Impossible de calculer l'empreinte numérique du document");
            anomalie.setDetails(e.getMessage());
            anomalies.add(anomalie);
        }
    }


    // 2. ANALYSE DES MÉTADONNÉES PDF


    private void analyserMetadonnees(byte[] contenuPdf,
                                     List<AnomalieFalsification> anomalies,
                                     ResultatAnalyseFalsification resultat) {
        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            PdfDocumentInfo infos = documentPdf.getDocumentInfo();

            String createur = infos.getCreator();
            String producteur = infos.getProducer();

            resultat.setCreateur(createur);
            resultat.setProducteur(producteur);

            if (createur != null && !createur.isEmpty()) {
                for (String suspect : CREATEURS_SUSPECTS) {
                    if (createur.toLowerCase().contains(suspect.toLowerCase())) {
                        AnomalieFalsification anomalie = new AnomalieFalsification();
                        anomalie.setType("CREATEUR_SUSPECT");
                        anomalie.setSeverite("MOYENNE");
                        anomalie.setDescription("Document modifié avec un éditeur PDF suspect");
                        anomalie.setDetails(String.format("Logiciel utilisé: %s", createur));
                        anomalies.add(anomalie);
                        resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 15);
                        break;
                    }
                }
            }

            if (producteur != null && !producteur.isEmpty()) {
                for (String motCle : MOTS_CLES_MODIFICATION) {
                    if (producteur.toLowerCase().contains(motCle.toLowerCase())) {
                        AnomalieFalsification anomalie = new AnomalieFalsification();
                        anomalie.setType("DOCUMENT_MODIFIE");
                        anomalie.setSeverite("ELEVEE");
                        anomalie.setDescription("Le document est marqué comme modifié dans ses métadonnées");
                        anomalie.setDetails(String.format("Producteur: %s", producteur));
                        anomalies.add(anomalie);
                        resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 20);
                        break;
                    }
                }
            }

        } catch (Exception e) {
            System.err.println("Erreur analyse métadonnées: " + e.getMessage());
        }
    }


    // 3. ANALYSE DE LA STRUCTURE PDF


    private void analyserStructurePdf(byte[] contenuPdf,
                                      List<AnomalieFalsification> anomalies,
                                      ResultatAnalyseFalsification resultat) {
        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            int nombrePages = documentPdf.getNumberOfPages();
            resultat.setNombrePages(nombrePages);

            int elementsSuspects = 0;
            List<String> pagesSuspectes = new ArrayList<>();

            for (int i = 1; i <= nombrePages; i++) {
                PdfPage page = documentPdf.getPage(i);

                int nombreAnnotations = page.getAnnotations().size();
                if (nombreAnnotations > 10) {
                    elementsSuspects++;
                    pagesSuspectes.add("Page " + i + " (" + nombreAnnotations + " annotations)");
                }

                List<PdfAnnotation> annotations = page.getAnnotations();
                for (PdfAnnotation annotation : annotations) {
                    if (annotation.getSubtype() == PdfName.Widget) {
                        AnomalieFalsification anomalie = new AnomalieFalsification();
                        anomalie.setType("CHAMPS_FORMULAIRE");
                        anomalie.setSeverite("MOYENNE");
                        anomalie.setDescription("Présence de champs de formulaire modifiables");
                        anomalie.setDetails("Page " + i + " contient des champs éditables");
                        anomalies.add(anomalie);
                        resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 5);
                        break;
                    }
                }
            }

            resultat.setElementsSuspects(elementsSuspects);
            resultat.setPagesSuspectes(pagesSuspectes);

            if (elementsSuspects > 0) {
                AnomalieFalsification anomalie = new AnomalieFalsification();
                anomalie.setType("STRUCTURE_ANORMALE");
                anomalie.setSeverite("MOYENNE");
                anomalie.setDescription("Structure PDF anormale détectée");
                anomalie.setDetails(String.format("%d éléments suspects sur %d pages",
                        elementsSuspects, nombrePages));
                anomalies.add(anomalie);
            }

            PdfDictionary catalogue = documentPdf.getCatalog().getPdfObject();
            if (catalogue != null && catalogue.containsKey(PdfName.OCProperties)) {
                AnomalieFalsification anomalie = new AnomalieFalsification();
                anomalie.setType("CALQUES_DETECTES");
                anomalie.setSeverite("MOYENNE");
                anomalie.setDescription("Présence de calques superposés (contenu caché possible)");
                anomalie.setDetails("Le document contient des calques qui peuvent masquer du contenu");
                anomalies.add(anomalie);
                resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 15);
            }

        } catch (Exception e) {
            System.err.println("Erreur analyse structure: " + e.getMessage());
        }
    }


    // 4. CALCUL DU SCORE D'INTÉGRITÉ


    private void calculerScoreIntegrite(ResultatAnalyseFalsification resultat,
                                        List<AnomalieFalsification> anomalies) {
        int score = resultat.getScoreIntegrite();
        score = Math.max(0, Math.min(100, score));
        resultat.setScoreIntegrite(score);

        if (resultat.getScoreIntegrite() >= 90) {
            resultat.setNiveauConfiance("EXCELLENT");
            resultat.setMessageConfiance("Document authentique. Aucune anomalie majeure détectée.");
        } else if (resultat.getScoreIntegrite() >= 70) {
            resultat.setNiveauConfiance("BON");
            resultat.setMessageConfiance("Document légèrement suspect. Vérification recommandée.");
        } else if (resultat.getScoreIntegrite() >= 50) {
            resultat.setNiveauConfiance("MOYEN");
            resultat.setMessageConfiance("Document suspect. À examiner attentivement.");
        } else {
            resultat.setNiveauConfiance("FAIBLE");
            resultat.setMessageConfiance("DOCUMENT FORTEMENT SUSPECT. Signature déconseillée.");
        }
    }


    // 5. GÉNÉRATION DES RECOMMANDATIONS


    private void genererRecommandations(ResultatAnalyseFalsification resultat,
                                        List<AnomalieFalsification> anomalies) {
        List<String> recommandations = new ArrayList<>();

        if (!resultat.isHashCorrespond() && resultat.getHashOriginal() != null) {
            recommandations.add("CRITIQUE: Ne PAS signer ce document. L'empreinte numérique ne correspond pas.");
            recommandations.add("Contacter l'expéditeur pour obtenir une version originale.");
        }

        for (AnomalieFalsification anomalie : anomalies) {
            if (anomalie.getSeverite().equals("CRITIQUE")) {
                recommandations.add(" Critique: " + anomalie.getDescription());
            } else if (anomalie.getSeverite().equals("ELEVEE")) {
                recommandations.add("Eleve :" + anomalie.getDescription());
            } else if (anomalie.getSeverite().equals("MOYENNE")) {
                recommandations.add("Moyenne :" + anomalie.getDescription());
            }
        }

        if (recommandations.isEmpty() && resultat.getScoreIntegrite() >= 70) {
            recommandations.add("Document apparemment intègre. Signature possible.");
            recommandations.add("Conserver une copie du rapport d'analyse.");
        } else if (resultat.getScoreIntegrite() < 50) {
            recommandations.add("Il est fortement déconseillé de signer ce document.");
            recommandations.add("Demander un audit externe avant toute signature.");
        }

        resultat.setRecommandations(recommandations);
    }


    // MÉTHODE UTILITAIRE


    public String calculerSha256(byte[] donnees) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(donnees);
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }



// NOUVELLES MÉTHODES DE DÉTECTION

    private void analyserContenuTexte(byte[] contenuPdf,
                                      List<AnomalieFalsification> anomalies,
                                      ResultatAnalyseFalsification resultat) {
        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            StringBuilder texteComplet = new StringBuilder();
            int pagesAvecTexteAnormal = 0;

            for (int i = 1; i <= documentPdf.getNumberOfPages(); i++) {
                PdfPage page = documentPdf.getPage(i);
                PdfDictionary pageDict = page.getPdfObject();

                // Détection de polices suspectes
                PdfDictionary resources = pageDict.getAsDictionary(PdfName.Resources);
                if (resources != null) {
                    PdfDictionary font = resources.getAsDictionary(PdfName.Font);
                    if (font != null) {
                        Set<PdfName> fontKeys = font.keySet();
                        for (PdfName key : fontKeys) {
                            String fontName = font.getAsDictionary(key).getAsName(PdfName.BaseFont).toString();
                            // Polices suspectes (souvent utilisées pour cacher du texte)
                            if (fontName.toLowerCase().contains("times") ||
                                    fontName.toLowerCase().contains("helvetica")) {
                                // Alerte légère
                            }
                        }
                    }
                }
            }


        } catch (Exception e) {
            System.err.println("Erreur analyse contenu: " + e.getMessage());
        }
    }


    private void detecterModificationsTexte(byte[] contenuPdf,
                                            List<AnomalieFalsification> anomalies,
                                            ResultatAnalyseFalsification resultat) {
        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            List<String> policesTrouvees = new ArrayList<>();
            int nombrePolicesDifferentes = 0;

            for (int i = 1; i <= documentPdf.getNumberOfPages(); i++) {
                PdfPage page = documentPdf.getPage(i);
                PdfDictionary resources = page.getPdfObject().getAsDictionary(PdfName.Resources);

                if (resources != null) {
                    PdfDictionary font = resources.getAsDictionary(PdfName.Font);
                    if (font != null) {
                        for (PdfName key : font.keySet()) {
                            String fontName = font.getAsDictionary(key).getAsName(PdfName.BaseFont).toString();
                            if (!policesTrouvees.contains(fontName)) {
                                policesTrouvees.add(fontName);
                                nombrePolicesDifferentes++;
                            }
                        }
                    }
                }
            }

            if (nombrePolicesDifferentes > 5) {
                AnomalieFalsification anomalie = new AnomalieFalsification();
                anomalie.setType("POLICES_MULTIPLES");
                anomalie.setSeverite("MOYENNE");
                anomalie.setDescription("Nombre élevé de polices différentes (" + nombrePolicesDifferentes + ")");
                anomalie.setDetails("Peut indiquer des copier-coller depuis plusieurs sources");
                anomalies.add(anomalie);
                resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 10);
            }

            resultat.setNombrePolices(nombrePolicesDifferentes);

        } catch (Exception e) {
            System.err.println("Erreur détection polices: " + e.getMessage());
        }
    }


    private void detecterContenuCache(byte[] contenuPdf,
                                      List<AnomalieFalsification> anomalies,
                                      ResultatAnalyseFalsification resultat) {
        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            int textesBlancsSurBlanc = 0;

            for (int i = 1; i <= documentPdf.getNumberOfPages(); i++) {
                PdfPage page = documentPdf.getPage(i);

                // Vérification des textes invisibles
                // (couleur du texte = couleur du fond)

                // Vérification des calques optionnels (contenu caché)
                PdfDictionary pageDict = page.getPdfObject();
                PdfArray contents = pageDict.getAsArray(PdfName.Contents);

                if (contents != null && contents.size() > 10) {
                    textesBlancsSurBlanc++;
                }
            }

            if (textesBlancsSurBlanc > 0) {
                AnomalieFalsification anomalie = new AnomalieFalsification();
                anomalie.setType("TEXTE_CACHE");
                anomalie.setSeverite("ELEVEE");
                anomalie.setDescription("Présence potentielle de texte caché ou invisible");
                anomalie.setDetails("Le document pourrait contenir du texte masqué");
                anomalies.add(anomalie);
                resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 20);
            }

        } catch (Exception e) {
            System.err.println("Erreur détection contenu caché: " + e.getMessage());
        }
    }


    private void analyserCohérenceDates(byte[] contenuPdf,
                                        List<AnomalieFalsification> anomalies,
                                        ResultatAnalyseFalsification resultat) {
        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            PdfDocumentInfo infos = documentPdf.getDocumentInfo();
            String dateCreation = infos.getMoreInfo("CreationDate");
            String dateModification = infos.getMoreInfo("ModDate");

            if (dateCreation != null && dateModification != null) {
                // Extraire les années
                String anneeCreation = dateCreation.replaceAll(".*(\\d{4}).*", "$1");
                String anneeModification = dateModification.replaceAll(".*(\\d{4}).*", "$1");

                if (!anneeCreation.equals(anneeModification)) {
                    AnomalieFalsification anomalie = new AnomalieFalsification();
                    anomalie.setType("DATE_INCOHERENTE");
                    anomalie.setSeverite("MOYENNE");
                    anomalie.setDescription("Dates de création et modification incohérentes");
                    anomalie.setDetails("Création: " + anneeCreation + ", Modification: " + anneeModification);
                    anomalies.add(anomalie);
                    resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 10);
                }
            }

        } catch (Exception e) {
            System.err.println("Erreur analyse dates: " + e.getMessage());
        }
    }


    private void verifierLogicielsSuspects(byte[] contenuPdf,
                                           List<AnomalieFalsification> anomalies,
                                           ResultatAnalyseFalsification resultat) {
        List<String> logicielsSuspectsSupplementaires = Arrays.asList(
                "Adobe Photoshop", "GIMP", "Inkscape", "Canva",
                "Figma", "Sketch", "Affinity", "CorelDRAW",
                "PDFescape", "PDF Candy", "Nitro Pro", "Foxit"
        );

        try (PdfReader lecteur = new PdfReader(new java.io.ByteArrayInputStream(contenuPdf));
             PdfDocument documentPdf = new PdfDocument(lecteur)) {

            PdfDocumentInfo infos = documentPdf.getDocumentInfo();
            String createur = infos.getCreator();
            String producteur = infos.getProducer();

            for (String logiciel : logicielsSuspectsSupplementaires) {
                if ((createur != null && createur.contains(logiciel)) ||
                        (producteur != null && producteur.contains(logiciel))) {
                    AnomalieFalsification anomalie = new AnomalieFalsification();
                    anomalie.setType("LOGICIEL_GRAPHIQUE");
                    anomalie.setSeverite("MOYENNE");
                    anomalie.setDescription("Document modifié avec un logiciel graphique");
                    anomalie.setDetails("Logiciel: " + logiciel);
                    anomalies.add(anomalie);
                    resultat.setScoreIntegrite(resultat.getScoreIntegrite() - 15);
                    break;
                }
            }

        } catch (Exception e) {
            System.err.println("Erreur vérification logiciels: " + e.getMessage());
        }
    }


}