#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LANGUAGETOOL_VERSION = '6.0';
const OUTPUT_DIR = path.join(__dirname, '..', 'languagetool');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'languagetool-server.jar');

// Crear directori si no existeix
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Comprovar si ja està descarregat
if (fs.existsSync(OUTPUT_FILE)) {
    console.log('LanguageTool ja està descarregat.');
    process.exit(0);
}

console.log('Descarregant LanguageTool ' + LANGUAGETOOL_VERSION + '...');

// URL de descàrrega d'LanguageTool
const downloadUrl = `https://languagetool.org/download/LanguageTool-${LANGUAGETOOL_VERSION}.zip`;
const zipFile = path.join(OUTPUT_DIR, 'languagetool.zip');

// Descarregar
const file = fs.createWriteStream(zipFile);
https.get(downloadUrl, (response) => {
    if (response.statusCode !== 200) {
        console.error('Error: ' + response.statusCode);
        process.exit(1);
    }

    response.pipe(file);

    file.on('finish', () => {
        file.close();
        console.log('Descarregar completat. Descomprimint...');

        try {
            // Descomprimir
            execSync(`unzip -q "${zipFile}" -d "${OUTPUT_DIR}"`, { stdio: 'inherit' });

            // Buscar el JAR
            const entries = fs.readdirSync(OUTPUT_DIR);
            const extracted = entries.find(e => e.startsWith('LanguageTool-'));

            if (extracted) {
                const extractedPath = path.join(OUTPUT_DIR, extracted);
                const jarPath = path.join(extractedPath, 'languagetool-server.jar');

                if (fs.existsSync(jarPath)) {
                    fs.copyFileSync(jarPath, OUTPUT_FILE);
                    console.log('✓ LanguageTool incrustado correctament a ' + OUTPUT_FILE);
                } else {
                    console.error('Error: No s\'ha trobat languagetool-server.jar');
                    process.exit(1);
                }
            }

            // Netejar
            fs.unlinkSync(zipFile);
            if (extracted) {
                execSync(`rm -rf "${path.join(OUTPUT_DIR, extracted)}"`, { stdio: 'ignore' });
            }

            console.log('✓ Instal·lació completada!');
        } catch (error) {
            console.error('Error al descomprimir:', error.message);
            process.exit(1);
        }
    });

    file.on('error', (error) => {
        fs.unlink(zipFile, () => {});
        console.error('Error de descàrrega:', error.message);
        process.exit(1);
    });
}).on('error', (error) => {
    console.error('Error de connexió:', error.message);
    process.exit(1);
});
