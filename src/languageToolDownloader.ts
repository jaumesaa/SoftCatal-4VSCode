import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { execSync, spawn } from 'child_process';

export class LanguageToolDownloader {
    private static readonly LANGUAGETOOL_VERSION = '6.0';
    private static readonly DOWNLOAD_URL = `https://languagetool.org/download/LanguageTool-6.0.zip`;
    private static readonly JAR_NAME = 'languagetool-server.jar';

    /**
     * Asegura que LanguageTool está disponible, buscando primero en extensionPath (bundled)
     * y copiándolo a globalStoragePath si es necesario, o descargándolo si no está en ningún lado
     */
    public static async ensureAvailable(extensionPath: string, globalStoragePath: string): Promise<void> {
        // Primero verificar si ya está en globalStorage (descargado anteriormente)
        if (this.isDownloaded(globalStoragePath)) {
            console.log('SoftCatalà: ✅ LanguageTool ya disponible en globalStorage');
            return;
        }

        // Verificar si está bundled en la extensión
        const bundledPath = path.join(extensionPath, 'languagetool', 'LanguageTool-6.0');
        if (fs.existsSync(bundledPath)) {
            const serverJarPath = path.join(bundledPath, this.JAR_NAME);
            const libsPath = path.join(bundledPath, 'libs');
            
            if (fs.existsSync(serverJarPath) && fs.existsSync(libsPath)) {
                console.log('SoftCatalà: ✅ LanguageTool encontrado en extensión, copiando a globalStorage...');
                try {
                    await this.copyLanguageToolToGlobalStorage(bundledPath, globalStoragePath);
                    console.log('SoftCatalà: ✅ LanguageTool copiado correctamente a globalStorage');
                    return;
                } catch (error) {
                    console.error('SoftCatalà: Error copiando LanguageTool:', error);
                    // Continuar para intentar descarga si la copia falla
                }
            }
        }

        // Si no está bundled ni descargado, ofrecer descarga
        console.log('SoftCatalà: LanguageTool no encontrado, ofreciendo descarga...');
        const choice = await vscode.window.showInformationMessage(
            'LanguageTool local no está disponible. ¿Quieres descargarlo (~100MB) para corrección offline?',
            'Descargar',
            'Ignorar'
        );

        if (choice === 'Descargar') {
            try {
                await this.ensureDownloaded(globalStoragePath);
            } catch (err) {
                console.error('SoftCatalà: Error descargando LanguageTool:', err);
                vscode.window.showErrorMessage('No se pudo descargar LanguageTool. Revisa la consola para más detalles.');
            }
        }
    }

    /**
     * Copia LanguageTool del bundle de la extensión a globalStorage
     */
    private static async copyLanguageToolToGlobalStorage(bundledPath: string, globalStoragePath: string): Promise<void> {
        const outputDir = path.join(globalStoragePath, 'languagetool', 'LanguageTool-6.0');
        
        // Crear directorios
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Copiar recursivamente
        await this.copyDirectoryRecursive(bundledPath, outputDir);
    }

    /**
     * Copia un directorio recursivamente
     */
    private static async copyDirectoryRecursive(source: string, destination: string): Promise<void> {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const entries = fs.readdirSync(source, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectoryRecursive(sourcePath, destPath);
            } else {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }

    /**
     * Detecta si LanguageTool está descargado y es válido
     */
    public static isDownloaded(extensionPath: string): boolean {
        // extensionPath aquí es context.globalStoragePath (ruta de almacenamiento persistente)
        const outputDir = path.join(extensionPath, 'languagetool');
        
        console.log('SoftCatalà: Verificando si LanguageTool está descargado en:', outputDir);
        
        // Verificar que existe la carpeta languagetool
        if (!fs.existsSync(outputDir)) {
            console.log('SoftCatalà: ❌ Carpeta languagetool no existe');
            return false;
        }

        // Verificar que existe la carpeta LanguageTool-X.X
        try {
            const entries = fs.readdirSync(outputDir);
            console.log('SoftCatalà: Contenido de carpeta languagetool:', entries);
            
            const extracted = entries.find(e => e.startsWith('LanguageTool-'));
            
            if (!extracted) {
                console.log('SoftCatalà: ❌ No se encontró carpeta LanguageTool extraída');
                return false;
            }

            const extractedPath = path.join(outputDir, extracted);
            const libsPath = path.join(extractedPath, 'libs');
            const serverJarPath = path.join(extractedPath, 'languagetool-server.jar');

            console.log('SoftCatalà: Verificando estructura en:', extractedPath);
            console.log('SoftCatalà:   - serverJarPath existe:', fs.existsSync(serverJarPath));
            console.log('SoftCatalà:   - libsPath existe:', fs.existsSync(libsPath));

            // Verificar que existen ambos
            if (!fs.existsSync(libsPath) || !fs.existsSync(serverJarPath)) {
                console.log('SoftCatalà: ❌ Carpeta LanguageTool incompleta (falta libs o JAR)');
                return false;
            }

            // Verificar que hay archivos en libs
            const libsEntries = fs.readdirSync(libsPath);
            console.log(`SoftCatalà: Librerías encontradas: ${libsEntries.length}`);

            if (libsEntries.length === 0) {
                console.log('SoftCatalà: ❌ Carpeta libs vacía');
                return false;
            }

            // Verificar que existe slf4j
            const hasSlf4j = libsEntries.some(f => f.includes('slf4j'));
            if (!hasSlf4j) {
                console.log('SoftCatalà: ❌ No se encontró slf4j en libs (descarga corrupta)');
                return false;
            }

            console.log('SoftCatalà: ✅ LanguageTool válido y completo - NO necesita descargar');
            return true;
        } catch (error) {
            console.error('SoftCatalà: Error verificando LanguageTool:', error);
            return false;
        }
    }

    /**
     * Obté la ruta al JAR
     */
    public static getJarPath(extensionPath: string): string {
        // Retorna la ruta correcta: globalStoragePath/languagetool/LanguageTool-6.0/languagetool-server.jar
        return path.join(extensionPath, 'languagetool', 'LanguageTool-6.0', this.JAR_NAME);
    }

    /**
     * Descarga LanguageTool si no està descarregat
     */
    public static async ensureDownloaded(extensionPath: string): Promise<void> {
        if (this.isDownloaded(extensionPath)) {
            console.log('SoftCatalà: ✅ LanguageTool ja està descarregat - SALTANT descàrrega');
            return;
        }

        console.log('SoftCatalà: ⬇️ Detectant que LanguageTool no està descarregat. Iniciant descàrrega...');

        // Mostrar notificació al usuari
        const progress = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'SoftCatalà: Descarregant LanguageTool',
                cancellable: true
            },
            async (progressReporter, token) => {
                try {
                    await this.downloadAndExtract(extensionPath, (percent) => {
                        progressReporter.report({ increment: percent });
                    }, token);

                    vscode.window.showInformationMessage(
                        '✓ LanguageTool descarregat correctament. La correcció offline ja està disponible!'
                    );
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    if (errorMessage.includes('cancel')) {
                        vscode.window.showWarningMessage(
                            'Descàrrega de LanguageTool cancel·lada. Pots reintentar més tard.'
                        );
                    } else {
                        const action = await vscode.window.showErrorMessage(
                            `Error al descarregar LanguageTool: ${errorMessage}`,
                            'Reintentar',
                            'Descartar'
                        );

                        if (action === 'Reintentar') {
                            return this.ensureDownloaded(extensionPath);
                        }
                    }

                    throw error;
                }
            }
        );
    }

    private static async downloadAndExtract(
        extensionPath: string,
        onProgress: (percent: number) => void,
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {
        const outputDir = path.join(extensionPath, 'languagetool');
        const zipFile = path.join(outputDir, 'languagetool.zip');

        // Crear directori si no existeix
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        try {
            console.log('SoftCatalà: Descargando LanguageTool desde ' + this.DOWNLOAD_URL);
            
            // Descarregar LanguageTool
            await this.downloadFile(this.DOWNLOAD_URL, zipFile, onProgress, cancellationToken);

            if (cancellationToken.isCancellationRequested) {
                throw new Error('Descàrrega cancel·lada per l\'usuari');
            }

            onProgress(10); // 10% per descompressió
            console.log('SoftCatalà: Descomprimint LanguageTool...');

            // Descomprimir
            await this.extractZip(zipFile, outputDir);

            onProgress(20); // 20% per extracció

            // Validar que la estructura es correcta
            const jarPath = this.findAndCopyJar(outputDir);

            if (!jarPath) {
                throw new Error('Estructura de LanguageTool descarregada es incorrecta o incompleta');
            }

            onProgress(30); // 30% completat

            // Netejar arxius temporals (el ZIP)
            this.cleanupTemporaryFiles(outputDir);

            console.log('SoftCatalà: LanguageTool descarregat correctament');
        } catch (error) {
            console.error('SoftCatalà: Error en la descarga/extracció:', error);
            
            // Netejar en cas d'error
            if (fs.existsSync(zipFile)) {
                try {
                    fs.unlinkSync(zipFile);
                    console.log('SoftCatalà: Archivo ZIP parcial eliminado');
                } catch (e) {
                    // Ignorar
                }
            }
            throw error;
        }
    }

    private static async downloadFile(
        url: string,
        outputPath: string,
        onProgress: (percent: number) => void,
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let lastProgress = 0;

            const cancelListener = cancellationToken.onCancellationRequested(() => {
                cancelListener.dispose();
                reject(new Error('Descàrrega cancel·lada per l\'usuari'));
            });

            axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 600000 // 10 minuts timeout (más para descargas lentas)
            })
                .then((response) => {
                    const totalSize = parseInt(response.headers['content-length'], 10) || 0;
                    console.log(`SoftCatalà: Tamaño a descargar: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
                    
                    // Validar que el tamaño es razonable (mínimo 100MB para LanguageTool 6.0)
                    if (totalSize < 100 * 1024 * 1024) {
                        reject(new Error(`Tamaño de descarga sospechoso: ${(totalSize / 1024 / 1024).toFixed(2)} MB (esperado >100MB)`));
                        return;
                    }
                    
                    const file = fs.createWriteStream(outputPath);
                    let downloadedSize = 0;

                    response.data.on('data', (chunk: Buffer) => {
                        downloadedSize += chunk.length;
                        const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 80) : 0;

                        if (percent > lastProgress && percent % 10 === 0) {
                            console.log(`SoftCatalà: Descarga ${percent}%...`);
                            lastProgress = percent;
                        }
                        
                        onProgress(percent);
                    });

                    response.data.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        cancelListener.dispose();
                        
                        // Verificar que el archivo descargado tiene el tamaño correcto
                        try {
                            const stats = fs.statSync(outputPath);
                            if (stats.size !== totalSize) {
                                console.error(`SoftCatalà: Error de descarga - tamaño incorrecto. Esperado: ${totalSize}, Obtenido: ${stats.size}`);
                                reject(new Error(`Descarga incompleta. Tamaño esperado: ${totalSize}, obtenido: ${stats.size}`));
                                return;
                            }
                            console.log('SoftCatalà: Descarga completada correctamente');
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });

                    file.on('error', (error) => {
                        cancelListener.dispose();
                        fs.unlink(outputPath, () => {});
                        reject(error);
                    });
                })
                .catch((error) => {
                    cancelListener.dispose();
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }

                    if (error.code === 'ECONNABORTED') {
                        reject(new Error('Timeout en la descàrrega (connexió molt lenta)'));
                    } else if (error.response?.status === 404) {
                        reject(new Error('Versió de LanguageTool no disponible (404)'));
                    } else {
                        reject(new Error(`Error de descàrrega: ${error.message}`));
                    }
                });
        });
    }

    private static async extractZip(zipFile: string, outputDir: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Detectar SO i usar comando apropiat
                const isWindows = process.platform === 'win32';

                console.log(`SoftCatalà: Descomprimiendo en ${isWindows ? 'Windows' : 'Unix-like'} desde: ${zipFile}`);

                if (isWindows) {
                    // Usar PowerShell en Windows con Force para overwrite
                    execSync(
                        `powershell -NoProfile -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${outputDir}' -Force"`,
                        { stdio: 'pipe', shell: 'powershell.exe' }
                    );
                } else {
                    // Usar unzip en macOS/Linux con -o para overwrite sin preguntar
                    // -q: quiet mode (sin output verbose)
                    // -o: overwrite existing files sin pedir confirmación
                    execSync(`unzip -q -o "${zipFile}" -d "${outputDir}"`, { stdio: 'pipe' });
                }

                console.log('SoftCatalà: Descompresión completada');
                resolve();
            } catch (error) {
                reject(new Error(`Error al descomprimir: ${(error as Error).message}`));
            }
        });
    }

    private static findAndCopyJar(outputDir: string): string | null {
        try {
            const entries = fs.readdirSync(outputDir);
            console.log('SoftCatalà: Contenido de la carpeta de descarga:', entries);
            
            // Buscar la carpeta LanguageTool-X.X
            const extracted = entries.find(e => e.startsWith('LanguageTool-'));

            if (!extracted) {
                console.error('SoftCatalà: No se encontró carpeta LanguageTool- en la descarga');
                return null;
            }

            const extractedPath = path.join(outputDir, extracted);
            console.log('SoftCatalà: Carpeta extraída:', extractedPath);
            
            // Listar contenido de la carpeta extraída
            const extractedEntries = fs.readdirSync(extractedPath);
            console.log('SoftCatalà: Contenido de carpeta extraída:', extractedEntries);

            // Verificar que existen los componentes necesarios
            const hasServerJar = extractedEntries.includes('languagetool-server.jar');
            const hasLibsFolder = extractedEntries.includes('libs');
            
            if (!hasServerJar || !hasLibsFolder) {
                console.error(`SoftCatalà: Estructura incompleta. Tiene JAR: ${hasServerJar}, Tiene libs: ${hasLibsFolder}`);
                console.error('SoftCatalà: Archivos encontrados:', extractedEntries);
                return null;
            }

            // Verificar que hay archivos en libs
            const libsPath = path.join(extractedPath, 'libs');
            const libsEntries = fs.readdirSync(libsPath);
            console.log(`SoftCatalà: Librerías encontradas: ${libsEntries.length}`);

            // Verificar que existe slf4j (que era el error anterior)
            const hasSlf4j = libsEntries.some(f => f.includes('slf4j'));
            if (!hasSlf4j) {
                console.error('SoftCatalà: No se encontró slf4j en la carpeta libs');
                return null;
            }

            console.log('SoftCatalà: Estructura de LanguageTool validada correctamente');
            return extractedPath; // Retornar la ruta de la carpeta extraída
        } catch (error) {
            console.error('Error buscando y validando estructura:', error);
            return null;
        }
    }

    private static cleanupTemporaryFiles(outputDir: string): void {
        try {
            const entries = fs.readdirSync(outputDir);

            for (const entry of entries) {
                const fullPath = path.join(outputDir, entry);

                try {
                    // Eliminar ZIP
                    if (entry === 'languagetool.zip') {
                        console.log('SoftCatalà: Eliminando archivo ZIP temporal...');
                        fs.unlinkSync(fullPath);
                    }
                    // Eliminar carpeta extraída (pero solo si no es el JAR)
                    else if (entry.startsWith('LanguageTool-') && fs.lstatSync(fullPath).isDirectory()) {
                        console.log(`SoftCatalà: Eliminando carpeta temporal ${entry}...`);
                        this.removeDirectory(fullPath);
                    }
                } catch (error) {
                    console.warn(`SoftCatalà: Error eliminando ${entry}:`, error);
                }
            }
        } catch (error) {
            console.warn('Error limpiando archivos temporales:', error);
        }
    }

    private static removeDirectory(dirPath: string): void {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const filePath = path.join(dirPath, file);
                if (fs.lstatSync(filePath).isDirectory()) {
                    this.removeDirectory(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }
}
