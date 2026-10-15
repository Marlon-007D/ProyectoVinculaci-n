# Checklist reproducible de smoke tests DECE

Requisitos: llenar `.env.test` con las credenciales del proyecto Supabase de pruebas y levantar la app con `npm run dev`. Usar exclusivamente las cuentas y filas ficticias indicadas por el proyecto. No usar datos reales de estudiantes.

## Gestión de estudiantes

- [ ] `dece1@prueba.test` abre `/ue-el-esfuerzo/dece/estudiantes`; la lista carga solo estudiantes de esa institución, ordenados por apellido y nombres, en páginas de 25 con total.
- [ ] Buscar por cédula y apellido con debounce. Probar caracteres `, ( ) % *` y confirmar que no alteran el filtro ni rompen la consulta.
- [ ] Registrar un estudiante ficticio con cédula de 10 dígitos, al menos un nombre y un apellido, y un grado de la lista. Sin filtro debe aparecer en la página actual sin recargar, enfocar la fila y actualizar el total/estadística del dashboard. Con búsqueda que no coincide, conservarla y ofrecer limpiar el filtro.
- [ ] Cambiar nombre, cédula y grado: el detalle, fila al volver, directorio y estadísticas del dashboard deben mostrar los datos nuevos sin recargar.
- [ ] Buscar y llegar a página 2; editar el estudiante y comprobar que se conserva el texto de búsqueda, la página y el scroll.
- [ ] Escribir números o símbolos en nombres/apellidos, o dejar vacío el nombre o apellido: se rechaza con un mensaje claro. El grado solo se puede escoger en el select.
- [ ] Buscar rápidamente y luego guardar; comprobar que una respuesta de búsqueda anterior no reemplaza los datos más recientes.
- [ ] Cédula con 9 dígitos o letras: se rechaza en pantalla. Cédula duplicada o error de permisos: muestra el error actual y conserva el listado sin cambios.
- [ ] Editar nombres y cédula desde `/ue-el-esfuerzo/dece/estudiantes/<student_id>`; comprobar los cambios al recargar. La URL no debe contener cédula ni nombres.
- [ ] `dece2@prueba.test` en `ue-puerto-limon` no ve el estudiante creado por `dece1`.
- [ ] `admin1@prueba.test` y `est1@prueba.test` reciben 403 al abrir `/ue-el-esfuerzo/dece/estudiantes` o su detalle.
- [ ] Con un estudiante ficticio sin cuenta (`profile_id` nulo), `dece1` abre y guarda su ficha; revisar que el envío quede asociado al UUID correcto de `students.student_id`.
- [ ] Revisar `audit_events`: debe registrar la acción y solo nombres de campos cambiados en el payload, sin valores personales. Si no se inserta, comprobar la solicitud documentada en `docs/solicitudes-bd.md`.

## Acceso y aislamiento

- [ ] `dece1@prueba.test`: iniciar sesión en `/ue-el-esfuerzo/login`; debe abrir el DECE y mostrar solo a Ana Prueba Uno.
- [ ] `dece2@prueba.test`: iniciar sesión en `/ue-puerto-limon/login`; debe abrir el DECE y mostrar solo a Luis Prueba Dos.
- [ ] `dece1@prueba.test`: intentar iniciar sesión en `/ue-puerto-limon/login`; debe cerrar la sesión y mostrar “No tienes acceso a esta institución”.
- [ ] `admin1@prueba.test`: iniciar sesión en `/ue-el-esfuerzo/login`; debe abrir el placeholder de administración, sin directorio ni casos DECE.
- [ ] `est1@prueba.test`: iniciar sesión en `/ue-el-esfuerzo/login`; solo debe cargar su ficha vinculada, la ficha general publicada y sus respuestas.
- [ ] Cerrar sesión y recargar; no debe quedar contenido protegido visible.

## Escrituras y documentos

- [ ] `dece1` crea un caso ficticio y lo ve en el historial; `dece2` no debe verlo.
- [ ] `est1` guarda el borrador, lo envía y ya no puede editarlo; `dece1` puede revisarlo y marcarlo como revisado.
- [ ] `est1` abre “Mi historial”, ve sus borradores y envíos, puede abrir sus respuestas y no ve fichas de otra cuenta.
- [ ] `dece1` sube un documento ficticio a `<institution_id>/<archivo>`; `admin1` no puede leerlo.

Registrar cualquier fallo de autorización en `docs/solicitudes-bd.md`; no corregir permisos desde la interfaz.

## Estado de ejecución

No se ejecutó el checklist contra Supabase porque este checkout no tiene `.env.test`. No se usó `.env` para evitar ejecutar escrituras con credenciales cuyo proyecto y rol no están verificados. La compilación del frontend se valida por separado.

## Estado en este repositorio

Los casos, historial, documentos y bucket no se pueden ejecutar desde este checkout: no contiene las migraciones base ni la configuración de almacenamiento. El flujo de formularios y autenticación sí compila, pero la ejecución de estos casos requiere `.env`, proyecto de pruebas y las cuentas anteriores.
