import * as vscode from 'vscode';
import { CatalaChecker } from './checker';
import { CatalaCodeActionProvider } from './codeActionProvider';
import { ErrorsPanelProvider, PanelError } from './errorsPanel';

let checker: CatalaChecker | undefined;
let errorsPanelProvider: ErrorsPanelProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Extensió Català - SoftCatalà activada');

    // Crear el WebView Panel per mostrar errors
    errorsPanelProvider = new ErrorsPanelProvider(
        context.extensionUri,
        async (error, replacement) => {
            // Eliminar immediatament del panel
            errorsPanelProvider?.removeError(error.id);

            // Aplicar correcció
            const edit = new vscode.WorkspaceEdit();
            edit.replace(error.uri, error.range, replacement);
            await vscode.workspace.applyEdit(edit);

            // Actualitzar diagnòstics
            checker?.removeDiagnostic(error.uri, error);
        },
        (error) => {
            // Eliminar immediatament del panel
            errorsPanelProvider?.removeError(error.id);

            // Ignorar error
            checker?.removeDiagnostic(error.uri, error);
        },
        (error) => {
            // Anar a l'error
            vscode.window.showTextDocument(error.uri, { selection: error.range });
        },
        (verbForms) => {
            // Canviar formes verbals
            const config = vscode.workspace.getConfiguration('catala');
            config.update('verbForms', verbForms, vscode.ConfigurationTarget.Global);
            
            // Re-chequjar el document actual amb la nova configuració
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                checker?.updateConfiguration();
                checker?.checkDocument(editor.document);
            }
        },
        (disabled) => {
            // Deshabilitar capitalització
            const config = vscode.workspace.getConfiguration('catala');
            config.update('disableCapitalization', disabled, vscode.ConfigurationTarget.Global);
            
            checker?.setDisableCapitalizationRules(disabled);
            errorsPanelProvider?.setDisableCapitalizationRules(disabled);
            
            // Re-chequjar el document actual amb la nova configuració
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                checker?.checkDocument(editor.document);
            }
        },
        () => {
            // Quan s'obri el panell: comprovar el document actual
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                checker?.checkDocument(editor.document);
            }
        },
        () => {
            // Canviar a mode offline
            const config = vscode.workspace.getConfiguration('catala');
            config.update('serverMode', 'local', vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Mode offline activat. L\'extensió usarà el servidor LanguageTool local.');
            
            // Re-chequjar el document actual
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                checker?.updateConfiguration();
                checker?.checkDocument(editor.document);
            }
        }
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ErrorsPanelProvider.viewType,
            errorsPanelProvider
        )
    );

    // Crear el comprovador
    checker = new CatalaChecker(errorsPanelProvider);

    // Registrar el CodeActionProvider per a les correccions ràpides
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        '*', // Tots els llenguatges
        new CatalaCodeActionProvider(),
        {
            providedCodeActionKinds: CatalaCodeActionProvider.providedCodeActionKinds
        }
    );

    // Comanda per comprovar el document actual
    const checkCommand = vscode.commands.registerCommand('catala.checkDocument', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            await checker?.checkDocument(editor.document);
        }
    });

    // Comanda per netejar diagnòstics
    const clearCommand = vscode.commands.registerCommand('catala.clearDiagnostics', () => {
        checker?.clearDiagnostics();
        errorsPanelProvider?.clearErrors();
    });

    // Escoltar canvis en el document
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        const config = vscode.workspace.getConfiguration('catala');
        if (config.get('autoCheck')) {
            checker?.scheduleCheck(event.document);
        }
    });

    // Escoltar canvis en l'editor actiu
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            const config = vscode.workspace.getConfiguration('catala');
            if (config.get('autoCheck')) {
                checker?.scheduleCheck(editor.document);
            }
        }
    });

    // Escoltar canvis en la configuració
    const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('catala')) {
            checker?.updateConfiguration();
        }
    });

    context.subscriptions.push(
        codeActionProvider,
        checkCommand,
        clearCommand,
        changeListener,
        editorChangeListener,
        configChangeListener
    );
}

export function deactivate() {
    if (checker) {
        checker.dispose();
        checker = undefined;
    }
}
