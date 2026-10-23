# Prueba de Google OAuth y solicitudes pendientes

> Guía de la integración OAuth preparada en el directorio de trabajo. Este commit aislado de administración no cambia las rutas de autenticación de la rama destino. Para ejecutar la etapa A se requiere integrar por separado ese frontend; las etapas de seed, listado y aprobación sí forman parte de esta entrega.

## URL directa de El Esfuerzo

[Abrir login de Unidad Educativa El Esfuerzo](http://localhost:5173/login?institution=f96873d4-9deb-4b8d-9677-348861cbd277&slug=ue-el-esfuerzo)

```text
http://localhost:5173/login?institution=f96873d4-9deb-4b8d-9677-348861cbd277&slug=ue-el-esfuerzo
```

Si el servidor no está iniciado, desde la raíz activa ejecutar:

```powershell
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

La URL es un dato de prueba, no una configuración fija de los componentes.
`AuthPage` obtiene ambos parámetros de `location.search`; el callback OAuth los
conserva en `/panel/admin`, y el formulario los envía a las RPC. El servidor
verifica que el ID y el slug correspondan a la misma institución activa.

## Preparación

1. Habilitar Google en Supabase Authentication con las credenciales del proveedor.
   En Google Cloud, usar el callback que indica Supabase, no la URL del login local.
2. En Supabase Authentication > URL Configuration autorizar el origen local y el
   retorno `http://localhost:5173/panel/admin` con parámetros variables. Una regla
   limitada a esta ruta es `http://localhost:5173/panel/admin**`.
3. Aplicar `drizzle/0009_admin_membership_requests.sql` si aún no está instalado.
   Los pasos están en [README.md](./README.md). Debe existir la RPC
   `assign_institution_role` de seis parámetros y los roles del catálogo.
4. Usar un Gmail confirmado sin membresía previa, y otra cuenta con membresía
   activa de Administrador institucional en El Esfuerzo. Mantener ambas sesiones
   en ventanas o perfiles separados. No usar la cuenta del administrador como
   solicitante.

La comprobación del 2026-10-22 encontró El Esfuerzo activo con el ID y slug
indicados. La tabla de solicitudes responde `401 / 42501` al acceso anónimo,
que es el resultado esperado de sus permisos. Esto no comprueba las RPC con
sesión ni sustituye la prueba completa con Google.

## A. Persona solicitante, en incógnito

1. Abrir la URL directa anterior. Debe verse «Continuar con Google».
2. Seleccionar el Gmail sin membresía y completar el consentimiento.
3. El retorno debe conservar `institution` y `slug`. Tras validar la sesión,
   `/panel/admin` devuelve a `/login` y muestra «Solicitud de acceso». No debe
   concederse acceso a un módulo ni producirse un bucle de redirección.
4. Completar nombres, apellidos y celular ecuatoriano de diez dígitos que empiece
   con `09`; pulsar «Enviar solicitud».
5. Debe verse «Pendiente de aprobación». «Consultar estado» permite revisar la
   misma solicitud sin crear otra ni cambiar de institución.

## B. Verificación en Supabase

Estas consultas son de lectura. Ejecutarlas en SQL Editor con permisos de
administración; la clave anónima del frontend no permite listar solicitudes.

```sql
SELECT institution_id, slug, is_active
FROM public.institutions
WHERE institution_id = 'f96873d4-9deb-4b8d-9677-348861cbd277'
  AND slug = 'ue-el-esfuerzo';

-- Sustituir el texto por el correo de la cuenta usada en esta prueba.
SELECT r.request_id, r.institution_id, r.status, r.reviewed_at,
       m.role_id, m.is_active
FROM public.admin_membership_requests r
JOIN auth.users u ON u.id = r.profile_id
LEFT JOIN public.memberships m
  ON m.profile_id = r.profile_id AND m.institution_id = r.institution_id
WHERE r.institution_id = 'f96873d4-9deb-4b8d-9677-348861cbd277'
  AND lower(u.email) = lower('REEMPLAZAR_CON_GMAIL_DE_PRUEBA');
```

Antes de aprobar: una solicitud, `status = pending`, `reviewed_at IS NULL` y
ningún rol nuevo. Una solicitud pendiente no equivale a una membresía activa.

## C. Administrador institucional, en otra ventana

1. Abrir e iniciar sesión en:
   [panel de El Esfuerzo](http://localhost:5173/panel/admin?institution=f96873d4-9deb-4b8d-9677-348861cbd277&slug=ue-el-esfuerzo).
2. Comprobar que la institución activa sea El Esfuerzo y abrir «Usuarios
   Registrados». Debe aparecer la cuenta con «Pendiente de aprobación» y su
   contador debe incluirla.
3. En ACCIONES, seleccionar «Gestor de proyectos» o «Equipo DECE» en
   «Aprobar y asignar rol».
4. Tras la confirmación, la cuenta debe desaparecer de «Usuarios Registrados»
   y aparecer en «Personal y Equipo» con el rol elegido. Los contadores se
   actualizan tras consultar nuevamente el servidor; «Estudiantes» no cambia.
5. Repetir la consulta SQL: `status = approved`, `reviewed_at` informado y
   membresía activa con el rol elegido. La RPC hace ambos cambios en una
   transacción; si falla, la solicitud permanece pendiente.
6. En la ventana del solicitante, pulsar «Consultar estado» y «Continuar al
   panel». Se vuelve a validar la membresía; se aplican las verificaciones MFA
   existentes y el destino correspondiente al rol. Para una comprobación adicional,
   cerrar sesión y entrar de nuevo con la misma URL institucional.

## Otras unidades: mismo recorrido

Pares verificados en el catálogo público el 2026-10-22:

| Institución | `institution` | `slug` |
| --- | --- | --- |
| El Esfuerzo | `f96873d4-9deb-4b8d-9677-348861cbd277` | `ue-el-esfuerzo` |
| Puerto Limón | `b99ed19a-459e-4823-a986-810714336405` | `ue-puerto-limon` |
| Luz de América | `816d15bb-3f56-43a7-be71-0caaf8c6a9c1` | `ue-luz-de-america` |
| La Concordia | `46701fcc-be73-4c0f-bdb4-ce65d65b5a8d` | `ue-la-concordia` |

Sustituir ambos parámetros en la URL y usar un administrador de esa institución.
No hay que editar componentes para agregar otra institución: debe estar activa
en el catálogo y tener un administrador autorizado. Los parámetros seleccionan
el contexto; nunca otorgan permisos.

## Casos de rechazo

- Cancelar Google: mostrar un mensaje y permitir reintentar.
- Repetir «Enviar solicitud»: no duplicar la solicitud para esa cuenta e institución.
- Cambiar solo el slug por el de otra institución: rechazar el contexto incoherente.
- Entrar como administrador de otro colegio: no ver ni aprobar la solicitud de El Esfuerzo.
- Intentar asignar Super Admin o aprobarse a uno mismo: rechazar en el servidor.
- Usar una membresía desactivada: no reactivarla mediante este flujo.

## Evidencia y límites

Las pruebas automatizadas verifican los cuatro pares en el parseo de URL y el
callback OAuth, y ejecutan solicitud y aprobación por institución en PostgreSQL
embebido, sin escribir en Supabase. También cubren RLS y reversión de la
transacción ante errores. Consultar los comandos en [README.md](./README.md).

El consentimiento real de Google y la aprobación en el Supabase desplegado
requieren las cuentas anteriores. No se marcaron como ejecutados desde este chat.
Al hacer la prueba manual, registrar por cada institución: retorno con contexto,
solicitud pendiente, aprobación, cambio de contador y acceso posterior con el rol.
