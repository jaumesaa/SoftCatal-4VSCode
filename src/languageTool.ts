import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { LocalLanguageToolServer } from './localServer';

interface LanguageToolMatch {
    message: string;
    shortMessage?: string;
    offset: number;
    length: number;
    replacements: Array<{ value: string }>;
    rule: {
        id: string;
        description: string;
        issueType?: string;
        category: {
            id: string;
            name: string;
        };
    };
}

interface LanguageToolResponse {
    matches: LanguageToolMatch[];
}

interface CacheEntry {
    result: LanguageToolMatch[];
    timestamp: number;
}

export class LanguageToolService {
    private client: AxiosInstance;
    private serverMode: 'softcatala' | 'local';
    private baseUrl: string;
    private language: string;
    private verbForms: 'central' | 'valenciana' | 'balear';
    private isOnline: boolean = true;
    private lastErrorTime: number = 0;
    private consecutiveErrors: number = 0;
    private cache: Map<string, CacheEntry> = new Map();
    private readonly CACHE_TTL = 60000; // 1 minut
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 segon base, amb backoff exponencial
    private autoFallbackAttempted: boolean = false; // Flag per a evitar reintentar fallback
    private hasLocalServer: boolean = false; // Detecta si hi ha servidor local disponible
    private localServer: LocalLanguageToolServer | undefined; // Servidor incrustado
    private extensionPath: string;
    private globalStoragePath: string;

    constructor(extensionPath: string, globalStoragePath: string) {
        this.extensionPath = extensionPath;
        this.globalStoragePath = globalStoragePath;
        this.client = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        this.serverMode = 'softcatala';
        this.baseUrl = '';
        this.language = 'ca-ES';
        this.verbForms = 'central';
        this.localServer = new LocalLanguageToolServer(extensionPath, globalStoragePath);
        this.updateConfiguration();
        this.initOnlineDetection();
    }

    private initOnlineDetection() {
        // En Node.js no tenim events de conexió, però monitorizarem els errors
        // Per detectar quan l'usuari torna online després d'una fallada
    }

    private async checkLocalServerAvailability() {
        // Comprovem si hi ha un servidor local disponible (test ràpid)
        const localUrl = 'http://localhost:8081/v2';
        try {
            await this.client.post<LanguageToolResponse>(
                `${localUrl}/check`,
                new URLSearchParams({ text: 'test', language: 'ca-ES' }).toString(),
                { timeout: 5000 } // Timeout curt per a no bloquejar
            );
            this.hasLocalServer = true;
            console.log('SoftCatalà: Servidor local disponible a ' + localUrl);
        } catch (error) {
            this.hasLocalServer = false;
        }
    }

    public updateConfiguration() {
        const config = vscode.workspace.getConfiguration('catala');

        this.serverMode = config.get('serverMode', 'softcatala') as 'softcatala' | 'local';
        this.language = config.get('language', 'ca-ES');
        this.verbForms = config.get('verbForms', 'central') as 'central' | 'valenciana' | 'balear';

        if (this.serverMode === 'softcatala') {
            this.baseUrl = config.get('softcatalaApiUrl', 'https://api.softcatala.org/corrector/v2');
        } else {
            this.baseUrl = config.get('localServerUrl', 'http://localhost:8081/v2');
        }
    }

    public async check(text: string): Promise<LanguageToolMatch[]> {
        try {
            // Si estem en mode local, assegurar que el servidor està en execució
            if (this.serverMode === 'local' && this.localServer) {
                try {
                    await this.localServer.start();
                } catch (error) {
                    console.error('SoftCatalà: Error al iniciar servidor local:', error);
                    // FALLBACK AUTOMÀTIC: Si el servidor local falla, intentar mode online
                    console.warn('SoftCatalà: Canviant a mode online automàticament per error al servidor local');
                    this.serverMode = 'softcatala';
                    this.baseUrl = 'https://api.softcatala.org/corrector/v2';
                    this.autoFallbackAttempted = true;
                    // Reintentar amb el mode online
                    return this.check(text);
                }
            }

            // Comprovar si tenim resultat en caché
            const cached = this.getFromCache(text);
            if (cached) {
                return cached;
            }

            // Si tenim errors consecutius, espera un temps (backoff exponencial)
            if (this.consecutiveErrors > 0) {
                const timeSinceLastError = Date.now() - this.lastErrorTime;
                const backoffDelay = Math.min(
                    this.RETRY_DELAY * Math.pow(2, this.consecutiveErrors - 1),
                    10000 // Màxim 10 segons
                );
                if (timeSinceLastError < backoffDelay) {
                    // Si estem en modo SoftCatalà i tenim 3+ errors, intentar fallback automàtic
                    if (this.serverMode === 'softcatala' && this.consecutiveErrors >= 3 && !this.autoFallbackAttempted) {
                        await this.attemptAutoFallback();
                    }
                    // Retorna caché anterior si existeix, sinó array buit
                    return cached || [];
                }
            }

            // Intentar connexió amb reintentos
            let lastError: Error | null = null;
            for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
                try {
                    const result = await this.performCheck(text);
                    // Èxit: reseteja comptadors d'error
                    this.consecutiveErrors = 0;
                    this.isOnline = true;
                    this.autoFallbackAttempted = false; // Reset fallback flag
                    // Guardar en caché
                    this.setToCache(text, result);
                    return result;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    if (attempt < this.MAX_RETRIES - 1) {
                        // Espera abans de reintentar (backoff exponencial)
                        await this.sleep(this.RETRY_DELAY * Math.pow(2, attempt));
                    }
                }
            }

            // Si tots els reintentos han fallat
            this.consecutiveErrors++;
            this.lastErrorTime = Date.now();
            this.isOnline = false;

            // Si estem en modo SoftCatalà i tenim 3+ errors, intentar fallback automàtic
            if ((this.serverMode as string) === 'softcatala' && this.consecutiveErrors >= 3 && !this.autoFallbackAttempted) {
                await this.attemptAutoFallback();
                // Reintentar amb la nova configuració
                if ((this.serverMode as string) === 'local') {
                    return this.check(text);
                }
            }

            throw lastError || new Error('Error desconegut en la connexió');
        } catch (error) {
            // Retorna resultat en caché si disponible, sinó array buit
            const cached = this.getFromCache(text);
            if (cached) {
                console.warn('SoftCatalà: Usant caché (connexió fallida)');
                return cached;
            }

            // Si no tenim caché, relança l'error amb millor missatge
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                    if (this.serverMode === 'local') {
                        throw new Error(
                            'No s\'ha pogut connectar al servidor local de LanguageTool. ' +
                            'Assegura\'t que està en execució a ' + this.baseUrl
                        );
                    } else {
                        throw new Error(
                            'No s\'ha pogut connectar a l\'API de SoftCatalà. ' +
                            'Comprova la teva connexió a internet. Intentos fallits: ' + this.consecutiveErrors
                        );
                    }
                }
            }
            throw error;
        }
    }

    private async performCheck(text: string): Promise<LanguageToolMatch[]> {
        const params = new URLSearchParams();
        params.append('text', text);
        params.append('language', this.language);
        params.append('verbForms', this.verbForms);
        params.append('enabledOnly', 'false');

        const response = await this.client.post<LanguageToolResponse>(
            `${this.baseUrl}/check`,
            params.toString()
        );

        return response.data.matches || [];
    }

    private getFromCache(text: string): LanguageToolMatch[] | null {
        const cached = this.cache.get(text);
        if (!cached) {
            return null;
        }
        // Verificar si el caché ha expirat
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(text);
            return null;
        }
        return cached.result;
    }

    private setToCache(text: string, result: LanguageToolMatch[]): void {
        this.cache.set(text, {
            result,
            timestamp: Date.now()
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async attemptAutoFallback(): Promise<void> {
        // Evitar reintentar fallback múltiples vegades
        if (this.autoFallbackAttempted) {
            return;
        }
        this.autoFallbackAttempted = true;

        // Comprovar si hi ha servidor local disponible
        if (this.hasLocalServer) {
            console.log('SoftCatalà: Canviant a mode local automàticament');
            this.serverMode = 'local';
            this.baseUrl = 'http://localhost:8081/v2';
            this.consecutiveErrors = 0; // Reset errors per a reintentar
        } else {
            // Intentar detectar servidor local
            await this.checkLocalServerAvailability();
            if (this.hasLocalServer) {
                console.log('SoftCatalà: Detectat servidor local. Canviant a mode local');
                this.serverMode = 'local';
                this.baseUrl = 'http://localhost:8081/v2';
                this.consecutiveErrors = 0;
            }
        }
    }

    public isConnected(): boolean {
        return this.isOnline && this.consecutiveErrors === 0;
    }

    public getConnectionStatus(): { online: boolean; errorCount: number; nextRetryIn?: number } {
        if (this.consecutiveErrors > 0) {
            const backoffDelay = Math.min(
                this.RETRY_DELAY * Math.pow(2, this.consecutiveErrors - 1),
                10000
            );
            const timeSinceLastError = Date.now() - this.lastErrorTime;
            const nextRetryIn = Math.max(0, Math.ceil((backoffDelay - timeSinceLastError) / 1000));
            
            return {
                online: this.isOnline,
                errorCount: this.consecutiveErrors,
                nextRetryIn
            };
        }

        return {
            online: this.isOnline,
            errorCount: this.consecutiveErrors
        };
    }

    public async checkMultiple(texts: string[]): Promise<LanguageToolMatch[][]> {
        const results = await Promise.all(texts.map(text => this.check(text)));
        return results;
    }

    public dispose(): void {
        if (this.localServer) {
            this.localServer.dispose();
        }
    }
}
