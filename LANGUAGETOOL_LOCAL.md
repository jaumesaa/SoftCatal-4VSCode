# Servidor LanguageTool Incrustado

La extensión SoftCatalà incluye soporte para ejecutar un servidor LanguageTool local incrustado, permitiendo la corrección de catalán sin necesidad de conexión a internet.

## Requisitos

Para usar el servidor LanguageTool local, necesitas tener **Java instalado** en tu sistema.

### Instalar Java

- **macOS**: 
  ```bash
  brew install java
  ```

- **Ubuntu/Debian**:
  ```bash
  sudo apt-get install default-jre
  ```

- **Windows**:
  Descarga desde: https://www.java.com/es/download/

## Uso

1. Abre la extensión SoftCatalà
2. En el panel lateral, verás dos botones:
   - **"Usar API de SoftCatalà (online)"** - Usa el servidor online (requiere conexión)
   - **"Usar servidor LanguageTool local"** - Usa el servidor local incrustado

3. Selecciona el modo que prefieras. La extensión recordará tu elección.

## Descarga del servidor

La primera vez que actives el modo local, la extensión descargará automáticamente LanguageTool (~200MB).

Este proceso ocurre:
- Al compilar la extensión (`npm run compile`)
- Al empaquetar la extensión (`npm run package`)
- Manualmente: `npm run download-languagetool`

## Solución de problemas

### "Java no s'ha detectat instal·lat al sistema"

La extensión no ha podido encontrar Java. Verifica:
1. Java está instalado: `java -version`
2. Java está en el PATH
3. Si acabas de instalar Java, reinicia VS Code

### El servidor no inicia

- Verifica que el puerto 8081 no está ocupado
- Comprueba los logs en la consola de VS Code (Ctrl+Shift+` )
- Reinicia VS Code

### Mejor rendimiento offline

Una vez descargado, el servidor local proporciona:
- Velocidad más rápida (sin latencia de red)
- Correcciones offline completas
- Sin límites de solicitudes (a diferencia del API online)

## Desarrollo

Para descargar manualmente el servidor:
```bash
npm run download-languagetool
```

Esto descargará LanguageTool en la carpeta `languagetool/`.
