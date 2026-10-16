# Checklist reproducible de smoke tests DECE

Requisitos: llenar `.env.test` con credenciales del proyecto Supabase de pruebas (archivo ignorado por Git) y levantar la app con `npm run dev`. Usar exclusivamente cuentas y filas ficticias. No usar datos reales de estudiantes ni incluir credenciales en código o documentación.

## Casos de acompañamiento

- [ ] `dece1` crea un caso para un estudiante ficticio; se asigna `DECE-AAAA-0001` y el siguiente es `DECE-AAAA-0002`; ambos aparecen sin recargar.
- [ ] `dece1` registra una visita con 2 observaciones, edita la visita y una observación, y crea una acción con fecha y responsable.
- [ ] Marcar una acción como completada guarda `completed_at`; desmarcarla limpia `completed_at`.
- [ ] Pasar un caso por los 4 estados. Al cerrar con acciones pendientes, se informa la cantidad y no se permite continuar.
- [ ] El detalle del estudiante muestra sus casos y estados, permite abrir el detalle y tiene Nuevo caso con el estudiante seleccionado.
- [ ] El portal de rol `student` obtiene los casos mediante `dece_student_portal_summary()` en una sección independiente de las fichas y muestra número, estado, próxima acción/fecha y próxima visita futura; no expone motivo, notas u observaciones. Con otra cuenta, validar que no devuelve datos ajenos.
- [ ] `dece_student_portal_summary()` muestra un estado vacío claro cuando no hay casos ni visitas futuras; un error de RPC/permisos se comunica sin consultar directamente `dece_cases` o `dece_actions`.
- [ ] DECE puede cambiar rápidamente el estado desde cada fila; al intentar cerrar con acciones pendientes el cambio se rechaza y el select conserva el estado anterior.
- [ ] Crear caso sin seleccionar estudiante muestra un aviso obligatorio claro; guardar correctamente muestra confirmación SweetAlert2.
- [ ] Una fecha de próxima acción anterior al día siguiente de la primera visita se rechaza; el formulario muestra la fecha mínima válida.
- [ ] `dece2` de otra institución no ve los casos de `dece1`, tampoco al abrir directamente el UUID del detalle.
- [ ] `institution_admin`, `student` y anon reciben 403 o redirección en las rutas de listado y detalle.
- [ ] `audit_events` solo contiene nombres de campos y valores técnicos del estado; no contiene motivo, resumen, notas, observaciones, nombres ni cédulas.
- [ ] Si falla una observación tras guardar la visita, se conserva la visita, se identifica la observación fallida y se permite reintentar solo esa observación. No se anuncia éxito completo.
- [ ] Listado pagina de 25, ordena por actualización reciente y filtra por estado, riesgo y búsqueda por número o nombre. Riesgo/estado/vencimiento incluyen texto.
- [ ] Las visitas muestran fecha y hora local de Ecuador; observaciones con seguimiento se distinguen visiblemente; acciones vencidas no completadas se identifican con texto.

## Rutas

- [ ] `/ue-el-esfuerzo/dece/casos` y `/ue-el-esfuerzo/dece/casos/<uuid>` cargan para `dece1`; las URL solo llevan UUID, nunca cédula, nombres ni texto del caso.
- [ ] Guardar actualiza la lista y el detalle sin recargar.

## Acceso, formularios y archivos

- [ ] `dece1@prueba.test` y `dece2@prueba.test` solo ven estudiantes de su institución.
- [ ] `admin1@prueba.test` y `est1@prueba.test` reciben 403 al abrir módulos DECE.
- [ ] Estudiante guarda un borrador y lo envía; DECE puede revisarlo. Estudiante solo consulta sus fichas.
- [ ] Verificar los permisos de almacenamiento para `dece-documents`; administrador no puede leer documentos.

Registrar fallos de autorización en `docs/solicitudes-bd.md`; nunca corregir permisos desde el frontend.
