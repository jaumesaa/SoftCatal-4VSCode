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

export interface ConnectionStatus {
    online: boolean;
    errorCount: number;
    nextRetryIn?: number; // Segons fins al proper retry
    retryCountdown?: number; // Compte enrere en viu
}

export class ErrorsPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'catalaErrorsPanel';
    private _view?: vscode.WebviewView;
    private errors: PanelError[] = [];
    private isLoading: boolean = true;
    private connectionStatus: ConnectionStatus = { online: true, errorCount: 0 };
    private countdownInterval?: NodeJS.Timeout;
    private disableCapitalizationRules: boolean = false;
    private isExtensionActive: boolean = false;
    private showSettings: boolean = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly onFixError: (error: PanelError, replacement: string) => void,
        private readonly onIgnoreError: (error: PanelError) => void,
        private readonly onGoToError: (error: PanelError) => void,
        private readonly onVerbFormsChanged?: (verbForms: 'central' | 'valenciana' | 'balear') => void,
        private readonly onCapitalizationToggled?: (disabled: boolean) => void,
        private readonly onPanelOpened?: () => void,
        private readonly onOfflineMode?: () => void,
        private readonly onOnlineMode?: () => void,
        private readonly onExtensionPaused?: () => void,
        private readonly onSettingsClicked?: () => void
    ) {
        // Inicialitzar la configuració de capitalització
        const config = vscode.workspace.getConfiguration('catala');
        this.disableCapitalizationRules = config.get('disableCapitalization', false);
    }

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

        // Disparar el callback quan s'obri el panell
        if (this.onPanelOpened) {
            this.onPanelOpened();
        }

        // Enviar configuració inicial al webview
        const config = vscode.workspace.getConfiguration('catala');
        const verbForms = config.get('verbForms', 'central');
        const disableCapitalization = config.get('disableCapitalization', false);
        
        webviewView.webview.postMessage({
            type: 'init',
            verbForms: verbForms,
            disableCapitalization: disableCapitalization
        });

        // Enviar estat de càrrega inicial
        webviewView.webview.postMessage({
            type: 'update',
            errors: this.errors,
            isLoading: this.isLoading,
            connectionStatus: this.connectionStatus,
            isExtensionActive: this.isExtensionActive,
            showSettings: this.showSettings
        });

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
                case 'verbFormsChanged':
                    if (this.onVerbFormsChanged) {
                        this.onVerbFormsChanged(data.verbForms);
                    }
                    break;
                case 'capitalizationToggled':
                    if (this.onCapitalizationToggled) {
                        this.onCapitalizationToggled(data.disabled);
                    }
                    break;
                case 'offlineMode':
                    if (this.onOfflineMode) {
                        this.onOfflineMode();
                    }
                    break;
                case 'onlineMode':
                    if (this.onOnlineMode) {
                        this.onOnlineMode();
                    }
                    break;
                case 'extensionActivated':
                    // Si se proporciona un modo, activar el callback correspondiente
                    if (data.mode === 'online') {
                        if (this.onOnlineMode) {
                            this.onOnlineMode();
                        }
                    } else if (data.mode === 'offline') {
                        if (this.onOfflineMode) {
                            this.onOfflineMode();
                        }
                    }
                    this.setExtensionActive(true);
                    if (this.onPanelOpened) {
                        this.onPanelOpened();
                    }
                    break;
                case 'extensionPaused':
                    this.setExtensionActive(false);
                    if (this.onExtensionPaused) {
                        this.onExtensionPaused();
                    }
                    break;
                case 'settingsClicked':
                    this.showSettings = true;
                    this._update();
                    break;
                case 'backFromSettings':
                    this.showSettings = false;
                    this._update();
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

    public setConnectionStatus(status: ConnectionStatus) {
        this.connectionStatus = status;

        // Si tenim error i temps fins al próxim retry, iniciar countdown
        if (!status.online && status.errorCount > 0 && status.nextRetryIn !== undefined) {
            this.connectionStatus.retryCountdown = status.nextRetryIn;

            // Iniciar countdown
            this.startCountdown();
        } else {
            // Aturar countdown si no hi ha errors
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = undefined;
            }
        }

        this._update();
    }

    private startCountdown() {
        // Aturar countdown anterior si existeix
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        // Iniciar countdown
        this.countdownInterval = setInterval(() => {
            if (this.connectionStatus.retryCountdown && this.connectionStatus.retryCountdown > 0) {
                this.connectionStatus.retryCountdown--;
                this._update();
            } else {
                // Countdown finalitzat
                if (this.countdownInterval) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = undefined;
                }
            }
        }, 1000);
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

    public setDisableCapitalizationRules(disabled: boolean) {
        this.disableCapitalizationRules = disabled;
        this._update();
    }

    public getDisableCapitalizationRules(): boolean {
        return this.disableCapitalizationRules;
    }

    public setExtensionActive(active: boolean) {
        this.isExtensionActive = active;
        this.isLoading = active ? true : false;
        this._update();
    }

    public getExtensionActive(): boolean {
        return this.isExtensionActive;
    }

    private _update() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update',
                errors: this.errors,
                isLoading: this.isLoading,
                connectionStatus: this.connectionStatus,
                isExtensionActive: this.isExtensionActive,
                showSettings: this.showSettings
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
                    position: relative;
                    text-align: center;
                    padding: 20px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 20px;
                }

                .settings-btn {
                    position: absolute;
                    top: 10px;
                    right: 0;
                    background: none;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    font-size: 18px;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                    opacity: 0.7;
                }

                .settings-btn:hover {
                    opacity: 1;
                    background-color: var(--vscode-button-hoverBackground);
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

                .connection-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    margin-top: 12px;
                    font-size: 11px;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .status-indicator.online {
                    background-color: #4ec9b0;
                    box-shadow: 0 0 8px rgba(78, 201, 176, 0.6);
                }

                .status-indicator.offline {
                    background-color: #cd5c5c;
                    box-shadow: 0 0 8px rgba(205, 92, 92, 0.6);
                }

                .status-indicator.reconnecting {
                    background-color: #d7ba7d;
                    animation: pulse 1s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .status-text {
                    flex: 1;
                    color: var(--vscode-descriptionForeground);
                }

                .status-text.offline {
                    color: #cd5c5c;
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

                .offline-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    transition: all 0.2s;
                    width: 100%;
                    margin-top: 8px;
                }

                .offline-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }

                .online-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    transition: all 0.2s;
                    width: 100%;
                    margin-top: 8px;
                }

                .online-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }

                .activation-container {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                }

                .activation-btn {
                    flex: 1;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 12px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    font-family: var(--vscode-font-family);
                    transition: all 0.2s;
                }

                .activation-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-2px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }

                .activation-btn.pause {
                    background-color: var(--vscode-editorWarning-foreground);
                    opacity: 0.8;
                }

                .activation-btn.pause:hover {
                    opacity: 1;
                }

                .inactive-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }

                .inactive-state-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }

                .inactive-state-text {
                    font-size: 14px;
                    margin-bottom: 24px;
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

                .settings-section {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 12px;
                    margin-top: 16px;
                }

                .settings-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                }

                .setting-item {
                    margin-bottom: 10px;
                }

                .setting-label {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 4px;
                    display: block;
                }

                select {
                    width: 100%;
                    padding: 6px 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    cursor: pointer;
                }

                select:hover {
                    border-color: var(--vscode-focusBorder);
                }

                .countdown {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                .countdown-value {
                    font-weight: 600;
                    color: var(--vscode-editorWarning-foreground);
                }

                .back-btn {
                    background-color: #ff6b6b;
                    color: #fff;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    font-weight: 600;
                    transition: all 0.2s;
                    position: absolute;
                    top: 10px;
                    left: 0;
                }

                .back-btn:hover {
                    background-color: #ff5252;
                    transform: translateY(-1px);
                }

                .settings-view {
                    display: none;
                }

                .settings-view.active {
                    display: block;
                }

                .settings-header {
                    position: relative;
                    text-align: center;
                    padding: 20px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 20px;
                }

                .settings-header-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .settings-content {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .settings-section {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 16px;
                }

                .settings-section-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .settings-section-icon {
                    font-size: 16px;
                }

                .creator-info {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .creator-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }

                .creator-item-icon {
                    font-size: 20px;
                    margin-top: 2px;
                    flex-shrink: 0;
                }

                .creator-item-content {
                    flex: 1;
                }

                .creator-item-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 4px;
                }

                .creator-item-value {
                    font-size: 13px;
                    color: var(--vscode-foreground);
                    word-break: break-word;
                }

                .creator-item-value a {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                    cursor: pointer;
                }

                .creator-item-value a:hover {
                    text-decoration: underline;
                }

                .danger-section {
                    background-color: rgba(205, 92, 92, 0.1);
                    border: 1px solid rgba(205, 92, 92, 0.3);
                }

                .danger-section .settings-section-title {
                    color: #cd5c5c;
                }

                .storage-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background-color: var(--vscode-textCodeBlock-background);
                    border-radius: 4px;
                    margin-bottom: 12px;
                    font-size: 12px;
                }

                .storage-icon {
                    font-size: 16px;
                    flex-shrink: 0;
                }

                .storage-text {
                    flex: 1;
                    color: var(--vscode-descriptionForeground);
                }

                .storage-size {
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .delete-btn {
                    width: 100%;
                    background-color: #cd5c5c;
                    color: #fff;
                    border: none;
                    padding: 10px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    font-weight: 600;
                    transition: all 0.2s;
                    margin-top: 8px;
                }

                .delete-btn:hover {
                    background-color: #b84343;
                    transform: translateY(-1px);
                }

                .delete-btn:disabled {
                    background-color: #888;
                    cursor: not-allowed;
                    transform: none;
                }

                .status-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                }

                .status-badge.coming-soon {
                    background-color: rgba(215, 186, 125, 0.3);
                    color: #d7ba7d;
                }

                .settings-description {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 12px;
                    line-height: 1.5;
                }

                .settings-links {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .settings-link-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-family: var(--vscode-font-family);
                    transition: all 0.2s;
                    text-decoration: none;
                    display: inline-block;
                }

                .settings-link-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <button class="settings-btn" id="settingsBtn" onclick="openSettings()" title="Configuració">⚙️</button>
                <button class="back-btn" id="backBtn" onclick="backFromSettings()" style="display: none;">← Torna</button>
                <div class="logo">
                    <img src="${styleUri}" alt="SoftCatalà">
                </div>
                <div class="title">Corrector Català</div>
                <div class="subtitle">SoftCatalà</div>
                <div id="connectionStatus" class="connection-status" style="display: none;">
                    <div class="status-indicator online" id="statusIndicator"></div>
                    <div class="status-text" id="statusText">Connectat</div>
                </div>
                <div id="activationContainer" class="activation-container" style="display: flex; gap: 8px;">
                    <button id="onlineBtn" class="activation-btn online-btn" onclick="activateOnlineMode()">🌐 ONLINE (SoftCatalà)<br>✓ Recomanat</button>
                    <button id="offlineBtn" class="activation-btn offline-btn" onclick="activateOfflineMode()">📦 OFFLINE (Local)</button>
                    <button id="pauseBtn" class="activation-btn pause" onclick="pauseExtension()" style="display: none;">⏸ PAUSAR</button>
                </div>
            </div>

            <div id="settings" class="settings-section" style="display: none;">
                <div class="settings-title">⚙️ Configuració</div>
                <div class="setting-item">
                    <label class="setting-label">Formes Verbals:</label>
                    <select id="verbFormsSelect" onchange="changeVerbForms(this.value)">
                        <option value="central">Central (Estàndard)</option>
                        <option value="valenciana">Valenciana</option>
                        <option value="balear">Balear</option>
                    </select>
                </div>
                <div class="setting-item">
                    <input type="checkbox" id="disableCapitalizationCheckbox" onchange="toggleCapitalization(this.checked)">
                    <label class="setting-label" for="disableCapitalizationCheckbox">Deshabilitar majúscules de principi de frase</label>
                </div>
                <div id="countdownDiv" class="countdown" style="display: none;">
                    <div style="margin-bottom: 8px;">
                        Proper intent en: <span class="countdown-value" id="countdownValue">0</span>s
                    </div>
                    <button id="offlineModeBtn" class="offline-btn" onclick="switchToOffline()">Usar servidor LanguageTool local</button>
                    <button id="onlineModeBtn" class="online-btn" onclick="switchToOnline()">Usar API de SoftCatalà (online)</button>
                </div>
            </div>

            <div id="content">
                <div class="empty-state">
                    <div class="empty-state-icon">✓</div>
                    <div>No hi ha errors!</div>
                </div>
            </div>

            <div id="settingsView" class="settings-view">
                <div class="settings-header">
                    <div class="settings-header-title">⚙️ Configuració</div>
                </div>

                <div class="settings-content">
                    <div class="settings-section">
                        <div class="settings-section-title">
                            <span class="settings-section-icon">👨‍💻</span>
                            Sobre el creador
                        </div>
                        <div class="creator-info">
                            <div class="creator-item">
                                <div class="creator-item-icon">👤</div>
                                <div class="creator-item-content">
                                    <div class="creator-item-label">Desenvolupador</div>
                                    <div class="creator-item-value">Jaume Samodelà</div>
                                </div>
                            </div>
                            <div class="creator-item">
                                <div class="creator-item-icon">🐙</div>
                                <div class="creator-item-content">
                                    <div class="creator-item-label">GitHub</div>
                                    <div class="creator-item-value">
                                        <a href="https://github.com/jaumesaa" target="_blank">github.com/jaumesaa</a>
                                    </div>
                                </div>
                            </div>
                            <div class="creator-item">
                                <div class="creator-item-icon">📦</div>
                                <div class="creator-item-content">
                                    <div class="creator-item-label">Repositori</div>
                                    <div class="creator-item-value">
                                        <a href="https://github.com/jaumesaa/SoftCatal-4VSCode" target="_blank">SoftCatal-4VSCode</a>
                                    </div>
                                </div>
                            </div>
                            <div class="creator-item">
                                <div class="creator-item-icon">⭐</div>
                                <div class="creator-item-content">
                                    <div class="creator-item-label">Si t'agrada, dona una estrella!</div>
                                    <div class="creator-item-value">La teva estrella ens ajuda a créixer</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">
                            <span class="settings-section-icon">ℹ️</span>
                            Informació de la versió
                        </div>
                        <div class="settings-description">
                            <strong>SoftCatalà</strong> v0.2.0<br>
                            Corrector ortogràfic i gramatical per al català.<br><br>
                            Suporta dos modes:<br>
                            • <strong>🌐 Online:</strong> Usa l'API de SoftCatalà (recomanat)<br>
                            • <strong>📦 Offline:</strong> Usa servidor LanguageTool local
                        </div>
                    </div>

                    <div class="settings-section danger-section">
                        <div class="settings-section-title">
                            <span class="settings-section-icon">🗑️</span>
                            Emmagatzematge
                        </div>
                        <div class="storage-info">
                            <div class="storage-icon">💾</div>
                            <div class="storage-text">
                                LanguageTool local: <span class="storage-size">~100MB</span>
                            </div>
                        </div>
                        <div class="settings-description">
                            Elimina la còpia local de LanguageTool per alliberar espai. Això deshabilitarà la correcció offline de manera permanent.
                        </div>
                        <button class="delete-btn" onclick="deleteLanguageTool()" disabled>
                            🗑️ Eliminar LanguageTool local
                            <span class="status-badge coming-soon">Properament</span>
                        </button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Inicialitzar el checkbox de capitalització
                function initializeCapitalizationCheckbox() {
                    const checkbox = document.getElementById('disableCapitalizationCheckbox');
                    if (checkbox) {
                        // Aquí s'inicialitzaria amb el valor de config si es pogués
                        // Per ara, es deixa unchecked per defecte
                        checkbox.checked = false;
                    }
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'update') {
                        updateUI(message.errors, message.isLoading, message.connectionStatus, message.isExtensionActive, message.showSettings);
                    } else if (message.type === 'init') {
                        // Inicialitzar configuració guardada
                        const verbFormsSelect = document.getElementById('verbFormsSelect');
                        const disableCapitalizationCheckbox = document.getElementById('disableCapitalizationCheckbox');
                        
                        if (verbFormsSelect && message.verbForms) {
                            verbFormsSelect.value = message.verbForms;
                        }
                        
                        if (disableCapitalizationCheckbox && message.disableCapitalization !== undefined) {
                            disableCapitalizationCheckbox.checked = message.disableCapitalization;
                        }
                    }
                });

                function updateUI(errors, isLoading, connectionStatus, isExtensionActive, showSettings) {
                    // Actualitzar botons d'activació/pausa
                    updateActivationButtons(isExtensionActive);

                    // Actualitzar estat de connexió
                    updateConnectionStatus(connectionStatus);

                    // Si es mostren les configuracions, no actualitzar el contingut d'errors
                    if (showSettings) {
                        document.getElementById('content').style.display = 'none';
                        document.getElementById('settingsView').classList.add('active');
                        document.getElementById('settingsBtn').style.display = 'none';
                        document.getElementById('backBtn').style.display = 'block';
                        return;
                    } else {
                        document.getElementById('content').style.display = 'block';
                        document.getElementById('settingsView').classList.remove('active');
                        document.getElementById('settingsBtn').style.display = 'block';
                        document.getElementById('backBtn').style.display = 'none';
                    }

                    const content = document.getElementById('content');

                    // Si l'extensió no està activa, mostrar panell d'inactivitat
                    if (!isExtensionActive) {
                        content.innerHTML = \`
                            <div class="inactive-state">
                                <div class="inactive-state-icon">⏸</div>
                                <div class="inactive-state-text">Extensió pausada</div>
                                <p>Prem el botó ACTIVAR per començar a detectar errors</p>
                            </div>
                        \`;
                        return;
                    }

                    if (isLoading) {
                        content.innerHTML = \`
                            <div class="loading">
                                <div class="spinner"></div>
                                <div>Detectant errors...</div>
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

                function updateConnectionStatus(status) {
                    const statusDiv = document.getElementById('connectionStatus');
                    const settingsDiv = document.getElementById('settings');
                    const indicator = document.getElementById('statusIndicator');
                    const statusText = document.getElementById('statusText');
                    const countdownDiv = document.getElementById('countdownDiv');
                    const countdownValue = document.getElementById('countdownValue');

                    if (!status || status.online) {
                        // Connectat
                        statusDiv.style.display = 'none';
                        settingsDiv.style.display = 'block';
                        countdownDiv.style.display = 'none';
                    } else {
                        // Desconnectat o amb errors
                        statusDiv.style.display = 'flex';
                        settingsDiv.style.display = 'block';
                        
                        if (status.errorCount > 0 && status.errorCount <= 2) {
                            // Intent de reconexió
                            indicator.className = 'status-indicator reconnecting';
                            statusText.className = 'status-text';
                            statusText.innerHTML = \`Intentant reconectar... (\${status.errorCount})\`;
                            countdownDiv.style.display = 'block';
                        } else if (status.errorCount > 2) {
                            // Desconnectat
                            indicator.className = 'status-indicator offline';
                            statusText.className = 'status-text offline';
                            statusText.innerHTML = '⚠️ Sense connexió. Usant caché.';
                            countdownDiv.style.display = 'block';
                        } else {
                            // Desconnectat
                            indicator.className = 'status-indicator offline';
                            statusText.className = 'status-text offline';
                            statusText.innerHTML = '⚠️ Desconnectat de la xarxa';
                            countdownDiv.style.display = 'none';
                        }

                        // Actualitzar countdown
                        if (status.retryCountdown !== undefined) {
                            countdownValue.textContent = status.retryCountdown;
                        }
                    }
                }

                function changeVerbForms(value) {
                    vscode.postMessage({
                        type: 'verbFormsChanged',
                        verbForms: value
                    });
                }

                function toggleCapitalization(checked) {
                    vscode.postMessage({
                        type: 'capitalizationToggled',
                        disabled: checked
                    });
                }

                function switchToOffline() {
                    vscode.postMessage({
                        type: 'offlineMode'
                    });
                }

                function switchToOnline() {
                    vscode.postMessage({
                        type: 'onlineMode'
                    });
                }

                function updateActivationButtons(isActive) {
                    const onlineBtn = document.getElementById('onlineBtn');
                    const offlineBtn = document.getElementById('offlineBtn');
                    const pauseBtn = document.getElementById('pauseBtn');
                    const settings = document.getElementById('settings');

                    if (isActive) {
                        // Extensión activa: mostrar botón PAUSAR, ocultar ONLINE/OFFLINE
                        if (onlineBtn) onlineBtn.style.display = 'none';
                        if (offlineBtn) offlineBtn.style.display = 'none';
                        if (pauseBtn) pauseBtn.style.display = 'block';
                        if (settings) settings.style.display = 'block';
                    } else {
                        // Extensión pausada: mostrar ONLINE/OFFLINE, ocultar PAUSAR
                        if (onlineBtn) onlineBtn.style.display = 'block';
                        if (offlineBtn) offlineBtn.style.display = 'block';
                        if (pauseBtn) pauseBtn.style.display = 'none';
                        if (settings) settings.style.display = 'none';
                    }
                }

                function activateOnlineMode() {
                    vscode.postMessage({
                        type: 'extensionActivated',
                        mode: 'online'
                    });
                }

                function activateOfflineMode() {
                    vscode.postMessage({
                        type: 'extensionActivated',
                        mode: 'offline'
                    });
                }

                function pauseExtension() {
                    vscode.postMessage({
                        type: 'extensionPaused'
                    });
                }

                function openSettings() {
                    vscode.postMessage({
                        type: 'settingsClicked'
                    });
                }

                function backFromSettings() {
                    vscode.postMessage({
                        type: 'backFromSettings'
                    });
                }

                function deleteLanguageTool() {
                    vscode.postMessage({
                        type: 'deleteLanguageTool'
                    });
                }

                // Inicialitzar el panel quan es carrega
                document.addEventListener('DOMContentLoaded', () => {
                    initializeCapitalizationCheckbox();
                });
            </script>
        </body>
        </html>`;
    }
}
