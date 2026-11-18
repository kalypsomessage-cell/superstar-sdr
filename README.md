# SUPERSTAR SDR Mobile — compagnon KiwiSDR

Cette édition **GitHub Pages / iPhone** est une première version web. Elle inclut :

- façade aluminium responsive et installable sur l'écran d'accueil iPhone (PWA) ;
- préréglages des bandes 80, 40, 20, 17, 15, 12 et 10 m ;
- réglage de fréquence par pas de 1 kHz, 100 Hz et 10 Hz ;
- modes AM, USB, LSB, NFM ;
- mémoires locales persistantes (localStorage) ;
- lien « ÉCOUTER SUR KIWI » vers le récepteur Web à la fréquence choisie.

**Limitation importante :** l'audio et les commandes de volume/squelch restent dans la page du récepteur KiwiSDR. Aucun scan audio automatique n'est encore porté sur iOS. GitHub Pages ne peut pas exécuter le logiciel Python/Tkinter/KiwiClient Windows. Le récepteur distant peut être indisponible ou interdire les connexions.

## Publication sur GitHub Pages

1. Sur le dépôt `kalypsomessage-cell/superstar-sdr`, cliquer sur **Add file** > **Upload files**.
2. Déposer **le contenu de ce dossier**, pas le ZIP ni le dossier parent. `index.html` doit être à la racine du dépôt.
3. Valider **Commit changes**.
4. **Settings > Pages > Build and deployment > Deploy from a branch** ; sélectionner **main** et **/(root)** puis **Save**.
5. Ouvrir l'adresse `https://kalypsomessage-cell.github.io/superstar-sdr/` une fois le déploiement effectué.
6. Sur iPhone : Safari > Partager > **Sur l'écran d'accueil**.

Aucune modification du dépôt `mon-radar-emploi` n'est nécessaire.

## Notes techniques

Le lien vers Kiwi utilise le paramètre de fréquence documenté `?f=7150lsb` (fréquence en kHz suivie du mode). Les commandes d'accord dans SUPERSTAR SDR Mobile **préparent ce lien** ; elles ne pilotent pas en direct une session audio Safari. Le serveur prérempli est celui utilisé lors des essais Windows : `http://22859.proxy.kiwisdr.com:8073/` ; sa disponibilité n'est pas garantie.
