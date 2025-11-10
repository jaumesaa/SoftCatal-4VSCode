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
    private errorsPanelProvider?: ErrorsPanelProvider;

    constructor(errorsPanelProvider?: ErrorsPanelProvider) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('catala');
        this.languageToolService = new LanguageToolService();
        this.enabledLanguages = this.getEnabledLanguages();
        this.codeLanguages = this.getCodeLanguages();
        this.checkCommentsOnly = this.getCheckCommentsOnly();
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

    public updateConfiguration() {
        this.enabledLanguages = this.getEnabledLanguages();
        this.codeLanguages = this.getCodeLanguages();
        this.checkCommentsOnly = this.getCheckCommentsOnly();
        this.languageToolService.updateConfiguration();
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
                    return;
                }

                // Comprovar cada comentari
                for (const comment of comments) {
                    const matches = await this.languageToolService.check(comment.text);

                    for (const match of matches) {
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
                    return;
                }

                const matches = await this.languageToolService.check(text);

                for (const match of matches) {
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
        } catch (error) {
            vscode.window.showErrorMessage(
                `Error comprovant el document: ${error instanceof Error ? error.message : String(error)}`
            );
        }
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
    }
}
