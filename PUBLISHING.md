# Guia de publicació

Aquest document explica com publicar l'extensió al Visual Studio Code Marketplace.

## Prerequisits

1. **Compte de Microsoft/Azure**: Necessites un compte de Microsoft per crear un editor al marketplace.

2. **Visual Studio Marketplace Publisher**: Has de crear un publisher a https://marketplace.visualstudio.com/manage

3. **Personal Access Token (PAT)**: Necessites un token d'accés personal d'Azure DevOps amb els permisos adequats.

## Passos per crear un Publisher

1. Ves a https://marketplace.visualstudio.com/manage
2. Inicia sessió amb el teu compte de Microsoft
3. Fes clic a "Create publisher"
4. Omple el formulari:
   - **ID**: Un identificador únic (ex: `jaumesampolalcover`)
   - **Display name**: Nom que es mostrarà (ex: `Jaume Sampol`)
   - **Description**: Una breu descripció sobre tu

## Configuració abans de publicar

### 1. Actualitza el package.json

Obre `package.json` i actualitza aquests camps:

```json
{
  "publisher": "el-teu-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/el-teu-usuari/catala-softcatala"
  }
}
```

### 2. Crea un icó per a l'extensió

L'extensió necessita un icó en format PNG (128x128 píxels). Pots crear-lo amb:
- Eines online com Canva, Figma
- Programes com GIMP, Photoshop
- Generar-lo amb IA

Guarda l'icó com `images/icon.png` (ja està configurat al package.json).

**Suggerències per a l'icó:**
- Icó simple amb les lletres "CA" o "CAT"
- Colors representatius del català (groc i vermell, o blau i vermell)
- Fons sòlid o amb degradat subtil

### 3. Crea un repositori Git (opcional però recomanat)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/el-teu-usuari/catala-softcatala.git
git push -u origin main
```

## Obtenir un Personal Access Token (PAT)

1. Ves a https://dev.azure.com/
2. Fes clic a l'icona d'usuari (dalt a la dreta) > "Personal access tokens"
3. Fes clic a "+ New Token"
4. Configura el token:
   - **Name**: VSCode Extension Publishing
   - **Organization**: All accessible organizations
   - **Expiration**: 90 dies (o el que prefereixis)
   - **Scopes**: Selecciona "Custom defined" i marca:
     - **Marketplace**: Manage
5. Fes clic a "Create"
6. **IMPORTANT**: Copia el token i guarda'l en un lloc segur (només es mostra una vegada)

## Publicar l'extensió

### Opció 1: Amb vsce (recomanat)

```bash
# Instal·la vsce si no ho has fet
npm install -g @vscode/vsce

# Login amb el teu publisher
vsce login el-teu-publisher-id
# Enganxa el teu PAT quan t'ho demani

# Empaqueta l'extensió (opcional, per provar)
vsce package

# Publica l'extensió
vsce publish
```

### Opció 2: Manual

```bash
# Crea el paquet .vsix
vsce package

# Puja'l manualment a https://marketplace.visualstudio.com/manage
```

## Actualitzar l'extensió

Quan vulguis publicar una nova versió:

1. Actualitza el `CHANGELOG.md` amb els canvis
2. Incrementa la versió al `package.json`:
   ```bash
   # Incrementa la versió patch (0.1.0 -> 0.1.1)
   npm version patch

   # O incrementa la versió minor (0.1.0 -> 0.2.0)
   npm version minor

   # O incrementa la versió major (0.1.0 -> 1.0.0)
   npm version major
   ```
3. Compila i publica:
   ```bash
   npm run compile
   vsce publish
   ```

## Verificació abans de publicar

Assegura't que:

- [ ] Has provat l'extensió localment (F5 a VSCode)
- [ ] El `package.json` té tota la informació correcta
- [ ] El `README.md` està complet i sense errors
- [ ] Has creat un icó `images/icon.png`
- [ ] El `CHANGELOG.md` està actualitzat
- [ ] El codi compila sense errors (`npm run compile`)
- [ ] No hi ha fitxers innecessaris (comprovant `.vscodeignore`)

## Provar localment abans de publicar

```bash
# Compila el projecte
npm run compile

# Prem F5 a VSCode per obrir una nova finestra amb l'extensió carregada
# O des del terminal:
code --extensionDevelopmentPath=.

# Prova les funcionalitats:
# 1. Obre un fitxer .js o .py
# 2. Escriu un comentari en català amb una falta
# 3. Verifica que es detecta l'error
```

## Instal·lar localment des del .vsix

```bash
# Crea el paquet
vsce package

# Instal·la localment
code --install-extension catala-softcatala-0.1.0.vsix
```

## Recursos addicionals

- [Documentació oficial de VSCode Extensions](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#extension-marketplace)

## Solució de problemes

### Error: "Publisher not found"
- Verifica que has creat el publisher a https://marketplace.visualstudio.com/manage
- Assegura't que el nom del publisher al `package.json` coincideix exactament

### Error: "Personal Access Token is invalid"
- El token pot haver caducat
- Crea un nou token amb els permisos correctes (Marketplace > Manage)

### L'icó no es mostra
- Verifica que `images/icon.png` existeix
- Comprova que la mida és 128x128 píxels
- Assegura't que el camí al `package.json` és correcte

## Suport

Si tens problemes, pots:
- Consultar la [documentació oficial](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- Preguntar a [Stack Overflow](https://stackoverflow.com/questions/tagged/vscode-extensions)
- Obrir un issue al repositori del projecte
