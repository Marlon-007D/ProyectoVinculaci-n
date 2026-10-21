# Arquitectura Administrativa / Superadmin

Esta rama contiene autenticacion, recuperacion de cuentas, MFA, instituciones,
usuarios, roles, permisos de modulos, auditoria y DECE restaurado por solicitud
posterior a la limpieza inicial.

## Desarrollo

1. Instalar dependencias con npm ci.
2. Configurar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).
3. Ejecutar npm run dev y abrir /panel/admin.
4. Verificar con npm run build y npm run lint.

## Base de datos

Para una base nueva, aplicar database/script.sql, database/superadmin.sql y las
migraciones de supabase/migrations, en orden de nombre, siguiendo su README.
La funcion invite-institution-user se encuentra en supabase/functions.

El esquema base compartido original se conserva desde 061202a: incluye contratos
para otros modulos, pero esta rama no contiene sus implementaciones, rutas,
migraciones de esos otros modulos ni datos demo. DECE es la excepcion restaurada.
Los nombres de roles y modulos se mantienen para que
Superadmin pueda gestionar sus permisos. Ningun cambio SQL se aplica automaticamente.

## Respaldo y limpieza

Ver docs/limpieza-arquitectura-admin-20261020.md para procedencia y recuperacion.

## Seguridad y Storage

Ver [paquete del Participante 1](docs/seguridad-participante-1.md) y
[auditoría de migraciones](supabase/migrations/README.md). La aplicación al
proyecto Supabase compartido requiere contrastar primero su esquema oficial.

Ver [restauracion de DECE e invitaciones institucionales](docs/restauracion-dece-invitaciones.md)
para la auditoria y los cambios aplicados al proyecto compartido el 20 de octubre.
