# Changelog

Tots els canvis notables d'aquest projecte es documentaran en aquest fitxer.

El format està basat en [Keep a Changelog](https://keepachangelog.com/ca/1.0.0/),
i aquest projecte segueix [Semantic Versioning](https://semver.org/lang/ca/).

## [0.3.0] - 2025-11-12

### ✨ Afegit

**Gestió d'Emmagatzematge:**
- 🗑️ Nou botó "Eliminar LanguageTool local" en la configuració
- 💾 Permet alliberar ~100MB d'espai eliminant LanguageTool del dispositiu
- ⚠️ Diàleg de confirmació abans d'eliminar amb advertència clara
- 🌐 Canvi automàtic a mode online si l'usuari estava en mode offline
- 🔄 Re-verificació automàtica del document després d'eliminar

**Millores d'UX:**
- 🎯 Botó completament funcional (ja no mostra "Properament")
- ℹ️ Informació clara sobre les conseqüències d'eliminar LanguageTool
- ✅ Notificacions informatives del resultat de l'operació

### 🔧 Canvis Tècnics
- `languageToolHelper.ts`: Afegides funcions `deleteLanguageTool()` i `removeDirectoryRecursive()`
- `errorsPanel.ts`: Afegit callback `onDeleteLanguageTool` i handler del missatge
- `extension.ts`: Implementada lògica completa d'eliminació amb confirmació i canvi automàtic de mode

### ⚠️ Notes Importants
- LanguageTool ve inclòs en el paquet de l'extensió (~100MB)
- Un cop eliminat, per recuperar-lo cal reinstal·lar l'extensió completa
- L'eliminació és permanent i no es pot desfer
- El mode online (API SoftCatalà) continua funcionant sense LanguageTool

## [0.2.0] - 2025-11-11

### ✨ Afegit

**Gestió Robusta de Connexió:**
- ⚡ Reintentos automàtics amb backoff exponencial (fins a 3 vegades)
- 💾 Cache de resultats (1 minut de validesa)
- 📊 Monitorització d'estat de connexió en temps real
- 🟢🟡🔴 Indicador visual de connexió en el panell lateral
- 🔇 **NO hi ha popups d'error** - L'indicador mostra l'estat silenciosament
- 🔘 Botó "Canviar a Mode Offline" quando no hi ha connexió
- 🔌 Mode offline parcial (usa caché quan falla connexió)

**Suport per a Formes Verbals:**
- 📍 Nou paràmetre `catala.verbForms` amb tres opcions:
  - `central`: Formes verbals centrals (estàndard, per defecte)
  - `valenciana`: Formes verbals valencianes
  - `balear`: Formes verbals balears
  - ⚠️ Nota: Només funciona en mode SoftCatalà (online)

**Filtratge Granular de Correccions:**
- ✅ Checkbox per deshabilitar correccions de majúscules de principi de frase
- 🔄 Re-verificació automàtica del document al canviar configuració
- 💾 Configuració persistent amb `catala.disableCapitalization`

**Activació Automàtica del Panell:**
- 🚀 Quan s'obri el panell lateral, verifica automàticament tot el document
- 📋 Mostra "Comprovant..." mentre escaneja els comentaris
- ⏱️ El panell està llest amb tots els errors quan finalitza

### 🚀 Millores
- Experiència de usuari millorada: Sense popups molestos en connexions inestables
- Funció offline parcial: Continua mostrant errors anteriors quan sense internet
- Mensages d'error més útils: Informa sobre intentos de reconexió
- Panell lateral mejorat: Mostra clarament l'estat de la connexió i opcions de configuració
- Re-verificació intel·ligent: Qualsevol canvi de configuració reinicia la verificació amb els paràmetres nous
- Performance: Cache redueix peticions a l'API

### 🔧 Canvis Tècnics
- `languageTool.ts`: Afegit reintentos, cache i detecció de connexió
- `checker.ts`: Gestió intel·ligent d'errors, filtratge de règles i sincronització de config
- `errorsPanel.ts`: Indicador visual, dropdown de formes verbals i checkbox de capitalització
- `extension.ts`: Callbacks amellorats per triggers re-verificació

## [0.1.0] - 2025-11-10

### Afegit
- Correcció ortogràfica i gramatical en català
- Mode de correcció només de comentaris (activat per defecte)
- Suport per a múltiples llenguatges de programació
- Integració amb l'API de SoftCatalà
- Suport per a servidor LanguageTool local
- Suport per a català general i valencià
- Comprovació automàtica mentre escrius
- Comandes per a comprovació manual i neteja de diagnòstics
- Configuració personalitzable
- Detecció de comentaris en:
  - JavaScript, TypeScript, JSX, TSX
  - Python (incloent docstrings)
  - Java, C, C++, C#
  - Go, Rust, Swift, Kotlin, Scala
  - PHP, Ruby, Perl
  - HTML, CSS, SCSS, Less
  - Shell, Bash, PowerShell
  - SQL, Lua, Makefile, Dockerfile
  - i molts més...

### Seguretat
- Les connexions a l'API utilitzen HTTPS
- Mode local disponible per a més privacitat
