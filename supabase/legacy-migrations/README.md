# Migraciones heredadas

Estos archivos SQL se conservaron como referencia histórica. El proyecto remoto
estaba vacío cuando se verificó el 17 de octubre de 2026, por lo que nunca se
aplicaron y no forman parte del historial activo.

El único historial ejecutable es `drizzle/`, aplicado mediante `npm run db:migrate`.
No ejecute estos archivos con Supabase CLI ni manualmente: duplicarían objetos
que ya pertenecen a las migraciones Drizzle.
