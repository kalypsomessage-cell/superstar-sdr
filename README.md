# SUPERSTAR SDR Mobile V2.1 — diagnostic audio sécurisé

Cette version corrige la stratégie de connexion iPhone : essaie `wss://<hôte>/ws/kiwi/.../SND` sur **443** avant le port **8073** et permet de renseigner **un relais Cloudflare Worker dédié**. Elle détecte `MSG audio_rate=` en plus de `sample_rate=` afin d'initialiser l'audio sur davantage de KiwiSDR. Le code utilise un serveur public défini et ne contourne aucune authentification.

## Publication GitHub Pages
Copiez les fichiers `index.html`, `app.js`, `kiwi-audio.js`, `style.css`, `sw.js`, `manifest.webmanifest` et `assets/` à la racine de `superstar-sdr`. **Ne publiez pas** le dossier `RELAIS_CLOUDFLARE` dans Pages (il n'y fonctionnera pas). Ce dossier sert à installer séparément un Worker Cloudflare si nécessaire. Le code navigateur conservera les mémoires précédentes (clé localStorage V1).

## État de validation
Tests automatisés locaux possibles, mais **aucune connexion réelle au KiwiSDR 22859 n'a été confirmée** depuis notre environnement. Le code 1006 sur iPhone peut aussi venir d'un refus du serveur, d'un endpoint incorrect, d'un quota, d'une session déjà pleine ou d'une incompatibilité protocolaire.

Le scanner n'est activable qu'après réception de trames SND; l'affichage de la fréquence indique une commande envoyée et non une confirmation matérielle.
