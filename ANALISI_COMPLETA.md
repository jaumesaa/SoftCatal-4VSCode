# Análise Completa de la Extensió SoftCatalà per a VSCode

Creat: 11 de novembre de 2025

---

## 📋 Índex

1. [Visió General](#visió-general)
2. [Mètodes Online i Offline](#mètodes-online-i-offline)
3. [Opcions de Personalització](#opcions-de-personalització)
4. [Aspectes a Millorar](#aspectes-a-millorar)
5. [Guia de Publicació](#guia-de-publicació)

---

## 🔍 Visió General

### Descripció
Aquesta és una extensió de VSCode no oficial que integra la correcció ortogràfica i gramatical en català usant:
- **API de SoftCatalà** (online)
- **LanguageTool local** (offline)

### Característiques Principals
- ✅ Correcció en temps real mentre escribs
- ✅ Mode de comentaris per a codi
- ✅ Suport per a variants (ca-ES i valenciano)
- ✅ Correccions ràpides (Quick Fix)
- ✅ Panell visual per a errors
- ✅ Flexible entre online/offline

### Versió Actual
- **Versió**: 0.1.0 (preliminar)
- **Llicència**: MIT
- **Requisits**: VSCode 1.80.0+

### Estructura de Fitxers

```
src/
├── extension.ts              # Punt d'entrada i configuració
├── checker.ts               # Comprovador principal
├── languageTool.ts          # Client de l'API
├── commentParser.ts         # Parser de comentaris
├── codeActionProvider.ts    # Correccions ràpides
├── errorsPanel.ts           # Panell visual WebView
└── diagnosticsData.ts       # Gestió de dades de diagnòstics
```

---

## 🌐 Mètodes Online i Offline

### 1. **Mode Online: API de SoftCatalà**

#### URL per Defecte
```
https://api.softcatala.org/corrector/v2
```

#### Características
- ✅ No requereix configuració addicional
- ✅ Sempre actualitzat
- ✅ Manteniment central
- ⚠️ Requereix connexió a internet
- ⚠️ Els textos es transmeten als servidors

#### Com Funciona
1. **Petició HTTP POST** a `/check`
2. **Paràmetres**:
   - `text`: El text a comprovar
   - `language`: `ca-ES` o `ca-ES-valencia`
   - `enabledOnly`: false (per defecte)

3. **Resposta**: Array de matches amb:
   - `message`: Descripció de l'error
   - `offset`: Posició del text
   - `length`: Longitud de l'error
   - `replacements`: Suggerències
   - `rule`: ID i categoria de la regla

#### Codi Relevant (`languageTool.ts`)
```typescript
private async check(text: string): Promise<LanguageToolMatch[]> {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', this.language);
    params.append('enabledOnly', 'false');

    const response = await this.client.post<LanguageToolResponse>(
        `${this.baseUrl}/check`,
        params.toString()
    );
    return response.data.matches || [];
}
```

#### Avantatges
- Millor detecció (SoftCatalà ha entrenat millors models)
- Sense instal·lació local
- Automàticament actualitzat

#### Desavantatges
- Privacitat: Els textos es transmeten
- Depèn de la connexió a internet
- Rate limiting potencial

---

### 2. **Mode Offline: LanguageTool Local**

#### Configuració Requerida
```json
{
  "catala.serverMode": "local",
  "catala.localServerUrl": "http://localhost:8081"
}
```

#### Instal·lació del Servidor
```bash
# Descarregar LanguageTool
wget https://languagetool.org/download/LanguageTool-stable.zip
unzip LanguageTool-stable.zip

# Iniciar el servidor
cd LanguageTool-stable
java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081
```

#### Características
- ✅ Total privacitat (res es transmete)
- ✅ Funciona sense internet
- ✅ Sense límit de peticions
- ⚠️ Requereix instal·lació Java
- ⚠️ Rendiment depèn del hardware local

#### Com Funciona
- Mateix format de peticions que SoftCatalà
- URL diferent: `http://localhost:8081/v2`
- Procés local del text

#### Avantatges
- 🔒 Privacitat completa
- 🚀 Sense depèndencies externes
- ⚡ Sense latència de xarxa

#### Desavantatges
- 💻 Requereix Java instal·lat
- 🔧 Manteniment manual
- 📦 ~150MB de descàrrega

---

### 3. **Lògica de Selecció**

En `extension.ts` i `checker.ts`, la lògica determina:

1. **Quins documents comprovar**:
   - Fitxers plaintext, markdown, LaTeX → comprova tot
   - Fitxers de codi → només comentaris (configurable)

2. **Com s'extreuen els comentaris**:
   - **Estil C** (`//`, `/* */`): JavaScript, TypeScript, Java, C++, Go, Rust, PHP, etc.
   - **Estil hash** (`#`): Python, Ruby, Bash, YAML
   - **HTML**: `<!-- -->`
   - **SQL**: `--` i `/* */`
   - **Lua, Docstrings Python**: Patrons específics

---

## ⚙️ Opcions de Personalització

### Configuració Global (`package.json`)

#### 1. **serverMode**
```json
"catala.serverMode": {
  "type": "string",
  "default": "softcatala",
  "enum": ["softcatala", "local"],
  "description": "Mode del servidor de correcció"
}
```
- `softcatala`: Utilitza l'API online
- `local`: Utilitza LanguageTool local

---

#### 2. **language**
```json
"catala.language": {
  "type": "string",
  "default": "ca-ES",
  "enum": ["ca-ES", "ca-ES-valencia"],
  "description": "Variant del català"
}
```
- `ca-ES`: Català estàndard (IEC)
- `ca-ES-valencia`: Norms de Valencia

---

#### 3. **autoCheck**
```json
"catala.autoCheck": {
  "type": "boolean",
  "default": true,
  "description": "Comprova automàticament mentre escribes"
}
```
- `true`: Comprova en temps real
- `false`: Només comprova manualment (menys recursos)

---

#### 4. **checkDelay**
```json
"catala.checkDelay": {
  "type": "number",
  "default": 500,
  "description": "Retard en mil·lisegons abans de comprovar"
}
```
- Evita massa peticions mentre escribes
- Es recomana 300-1000 ms

**Exemple d'optimització**:
```json
{
  "catala.checkDelay": 300  // Més ràpid
}
```

---

#### 5. **checkCommentsOnly**
```json
"catala.checkCommentsOnly": {
  "type": "boolean",
  "default": true,
  "description": "En codi: comprova només comentaris"
}
```
- `true`: Ideal per a developers (només comentaris)
- `false`: Comprova tot el document

**Exemple d'ús**:
```json
{
  "catala.checkCommentsOnly": false  // Comprova tot
}
```

---

#### 6. **enabledLanguages**
```json
"catala.enabledLanguages": {
  "type": "array",
  "default": ["plaintext", "markdown", "latex"],
  "description": "Llenguatges on comprovar el document complet"
}
```

**Personalització**:
```json
{
  "catala.enabledLanguages": [
    "plaintext",
    "markdown",
    "latex",
    "rst"  // Afegir reStructuredText
  ]
}
```

---

#### 7. **codeLanguages**
```json
"catala.codeLanguages": {
  "type": "array",
  "default": [
    "javascript", "typescript", "python", "java",
    "c", "cpp", "csharp", "go", "rust", "php",
    "ruby", "swift", "kotlin", "scala", "html",
    "css", "scss", "less", "vue", "jsx", "tsx"
  ],
  "description": "Llenguatges on comprovar comentaris"
}
```

**Personalització**:
```json
{
  "catala.codeLanguages": [
    // Els per defecte + nous...
    "lua", "sql", "powershell"
  ]
}
```

---

#### 8. **softcatalaApiUrl** (Avançat)
```json
"catala.softcatalaApiUrl": {
  "type": "string",
  "default": "https://api.softcatala.org/corrector/v2",
  "description": "URL personalitzada de l'API"
}
```

Útil per a:
- Proxy personalitzats
- Servidor mirror
- Entorns corporatius

---

#### 9. **localServerUrl** (Avançat)
```json
"catala.localServerUrl": {
  "type": "string",
  "default": "http://localhost:8081",
  "description": "URL del servidor LanguageTool local"
}
```

---

### Exemple de Configuració Completa (`.vscode/settings.json`)

```json
{
  "catala.serverMode": "softcatala",
  "catala.language": "ca-ES",
  "catala.autoCheck": true,
  "catala.checkDelay": 400,
  "catala.checkCommentsOnly": true,
  "catala.enabledLanguages": [
    "plaintext",
    "markdown",
    "latex",
    "rst"
  ],
  "catala.codeLanguages": [
    "javascript",
    "typescript",
    "python",
    "java",
    "jsx",
    "tsx",
    "vue"
  ]
}
```

---

### Comandes Disponibles

Accedir amb `Ctrl+Shift+P` / `Cmd+Shift+P`:

1. **Català: Comprova el document**
   - Força comprovació manual
   - Útil si autoCheck està desactivat

2. **Català: Neteja els diagnòstics**
   - Esborra tots els errors trobats
   - Buida el panell

---

## 🔧 Aspectes a Millorar

### 1. **Rendiment i Optimització**

#### Problema Actual
- Comprova document sencer en modificacions petites
- Pot fer moltes peticions a l'API

#### Millora Proposada
```typescript
// Només comprovar línies modificades (en comptes de document sencer)
private async checkOnlyChangedLines(changeEvent: vscode.TextDocumentChangeEvent) {
    const changes = changeEvent.contentChanges;
    
    for (const change of changes) {
        const affectedLines = this.getAffectedLines(change.range);
        // Comprovar només aquestes línies
    }
}
```

#### Beneficis
- ⚡ 50-70% més ràpid
- 💰 Menys peticions a l'API
- 📊 Menys ús de CPU/memòria

---

### 2. **Caché de Resultats**

#### Problema Actual
- Si repittes el mateix text, fa nova petició

#### Millora Proposada
```typescript
private cache = new Map<string, LanguageToolMatch[]>();

public async check(text: string): Promise<LanguageToolMatch[]> {
    // Si ja l'hem comprovat, retorna del caché
    if (this.cache.has(text)) {
        return this.cache.get(text)!;
    }
    
    // Si no, fa la petició
    const result = await this.apiCall(text);
    this.cache.set(text, result);
    return result;
}
```

#### Beneficis
- 🚀 Respuesta instantànea en textos repetits
- 📉 Menys peticions a l'API
- 💾 Menys tràfic de xarxa

---

### 3. **Suport per a Ignora Permanents**

#### Problema Actual
- No pots "ignora per a sempre" una paraula
- Cada vegada que escribes, es marca

#### Millora Proposada
```typescript
// Fitxer: .softcatala-ignore
interface IgnoreList {
    words: string[];
    rules: string[];
    files: string[];
}

// Guardar ignored words
interface VSCodeIgnoreConfig {
    ignoredWords: Set<string>;
}
```

#### Beneficis
- ✅ Personalització permanent
- 🎯 Noms propis i termes específics
- 👤 Per projecte o global

---

### 4. **Estadístiques i Mètriques**

#### Millora Proposada
```typescript
interface ExtensionStats {
    errorsFound: number;
    errorsCorrected: number;
    topErrorTypes: Map<string, number>;
    apiCallsToday: number;
    averageCheckTime: number;
}
```

#### Beneficis
- 📊 Veure evolució
- 🎯 Identificar patrons d'errors
- 💡 Millorar hàbits d'escribir

---

### 5. **Integració amb altres Extensions**

#### Millora Proposada
Suport per a:
- `cSpell` (ortografia en anglès + català)
- `Code Spell Checker`
- `GitLens` (comprovar commits)

#### Beneficis
- 🔗 Ecosistema complet
- 🌐 Multiidioma
- 🎨 Experiència més integrada

---

### 6. **Diagnòstics Més Detallats**

#### Millora Proposada
```typescript
interface DetailedDiagnostic {
    match: LanguageToolMatch;
    ruleExplanation: string;
    examples: string[];
    learnMoreUrl: string;
    severity: "critical" | "major" | "minor" | "info";
}
```

#### Beneficis
- 📚 Aprendre mentre corriges
- 🎓 Comprendre les regles
- 📖 Enllaços a documentació

---

### 7. **Millor Gestió de Comentaris Multi-línia**

#### Problema Actual
- Els comentaris multibloc es tracten com un text únic
- Les posicions de l'error es poden calcular malament

#### Millora Proposada
```typescript
private calculateCorrectPosition(
    matchInComment: LanguageToolMatch,
    commentInDocument: CommentRange
): vscode.Range {
    // Tractar cada línia del comentari
    const lines = commentInDocument.text.split('\n');
    // Fer match amb posicions reals
}
```

---

### 8. **Suport per a Diccionaris Personalitzats**

#### Millora Proposada
```json
{
  "catala.customDictionary": {
    "enable": true,
    "path": ".softcatala-dict.json"
  }
}
```

Fitxer `.softcatala-dict.json`:
```json
{
  "allowedWords": ["meuProjecte", "CatalaCustom"],
  "replacements": {
    "kk": "que que"
  }
}
```

---

### 9. **Panel Millorat amb Més Opcions**

#### Millora Proposada
- Filtrar errors per tipus
- Estadístiques en temps real
- Historial d'errors corregits
- Export de report

---

### 10. **Suport per a More Llenguatges**

#### Millora Proposada
Afegir suport per:
- Cobol, Fortran (llenguatges antic)
- Groovy, Gradle (JVM)
- Terraform, CloudFormation (infrastructure)

---

## 📦 Guia de Publicació

### Pre-publicació: Checklist

#### 1. Preparació Tècnica
- [ ] Codi compila sense errors: `npm run compile`
- [ ] No hi ha warnings de ESLint
- [ ] Tots els imports estan correctes
- [ ] Fitxer `.vscodeignore` està configurat

#### 2. Documentació
- [ ] README.md és complet i correcte
- [ ] CHANGELOG.md està actualitzat
- [ ] Exemples de configuració funcionan
- [ ] Enllaços funcionan

#### 3. Assets
- [ ] Icó 128x128px creat (`images/icon.png`)
- [ ] Icó de qualitat (no borrós)
- [ ] Colors representatius

#### 4. Metadades
- [ ] `package.json` actualitzat:
  - [ ] Publisher correcte
  - [ ] Descripció adequada
  - [ ] Keywords pertinents
  - [ ] Repositori correcte
  - [ ] Versió incrementada

---

### Pas 1: Crear Publisher

```bash
# Ves a https://marketplace.visualstudio.com/manage
# 1. Inicia sessió amb compte Microsoft
# 2. Fes clic en "Create publisher"
# 3. Omple formulari:
#    - ID: jaumesampolalcover
#    - Display: Jaume Sampol
#    - Descripció: Extensió de corrector català
```

---

### Pas 2: Obtenir Personal Access Token (PAT)

```bash
# 1. Ves a https://dev.azure.com/
# 2. Avatar > Personal access tokens
# 3. New Token:
#    - Name: VSCode Extension Publishing
#    - Organization: All accessible organizations
#    - Expiration: 90 días
#    - Scopes: Marketplace > Manage
# 4. Copia el token (només es mostra una vegada)
```

---

### Pas 3: Configurar Credencials

```bash
# Instal·lar vsce si no ho tens
npm install -g @vscode/vsce

# Login (primer cop)
vsce login jaumesampolalcover
# Enganxa el token quan t'ho demani
```

---

### Pas 4: Versió i Compilació

```bash
# Incrementar versió
npm version patch  # 0.1.0 -> 0.1.1

# O si vols
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0

# Compilar
npm run compile
```

---

### Pas 5: Provar Localment

```bash
# Crear paquet .vsix
vsce package

# Instal·lar localment per provar
code --install-extension catala-softcatala-0.1.1.vsix

# O directament en VSCode Debug (F5)
```

#### Tests Mínims
1. Obrir un fitxer .js amb comentari en català
2. Escriure una falta ortogràfica
3. Verificar que es detecta
4. Aplicar correcció
5. Comprovar que funciona
6. Provar els dos modes (online/local)

---

### Pas 6: Publicar

```bash
# Publicar la versió
vsce publish

# O amb missatge de commit
vsce publish -m "Release v0.1.1: Millores de rendiment"
```

#### Output Esperat
```
Packaging extension...
Created: catala-softcatala-0.1.1.vsix
Publishing...
Published jaumesampolalcover.catala-softcatala v0.1.1
```

---

### Pas 7: Verificar a Marketplace

1. Ves a https://marketplace.visualstudio.com
2. Busca "Català SoftCatalà"
3. Verifica que apareix amb:
   - Descripció correcta
   - Icó visible
   - Versió correcta
   - README mostrat

---

### Pas 8: Promoció

#### 1. Social Media
```
🚀 He publicat la meva extensió de corrector en català per a VSCode!

Característiques:
✅ Correcció online (SoftCatalà) i offline (LanguageTool)
✅ Correccions automàtiques
✅ Suport de comentaris en codi
✅ Suport ca-ES i valenciano

Descarrrega: [link]
Codi obert: [github]
```

#### 2. Comunitats Catalan
- [SoftCatalà Mailing List](https://lists.softcatala.org/)
- [Generalitat Tech Community](https://gencat.cat/)
- Fòrums de desenvolupadors

#### 3. Reddit/Fòrums
- r/catalonia
- r/programming
- r/vscode

---

### Pas 9: Manteniment

#### Actualizações Periòdiques
```bash
# Cada 2-4 setmanes
1. Recollir feedback (GitHub issues)
2. Corregir bugs crítics
3. Afegir millores menors
4. Incrementar versió (patch/minor)
5. Publicar nova versió
```

#### Versioning
- **Patch** (0.1.1): Bug fixes
- **Minor** (0.2.0): Noves funcionalitats
- **Major** (1.0.0): Canvis grans/API change

---

### Exemple de CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2025-11-15

### Added
- Suport per a SQL i Lua
- Caché de resultats per a millor rendiment

### Fixed
- Error en detectar comentaris multibloc en Python
- Crash quan servidor local no estava disponible

### Changed
- Retard per defecte: 500ms -> 400ms

## [0.1.0] - 2025-11-11

### Added
- Versió inicial
- Suport SoftCatalà i LanguageTool local
- Mode comentaris per a codi
```

---

### Problemes Comuns en Publicació

#### Error: "Publisher not found"
```bash
# Solució: Verifica que el publisher existeix
# i que el nom coincideix exactament al package.json
vsce login  # Login de nou
```

#### Error: "VSCE not installed"
```bash
npm install -g @vscode/vsce
vsce publish
```

#### Token Expirat
```bash
# Crear token nou a https://dev.azure.com/
vsce login jaumesampolalcover
# Enganxa el token nou
```

#### L'Icó no es Veu al Marketplace
```bash
# Verificar:
# 1. images/icon.png existeix
# 2. Mida: 128x128px mínima
# 3. Format: PNG
# 4. Path al package.json és correcte
```

---

## 📊 Estadístiques i Mètriques

### Per Rastrejar Després de Publicar

```json
{
  "marketplace_metrics": {
    "downloads": "monitor setmanalment",
    "rating": "objectiu: 4.5+ stars",
    "installs": "seguiment creixement",
    "active_users": "via telemetria opcional"
  },
  "code_metrics": {
    "avg_check_time": "< 200ms",
    "api_success_rate": "> 99%",
    "error_correction_rate": "track"
  }
}
```

---

## 🎯 Roadmap Proposat

### v0.2.0 (1-2 mesos)
- [ ] Caché de resultats
- [ ] Millor detecció de comentaris multibloc
- [ ] Suport per a ignored words

### v0.3.0 (2-3 mesos)
- [ ] Estadístiques i mètriques
- [ ] Diccionaris personalitzats
- [ ] Suport per a més llenguatges

### v1.0.0 (Q1 2026)
- [ ] Integració amb altres extensions
- [ ] Panel millorat
- [ ] Suport per a linters personalitzats

---

## 📚 Recursos Útils

### Documentació Oficial
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [SoftCatalà API Docs](https://api.softcatala.org/)

### SoftCatalà
- [Projecte Principal](https://www.softcatala.org/)
- [Repositori GitHub](https://github.com/Softcatala)

### LanguageTool
- [Web](https://languagetool.org/)
- [Descàrrega Servidor](https://languagetool.org/download/)
- [Documentació API](https://languagetool.org/http-api/)

---

## 📞 Contacte i Suport

### Per a problemes
- GitHub Issues: [repositori]
- Email: [contacte]
- Comunitat SoftCatalà

### Contribucions
- Fork + Pull Request benvinguts
- Siegueix el CONTRIBUTING.md

---

**Creació**: 11/11/2025
**Última actualització**: 11/11/2025
**Estat**: Document viu (actualitzar regularment)
