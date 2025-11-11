import * as path from 'path';
import * as fs from 'fs';

/**
 * Helper para acceder a LanguageTool que está incrustado en la extensión
 */
export class LanguageToolHelper {
    /**
     * Obtiene la ruta a la carpeta raíz de LanguageTool
     */
    public static getLanguageToolPath(extensionPath: string): string {
        return path.join(extensionPath, 'languagetool', 'LanguageTool-6.0');
    }

    /**
     * Obtiene la ruta al JAR del servidor
     */
    public static getServerJarPath(extensionPath: string): string {
        return path.join(this.getLanguageToolPath(extensionPath), 'languagetool-server.jar');
    }

    /**
     * Obtiene la ruta a la carpeta de librerías
     */
    public static getLibsPath(extensionPath: string): string {
        return path.join(this.getLanguageToolPath(extensionPath), 'libs');
    }

    /**
     * Verifica que LanguageTool está disponible
     */
    public static isAvailable(extensionPath: string): boolean {
        const serverJarPath = this.getServerJarPath(extensionPath);
        const libsPath = this.getLibsPath(extensionPath);

        if (!fs.existsSync(serverJarPath)) {
            console.error('SoftCatalà: JAR de LanguageTool no encontrado en:', serverJarPath);
            return false;
        }

        if (!fs.existsSync(libsPath)) {
            console.error('SoftCatalà: Carpeta libs de LanguageTool no encontrada en:', libsPath);
            return false;
        }

        // Verificar que existe slf4j
        const libsEntries = fs.readdirSync(libsPath);
        const hasSlf4j = libsEntries.some(f => f.includes('slf4j'));
        if (!hasSlf4j) {
            console.error('SoftCatalà: No se encontró slf4j en libs');
            return false;
        }

        console.log('SoftCatalà: ✅ LanguageTool está disponible y completo');
        return true;
    }
}
