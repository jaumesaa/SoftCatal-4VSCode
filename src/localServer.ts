import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import axios from 'axios';
import { LanguageToolHelper } from './languageToolHelper';

export class LocalLanguageToolServer {
    private serverProcess: ChildProcess | undefined;
    private serverUrl: string = 'http://localhost:8081';
    private isStarting: boolean = false;
    private isReady: boolean = false;
    private startPromise: Promise<void> | undefined;
    private extensionPath: string;
    private globalStoragePath: string;

    constructor(extensionPath: string, globalStoragePath: string) {
        this.extensionPath = extensionPath;
        this.globalStoragePath = globalStoragePath;
    }

    /**
     * Inicia el servidor LanguageTool local
     */
    public async start(): Promise<void> {
        if (this.isReady) {
            return; // Ya está en ejecución
        }

        if (this.isStarting && this.startPromise) {
            return this.startPromise; // Espera si se está iniciando
        }

        this.isStarting = true;
        this.startPromise = this.startServer();
        return this.startPromise;
    }

    private async startServer(): Promise<void> {
        try {
            // Verificar si el puerto ya está en uso (servidor ya activo)
            if (await this.checkServerHealth()) {
                console.log('SoftCatalà: Servidor LanguageTool já actiu a ' + this.serverUrl);
                this.isReady = true;
                this.isStarting = false;
                return;
            }

            console.log('SoftCatalà: Iniciant servidor LanguageTool local...');

            // Verificar que el JAR existe
            const jarPath = this.getLanguageToolPath();
            if (!fs.existsSync(jarPath)) {
                throw new Error(
                    `El archivo LanguageTool.jar no se encuentra en: ${jarPath}. ` +
                    `Por favor, asegúrate de que LanguageTool está descargado. ` +
                    `Usa la opción de modo online o descarga LanguageTool desde: ` +
                    `https://languagetool.org/download/`
                );
            }

            // Intentar detectar Java instalado
            const javaPath = this.findJava();
            if (!javaPath) {
                throw new Error(
                    'Java no s\'ha detectat instal·lat al sistema. ' +
                    'Per usar el servidor LanguageTool local, si us plau instal·la Java. ' +
                    'Descarrega\'l des de: https://www.java.com/es/download/'
                );
            }

            console.log('SoftCatalà: Java detectado en:', javaPath);
            console.log('SoftCatalà: JAR en:', jarPath);

            // Intentar iniciar el servidor
            await this.launchServer(javaPath);

            // Esperar a que esté llest
            await this.waitForServerReady();

            console.log('SoftCatalà: Servidor LanguageTool local iniciat correctament');
            this.isReady = true;
            this.isStarting = false;
        } catch (error) {
            this.isStarting = false;
            console.error('SoftCatalà: Error al iniciar servidor local:', error);
            throw error;
        }
    }

    private findJava(): string | null {
        const isWindows = process.platform === 'win32';
        
        const possiblePaths = isWindows
            ? [
                'java.exe', // En PATH
                'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
                'C:\\Program Files\\Java\\jdk-20\\bin\\java.exe',
                'C:\\Program Files\\Java\\jdk-19\\bin\\java.exe',
                'C:\\Program Files\\Java\\jdk-18\\bin\\java.exe',
                'C:\\Program Files (x86)\\Java\\jre1.8.0_431\\bin\\java.exe',
                'C:\\Program Files\\OpenJDK\\bin\\java.exe',
              ]
            : [
                'java', // En PATH
                '/usr/bin/java', // macOS/Linux estàndar
                '/usr/local/bin/java', // macOS (Homebrew)
                '/opt/java/openjdk/bin/java', // Java comú
                '/opt/jdk/bin/java',
              ];

        for (const javaPath of possiblePaths) {
            try {
                // Verificar que Java existeix i funciona
                const result = require('child_process').spawnSync(javaPath, ['-version'], {
                    encoding: 'utf-8',
                    stdio: 'pipe',
                    timeout: 5000
                });
                if (result.status === 0) {
                    console.log(`SoftCatalà: Java trovado en: ${javaPath}`);
                    return javaPath;
                }
            } catch (e) {
                // Continuar buscant
            }
        }

        console.error('SoftCatalà: Java no trovado en ninguna ubicación conocida');
        return null;
    }

    private async launchServer(javaPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Obtener rutas correctas desde LanguageToolHelper (con globalStorage)
                const serverJar = LanguageToolHelper.getServerJarPath(this.extensionPath, this.globalStoragePath);
                const libsDir = LanguageToolHelper.getLibsPath(this.extensionPath, this.globalStoragePath);

                console.log('SoftCatalà: Usando servidor JAR:', serverJar);
                console.log('SoftCatalà: Con libs en:', libsDir);
                console.log('SoftCatalà: Sistema operativo:', process.platform);

                // Construir el classpath usando el delimitador de sistema
                const classpathSeparator = path.delimiter; // ';' en Windows, ':' en Unix
                // Usar patrón de wildcard para incluir todas las libs
                const libsPattern = path.join(libsDir, '*');
                const classpath = `${serverJar}${classpathSeparator}${libsPattern}`;
                console.log('SoftCatalà: Classpath:', classpath);

                // Iniciar el servidor LanguageTool con classpath completo
                // El servidor JAR es solo un wrapper, necesita todas las librerías en libs/
                this.serverProcess = spawn(javaPath, [
                    '-cp',
                    classpath,
                    'org.languagetool.server.HTTPServer',
                    '--port', '8081',
                    '--allow-origin', '*'
                ], {
                    detached: false,
                    stdio: 'pipe'
                });

                let errorOutput = '';
                if (this.serverProcess.stderr) {
                    this.serverProcess.stderr.on('data', (data) => {
                        const output = data.toString();
                        errorOutput += output;
                        if (output.includes('Exception') || output.includes('Error')) {
                            console.error('SoftCatalà: Error del servidor LanguageTool:', output);
                        }
                    });
                }

                this.serverProcess.on('error', (error) => {
                    reject(new Error(`Error al iniciar el servidor: ${error.message}`));
                });

                // Donar 5 segons per iniciar
                const timeout = setTimeout(() => {
                    resolve();
                }, 5000);

                this.serverProcess.on('exit', (code) => {
                    clearTimeout(timeout);
                    if (code !== 0 && code !== null) {
                        reject(new Error(
                            `Servidor LanguageTool va sortir amb codi ${code}. ${errorOutput ? 'Error: ' + errorOutput : ''}`
                        ));
                    }
                });

                // Resolver cuando se detecte que está listo
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    private getLanguageToolPath(): string {
        // Usar la ruta desde LanguageToolHelper que busca en globalStorage primero
        return LanguageToolHelper.getServerJarPath(this.extensionPath, this.globalStoragePath);
    }

    private async waitForServerReady(): Promise<void> {
        const maxRetries = 60; // 60 intents (60 segons)
        let retries = 0;

        while (retries < maxRetries) {
            try {
                if (await this.checkServerHealth()) {
                    return;
                }
            } catch (e) {
                // Continuar intentant
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
        }

        throw new Error('El servidor LanguageTool no va respondre en temps');
    }

    private async checkServerHealth(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.serverUrl}/v2/languages`, {
                timeout: 2000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Obté l'URL del servidor local
     */
    public getServerUrl(): string {
        return this.serverUrl;
    }

    /**
     * Comprova si el servidor està actiu i llest
     */
    public isHealthy(): boolean {
        return this.isReady;
    }

    /**
     * Para el servidor
     */
    public stop(): void {
        if (this.serverProcess) {
            try {
                this.serverProcess.kill();
            } catch (error) {
                console.warn('Error al parar el servidor:', error);
            }
            this.serverProcess = undefined;
        }
        this.isReady = false;
    }

    /**
     * Destructor
     */
    public dispose(): void {
        this.stop();
    }
}
