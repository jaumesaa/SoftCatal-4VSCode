# 🎯 Features - Corrector Català SoftCatalà

## 📋 Eines de Correcció

### ✅ Correcció Ortogràfica i Gramatical
- Detecció automàtica d'errors ortogràfics
- Detecció d'errors gramaticals
- Suggestions de correccions amb eines per aplicar-les
- Suport complet per a català estàndard i valencià

### 📝 Mode de Correcció de Comentaris (activat per defecte)
- Correcció automàtica només de comentaris en fitxers de codi
- Suporta 30+ llenguatges de programació
- Docstrings en Python (""" i ''')
- Comentaris multilínia i de línia única
- Exemples: JavaScript/TypeScript, Python, Java, C/C++, Go, Rust, PHP, Ruby, HTML, SQL, etc.

### 🌐 Suport Multiidioma
- **Català estàndard** (ca-ES)
- **Valencià** (ca-ES-valencia)
- Detecció automàtica de dialecte

---

## ⚙️ Configuració i Personalització

### 🔧 Configuracions Disponibles

**Mode del Servidor**
```json
"catala.serverMode": "softcatala"  // "softcatala" o "local"
```
- `softcatala`: API en línia (requereix connexió)
- `local`: Servidor LanguageTool local

**Formes Verbals** (mode SoftCatalà)
```json
"catala.verbForms": "central"  // "central", "valenciana", "balear"
```
- Central: Formes estàndard (per defecte)
- Valenciana: Variants valencianes
- Balear: Variants balears

**Filtratge de Correccions**
```json
"catala.disableCapitalization": false  // Deshabilita majúscules de principi de frase
```

**Comprovació Automàtica**
```json
"catala.autoCheck": true           // Comprova mentre escrius
"catala.checkDelay": 500           // Retard en ms
"catala.checkCommentsOnly": true   // Mode comentaris només
```

**Llenguatges**
```json
"catala.enabledLanguages": ["plaintext", "markdown", "latex"]
"catala.codeLanguages": ["javascript", "typescript", "python", ...]
```

---

## 🚀 Gestió de Connexió Inteligent

### ⚡ Reintentos Automàtics
- Retry automàtic amb backoff exponencial
- Fins a 3 tentatives (1s, 2s, 4s)
- Fallback automàtic a mode local si disponible

### 💾 Sistema de Caché
- **TTL**: 60 segons
- Reutilitza resultats recents
- Fallback al caché quan no hi ha connexió

### 📊 Monitorització d'Estat

#### Indicadors Visuals
- 🟢 **Online**: Connexió activa
- 🟡 **Reconnecting**: Intentant reconectar (countdown visible)
- 🔴 **Offline**: Sense connexió

#### Informació del Panell
- Estat de connexió en temps real
- Contador de reintentos
- Temps fins al proper intent (countdown)

### 🔌 Mode Offline Parcial
- Continua mostrant errors anteriors quan sense internet
- Caché manté resultats disponibles 1 minut
- No causa frustració per popups d'error repetits

---

## 🎨 Panell Lateral Integrat

### ✨ UI Components

**Secció de Connexió**
- Indicador visual d'estat (colors)
- Comptador de reintentos
- Countdown per al proper intent

**Secció de Configuració**
- Dropdown de formes verbals (central/valenciana/balear)
- Checkbox per deshabilitar majúscules de principi de frase
- Configuració persisteix entre sessions

**Llista d'Errors**
- Visualització clara dels errors
- Número de línia
- Text amb error ressaltat
- Missatge d'error en català
- Suggestions de correccions amb botons
- Botó per anar a la línia

**Estadístiques**
- Contador total d'errors
- Empty state quan tot és correcte

---

## 🔄 Re-verificació Intel·ligent

### Triggers de Re-verificació
1. **Canvi de forma verbal**: Quando canvias entre central/valenciana/balear
2. **Toggle de capitalització**: Quand actives/desactives el filtratge
3. **Canvi de configuració**: Qualsevol canvi de settings

### Comportament
- Re-verifica automàticament el document obert
- Recarrega tots els errors amb la nova configuració
- Actualitza el panell amb nous resultats

---

## 🛡️ Privacitat i Seguretat

### 🔐 Opcions de Privacitat
- **Mode en línia** (SoftCatalà): API oficial amb HTTPS
- **Mode local**: Servidor LanguageTool privat a localhost

### 📱 Detecció Automàtica
- Detecta servidor local al iniciar
- Fallback automàtic si API falla

---

## 📦 Suport de Llenguatges de Codi

### Comentaris Detectats Automàticament En

**Estil C**
- JavaScript, TypeScript, JSX, TSX
- Java, C, C++, C#
- Scala, Kotlin, Go, Rust

**Estil Hash**
- Python (incloent """ i ''' per docstrings)
- Ruby, PHP, Perl, Shell, Bash, PowerShell

**Estil Especial**
- HTML (<!-- -->)
- SQL (-- i /* */)
- Lua (-- i --[[ ]])
- Makefile, Dockerfile

---

## ⌨️ Comandes Disponibles

### Comandes Registrades

```
catala.checkDocument      → Comprova el document obert
catala.clearDiagnostics   → Neteja tots els diagnòstics
```

### Accions Ràpides (CodeActions)
- Corregir error individual
- Ignorar error
- Anar a la posició de l'error

---

## 📊 Rendiment

### Optimitzacions
- Cache per evitar peticions repetides
- Throttle de notificacions d'error (30s entre popups)
- Retard configurable per la comprovació (default 500ms)
- Reintentos intel·ligents sense spam

### Límits
- Timeout de 30 segons per peticions HTTP
- Caché máxima de 1 minut
- MAX_RETRIES: 3 tentatives

---

## 🔮 Funcionalitats Futures Potencials

- [ ] Llista blanca d'errors personalizats (.softcatala-ignore)
- [ ] Filtratge de més tipus de regles
- [ ] Integració amb més engines de correcció
- [ ] Suport per a temes personalitzats del panell
- [ ] Estadístiques d'ús
- [ ] Exportació de errors

---

## 📞 Suport i Feedback

- **Issues**: https://github.com/your-username/catala-softcatala/issues
- **API SoftCatalà**: https://www.softcatala.org/

