import * as vscode from 'vscode';

export interface PanelError {
    id: string;
    line: number;
    text: string;
    message: string;
    replacements: string[];
    uri: vscode.Uri;
    range: vscode.Range;
}

export class ErrorsPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'catalaErrorsPanel';
    private _view?: vscode.WebviewView;
    private errors: PanelError[] = [];
    private isLoading: boolean = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly onFixError: (error: PanelError, replacement: string) => void,
        private readonly onIgnoreError: (error: PanelError) => void,
        private readonly onGoToError: (error: PanelError) => void
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Gestionar missatges del webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'fix':
                    const errorToFix = this.errors.find(e => e.id === data.errorId);
                    if (errorToFix) {
                        this.onFixError(errorToFix, data.replacement);
                    }
                    break;
                case 'ignore':
                    const errorToIgnore = this.errors.find(e => e.id === data.errorId);
                    if (errorToIgnore) {
                        this.onIgnoreError(errorToIgnore);
                    }
                    break;
                case 'goto':
                    const errorToGoTo = this.errors.find(e => e.id === data.errorId);
                    if (errorToGoTo) {
                        this.onGoToError(errorToGoTo);
                    }
                    break;
            }
        });
    }

    public setErrors(errors: PanelError[]) {
        this.errors = errors;
        this.isLoading = false;
        this._update();
    }

    public setLoading(loading: boolean) {
        this.isLoading = loading;
        this._update();
    }

    public removeError(errorId: string) {
        this.errors = this.errors.filter(e => e.id !== errorId);
        this._update();
    }

    public clearErrors() {
        this.errors = [];
        this.isLoading = false;
        this._update();
    }

    private _update() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                errors: this.errors,
                isLoading: this.isLoading
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'images', 'icon.png'));

        return `<!DOCTYPE html>
        <html lang="ca">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Corrector Català</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-sideBar-background);
                    padding: 16px;
                }

                .header {
                    text-align: center;
                    padding: 20px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 20px;
                }

                .logo {
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 12px;
                }

                .logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .subtitle {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }

                .loading {
                    text-align: center;
                    padding: 40px 20px;
                }

                .spinner {
                    border: 3px solid var(--vscode-progressBar-background);
                    border-top: 3px solid var(--vscode-button-background);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 16px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }

                .error-item {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .error-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                }

                .error-header {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }

                .error-icon {
                    font-size: 16px;
                    margin-right: 8px;
                    flex-shrink: 0;
                }

                .error-icon.warning { color: var(--vscode-editorWarning-foreground); }
                .error-icon.error { color: var(--vscode-editorError-foreground); }

                .error-content {
                    flex: 1;
                }

                .error-text {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 13px;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 4px 8px;
                    border-radius: 3px;
                    margin-bottom: 6px;
                    word-break: break-word;
                }

                .error-message {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 8px;
                }

                .error-line {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 8px;
                }

                .suggestions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 8px;
                }

                .suggestion-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .suggestion-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }

                .ignore-btn {
                    background-color: transparent;
                    color: var(--vscode-descriptionForeground);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    transition: all 0.2s;
                    margin-top: 6px;
                }

                .ignore-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                    border-color: var(--vscode-focusBorder);
                }

                .stats {
                    text-align: center;
                    padding: 12px;
                    background-color: var(--vscode-editor-background);
                    border-radius: 6px;
                    margin-bottom: 16px;
                    border: 1px solid var(--vscode-panel-border);
                }

                .stats-number {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-editorWarning-foreground);
                }

                .stats-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">
                    <img src="${styleUri}" alt="SoftCatalà">
                </div>
                <div class="title">Corrector Català</div>
                <div class="subtitle">SoftCatalà</div>
            </div>

            <div id="content">
                <div class="empty-state">
                    <div class="empty-state-icon">✓</div>
                    <div>No hi ha errors!</div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'update') {
                        updateUI(message.errors, message.isLoading);
                    }
                });

                function updateUI(errors, isLoading) {
                    const content = document.getElementById('content');

                    if (isLoading) {
                        content.innerHTML = \`
                            <div class="loading">
                                <div class="spinner"></div>
                                <div>Comprovant...</div>
                            </div>
                        \`;
                        return;
                    }

                    if (!errors || errors.length === 0) {
                        content.innerHTML = \`
                            <div class="empty-state">
                                <div class="empty-state-icon">✓</div>
                                <div>No hi ha errors!</div>
                            </div>
                        \`;
                        return;
                    }

                    let html = \`
                        <div class="stats">
                            <div class="stats-number">\${errors.length}</div>
                            <div class="stats-label">error\${errors.length === 1 ? '' : 's'} trobat\${errors.length === 1 ? '' : 's'}</div>
                        </div>
                    \`;

                    errors.forEach(error => {
                        const icon = error.message.includes('ortogràfic') ? '⚠️' : '⚠️';
                        const iconClass = 'warning';

                        html += \`
                            <div class="error-item" onclick="goToError('\${error.id}')">
                                <div class="error-header">
                                    <div class="error-icon \${iconClass}">\${icon}</div>
                                    <div class="error-content">
                                        <div class="error-text">\${escapeHtml(error.text)}</div>
                                        <div class="error-message">\${escapeHtml(error.message)}</div>
                                        <div class="error-line">Línia \${error.line}</div>
                                    </div>
                                </div>
                                <div class="suggestions">
                                    \${error.replacements.map(r =>
                                        \`<button class="suggestion-btn" onclick="fixError(event, '\${error.id}', '\${escapeHtml(r)}')">\${escapeHtml(r)}</button>\`
                                    ).join('')}
                                </div>
                                <button class="ignore-btn" onclick="ignoreError(event, '\${error.id}')">Ignora aquest error</button>
                            </div>
                        \`;
                    });

                    content.innerHTML = html;
                }

                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                function fixError(event, errorId, replacement) {
                    event.stopPropagation();
                    vscode.postMessage({
                        type: 'fix',
                        errorId: errorId,
                        replacement: replacement
                    });
                }

                function ignoreError(event, errorId) {
                    event.stopPropagation();
                    vscode.postMessage({
                        type: 'ignore',
                        errorId: errorId
                    });
                }

                function goToError(errorId) {
                    vscode.postMessage({
                        type: 'goto',
                        errorId: errorId
                    });
                }
            </script>
        </body>
        </html>`;
    }
}
