# AgriCapital Client — Android (TWA)

## Identité validée
- Nom public : **AgriCapital Client**
- Application ID Android : `ci.agricapital.client`
- Domaine de lancement : `https://client.agricapital.ci`
- Distribution prévue : Google Play (AAB) et téléchargement direct (APK).

## Architecture
L'application Android sera une Trusted Web Activity (TWA) basée sur le portail web existant. L'authentification, les comptes et les données restent gérés par le portail. Le paquet Android fournit l'enveloppe plein écran, l'identité Android et le lien vérifié au domaine.

## Prérequis bloquants avant génération des binaires
1. Générer et conserver la clé de signature Android dans un coffre sécurisé hors du dépôt Git. Ne jamais committer le keystore, ses mots de passe ou les clés privées.
2. Définir la stratégie de signature Google Play : activer Play App Signing et conserver la clé d'upload. Le certificat utilisé pour vérifier la TWA doit correspondre au certificat de signature de l'application distribuée.
3. Générer le fichier `.well-known/assetlinks.json` avec le package `ci.agricapital.client` et l'empreinte SHA-256 exacte du certificat de signature. Ne pas publier de valeurs fictives.
4. Vérifier que `https://client.agricapital.ci` sert le fichier asset links avec le type de contenu JSON et sans redirection.
5. Construire et tester la TWA sur appareils Android réels : ouverture plein écran, retour, liens externes, authentification, notifications et gestion hors ligne.
6. Générer l'AAB pour Play Console et l'APK signé pour le téléchargement direct. Vérifier qu'une installation APK peut être mise à jour vers la version Play sans conflit de signature ; sinon, distribuer les deux canaux avec une stratégie de signature cohérente.

## Téléchargement direct depuis le profil client
Le bouton « Télécharger l’application » ne doit être activé qu'une fois qu'un APK signé, versionné et hébergé sur une URL stable est disponible. L'afficher uniquement sur Android et masquer le bouton en démonstration. Ne pas mettre en production un lien factice ou un fichier de test.

## Publication Google Play
La publication nécessite un compte Play Console appartenant à AgriCapital, la fiche de l'application, les informations de confidentialité et de sécurité, les captures d'écran, les déclarations requises et la validation de Google. La création du paquet ne vaut pas publication.

## État
- [x] Nom et identifiant Android validés.
- [x] Identité du manifeste web alignée sur « AgriCapital Client ».
- [ ] Certificat de signature Android sécurisé et empreinte SHA-256 obtenue.
- [ ] Fichier Digital Asset Links publié et vérifié.
- [ ] Projet TWA configuré et binaire AAB/APK généré.
- [ ] APK hébergé et bouton Android activé dans le profil.
- [ ] Tests sur appareils Android physiques.
- [ ] Fiche Play Console et publication.
