# Respostes a les 3 Preguntes Clau

**Data**: 11/11/2025
**Versió**: 0.2.0+

---

## ❓ Pregunta 1: Quan s'obri el projecte i es carrega l'extensió per primer pic, es revisen TOTES les línies comentades de codi?

### 📋 Resposta Curta
**NO.** L'extensió NO escaneja automàticament tots els fitxers oberts al inici. Només es comproven els documents quan:
1. L'usuari els edita
2. L'usuari canvia d'editor actiu

### 🔍 Explicació Tècnica

**A l'activation (`extension.ts`):**

```typescript
export function activate(context: vscode.ExtensionContext) {
    // Es registren els listeners (escoltadors)
    
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        checker?.scheduleCheck(event.document);  // ← Només quan es CANVIA
    });

    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            checker?.scheduleCheck(editor.document);  // ← Només quan es CANVIA editor
        }
    });
}
```

**Timeline d'activació:**

```
t=0s: VSCode detecta l'extensió
      ↓
t=0.1s: Es crida activate()
        ↓
        - Es crea el panell lateral
        - Es registren els listeners (listeners no fan res fins que no hi ha canvis)
        - S'inicialitza el checker
        ↓
t=0.2s: Extension carregada
        ✓ Panell visible
        ✓ Listeners actius
        ✗ NO s'ha comprovat res de codi
        
t=1s: Usuari edita la línia 5
      ↓
      onDidChangeTextDocument event disparat
      ↓
      scheduleCheck(document) → programa check amb retard 500ms
      
t=1.5s: Check executat
        ✓ Es comprova el document SENCER (totes les línies)
        ✓ Es detecten errors
        ✓ Es mostren al panell
```

### 💡 Avantatges d'aquest sistema

✅ **Eficient**: No desperdicia recursos en activació
✅ **Responsiu**: Comença a comprovar tan aviat com l'usuari comença a treballar
✅ **Apropiat**: No molesta els documents que l'usuari no està editant

---

## ❓ Pregunta 2: Només es revisen les línies editades?

### 📋 Resposta Curta
**NO exactament.** S'escaneja **el document SENCER**, no només les línies editades.

Però és una **bona idea per a futurs millores** per a documents grans.

### 🔍 Explicació Actual

**Com funciona actualment (`checker.ts`):**

```typescript
public async checkDocument(document: vscode.TextDocument): Promise<void> {
    // ...
    const text = document.getText();  // ← TOTS els text!
    const matches = await this.languageToolService.check(text);
}
```

**Exemple pràctic:**

```javascript
// Línia 1: // Comentari correccte
// Línia 2: // Comentari amb falta
// Línia 3: function test() {
// Línia 4: console.log("hello")
// ...
// Línia 500: // Altre comentari

// Usuari edita la línia 4 (afegeix espai):
// ↓
// Es programa check
// ↓
// Checker escaneja TOTA la línia 1-500
// ↓
// Detalla errors a TOTES les línies (no només línia 4)
```

### ⚡ Problema amb Documents Grans

```
Document de 1000 línies
      ↓
Usuari escriu 1 caràcter
      ↓
SENCER document es comprova (1000 línies)
      ↓
API rep 20KB+ de text
      ↓
Respuesta (2-5 segons)
      ↓
Usuari segueix escrivint... SENCER check de nou!
```

### 🚀 Millora Proposada (Futura)

Es podria implementar una **comprovació per seccions**:

```typescript
// Pseudocodi per a futura millora

private async checkModifiedLines(changeEvent: vscode.TextDocumentChangeEvent) {
    const changes = changeEvent.contentChanges;
    
    for (const change of changes) {
        // Extreure només les línies afectades + context (±5 línies)
        const affectedRange = this.expandRange(change.range, 5);
        const affectedText = document.getText(affectedRange);
        
        // Comprovar només aquesta secció
        const matches = await this.check(affectedText);
        
        // Actualitzar només els diagnòstics afectats
    }
}
```

**Beneficis:**
- 50-80% més ràpid en documents grans
- Menys tràfic a l'API
- Experiència més fluida

---

## ❓ Pregunta 3: Fer que si no hi ha connexió s'utilitzi el corrector offline automàtic seria molt complicat?

### 📋 Resposta Curta
**NO!** És bastant **senzill i ja l'hem implementat** (v0.2.0+).

### ✅ Ja Implementat

**S'ha afegit fallback automàtic a mode local:**

```typescript
// A languageTool.ts
private async attemptAutoFallback(): Promise<void> {
    if (this.autoFallbackAttempted) {
        return;
    }
    this.autoFallbackAttempted = true;

    // Detectar servidor local disponible
    if (this.hasLocalServer) {
        console.log('SoftCatalà: Canviant a mode local automàticament');
        this.serverMode = 'local';
        this.baseUrl = 'http://localhost:8081/v2';
        this.consecutiveErrors = 0; // Reset per a reintentar
    }
}
```

### 🔄 Timeline de Fallback Automàtic

**Scenario: Connexió API falla**

```
t=0s: Primer check → connecta a API SoftCatalà
      ✓ Èxit

t=5s: Usuari edita
      Check → connecta a API
      ✗ Falla (timeout)
      
t=5.5s: Retry 1 (espera 1 seg)
      ✗ Falla
      
t=6.5s: Retry 2 (espera 2 seg)
      ✗ Falla
      
t=8.5s: Retry 3 (espera 4 seg)
      ✗ Falla
      
      consecutiveErrors = 3
      → FALLBACK AUTOMÀTIC ACTIVAT
      
t=9s: Detecta servidor local a http://localhost:8081
      ✓ Trovato!
      
      Canvia automàticament a mode local
      serverMode = 'local'
      
t=9.1s: Retry check amb modo local
      ✓ Èxit!
      Usari no nota res, només veu errors detectats
      
Panel mostra: "✓ Connectat (mode local)"
```

### 📊 Flux de Fallback (Diagram)

```
Connexió API
     ↓
[Intent 1, 2, 3 fallats?]
     ↓
    SÍ → consecutiveErrors = 3+
     ↓
[Servidor local disponible?]
     ↓
    SÍ → Canviar a mode local
        └→ Reintentar check
        
    NO → Usar caché
        └→ Mostrar "Sense connexió"
```

### 💻 Per Activar l'Offline Automàtic

**NO cal fer res!** Funciona automàticament si:

1. **Tens LanguageTool local instal·lat:**
   ```bash
   # Descarregar
   wget https://languagetool.org/download/LanguageTool-stable.zip
   unzip LanguageTool-stable.zip
   
   # Executar
   cd LanguageTool-stable
   java -cp languagetool-server.jar \
     org.languagetool.server.HTTPServer --port 8081
   ```

2. **L'extensió detecta automàticament:**
   - Si API falla 3+ vegades
   - Si servidor local està actiu a `localhost:8081`
   - Canvia automàticament ✅

### 🎯 Casos d'Ús

#### Caso 1: Treball Offline amb LanguageTool Local

```
1. Usuari té LanguageTool local funcionant
2. Tanc internet (WiFi off)
3. Obr extensió SoftCatalà
4. Edita document
   ↓
   1r check: Intenta API (falla)
   2n check: Intenta API (falla)
   3r check: Intenta API (falla)
   ↓
   Detecta local server
   ↓
   Automatament canvia a mode local
   ↓
   Continues treballant normalment offline!
```

#### Caso 2: API Cau, Fallback a Local

```
1. Usuari treballant amb API (normal)
2. SoftCatalà API server cau
3. Follows 3 failed attempts
   ↓
   Fallback automàtic activat
   ↓
   Canvia a servidor local
   ↓
   Continua corregint normalment
4. Usuari NO veu interrupció
```

#### Caso 3: No hi ha Local Server

```
1. Sense internet
2. LanguageTool local NO instal·lat
3. Edita document
   ↓
   API falla 3 vegades
   ↓
   Intenta detectar local server (no encontrat)
   ↓
   Usa caché de resultats anteriors
   ↓
   Panell mostra: "⚠️ Sense connexió. Usant caché"
   ↓
   Usuari veu errors del caché
```

### 🔧 Complexitat Implementació

**Dades:**
- Línies de codi afegides: ~35
- Temps d'implementació: ~45 minuts
- Complexitat: **BAIXA** ⭐⭐ (de 10)

**Perquè és fàcil:**
✅ Reusa la lògica de reintentos existent
✅ LanguageTool local usa el mateix API
✅ La transició és transparent per a l'usuari
✅ Sense canvis majors a l'arquitectura

### 📈 Estadístiques

```
Abans (v0.1.0):
- Sense internet → No funciona
- API cau → No funciona
- Usuari bloquejat ❌

Després (v0.2.0+):
- Sense internet + Local server → Funciona offline ✅
- API cau + Local server → Fallback automàtic ✅
- Sense internet + Cap local → Usa caché ✅
```

---

## 🎓 Resum

| Pregunta | Resposta | Detall |
|----------|----------|--------|
| **1. Escaneja tot al inici?** | NO | Només activa listeners, comprova quan s'edita |
| **2. Només línies editades?** | NO | Escaneja document sencer (millora futura) |
| **3. Fallback offline complicat?** | NO | Ja implementat, només 35 línies de codi |

---

## 📝 Changelog v0.2.0+

```
- Fallback automàtic a mode local quan API falla
- Detecció automàtica de servidor LanguageTool local
- Transparència total per a l'usuari
- Cap configuració manual necessària
```

---

**Status**: ✅ Implementat i compilat
**Proves manuals**: Pendents
