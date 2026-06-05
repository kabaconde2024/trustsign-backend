# --- Étape 1 : Build Maven ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copier le pom.xml
COPY pom.xml .

# Télécharger les dépendances (optimisation cache Docker)
RUN mvn dependency:go-offline -B

# Copier le code source
COPY src ./src

# Compiler et packager
RUN mvn clean package -DskipTests

# --- Étape 2 : Image d'exécution ---
FROM eclipse-temurin:21-jre
WORKDIR /app

# Installation de SoftHSM2 et dépendances
RUN apt-get update && apt-get install -y \
    softhsm2 \
    opensc \
    libpcsclite1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configuration de SoftHSM2
RUN mkdir -p /app/softhsm_tokens /data/pki /data/archives
RUN echo "directories.tokendir = /app/softhsm_tokens" > /app/softhsm2.conf

# Initialisation du Token SoftHSM
RUN SOFTHSM2_CONF=/app/softhsm2.conf softhsm2-util --init-token --free \
    --label "MonTokenPFE" --pin 1234 --so-pin 1234 || true

# Permissions
RUN chmod -R 777 /app/softhsm_tokens /app/softhsm2.conf /data

# Copie du JAR produit à l'étape 1
COPY --from=build /app/target/*.jar app.jar

# Variables d'environnement
ENV SOFTHSM2_CONF=/app/softhsm2.conf
ENV SPRING_PROFILES_ACTIVE=render
ENV JAVA_OPTS="-Xmx512m -Djava.net.preferIPv4Stack=true"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

EXPOSE 8080

# Exécution
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]