// Read-only checks using the same anonymous key as the public portal. No login or writes.
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env');
const key=process.env.VITE_SUPABASE_ANON_KEY;
if (!key) throw new Error('Falta la configuración pública.');
if (!key.startsWith('sb_publishable_') && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role!=='anon') throw new Error('Solo se admite la clave pública.');
const client=createClient(process.env.VITE_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const institutions=await client.from('institutions').select('institution_id,name,slug').eq('is_active',true).order('name');
if(institutions.error) throw new Error(`No se pudo leer instituciones: ${institutions.error.code}`);
const checks=await Promise.all(institutions.data.map(async institution=>{
 const [settings,menus,pages]=await Promise.all([
  client.from('site_settings').select('site_title,logo_url').eq('institution_id',institution.institution_id).maybeSingle(),
  client.from('menus').select('menu_id,parent_id,label,is_visible').eq('institution_id',institution.institution_id).order('position'),
  client.from('pages').select('page_id,title,slug').eq('institution_id',institution.institution_id).eq('status','published'),
 ]);
 return {institution:institution.name,slug:institution.slug,title:settings.data?.site_title,hasLogo:Boolean(settings.data?.logo_url),navigation:(menus.data??[]).filter(menu=>menu.is_visible!==false).map(menu=>({label:menu.label,submenu:Boolean(menu.parent_id)})),publishedPages:(pages.data??[]).map(page=>({title:page.title,slug:page.slug})),errors:[settings.error,menus.error,pages.error].filter(Boolean).map(error=>error.code)};
}));
console.log(JSON.stringify(checks,null,2));
if(checks.some(check=>check.errors.length)) process.exitCode=1;
