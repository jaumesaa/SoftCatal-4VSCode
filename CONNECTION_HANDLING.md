# Gestió de Fallades de Connexió - Millores Implementades

## 📊 Resum Executiu

L'extensió ara té una **gestió robusta de fallades de connexió** amb:
- ✅ Reintentos automàtics amb backoff exponencial
- ✅ Cache de resultats per a mode offline
- ✅ Indicador visual de connexió en el panell
- ✅ Notificacions no molestas (sense popups repetits)

---

## 🔧 Millores Técniques Implementades

### 1. **Reintentos Automàtics amb Backoff Exponencial**

**Ubicació**: `src/languageTool.ts`

```typescript
private readonly MAX_RETRIES = 3;
private readonly RETRY_DELAY = 1000; // 1 segon base

// Si falla la 1ª: espera 1 segon
// Si falla la 2ª: espera 2 segons  
// Si falla la 3ª: espera 4 segons
```

**Com funciona:**
- Detecta error de connexió (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- Intenta fins a 3 vegades
- Cada intent espera el doble de temps (backoff exponencial)
- Màxim d'espera: 10 segons

**Avantatges:**
- 🚀 Recuperació automàtica de fallades temporals
- 💻 Mitiga pics de tràfic amb backoff
- ⚡ No bloqueig de la UI

---

### 2. **Cache de Resultats**

**Ubicació**: `src/languageTool.ts`

```typescript
private cache: Map<string, CacheEntry> = new Map();
private readonly CACHE_TTL = 60000; // 1 minut

interface CacheEntry {
    result: LanguageToolMatch[];
    timestamp: number;
}
```

**Com funciona:**
- Emmagatzema resultats de les últimes comprovacions
- Vàlid durant 1 minut
- Si connexió falla i tenim caché: retorna caché automàticament
- Si connexió és offline 3+ temps: usa caché indefinidament

**Avantatges:**
- 📱 Funciona offline als documents recents
- ⚡ Respuesta instantànea per textos repetits
- 💾 Menys tràfic de xarxa

---

### 3. **Monitorització d'Estat de Connexió**

**Ubicació**: `src/languageTool.ts`

```typescript
private isOnline: boolean = true;
private lastErrorTime: number = 0;
private consecutiveErrors: number = 0;

public getConnectionStatus(): { online: boolean; errorCount: number } {
    return {
        online: this.isOnline,
        errorCount: this.consecutiveErrors
    };
}
```

**Estados**:
- `online: true, errorCount: 0` → Connectat ✅
- `online: true, errorCount: 1-2` → Intentant reconectar 🔄
- `online: false, errorCount: 3+` → Offline mode 🔌

---

### 4. **Indicador Visual en el Panell**

**Ubicació**: `src/errorsPanel.ts` (webview)

**Estats visuals:**

1. **Connectat** (no es mostra)
   - Verd pulsant quan es detecten errors d'API (normalitat)

2. **Intentant Reconectar** 🟡 (pulsant)
   - Mostrat quan errorCount = 1-2
   - Text: "Intentant reconectar... (1)", "Intentant reconectar... (2)"

3. **Offline Mode** 🔴
   - Mostrat quan errorCount > 2
   - Text: "⚠️ Sense connexió. Usant caché."

**Ubicació en la UI:**
- A sota del títol "Corrector Català"
- No ocupa espai si tot va bé
- Es mostra/amaga automàticament

---

### 5. **Notificacions Intel·ligents (sense spam)**

**Ubicació**: `src/checker.ts`

```typescript
private lastErrorShown: Map<string, number> = new Map();
private readonly ERROR_POPUP_COOLDOWN = 30000; // 30 segons

private handleCheckError(error: any, uri: vscode.Uri) {
    const errorKey = `${uri.toString()}_${error.message}`;
    const lastShown = this.lastErrorShown.get(errorKey) || 0;
    const now = Date.now();

    // No mostrar si fa menys de 30 segons que es va mostrar
    if (now - lastShown < this.ERROR_POPUP_COOLDOWN) {
        console.warn('SoftCatalà Error (silenciat):', error.message);
        return;
    }
}
```

**Funcionament:**
- Primer error: mostra notification (no modal popup)
- Errors repetits: ignorats durant 30 segons
- Botó "Detalls": ofereix més informació

**Avantatges:**
- 🤐 Sense spam de popups
- 📊 Segueix els errors al log de consola
- 👤 L'usuari pot veure el panell lateral per a info en temps real

---

## 🎯 Casos d'Ús

### Scenario 1: Connexió a Internet Cau

**Timeline:**
```
t=0s:   Primer error detectat → Reintentar
t=1s:   Segon intent falla → Reintentar
t=3s:   Tercer intent falla → Cache activat
t=5s:   Panell mostra: "⚠️ Sense connexió. Usant caché."
        Usuari veu errors anteriors (del caché)
        
t=60s:  Connexió restaurada → Es reseteja comptador
t=61s:  Nou check normal → API disponible
```

### Scenario 2: Connexió Lenta

**Timeline:**
```
t=0s:   API lenta (10 segons)
t=10s:  Respuesta (èxit)
t=11s:  Siguiente check (molt ràpid, del caché)
t=40s:  Check normal (caché expirat)
t=50s:  Respuesta
```

### Scenario 3: Usuari Escrivint Ràpidament

**Timeline:**
```
t=0s:   Primer check progr. (retard 500ms)
t=0.5s: Check 1 executat
t=1s:   Usuari continua → Nou check progr.
t=1.5s: Check 2 executat (caché per a textos iguals)
t=2s:   Usuari continua → Nou check progr.
t=2.5s: Check 3 (sense errors de connexió)
```

---

## 👁️ Experiència d'Usuari

### Abans (0.1.0)
```
Usuari escrivint → Error de connexió → POPUP MODAL
                                    ↓
Usuari intenta escriure → Altre error → POPUP MODAL (DE NOU)
                                    ↓
Usuari frustrat, tanca l'extensió
```

### Després (0.2.0+)
```
Usuari escrivint → Error de connexió (silenciat, log)
                                    ↓
Panell mostra: "⚠️ Sense connexió. Usant caché"
                                    ↓
Usuari veu errors anteriors, continua fent clic
                                    ↓
Connexió restaurada → "✓ Connectat"
                                    ↓
Usuari feliç, segueix usant
```

---

## 📈 Configuració (opcional)

A futurs versions, es podria exposar aquests paràmetres a la configuració:

```json
{
  "catala.networkRetries": 3,
  "catala.retryDelay": 1000,
  "catala.cacheTimeout": 60000,
  "catala.errorPopupCooldown": 30000,
  "catala.showConnectionStatus": true
}
```

---

## 🧪 Tests Manuals Recomanats

### Test 1: Fallada de Connexió
```bash
# Desactiva internet mentre l'extensió està activa
# 1. Escriu codi/text
# 2. Observa que no hi ha popup
# 3. Observa el panell: "⚠️ Sense connexió. Usant caché"
# 4. Reactiva internet
# 5. Observa que desapareix l'avís
```

### Test 2: Mode Offline (local)
```bash
# Configura a mode local (LanguageTool)
# 1. Apaga el servidor local
# 2. Escriu codi
# 3. Observa reintentos (3 vegades)
# 4. Panell mostra offline
# 5. Inicia el servidor local
# 6. Els errors es detecten de nou
```

### Test 3: Cache
```bash
# 1. Escriu codi amb error
# 2. Es detecta i es mostra
# 3. Desactiva internet
# 4. Canvia la línia (text idèntic amb error)
# 5. Observa que es mostra l'error (del caché)
# 6. Reactiva internet
```

---

## 📝 Changelog per v0.2.0

```
## [0.2.0] - 2025-11-11

### Afegit
- **Gestió robusta de connexió**:
  - Reintentos automàtics amb backoff exponencial (3 vegades)
  - Cache de resultats (1 minut TTL)
  - Monitorització d'estat de connexió
  - Indicador visual en el panell lateral
  - Notificacions inteligents sense spam

- **Suport per a formes verbals**:
  - Paràmetre `catala.verbForms` (central/valenciana/balear)

### Millores
- Experiència de usuari millorada en connexions inestables
- Funció offline parcial (usa caché)
- Mensages d'error més útils

### Fixes
- Evita popups repetits amb throttling
- Recuperació automàtica de fallades temporals
```

---

## 🔮 Millores Futures

1. **Fallback a mode local automàtic**
   - Si API falla 5 vegades, suggerir mode local

2. **Estadístiques de connexió**
   - Dashboard amb uptime, latència, etc.

3. **Configuració de reintentos**
   - Deixar usuari personalitzar retries i delays

4. **Sincronització offline**
   - Guardar errors offline, sincronitzar quan online

5. **Monitorització remota**
   - Telemetria opcional d'errors de connexió

---

**Data**: 11/11/2025
**Versió**: 0.2.0+
**Status**: ✅ Implementat i compilat
