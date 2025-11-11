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
     * Detecta si LanguageTool está descargado
     */
    public static isDownloaded(extensionPath: string): boolean {
        const jarPath = this.getJarPath(extensionPath);
        return fs.existsSync(jarPath);
    }

    /**
     * Obté la ruta al JAR
     */
    public static getJarPath(extensionPath: string): string {
        return path.join(extensionPath, 'languagetool', this.JAR_NAME);
    }

    /**
     * Descarga LanguageTool si no està descarregat
     */
    public static async ensureDownloaded(extensionPath: string): Promise<void> {
        if (this.isDownloaded(extensionPath)) {
            console.log('SoftCatalà: LanguageTool ja està descarregat');
            return;
        }

        console.log('SoftCatalà: Detectant que LanguageTool no està descarregat. Iniciant descàrrega...');

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

            // Buscar i copiar el JAR
            const jarPath = this.findAndCopyJar(outputDir);

            if (!jarPath) {
                throw new Error('No s\'ha trobat languagetool-server.jar dins del ZIP');
            }

            onProgress(30); // 30% completat

            // Netejar arxius temporals
            this.cleanupTemporaryFiles(outputDir);

            console.log('SoftCatalà: LanguageTool descarregat correctament a ' + jarPath);
        } catch (error) {
            // Netejar en cas d'error
            if (fs.existsSync(zipFile)) {
                try {
                    fs.unlinkSync(zipFile);
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
                timeout: 300000 // 5 minuts timeout
            })
                .then((response) => {
                    const totalSize = parseInt(response.headers['content-length'], 10) || 0;
                    const file = fs.createWriteStream(outputPath);
                    let downloadedSize = 0;

                    response.data.on('data', (chunk: Buffer) => {
                        downloadedSize += chunk.length;
                        const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 80) : 0;

                        if (percent > lastProgress) {
                            onProgress(percent);
                            lastProgress = percent;
                        }
                    });

                    response.data.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        cancelListener.dispose();
                        resolve();
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
                        reject(new Error('Versió de LanguageTool no disponible'));
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

                if (isWindows) {
                    // Usar PowerShell en Windows
                    execSync(
                        `powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${outputDir}' -Force"`,
                        { stdio: 'pipe' }
                    );
                } else {
                    // Usar unzip en macOS/Linux
                    execSync(`unzip -q "${zipFile}" -d "${outputDir}"`, { stdio: 'pipe' });
                }

                resolve();
            } catch (error) {
                reject(new Error(`Error al descomprimir: ${(error as Error).message}`));
            }
        });
    }

    private static findAndCopyJar(outputDir: string): string | null {
        try {
            const entries = fs.readdirSync(outputDir);
            const extracted = entries.find(e => e.startsWith('LanguageTool-'));

            if (!extracted) {
                return null;
            }

            const extractedPath = path.join(outputDir, extracted);
            const jarPath = path.join(extractedPath, this.JAR_NAME);

            if (!fs.existsSync(jarPath)) {
                return null;
            }

            const destPath = path.join(outputDir, this.JAR_NAME);
            fs.copyFileSync(jarPath, destPath);

            return destPath;
        } catch (error) {
            console.error('Error buscant JAR:', error);
            return null;
        }
    }

    private static cleanupTemporaryFiles(outputDir: string): void {
        try {
            const entries = fs.readdirSync(outputDir);

            for (const entry of entries) {
                const fullPath = path.join(outputDir, entry);

                // Eliminar ZIP
                if (entry === 'languagetool.zip') {
                    fs.unlinkSync(fullPath);
                }
                // Eliminar carpeta extraída
                else if (entry.startsWith('LanguageTool-')) {
                    this.removeDirectory(fullPath);
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
