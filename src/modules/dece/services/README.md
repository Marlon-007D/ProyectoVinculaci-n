# Datos de formularios DECE

`createDeceFormService(client)` recibe el mismo cliente de Supabase que usa autenticación. No crea otra sesión. Las fichas se consultan por institución y código (`general` / `authorization`), las respuestas se guardan como borrador y las preguntas personalizadas se pueden agregar o retirar. Las preguntas con `is_system = true` se muestran bloqueadas y la base también impide eliminarlas.

El directorio debe entregar el UUID real de `public.students` como `Student.recordId`; el identificador visible `Student.id` sigue siendo la cédula y no se usa como clave foránea. El proveedor requiere además el UUID de la institución y una función `getStudentId` para adaptar el modelo que entregue el módulo de estudiantes.

Las fichas estándar comienzan con los datos del estudiante que ya existen en `students` y preguntas comunes de cada ficha. Cada institución puede agregar y retirar preguntas. Las preguntas retiradas se marcan inactivas y las respuestas que ya se guardaron se conservan.

## Conectar desde el módulo de la aplicación

```tsx
import { DeceDataProvider, DeceApp } from './modules/dece'
import { supabase } from './core/supabase'

const deceData = {
  client: supabase, // mismo cliente autenticado que usa el login
  institutionId: activeInstitution.institution_id,
  getStudentId: student => student.recordId ?? null,
}

<DeceDataProvider value={deceData}><DeceApp /></DeceDataProvider>
```

Ejecutar `supabase/migrations/202610100001_dece_forms.sql` una vez y, con una sesión que tenga membresía en la institución, crear las fichas iniciales con `select public.create_dece_default_forms('<institution UUID>');`. El proveedor se puede conectar cuando el módulo de login entregue la institución y el directorio entregue `recordId`.
