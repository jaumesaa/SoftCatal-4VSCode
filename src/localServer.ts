import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import axios from 'axios';
import { LanguageToolDownloader } from './languageToolDownloader';

export class LocalLanguageToolServer {
    private serverProcess: ChildProcess | undefined;
    private serverUrl: string = 'http://localhost:8081';
    private isStarting: boolean = false;
    private isReady: boolean = false;
    private startPromise: Promise<void> | undefined;
    private extensionPath: string;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
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

            // Intentar detectar Java instalado
            const javaPath = this.findJava();
            if (!javaPath) {
                throw new Error(
                    'Java no s\'ha detectat instal·lat al sistema. ' +
                    'Per usar el servidor LanguageTool local, si us plau instal·la Java. ' +
                    'Descarrega\'l des de: https://www.java.com/es/download/'
                );
            }

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
        const possiblePaths = [
            'java', // En PATH
            '/usr/bin/java', // macOS/Linux estàndar
            '/opt/java/openjdk/bin/java', // Java comú
            'C:\\Program Files\\Java\\jdk-*/bin\\java.exe', // Windows
            'C:\\Program Files (x86)\\Java\\jre*/bin\\java.exe',
        ];

        for (const javaPath of possiblePaths) {
            try {
                // Verificar que Java existeix i funciona
                const result = require('child_process').spawnSync(javaPath, ['-version'], {
                    encoding: 'utf-8',
                    stdio: 'pipe'
                });
                if (result.status === 0) {
                    return javaPath;
                }
            } catch (e) {
                // Continuar buscant
            }
        }

        return null;
    }

    private async launchServer(javaPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Iniciar el servidor LanguageTool (versió 6.x compatible amb català)
                this.serverProcess = spawn(javaPath, [
                    '-cp',
                    this.getLanguageToolPath(),
                    'org.languagetool.server.HTTPServer',
                    '--port', '8081',
                    '--allow-origin', '*'
                ], {
                    detached: false,
                    stdio: 'pipe'
                });

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
                        reject(new Error(`Servidor LanguageTool va sortir amb codi ${code}`));
                    }
                });

                // Resolver quan es detecti que està llest
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    private getLanguageToolPath(): string {
        // Usar la ruta desde LanguageToolDownloader
        return LanguageToolDownloader.getJarPath(this.extensionPath);
    }

    private async waitForServerReady(): Promise<void> {
        const maxRetries = 30; // 30 intents (30 segons)
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
