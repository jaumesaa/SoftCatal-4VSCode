import * as vscode from 'vscode';
import { LanguageToolService } from './languageTool';
import { CommentParser } from './commentParser';
import { setDiagnosticData, clearDiagnosticData, getDiagnosticData } from './diagnosticsData';
import { ErrorsPanelProvider, PanelError } from './errorsPanel';

export class CatalaChecker {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private languageToolService: LanguageToolService;
    private checkTimeout: NodeJS.Timeout | undefined;
    private enabledLanguages: string[];
    private codeLanguages: string[];
    private checkCommentsOnly: boolean;
    private verbForms: 'central' | 'valenciana' | 'balear';
    private errorsPanelProvider?: ErrorsPanelProvider;
    private lastErrorShown: Map<string, number> = new Map(); // Per evitar popups repetits
    private readonly ERROR_POPUP_COOLDOWN = 30000; // 30 segons entre popups
    private disableCapitalizationRules: boolean = false; // Flag per deshabilitar majúscules

    constructor(extensionPath: string, errorsPanelProvider?: ErrorsPanelProvider) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('catala');
        this.languageToolService = new LanguageToolService(extensionPath);
        this.enabledLanguages = this.getEnabledLanguages();
        this.codeLanguages = this.getCodeLanguages();
        this.checkCommentsOnly = this.getCheckCommentsOnly();
        this.verbForms = this.getVerbForms();
        this.disableCapitalizationRules = this.getDisableCapitalizationRules();
        this.errorsPanelProvider = errorsPanelProvider;
    }

    private getEnabledLanguages(): string[] {
        const config = vscode.workspace.getConfiguration('catala');
        return config.get('enabledLanguages', ['plaintext', 'markdown', 'latex']);
    }

    private getCodeLanguages(): string[] {
        const config = vscode.workspace.getConfiguration('catala');
        return config.get('codeLanguages', ['javascript', 'typescript', 'python', 'java']);
    }

    private getCheckCommentsOnly(): boolean {
        const config = vscode.workspace.getConfiguration('catala');
        return config.get('checkCommentsOnly', true);
    }

    private getVerbForms(): 'central' | 'valenciana' | 'balear' {
        const config = vscode.workspace.getConfiguration('catala');
        return config.get('verbForms', 'central') as 'central' | 'valenciana' | 'balear';
    }

    public updateConfiguration() {
        this.enabledLanguages = this.getEnabledLanguages();
        this.codeLanguages = this.getCodeLanguages();
        this.checkCommentsOnly = this.getCheckCommentsOnly();
        this.verbForms = this.getVerbForms();
        this.disableCapitalizationRules = this.getDisableCapitalizationRules();
        this.languageToolService.updateConfiguration();
    }

    private getDisableCapitalizationRules(): boolean {
        const config = vscode.workspace.getConfiguration('catala');
        return config.get('disableCapitalization', false);
    }

    public setDisableCapitalizationRules(disable: boolean): void {
        this.disableCapitalizationRules = disable;
        const config = vscode.workspace.getConfiguration('catala');
        config.update('disableCapitalization', disable, vscode.ConfigurationTarget.Global);
    }

    public getDisableCapitalizationRulesState(): boolean {
        return this.disableCapitalizationRules;
    }

    private shouldCheckDocument(document: vscode.TextDocument): boolean {
        const languageId = document.languageId;

        // Si és un llenguatge de text (plaintext, markdown, etc.), sempre comprova
        if (this.enabledLanguages.includes(languageId)) {
            return true;
        }

        // Si és un llenguatge de codi i està en la llista de llenguatges de codi
        if (this.codeLanguages.includes(languageId) && CommentParser.isCodeLanguage(languageId)) {
            return true;
        }

        return false;
    }

    public scheduleCheck(document: vscode.TextDocument) {
        // Comprovar si el document s'ha de verificar
        if (!this.shouldCheckDocument(document)) {
            return;
        }

        // Cancel·lar la comprovació anterior si existeix
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }

        // Programar una nova comprovació
        const config = vscode.workspace.getConfiguration('catala');
        const delay = config.get('checkDelay', 500);

        this.checkTimeout = setTimeout(() => {
            this.checkDocument(document);
        }, delay);
    }

    public async checkDocument(document: vscode.TextDocument): Promise<void> {
        // Comprovar si el document s'ha de verificar
        if (!this.shouldCheckDocument(document)) {
            return;
        }

        const languageId = document.languageId;
        const isCodeFile = this.codeLanguages.includes(languageId) && CommentParser.isCodeLanguage(languageId);

        // Determinar si hem de comprovar només comentaris
        const shouldCheckOnlyComments = isCodeFile && this.checkCommentsOnly;

        try {
            let diagnostics: vscode.Diagnostic[] = [];

            if (shouldCheckOnlyComments) {
                // Mode: només comentaris
                const comments = CommentParser.extractComments(document);

                if (comments.length === 0) {
                    this.diagnosticCollection.set(document.uri, []);
                    this.updatePanelStatus();
                    return;
                }

                // Comprovar cada comentari
                for (const comment of comments) {
                    const matches = await this.languageToolService.check(comment.text);

                    for (const match of matches) {
                        // Filtrar si la regla està deshabilitada
                        if (this.disableCapitalizationRules && match.rule.id === 'UPPERCASE_SENTENCE_START') {
                            continue;
                        }

                        // Calcular la posició real en el document
                        const startOffset = comment.offset + this.findCommentTextOffset(comment.text, document.getText().substring(comment.offset));
                        const matchStartPos = document.positionAt(startOffset + match.offset);
                        const matchEndPos = document.positionAt(startOffset + match.offset + match.length);

                        const range = new vscode.Range(matchStartPos, matchEndPos);

                        const diagnostic = this.createDiagnostic(range, match, document.uri);
                        diagnostics.push(diagnostic);
                    }
                }
            } else {
                // Mode: document complet
                const text = document.getText();
                if (!text.trim()) {
                    this.diagnosticCollection.set(document.uri, []);
                    this.updatePanelStatus();
                    return;
                }

                const matches = await this.languageToolService.check(text);

                for (const match of matches) {
                    // Filtrar si la regla està deshabilitada
                    if (this.disableCapitalizationRules && match.rule.id === 'UPPERCASE_SENTENCE_START') {
                        continue;
                    }

                    const range = new vscode.Range(
                        document.positionAt(match.offset),
                        document.positionAt(match.offset + match.length)
                    );

                    const diagnostic = this.createDiagnostic(range, match, document.uri);
                    diagnostics.push(diagnostic);
                }
            }

            this.diagnosticCollection.set(document.uri, diagnostics);

            // Actualitzar el Panel amb els errors
            if (this.errorsPanelProvider) {
                const panelErrors: PanelError[] = diagnostics.map((diagnostic, index) => {
                    const data = getDiagnosticData(diagnostic);
                    const text = document.getText(diagnostic.range);
                    const line = diagnostic.range.start.line + 1;
                    return {
                        id: `${document.uri.toString()}-${index}`,
                        line,
                        text,
                        message: diagnostic.message,
                        replacements: data?.replacements || [],
                        uri: document.uri,
                        range: diagnostic.range
                    };
                });
                this.errorsPanelProvider.setErrors(panelErrors);
            }

            // Actualitzar l'estat de connexió al panell
            this.updatePanelStatus();
        } catch (error) {
            // No mostrar popup cada vegada - usar throttle
            this.handleCheckError(error, document.uri);
            
            // Actualitzar l'estat de connexió al panell
            this.updatePanelStatus();
        }
    }

    private updatePanelStatus() {
        if (this.errorsPanelProvider) {
            const status = this.languageToolService.getConnectionStatus();
            this.errorsPanelProvider.setConnectionStatus(status);
        }
    }

    private handleCheckError(error: any, uri: vscode.Uri) {
        const errorKey = `${uri.toString()}_${error instanceof Error ? error.message : String(error)}`;
        const lastShown = this.lastErrorShown.get(errorKey) || 0;
        const now = Date.now();

        // Si fa poc que hem mostrat aquest error, no el mostrem de nou
        if (now - lastShown < this.ERROR_POPUP_COOLDOWN) {
            console.warn('SoftCatalà Error (silenciat):', error instanceof Error ? error.message : String(error));
            return;
        }

        this.lastErrorShown.set(errorKey, now);

        const message = error instanceof Error ? error.message : String(error);
        
        // No mostrar notificacions d'error - l'indicador de connexió al panell ja en parla
        console.warn('SoftCatalà Error:', message);
        
        // L'indicador de connexió al panell ja mostra l'estat
        this.updatePanelStatus();
    }

    public removeDiagnostic(uri: vscode.Uri, error: PanelError) {
        // Eliminar del diagnostic collection basant-nos en el range
        const currentDiagnostics = this.diagnosticCollection.get(uri) || [];
        const newDiagnostics = currentDiagnostics.filter(d =>
            !d.range.isEqual(error.range)
        );
        this.diagnosticCollection.set(uri, newDiagnostics);

        // Actualitzar el Panel
        if (this.errorsPanelProvider) {
            const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
            if (document) {
                const panelErrors: PanelError[] = newDiagnostics.map((diagnostic, index) => {
                    const data = getDiagnosticData(diagnostic);
                    const text = document.getText(diagnostic.range);
                    const line = diagnostic.range.start.line + 1;
                    return {
                        id: `${uri.toString()}-${index}`,
                        line,
                        text,
                        message: diagnostic.message,
                        replacements: data?.replacements || [],
                        uri,
                        range: diagnostic.range
                    };
                });
                this.errorsPanelProvider.setErrors(panelErrors);
            }
        }
    }

    private findCommentTextOffset(commentText: string, fullComment: string): number {
        // Trobar on comença el text real del comentari dins del comentari complet
        // Això té en compte els delimitadors de comentaris
        const index = fullComment.indexOf(commentText);
        return index >= 0 ? index : 0;
    }

    private createDiagnostic(range: vscode.Range, match: any, uri: vscode.Uri): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(
            range,
            match.message,
            this.getSeverity(match.rule.issueType)
        );

        diagnostic.source = 'SoftCatalà';
        diagnostic.code = match.rule.id;

        // Guardar les suggerències en el mapa (no en relatedInformation)
        if (match.replacements && match.replacements.length > 0) {
            const replacements = match.replacements.map((r: any) => r.value);
            setDiagnosticData(diagnostic, replacements);
        }

        return diagnostic;
    }

    private getSeverity(issueType?: string): vscode.DiagnosticSeverity {
        switch (issueType) {
            case 'misspelling':
                return vscode.DiagnosticSeverity.Error;
            case 'typographical':
                return vscode.DiagnosticSeverity.Warning;
            case 'grammar':
                return vscode.DiagnosticSeverity.Warning;
            case 'style':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Warning;
        }
    }

    public clearDiagnostics() {
        this.diagnosticCollection.clear();
        clearDiagnosticData();
        if (this.errorsPanelProvider) {
            this.errorsPanelProvider.clearErrors();
        }
    }

    public dispose() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }
        this.diagnosticCollection.dispose();
        this.languageToolService.dispose();
    }
}
