# Guia de Formes Verbals

## Visió General

L'extensió SoftCatalà per a VSCode suporta tres principals variants de formes verbals en català, que corresponen als diferents dialects i normatives del català.

---

## 🎯 Disponible a la Configuració

Paràmetre: `catala.verbForms`

```json
{
  "catala.verbForms": "central"  // "central" | "valenciana" | "balear"
}
```

---

## 📍 Formes Verbals per Variant

### 1. **Central** (Per Defecte)

**Variant**: Català estàndard (IEC)
**Códi**: `central`
**Aplicable a**: Dues Valls, Osona, Bages, Moianès, etc.

#### Característiques
- Formes verbals segons l'**Institut d'Estudis Catalans (IEC)**
- La variant de referència a la majoria de documents oficials
- Recomana per a ús general

#### Exemples de Formes
| Infinitiu | Present | Imperfet | Perfet |
|-----------|---------|----------|--------|
| cantar | cant | cantava | he cantat |
| vendre | vend | venía | he venut |
| partir | part | partía | he partit |

#### Quan utilitzar
- 📚 Documentació oficial i acadèmica
- 🏢 Projectes corporatius
- 📝 Textos formals
- 🎓 Entorno educatiu

---

### 2. **Valenciana**

**Variant**: Norms de l'AVL (Acadèmia Valenciana de la Llengua)
**Códi**: `valenciana`
**Aplicable a**: País Valencià, Castelló, Alacant, Alicant

#### Característiques
- Formes verbals segons l'**Acadèmia Valenciana de la Llengua (AVL)**
- Diferències notables en temps compostos i condicionals
- Recomana per a ús a la regió de la Comunitat Valenciana

#### Exemples de Diferències
| Infinitiu | Central | Valenciano |
|-----------|---------|-----------|
| cantar | he cantat | he cantat |
| vendre | he venut | he venut |
| partir | he partit | he partit |
| anar | vam anar | varem anar |
| dir | vaig dir | varem dir |

#### Particularitats
- 🔹 Preferència per formes com "varem" (central: "vaig")
- 🔹 Variants en formes de passat perifràstic
- 🔹 Conservació d'algunes formes arcaiques

#### Quan utilitzar
- 🏛️ Documents en Context Valenciano
- 👥 Comunicació amb comunitats valencianes
- 📢 Campanya o projectes per a la Comunitat Valenciana

---

### 3. **Balear**

**Variant**: Norms de les Illes Balears
**Códi**: `balear`
**Aplicable a**: Mallorca, Menorca, Eivissa, Formentera

#### Característiques
- Formes verbals específiques de les Illes Balears
- Conserva traits dialectals tradicionals
- Recomana per a ús a l'arxipèlag balear

#### Exemples de Diferències
| Infinitiu | Central | Balear |
|-----------|---------|--------|
| cantar | he cantat | he cantat |
| vendre | he venut | he venut |
| anar | vaig anar | vaig anar |
| veure | he vist | he vist |

#### Particularitats
- 🔹 Manteniment de diptongacions
- 🔹 Conservació d'alguns arcaismes
- 🔹 Variants en el vosaltres

#### Quan utilitzar
- 🏖️ Documents relacionats amb les Illes Balears
- 🎭 Comunicació cultural balear
- 🌴 Projectes locals de les illes

---

## 🔄 Comparativa de Les Tres Variants

### Taula Comparativa

```
INFINITIU: cantar

Central    | vaig cantar    | vaig cantar | he cantat
Valenciana | varem cantar   | vaig cantar | he cantat
Balear     | vaig cantar    | vaig cantar | he cantat

INFINITIU: anar

Central    | vaig anar      | veia anar   | vaig anar (perfecte perifràstic)
Valenciana | varem anar     | veia anar   | vaig anar
Balear     | vaig anar      | veia anar   | vaig anar
```

---

## ⚙️ Com Canviar la Configuració

### Opció 1: Configuració d'Usuari Global

**Fitxer**: `~/.config/Code/User/settings.json` (Linux/Mac) o `%APPDATA%\Code\User\settings.json` (Windows)

```json
{
  "catala.verbForms": "valenciana"
}
```

### Opció 2: Configuració del Projecte

**Fitxer**: `.vscode/settings.json` a la carpeta del projecte

```json
{
  "catala.verbForms": "balear"
}
```

### Opció 3: Interfície de VSCode

1. Ves a **File** > **Preferences** > **Settings** (o `Ctrl+,` / `Cmd+,`)
2. Busca `catala.verbForms`
3. Selecciona la variant desitjada

---

## 📊 Efecte de Les Formes Verbals

### Exemples d'Errors Detectats Segons La Variant

#### Ús Central
```javascript
// ✅ Detecta correctament
// Vaig arribar a casa

// ❌ Marca com a error
// Varem arribar a casa (form valenciana)
```

#### Ús Valenciana
```javascript
// ✅ Detecta correctament
// Varem arribar a casa

// ❌ Marca com a error (potencial)
// Vaig arribar a casa (considerada central)
```

---

## 💡 Recomanacions

### Per Projectes Multiregionals
Si treballes amb textos de múltiples regions:

```json
{
  "catala.verbForms": "central"  // Utilitza sempre la variant central
}
```

### Per Projectes Locals
Si treballes només en una regió:

```json
{
  "catala.verbForms": "valenciana"  // O "balear"
}
```

### Per a Equips Distribuïts
Defineix la configuració per projecte a `.vscode/settings.json`:

```json
{
  "catala.verbForms": "valenciana",
  "catala.language": "ca-ES-valencia",
  "catala.checkCommentsOnly": true
}
```

---

## ⚠️ Limitacions Actuals

- ✋ **Mode Offline**: En mode LanguageTool local, el paràmetre `verbForms` no s'utilitza (sempre usa central)
- ✋ **Compatibilitat**: Depèn de l'API de SoftCatalà, que ha d'estar actualitzada amb suport per a la variant

---

## 🔗 Referències

### Normatives Oficials

1. **IEC (Institut d'Estudis Catalans)**
   - [IEC - Norms de Gramàtica Valenciana](https://www.iec.cat/)
   - Referència per a formes centrals

2. **AVL (Acadèmia Valenciana de la Llengua)**
   - [AVL - Ortografia de la Llengua Valenciana](https://www.avl.gva.es/)
   - Referència per a formes valencianes

3. **Institut de Estudis Baleàrics**
   - [IEB - Els Treballs de Baleari](https://www.iebalears.org/)
   - Referència per a formes balears

### Recursos Útils

- [SoftCatalà - Projecte de Verificació](https://www.softcatala.org/)
- [LanguageTool - Suport per a Català](https://languagetool.org/)
- [Diccionari Sinonims](https://www.sinonims.cat/)

---

## 📞 Suport

Si tens dubtes sobre les formes verbals:

1. **GitHub Issues**: Reporta a [Repositori](https://github.com/your-username/catala-softcatala/issues)
2. **SoftCatalà Community**: Pregunta a [Mailing List](https://lists.softcatala.org/)
3. **Documentació Oficial**: Consulta els recursos d'IEC, AVL o IEB

---

**Última actualització**: 11/11/2025
