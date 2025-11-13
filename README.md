# Català - Corrector SoftCatalà per a VSCode

Extensió de Visual Studio Code per a la correcció ortogràfica i gramatical de textos en català utilitzant l'API de [SoftCatalà](https://www.softcatala.org/) basada en LanguageTool.

### Enllaç MarketPlace:
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mainlab.catala-softcatala)

## Característiques

✨ **Mode de correcció de comentaris** (activat per defecte): Corregeix automàticament els comentaris del codi en diferents llenguatges de programació
- Suporta JavaScript, TypeScript, Python, Java, C/C++, Go, Rust, PHP, Ruby, i molts més
- Detecta comentaris de línia (`//`, `#`) i de bloc (`/* */`, `""" """`)
- Ideal per a desenvolupadors que volen escriure comentaris en català correctament

📝 **Correcció de text complet**: També pots utilitzar-la per a documents de text, markdown, LaTeX, etc.

🌐 **Flexible**: Utilitza l'API de SoftCatalà (online) o un servidor LanguageTool local

🇪🇸 **Suport per a variants**: Català general i valencià

## Requisits

- Visual Studio Code 1.80.0 o superior
- Connexió a internet (per utilitzar l'API de SoftCatalà en mode online)
- **LanguageTool ve inclòs** en el paquet de l'extensió (~100MB) per a ús offline

## Instal·lació

1. Obre Visual Studio Code
2. Ves a Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Cerca "Català SoftCatalà"
4. Fes clic a "Install"

## Configuració

L'extensió funciona directament després de la instal·lació amb la configuració per defecte. Pots personalitzar-la a la configuració de VSCode:

### Opcions disponibles

- **Mode del servidor** (`catala.serverMode`):
  - `softcatala` (per defecte): Utilitza l'API de SoftCatalà
  - `local`: Utilitza un servidor LanguageTool local

- **Correcció només de comentaris** (`catala.checkCommentsOnly`):
  - `true` (per defecte): Només corregeix comentaris en fitxers de codi
  - `false`: Corregeix tot el document

- **Variant del català** (`catala.language`):
  - `ca-ES` (per defecte): Català general
  - `ca-ES-valencia`: Valencià

- **Formes verbals** (`catala.verbForms`):
  - `central` (per defecte): Formes verbals centrals (estàndard)
  - `valenciana`: Formes verbals valencianes
  - `balear`: Formes verbals balears
  - ⚠️ Només funciona en mode SoftCatalà (online)

- **Deshabilitar majúscules de principi de frase** (`catala.disableCapitalization`):
  - `false` (per defecte): Mostra errors de majúscules de principi de frase
  - `true`: Deshabilita els errors de capitalització (UPPERCASE_SENTENCE_START)

- **Comprovació automàtica** (`catala.autoCheck`):
  - `true` (per defecte): Comprova mentre escrius
  - `false`: Només comprova manualment

- **Retard de comprovació** (`catala.checkDelay`):
  - Valor en mil·lisegons (per defecte: 500)
  - Temps d'espera abans de comprovar el text per evitar masses peticions

- **Llenguatges de codi** (`catala.codeLanguages`):
  - Llista de llenguatges on aplicar la correcció de comentaris

- **Llenguatges de text** (`catala.enabledLanguages`):
  - Llista de llenguatges on comprovar tot el document (plaintext, markdown, latex per defecte)

### Exemple de configuració

```json
{
  "catala.serverMode": "softcatala",
  "catala.checkCommentsOnly": true,
  "catala.language": "ca-ES",
  "catala.verbForms": "central",
  "catala.autoCheck": true,
  "catala.checkDelay": 500
}
```

## Ús

### Mode automàtic (per defecte)

L'extensió comprovarà automàticament el text mentre escrius:
- En fitxers de codi: només els comentaris
- En fitxers de text: tot el document

### Panell Lateral

L'extensió mostra un panell lateral "Corrector Català" a VSCode amb les següents funcionalitats:

**Botons d'Activació:**
- **🌐 ONLINE (SoftCatalà)**: Activa el corrector en mode online (recomanat)
- **📦 OFFLINE (Local)**: Activa el corrector en mode offline amb LanguageTool local
- **⏸ PAUSAR**: Pausa el corrector (es mostren els botons d'activació quan està pausat)

**Activació Automàtica:**
- Quan obris el panell lateral i activis el corrector, l'extensió **verifica automàticament tot el document obert**
- Mostra un missatge de "Comprovant..." mentre escaneja tots els comentaris
- Un cop finalitzada la verificació, mostra tots els errors detectats

**Secció de Configuració:**
- Dropdown per canviar les formes verbals (Central, Valenciana, Balear)
- Checkbox per deshabilitar les correccions de majúscules de principi de frase
- Els canvis de configuració triguen una re-verificació automàtica del document
- Botó ⚙️ per accedir a la configuració avançada:
  - Informació del creador i enllaços
  - Informació de la versió
  - **🗑️ Eliminar LanguageTool local**: Allibera ~100MB d'espai (deshabilita permanentment el mode offline)

**Secció d'Errors:**
- Llista de tots els errors detectats
- Número de línia per a cada error
- Missatge d'error en català
- Suggestions de correccions amb botons per aplicar-les
- Butó per anar a la posició de l'error

**Indicador de Connexió:**
- 🟢 Verde: Connexió activa
- 🟡 Taronja: Intent de reconexió (amb contador de reintentos)
- 🔴 Roig: Sense connexió
  - Mostra caché anterior si disponible
  - Botó "Canviar a Mode Offline" per activar mode local sense errors

### Comandes disponibles

- **Català: Comprova el document**: Comprova manualment el document actual
- **Català: Neteja els diagnòstics**: Elimina tots els avisos de correcció

Pots accedir a les comandes amb `Ctrl+Shift+P` / `Cmd+Shift+P` i cercant "Català".

## Exemple d'ús amb codi

```javascript
// Aquest és un comentary amb una falta (es detectarà!)
function saludar() {
    // Funció per a saludar en catala (també es detectarà si hi ha errors)
    return "Hola món!";
}
```

## Formes Verbals

L'extensió suporta les tres principals variants de formes verbals en català:

- **Central**: Formes verbals estàndard (IEC) - es recomana per a ús general
- **Valenciana**: Formes verbals segons les normes de l'AVL (Acadèmia Valenciana de la Llengua)
- **Balear**: Formes verbals segons les normes de les Illes Balears

Pots canviar la variant a la configuració:

```json
{
  "catala.verbForms": "central"  // o "valenciana" o "balear"
}
```

⚠️ **Nota**: Aquesta opció només funciona en mode SoftCatalà (online). En mode local (LanguageTool), sempre utilitza formes centrals.

## Mode Offline amb LanguageTool

L'extensió **ja inclou LanguageTool** (~100MB) en el seu paquet, així que pots utilitzar el mode offline sense haver de descarregar res addicional:

1. Obre el panell lateral "Corrector Català"
2. Fes clic al botó **📦 OFFLINE (Local)**
3. L'extensió iniciarà automàticament el servidor LanguageTool local inclòs

**Nota**: El mode offline utilitza el servidor LanguageTool inclòs en l'extensió. Si l'has eliminat prèviament, necessitaràs reinstal·lar l'extensió per recuperar-lo.

**Alliberar espai:**
- Si necessites alliberar espai (~100MB), pots eliminar LanguageTool des de la configuració del panell lateral (botó ⚙️ → Emmagatzematge → Eliminar LanguageTool local)
- **Atenció**: Això deshabilita permanentment el mode offline. Per recuperar-lo, cal reinstal·lar l'extensió completa.

## Privacitat

- **Mode Online (API SoftCatalà)**: El text s'envia a l'API de SoftCatalà per a la comprovació. SoftCatalà no emmagatzema els textos, només dades estadístiques anonimitzades.
- **Mode Offline (LanguageTool local)**: Tot el processament es fa localment al teu ordinador. LanguageTool ve inclòs en el paquet de l'extensió.

## Problemes coneguts

- La detecció de comentaris en alguns llenguatges menys comuns pot no funcionar perfectament
- Els comentaris molt llargs poden trigar més a comprovar-se

## Contribucions

Les contribucions són benvingudes! Si trobes un error o vols afegir una funcionalitat:

1. Fes un fork del repositori
2. Crea una branca per a la teva funcionalitat
3. Envia un pull request

## Llicència

MIT License - Consulta el fitxer [LICENSE](LICENSE) per a més detalls.

## Agraïments

- [SoftCatalà](https://www.softcatala.org/) per proporcionar l'API de correcció
- [LanguageTool](https://languagetool.org/) pel motor de correcció
- La comunitat de Visual Studio Code

## Enllaços

- [GitHub Repository](https://github.com/jaumesaa/SoftCatal-4VSCode)
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mainlab.catala-softcatala)
- [SoftCatalà](https://www.softcatala.org/)
- [Reportar un problema](https://github.com/jaumesaa/SoftCatal-4VSCode/issues)

---

Fet amb ❤️ per a la comunitat catalana
