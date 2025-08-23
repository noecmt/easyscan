# Easy Scan - Extension Chrome

Une extension Chrome moderne permettant de scanner des documents directement depuis le navigateur via le protocole eSCL/AirScan. Support optimisé pour HP ENVY Inspire 7200e et autres scanners compatibles.

## 🎯 Fonctionnalités

- **Scan réseau direct** - Scanner depuis le navigateur sans logiciel supplémentaire
- **Auto-découverte** - Détection automatique des scanners sur le réseau
- **Multiple formats** - Support JPEG, PNG et PDF
- **Aperçu instantané** - Prévisualisation de l'image scannée
- **Copie rapide** - Copier l'image dans le presse-papiers en un clic
- **Téléchargement direct** - Sauvegarder via l'API Chrome Downloads
- **Interface moderne** - UI responsive avec thème professionnel
- **Configuration avancée** - Page d'options complète

## 🚀 Installation

1. **Cloner ou télécharger** ce repository
2. **Ouvrir Chrome** et aller dans `chrome://extensions/`
3. **Activer le mode développeur** (coin supérieur droit)
4. **Cliquer sur "Charger l'extension non empaquetée"**
5. **Sélectionner** le dossier `extension`
6. **L'extension est prête** à utiliser !

## 📖 Utilisation

### Scan rapide
1. **Cliquer sur l'icône** de l'extension dans la barre d'outils
2. **Entrer l'adresse IP** de votre scanner
3. **Configurer les paramètres** (résolution, couleur, format)
4. **Cliquer sur "Scanner"**
5. **Aperçu automatique** de l'image scannée

### Découverte automatique
1. **Cliquer sur "Découvrir scanners"**
2. **Sélectionner** votre scanner dans la liste
3. **Scanner directement** sans configuration manuelle

### Configuration avancée
- **Clic droit** sur l'icône → "Options"
- **Définir les paramètres** par défaut
- **Configurer la découverte** réseau
- **Personnaliser l'interface**

## 🔧 Structure du projet

```
extension/
├── src/
│   ├── core/
│   │   ├── escl.js          # Module eSCL/AirScan
│   │   └── discovery.js     # Découverte réseau
│   ├── popup/
│   │   ├── popup.html       # Interface principale
│   │   └── popup.js         # Logique de l'interface
│   ├── options/
│   │   ├── options.html     # Page d'options
│   │   └── options.js       # Configuration
│   ├── styles/
│   │   └── styles.css       # Styles CSS
│   └── background.js        # Service Worker
├── icons/
│   └── icon16.png          # Icônes de l'extension
├── manifest.json           # Configuration Chrome
└── README.md              # Documentation
```

## 🛠️ Développement

### Architecture
- **Manifest V3** - Service Worker moderne
- **Modules ES6** - Import/export natifs
- **Async/Await** - Code asynchrone propre
- **Chrome Storage API** - Persistance des paramètres
- **Fetch API** - Requêtes réseau optimisées

### Protocole eSCL
- **Support HP spécifique** - Version PWG 2.63 requise
- **Headers optimisés** - User-Agent HP Smart compatible
- **CORS configuré** - Mode cors avec credentials omit
- **Gestion d'erreurs** - Messages d'erreur détaillés

### Compatibilité
- **HP ENVY Inspire 7200e** ✅ Testé et validé
- **Autres scanners HP** ✅ Compatible
- **Scanners eSCL standard** ✅ Support générique
- **AirScan** ✅ Fallback automatique

## 🐛 Dépannage

### Erreur 403 Forbidden
- **Vérifier l'IP** du scanner
- **Tester la connectivité** avec le bouton dédié
- **S'assurer** que le scanner est allumé et connecté au Wi-Fi

### Scanner non détecté
- **Vérifier le réseau** - Scanner et PC sur le même réseau
- **Étendre la plage** de découverte dans les options
- **Essayer manuellement** avec l'adresse IP

### Problèmes de performance
- **Réduire la résolution** pour des scans plus rapides
- **Vérifier la connectivité** réseau Wi-Fi
- **Redémarrer** le scanner si nécessaire

## 📝 Changelog

### v1.1.0 (Actuel)
- ✨ **Refactorisation complète** du code
- 🏗️ **Architecture modulaire** avec dossiers séparés
- 🎨 **Interface moderne** avec design professionnel
- 🔧 **Page d'options** avancée
- 🐛 **Corrections** et optimisations

### v1.0.3
- ✅ **Support HP ENVY Inspire 7200e** complet
- 🔧 **Version PWG 2.63** implémentée
- 🚀 **Scan fonctionnel** validé

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- 🐛 **Signaler des bugs**
- 💡 **Proposer des améliorations**
- 🔧 **Soumettre des pull requests**
- 📖 **Améliorer la documentation**

## 📞 Support

Pour toute question ou problème :
1. **Vérifier** la section dépannage ci-dessus
2. **Ouvrir une issue** sur GitHub
3. **Inclure** les détails de votre scanner et configuration
