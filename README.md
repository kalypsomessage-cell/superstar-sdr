# SUPERSTAR SDR Mobile V2 — édition expérimentale

Version iPhone / Safari / GitHub Pages, indépendante du programme Windows.

## Fonctions

- Nouveau moteur JavaScript direct KiwiSDR : tentative WSS, handshake, démodulation distante, PCM/IMA ADPCM, AudioContext Safari, volume et squelch local. Il ne nécessite pas de Python ni de serveur de relais.
- Fréquences en MHz à cinq décimales, correctes sur petit écran iPhone. Accord fin 10/100/1000 Hz.
- Mémoires persistantes et migration automatique du stockage de la V1.
- Scan HF activable **uniquement après réception effective de trames audio**. Détection d'activité, pas de voix ni de langue française.
- Affichage interne de la page KiwiSDR à titre de repli **uniquement si le serveur autorise le chargement en iframe et HTTPS**.
- Accès externe de secours pour les récepteurs HTTP qui ne permettent pas WSS.

## Limite fondamentale

Le site GitHub Pages est servi en HTTPS. Les navigateurs modernes interdisent les WebSocket non sécurisés `ws://` et l'intégration en iframe de `http://` à l'intérieur de HTTPS. Le récepteur `http://22859.proxy.kiwisdr.com:8073/`, fonctionnel dans Safari seul, **n'a pas été confirmé accessible en WSS**. L'audio direct V2 et le scanner sont donc **expérimentaux** et ne peuvent être déclarés fonctionnels sur cet hôte avant test sur iPhone. Le programme n'affiche « trames audio reçues » que lorsqu'il en reçoit réellement.

Un service HTTPS/WSS autorisé par l'exploitant du KiwiSDR pourrait être requis pour la compatibilité complète. GitHub Pages ne peut servir de relais websocket lui-même.

## Publication GitHub

Décompressez l'archive et téléversez **les fichiers et le dossier assets** à la racine du dépôt `kalypsomessage-cell/superstar-sdr`, en remplaçant les anciens fichiers lorsqu'ils portent le même nom. Le nouveau fichier `kiwi-audio.js` doit impérativement être téléversé.

La V1 reste disponible dans GitHub (historique des commits) pour revenir en arrière.

## Autotests

`node --check kiwi-audio.js && node --check app.js && node --check sw.js`

`node tests/smoke.test.js`

Ces tests couvrent la syntaxe, la construction de l'URL WSS, les limites des fréquences et le format des commandes DSP. Ils ne simulent pas un serveur radio distant réel.
