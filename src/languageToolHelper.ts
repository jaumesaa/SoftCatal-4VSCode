import * as path from 'path';
import * as fs from 'fs';

/**
 * Helper para acceder a LanguageTool que está en globalStorage o bundled en la extensión
 */
export class LanguageToolHelper {
    /**
     * Obtiene la ruta a la carpeta raíz de LanguageTool, buscando primero en globalStorage
     */
    public static getLanguageToolPath(extensionPath: string, globalStoragePath?: string): string {
        // Primero buscar en globalStorage (donde se copia/descarga)
        if (globalStoragePath) {
            const globalPath = path.join(globalStoragePath, 'languagetool', 'LanguageTool-6.0');
            if (fs.existsSync(globalPath)) {
                return globalPath;
            }
        }
        
        // Fallback: buscar en la extensión (bundled)
        return path.join(extensionPath, 'languagetool', 'LanguageTool-6.0');
    }

    /**
     * Obtiene la ruta al JAR del servidor
     */
    public static getServerJarPath(extensionPath: string, globalStoragePath?: string): string {
        return path.join(this.getLanguageToolPath(extensionPath, globalStoragePath), 'languagetool-server.jar');
    }

    /**
     * Obtiene la ruta a la carpeta de librerías
     */
    public static getLibsPath(extensionPath: string, globalStoragePath?: string): string {
        return path.join(this.getLanguageToolPath(extensionPath, globalStoragePath), 'libs');
    }

    /**
     * Verifica que LanguageTool está disponible
     */
    public static isAvailable(extensionPath: string, globalStoragePath?: string): boolean {
        const serverJarPath = this.getServerJarPath(extensionPath, globalStoragePath);
        const libsPath = this.getLibsPath(extensionPath, globalStoragePath);

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

        console.log('SoftCatalà: ✅ LanguageTool está disponible y completo en:', serverJarPath);
        return true;
    }

    /**
     * Elimina LanguageTool del globalStorage
     * Esto libera ~100MB de espacio pero deshabilita la corrección offline
     */
    public static deleteLanguageTool(globalStoragePath: string): boolean {
        const languageToolPath = path.join(globalStoragePath, 'languagetool');

        try {
            if (!fs.existsSync(languageToolPath)) {
                console.log('SoftCatalà: LanguageTool ya está eliminado');
                return true;
            }

            console.log('SoftCatalà: Eliminando LanguageTool de:', languageToolPath);

            // Eliminar recursivamente toda la carpeta languagetool
            this.removeDirectoryRecursive(languageToolPath);

            console.log('SoftCatalà: ✅ LanguageTool eliminado correctamente');
            return true;
        } catch (error) {
            console.error('SoftCatalà: Error eliminando LanguageTool:', error);
            return false;
        }
    }

    /**
     * Elimina un directorio recursivamente
     */
    private static removeDirectoryRecursive(dirPath: string): void {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const filePath = path.join(dirPath, file);
                if (fs.lstatSync(filePath).isDirectory()) {
                    this.removeDirectoryRecursive(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }
}
