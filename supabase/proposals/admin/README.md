# Propuestas de base de datos: administración

## 202610300000_mfa_switch.sql (sin aplicar)

Interruptor reversible del segundo factor para la demo. Complementa a `VITE_MFA_ENABLED` del frontend (ver `CLAUDE.md`).

| Parte | Qué hace | Riesgo |
|---|---|---|
| A. Diagnóstico | Lista perfiles con `mfa_required`/`mfa_enabled`, funciones que exigen `aal2`, políticas relacionadas y las definiciones actuales. Solo lectura. | Ninguno. |
| B. Desactivar | Crea `mfa_enforced()` (false) y hace que `projects_session_verified()` y las dos RPC `own_mfa_*` la consulten. Con false, proyectos/portal dejan de exigir `aal2` y el frontend no recibe "pide código/enrolar". No toca datos de perfiles ni borra funciones. | Mientras esté apagado, una cuenta con contraseña robada accede a proyectos/portal sin segundo factor. Si la función en producción difiere de la del repo, `CREATE OR REPLACE` la pisa: por eso se compara A6 antes. |
| C. Reactivar | Vuelve `mfa_enforced()` a true; el comportamiento es el original. | Las cuentas con `mfa_required` verán el enrolamiento y las de `mfa_enabled` pedirán código. |

`complete_own_mfa_enrollment()` y las columnas de `profiles` no se modifican, para poder reactivar sin perder qué cuentas tenían MFA.
