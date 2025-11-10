import * as vscode from 'vscode';

interface DiagnosticData {
    replacements: string[];
}

// Mapa per guardar les dades associades als diagnòstics
const diagnosticDataMap = new Map<vscode.Diagnostic, DiagnosticData>();

export function setDiagnosticData(diagnostic: vscode.Diagnostic, replacements: string[]) {
    diagnosticDataMap.set(diagnostic, { replacements });
}

export function getDiagnosticData(diagnostic: vscode.Diagnostic): DiagnosticData | undefined {
    return diagnosticDataMap.get(diagnostic);
}

export function clearDiagnosticData() {
    diagnosticDataMap.clear();
}
