# Hone Optimizador (Windows)

App de escritorio no oficial inspirada en Hone. Abre en su propia ventana y realiza dos ajustes reales y reversibles en el perfil actual de Windows:

- Activar o desactivar el Modo Juego de Windows.
- Desactivar o restaurar Game DVR/capturas en segundo plano.

Antes de cambiar un valor, guarda el original en la carpeta de datos de la app. El botón **Restaurar valores originales** recupera esos valores. Desactivar Game DVR puede impedir grabar clips o capturas de Xbox Game Bar. Los cambios no garantizan FPS adicionales.

No desactiva servicios, no mata procesos, no altera drivers ni el registro de todo el equipo. No requiere permisos de administrador porque los ajustes son del usuario actual.

## Publicar el instalador en GitHub

1. Descarga `hone-desktop-github.zip` y extráelo.
2. Instala y abre GitHub Desktop. Inicia sesión.
3. En GitHub Desktop selecciona **File → Clone repository**, busca `tocelpepo-crypto/hogar-en-orden-real` y pulsa **Clone**.
4. Abre la carpeta local del repositorio desde GitHub Desktop (**Show in Explorer**).
5. Copia dentro de esa carpeta los archivos del ZIP: `index.html`, `main.cjs`, `preload.cjs`, `package.json`, `README.md` y la carpeta `.github`. Si pregunta si quieres reemplazar archivos, acepta.
6. Vuelve a GitHub Desktop. En **Changes**, escribe `Crear optimizador de Windows`, pulsa **Commit to main** y después **Push origin**.
7. Abre el repositorio en GitHub → **Releases** → **Draft a new release**. En la etiqueta elige/crea `v1.0.0`, selecciona `main`, escribe el título `Hone Optimizador 1.0.0` y publica el release.
8. Ve a **Actions** y espera que **Crear instalador de Windows** termine en verde. El flujo compila la app con Electron y sube el instalador al release.
9. En **Releases**, abre `v1.0.0` y copia el enlace del archivo `Hone-Optimizador-Setup-1.0.0.exe`.

Para probar o compilar manualmente, instala Node.js 22, abre una terminal en esta carpeta y ejecuta `npm install` y `npm run dist`. El instalador aparecerá en `dist/`.
