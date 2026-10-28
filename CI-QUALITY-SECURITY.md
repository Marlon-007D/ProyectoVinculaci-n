# Calidad y seguridad del código

El repositorio usa GitHub Actions como verificación automática principal para cada push y pull request, sin importar la rama. La compilación ejecuta `npm ci` y `npm run build` (incluye el chequeo de TypeScript) con valores públicos de marcador para no requerir secretos de despliegue. El análisis de SonarQube Cloud es obligatorio: el workflow falla si faltan sus credenciales, si el escaneo no puede completarse o si no se cumple el Quality Gate. Snyk Code se ejecuta cuando se configura su token.

## GitHub Actions

En la configuración del repositorio, agrega estos valores:

| Tipo | Nombre | Uso |
| --- | --- | --- |
| Secret | `SONAR_TOKEN` | Token de análisis de SonarQube Cloud |
| Variable | `SONAR_ORGANIZATION` | Clave de la organización en SonarQube Cloud |
| Secret | `SNYK_TOKEN` | Token de Snyk con Snyk Code habilitado |

Importa este repositorio en [SonarQube Cloud](https://sonarcloud.io/) y configura el Quality Gate `SonarQube analysis` como check requerido en las reglas de protección de la rama principal. El identificador de proyecto está en `sonar-project.properties`; debe coincidir con la clave mostrada en SonarQube Cloud. Si la organización o clave asignadas son distintas, actualiza `SONAR_ORGANIZATION` en GitHub y `sonar.projectKey` en el archivo de propiedades.

Para que GitHub impida integrar cambios cuando falle un check, marca también `Typecheck and build` como requerido en las reglas de protección. Sin esa regla, GitHub mostrará el resultado, pero no bloqueará el merge por sí solo.

## SonarQube local con Docker

El archivo `compose.sonarqube.yml` levanta SonarQube Community Build solo en `127.0.0.1:9000` y persiste sus datos en volúmenes Docker. No publica el servidor en la red.

```powershell
docker compose -f compose.sonarqube.yml up -d
```

Abre [http://localhost:9000](http://localhost:9000) y, en el primer ingreso, cambia la contraseña inicial `admin` / `admin`. Crea un token de análisis en **My Account → Security**. Para escanear este checkout desde PowerShell, define ese token en `SONAR_TOKEN` y ejecuta el scanner oficial:

```powershell
$env:SONAR_TOKEN = "TOKEN_LOCAL"
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 -e SONAR_TOKEN -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli
```

Este análisis local usa el servidor Docker. Actions usa SonarQube Cloud y requiere un token Cloud distinto, guardado como `SONAR_TOKEN` en los secretos del repositorio.

## Jenkins

`Jenkinsfile` ofrece el mismo build y los análisis como pipeline alternativo. Configura:

- NodeJS Plugin con una instalación llamada `Node 22`.
- SonarQube Scanner Plugin, una instalación de servidor llamada `SonarQube` y `sonar-scanner` disponible en el agente. Para usar el SonarQube local, la URL configurada debe ser accesible desde el agente Jenkins.
- Una credencial de tipo Secret text con ID `SNYK_TOKEN`.
- Configura el servidor y token en `SonarQube` dentro del plugin. Para SonarQube Cloud, define `SONAR_ORGANIZATION`; para Server, configura la URL en la instalación del servidor de Jenkins.
- El plugin Workspace Cleanup para que `cleanWs()` elimine el workspace al finalizar.

Conecta el repositorio a Jenkins mediante un Multibranch Pipeline/webhook si se desea ejecutar este pipeline en cada cambio. GitHub Actions sigue siendo el CI principal; habilitar ambas automatizaciones sobre los mismos eventos duplica ejecuciones.

## Alcance

Estas configuraciones analizan y compilan el repositorio. No publican automáticamente a Vercel ni cambian las funciones visibles de la aplicación. El despliegue continúa siendo manual con `npm run deploy`.
