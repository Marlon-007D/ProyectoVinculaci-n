# Arquitectura Administrativa / Superadmin

Esta rama contiene autenticacion, recuperacion de cuentas, MFA, instituciones,
usuarios, roles, permisos de modulos y auditoria.

## Desarrollo

1. Instalar dependencias con npm ci.
2. Configurar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).
3. Ejecutar npm run dev y abrir /panel/admin.
4. Verificar con npm run build y npm run lint.

## Base de datos

Para una base nueva, aplicar database/script.sql, database/superadmin.sql y las
cuatro migraciones conservadas en supabase/migrations, en orden de nombre.
La funcion invite-institution-user se encuentra en supabase/functions.

El esquema base compartido original se conserva desde 061202a: incluye contratos
para otros modulos, pero esta rama no contiene sus implementaciones, rutas,
migraciones ni datos demo. Los nombres de roles y modulos se mantienen para que
Superadmin pueda gestionar sus permisos. Ningun cambio SQL se aplica automaticamente.

## Respaldo y limpieza

Ver docs/limpieza-arquitectura-admin-20261020.md para procedencia y recuperacion.
