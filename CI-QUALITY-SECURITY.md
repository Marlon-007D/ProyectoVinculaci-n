# Calidad y seguridad del código

El repositorio usa GitHub Actions como verificación automática principal para cada push y pull request, sin importar la rama. La compilación ejecuta `npm ci` y `npm run build` (incluye el chequeo de TypeScript) con valores públicos de marcador para no requerir secretos de despliegue. SonarQube y Snyk Code se ejecutan automáticamente cuando sus credenciales están configuradas; cuando se ejecutan, el workflow falla si el escaneo no puede completarse, se incumple el Quality Gate de SonarQube o se encuentran hallazgos de Snyk Code.

## GitHub Actions

En la configuración del repositorio, agrega estos valores:

| Tipo | Nombre | Uso |
| --- | --- | --- |
| Secret | `SONAR_TOKEN` | Token del proyecto SonarQube |
| Variable | `SONAR_HOST_URL` | URL de SonarQube Server; omitir para SonarQube Cloud |
| Variable | `SONAR_ORGANIZATION` | Organización de SonarQube Cloud; omitir para Server |
| Secret | `SNYK_TOKEN` | Token de Snyk con Snyk Code habilitado |

La clave y el nombre compartidos del proyecto están en `sonar-project.properties`. Si el proyecto registrado en SonarQube usa otra clave, actualiza `sonar.projectKey` para que coincida.

Configura ambos secretos y las variables de SonarQube para habilitar los análisis externos. Para que GitHub impida integrar cambios cuando falle un check, marca `Typecheck and build`, `SonarQube analysis` y `Snyk Code analysis` como checks requeridos en las reglas de protección de ramas. Sin esa regla, GitHub mostrará el estado del workflow, pero no bloqueará el merge por sí solo.

## Jenkins

`Jenkinsfile` ofrece el mismo build y los dos análisis como pipeline alternativo. Configura:

- NodeJS Plugin con una instalación llamada `Node 22`.
- SonarQube Scanner Plugin, una instalación de servidor llamada `SonarQube` y `sonar-scanner` disponible en el agente.
- Una credencial de tipo Secret text con ID `SNYK_TOKEN`.
- Configura el servidor y token en `SonarQube` dentro del plugin. Para SonarQube Cloud, define `SONAR_ORGANIZATION`; para Server, define `SONAR_HOST_URL` en la instalación del servidor de Jenkins.
- El plugin Workspace Cleanup para que `cleanWs()` elimine el workspace al finalizar.

Conecta el repositorio a Jenkins mediante un Multibranch Pipeline/webhook si se desea ejecutar este pipeline en cada cambio. GitHub Actions sigue siendo el CI principal; habilitar ambas automatizaciones sobre los mismos eventos duplica ejecuciones.

## Alcance

Estas configuraciones analizan y compilan el repositorio. No publican automáticamente a Vercel ni cambian las funciones visibles de la aplicación. El despliegue continúa siendo manual con `npm run deploy`.
