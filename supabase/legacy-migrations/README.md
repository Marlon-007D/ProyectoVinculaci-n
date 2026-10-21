# Migraciones heredadas

Estos archivos SQL se conservaron como referencia histórica. El proyecto remoto
estaba vacío cuando se verificó el 17 de octubre de 2026, por lo que nunca se
aplicaron y no forman parte del historial activo.

El único historial ejecutable es `drizzle/`, aplicado mediante `npm run db:migrate`.
No ejecute estos archivos con Supabase CLI ni manualmente: duplicarían objetos
que ya pertenecen a las migraciones Drizzle.

## Propuestas de seguridad administrativa del 20 de octubre de 2026

Los archivos 2026102010*.sql a 2026102016*.sql se conservan como propuestas de la rama feature/arquitectura-admin. Esta rama develop documenta Drizzle (drizzle/ y
pm run db:migrate) como el �nico historial ejecutable. Los SQL a�adidos no forman parte del historial activo y no deben aplicarse con Supabase CLI ni manualmente. Contrastar y adaptar su contenido con el esquema remoto antes de plantear una migraci�n Drizzle nueva.
