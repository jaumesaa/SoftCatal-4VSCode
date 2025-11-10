import * as vscode from 'vscode';

export interface CommentRange {
    range: vscode.Range;
    text: string;
    offset: number;
}

/**
 * Parser de comentaris per a diferents llenguatges de programació
 */
export class CommentParser {
    /**
     * Extreu tots els comentaris d'un document
     */
    public static extractComments(document: vscode.TextDocument): CommentRange[] {
        const languageId = document.languageId;
        const text = document.getText();
        const comments: CommentRange[] = [];

        // Obtenir els patrons de comentaris segons el llenguatge
        const patterns = this.getCommentPatterns(languageId);

        for (const pattern of patterns) {
            const regex = new RegExp(pattern.regex, 'gm');
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const matchText = match[0];
                const offset = match.index;

                // Extreure el text del comentari sense els delimitadors
                let commentText = this.extractCommentText(matchText, pattern.type);

                // Saltar comentaris buits o molt curts
                if (commentText.trim().length < 3) {
                    continue;
                }

                const startPos = document.positionAt(offset);
                const endPos = document.positionAt(offset + matchText.length);

                comments.push({
                    range: new vscode.Range(startPos, endPos),
                    text: commentText,
                    offset: offset
                });
            }
        }

        return comments;
    }

    /**
     * Obté els patrons de comentaris per al llenguatge especificat
     */
    private static getCommentPatterns(languageId: string): Array<{ regex: string; type: string }> {
        const patterns: Array<{ regex: string; type: string }> = [];

        // Llenguatges amb comentaris // i /* */
        const cStyleLanguages = [
            'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp',
            'go', 'rust', 'swift', 'kotlin', 'scala', 'php',
            'jsx', 'tsx', 'vue', 'css', 'scss', 'less', 'objective-c'
        ];

        // Llenguatges amb comentaris #
        const hashStyleLanguages = [
            'python', 'ruby', 'perl', 'shell', 'bash', 'yaml',
            'powershell', 'r', 'makefile', 'dockerfile', 'toml'
        ];

        if (cStyleLanguages.includes(languageId)) {
            // Comentaris de línia simple //
            patterns.push({
                regex: '\\/\\/[^\\n]*',
                type: 'line'
            });

            // Comentaris de bloc /* */
            patterns.push({
                regex: '\\/\\*[\\s\\S]*?\\*\\/',
                type: 'block'
            });
        }

        if (hashStyleLanguages.includes(languageId)) {
            // Comentaris #
            patterns.push({
                regex: '#[^\\n]*',
                type: 'line'
            });

            // Python docstrings """ """ o ''' '''
            if (languageId === 'python') {
                patterns.push({
                    regex: '"""[\\s\\S]*?"""',
                    type: 'docstring'
                });
                patterns.push({
                    regex: "'''[\\s\\S]*?'''",
                    type: 'docstring'
                });
            }
        }

        if (languageId === 'html' || languageId === 'xml') {
            // Comentaris HTML <!-- -->
            patterns.push({
                regex: '<!--[\\s\\S]*?-->',
                type: 'block'
            });
        }

        if (languageId === 'lua') {
            patterns.push({
                regex: '--[^\\n]*',
                type: 'line'
            });
            patterns.push({
                regex: '--\\[\\[[\\s\\S]*?\\]\\]',
                type: 'block'
            });
        }

        if (languageId === 'sql') {
            patterns.push({
                regex: '--[^\\n]*',
                type: 'line'
            });
            patterns.push({
                regex: '\\/\\*[\\s\\S]*?\\*\\/',
                type: 'block'
            });
        }

        // Si no hem trobat patrons, retornem buit
        return patterns;
    }

    /**
     * Extreu el text del comentari eliminant els delimitadors
     */
    private static extractCommentText(comment: string, type: string): string {
        switch (type) {
            case 'line':
                // Eliminar // o # del principi
                return comment.replace(/^(\/\/|#)\s*/, '');

            case 'block':
                // Eliminar /* */ o <!-- -->
                return comment
                    .replace(/^\/\*\s*/, '')
                    .replace(/\s*\*\/$/, '')
                    .replace(/^<!--\s*/, '')
                    .replace(/\s*-->$/, '')
                    .replace(/^\s*\*\s*/gm, ''); // Eliminar * de cada línia

            case 'docstring':
                // Eliminar """ """ o ''' '''
                return comment
                    .replace(/^(""""|'''')\s*/, '')
                    .replace(/\s*(""""|'''')$/, '');

            default:
                return comment;
        }
    }

    /**
     * Comprova si un llenguatge és un llenguatge de codi
     */
    public static isCodeLanguage(languageId: string): boolean {
        const codeLanguages = [
            'javascript', 'typescript', 'python', 'java', 'c', 'cpp',
            'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
            'scala', 'html', 'css', 'scss', 'less', 'vue', 'jsx', 'tsx',
            'perl', 'shell', 'bash', 'yaml', 'powershell', 'r',
            'makefile', 'dockerfile', 'toml', 'lua', 'sql', 'xml',
            'objective-c'
        ];

        return codeLanguages.includes(languageId);
    }
}
