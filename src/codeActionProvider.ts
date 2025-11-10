import * as vscode from 'vscode';
import { getDiagnosticData } from './diagnosticsData';

export class CatalaCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] | undefined {
        const codeActions: vscode.CodeAction[] = [];

        // Buscar diagnòstics de SoftCatalà en la posició actual
        const catalaDiagnostics = context.diagnostics.filter(
            diagnostic => diagnostic.source === 'SoftCatalà'
        );

        for (const diagnostic of catalaDiagnostics) {
            // Obtenir les suggerències del mapa
            const data = getDiagnosticData(diagnostic);
            if (data && data.replacements.length > 0) {
                for (const replacement of data.replacements) {
                    const action = this.createFix(document, diagnostic, replacement);
                    codeActions.push(action);
                }
            }
        }

        return codeActions;
    }

    private createFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        replacement: string
    ): vscode.CodeAction {
        const fix = new vscode.CodeAction(
            `Canvia per "${replacement}"`,
            vscode.CodeActionKind.QuickFix
        );
        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.replace(document.uri, diagnostic.range, replacement);
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        return fix;
    }
}
