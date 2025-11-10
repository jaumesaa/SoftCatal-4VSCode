import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

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

export class LanguageToolService {
    private client: AxiosInstance;
    private serverMode: 'softcatala' | 'local';
    private baseUrl: string;
    private language: string;

    constructor() {
        this.client = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        this.serverMode = 'softcatala';
        this.baseUrl = '';
        this.language = 'ca-ES';
        this.updateConfiguration();
    }

    public updateConfiguration() {
        const config = vscode.workspace.getConfiguration('catala');

        this.serverMode = config.get('serverMode', 'softcatala') as 'softcatala' | 'local';
        this.language = config.get('language', 'ca-ES');

        if (this.serverMode === 'softcatala') {
            this.baseUrl = config.get('softcatalaApiUrl', 'https://api.softcatala.org/corrector/v2');
        } else {
            this.baseUrl = config.get('localServerUrl', 'http://localhost:8081/v2');
        }
    }

    public async check(text: string): Promise<LanguageToolMatch[]> {
        try {
            const params = new URLSearchParams();
            params.append('text', text);
            params.append('language', this.language);

            // Afegir paràmetres addicionals per a millor detecció
            params.append('enabledOnly', 'false');

            const response = await this.client.post<LanguageToolResponse>(
                `${this.baseUrl}/check`,
                params.toString()
            );

            return response.data.matches || [];
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                    if (this.serverMode === 'local') {
                        throw new Error(
                            'No s\'ha pogut connectar al servidor local de LanguageTool. ' +
                            'Assegura\'t que està en execució o canvia a l\'API de SoftCatalà a la configuració.'
                        );
                    } else {
                        throw new Error(
                            'No s\'ha pogut connectar a l\'API de SoftCatalà. ' +
                            'Comprova la teva connexió a internet.'
                        );
                    }
                }
                throw new Error(`Error de xarxa: ${error.message}`);
            }
            throw error;
        }
    }

    public async checkMultiple(texts: string[]): Promise<LanguageToolMatch[][]> {
        const results = await Promise.all(texts.map(text => this.check(text)));
        return results;
    }
}
