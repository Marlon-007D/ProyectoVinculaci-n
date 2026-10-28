# Calidad y seguridad del código

El repositorio usa GitHub Actions como verificación automática principal para cada push y pull request a `main`, `master` o `develop`. La compilación ejecuta `npm ci` y `npm run build` (incluye el chequeo de TypeScript). SonarQube y Snyk Code se ejecutan cuando sus credenciales están configuradas.

## GitHub Actions

En la configuración del repositorio, agrega estos valores:

| Tipo | Nombre | Uso |
| --- | --- | --- |
| Secret | `SONAR_TOKEN` | Token del proyecto SonarQube |
| Variable | `SONAR_HOST_URL` | URL de SonarQube Server; omitir para SonarQube Cloud |
| Variable | `SONAR_ORGANIZATION` | Organización de SonarQube Cloud; omitir para Server |
| Secret | `SNYK_TOKEN` | Token de Snyk con Snyk Code habilitado |

El `sonar.projectKey` y el nombre iniciales están en `sonar-project.properties`. Si el proyecto registrado en SonarQube usa otra clave, actualiza `sonar.projectKey` para que coincida.

Los escaneos que no tienen token configurado se marcan como omitidos en el resumen del workflow; no bloquean el build. Configura ambos secretos para activar los escaneos. Después, si deben ser obligatorios para integrar cambios, marca esos checks como requeridos en las reglas de protección de ramas de GitHub.

## Jenkins

`Jenkinsfile` ofrece el mismo build y los dos análisis como pipeline alternativo. Configura:

- NodeJS Plugin con una instalación llamada `Node 22`.
- SonarQube Scanner Plugin, una instalación de servidor llamada `SonarQube` y `sonar-scanner` disponible en el agente.
- Una credencial de tipo Secret text con ID `SNYK_TOKEN`.
- `SONAR_TOKEN` como variable de entorno protegida del job. Para SonarQube Cloud, define también `SONAR_ORGANIZATION`; para Server, define `SONAR_HOST_URL` en la instalación de servidor de Jenkins.
- El plugin Workspace Cleanup para que `cleanWs()` elimine el workspace al finalizar.

Conecta el repositorio a Jenkins mediante un Multibranch Pipeline/webhook si se desea ejecutar este pipeline en cada cambio. GitHub Actions sigue siendo el CI principal; habilitar ambas automatizaciones sobre los mismos eventos duplica ejecuciones.

## Alcance

Estas configuraciones analizan y compilan el repositorio. No publican automáticamente a Vercel ni cambian las funciones visibles de la aplicación. El despliegue continúa siendo manual con `npm run deploy`.
