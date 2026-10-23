"""Executed inside run_projects_tests.py's disposable PostgreSQL instance."""
print('Verificando contacto, submenús y publicación en cuatro portales...', flush=True)
sql(f"UPDATE institutions SET slug='ue-el-esfuerzo' WHERE institution_id='{A}';")
sql(f"INSERT INTO menus(institution_id,label,url,position) VALUES('{A}','Institución','/',10),('{A}','Nosotros','/?slug=nosotros',11),('{A}','Oferta educativa','/?slug=oferta-educativa',12);")
file(ROOT / 'supabase/proposals/projects/ACTUALIZAR_EDITOR_PORTAL.sql')
file(ROOT / 'supabase/proposals/projects/ACTUALIZAR_EDITOR_PORTAL.sql')
assert sql(f"SELECT count(*) FROM menus c JOIN menus p ON p.menu_id=c.parent_id WHERE c.institution_id='{A}' AND c.label IN ('Nosotros','Oferta educativa') AND p.label='Institución';") == '2'
for index, tenant in enumerate([A, B, C, D], 1):
    editor = ident(100 + index)
    sql(f"INSERT INTO auth.users(id,email) VALUES('{editor}','portal{index}@example.test');")
    sql(f"INSERT INTO profiles(profile_id,first_name,last_name,email,phone) VALUES('{editor}','Portal','{index}','portal{index}@example.test','0999999999') ON CONFLICT(profile_id) DO UPDATE SET mfa_required=false,mfa_enabled=false;")
    sql(f"INSERT INTO memberships(institution_id,profile_id,role_id) SELECT '{tenant}','{editor}',role_id FROM roles WHERE name='institution_admin';")
    content = json.loads(json.dumps(snapshot))
    content.update(title=f'Contacto {index}', slug=f'contacto-{index}', is_homepage=False)
    content['settings'].update(site_title=f'Unidad educativa {index}', contact_email=f'contacto{index}@example.test', contact_phone=f'099999999{index}', social_links={'facebook': f'https://example.test/colegio-{index}'})
    content['menus'] = [
        {'id': 'child', 'parent_id': 'parent', 'label': 'Contacto', 'url': f'/?slug=contacto-{index}'},
        {'id': 'parent', 'label': 'Institución', 'url': '/'},
        {'id': 'hidden', 'parent_id': 'parent', 'label': 'Oculto', 'url': '/', 'is_visible': False},
    ]
    draft4 = save_portal(tenant, None, 0, content, False, user=editor)
    page4 = draft4['page_id']
    assert sql(f"SELECT count(*) FROM publication_versions WHERE page_id='{page4}';") == '0'
    save_portal(tenant, page4, 1, content, True, user=editor)
    assert sql(f"SELECT contact_email FROM site_settings WHERE institution_id='{tenant}';") == f'contacto{index}@example.test'
    assert sql(f"SELECT count(*) FROM menus c JOIN menus p ON p.menu_id=c.parent_id WHERE c.institution_id='{tenant}' AND p.institution_id='{tenant}' AND c.deleted_at IS NULL AND c.label='Contacto' AND p.label='Institución';") == '1'
    assert sql(f"SELECT is_visible FROM menus WHERE institution_id='{tenant}' AND label='Oculto' AND deleted_at IS NULL;") == 'f'
    content['sections'][0]['properties']['body'] = f'Edición pública {index}'
    save_portal(tenant, page4, 2, content, False, user=editor)
    assert 'Edición pública' not in sql(f"SELECT content_snapshot FROM publication_versions WHERE page_id='{page4}' ORDER BY version_number DESC LIMIT 1;")
    save_portal(tenant, page4, 3, content, True, user=editor)
    assert f'Edición pública {index}' in sql(f"SELECT content_snapshot FROM publication_versions WHERE page_id='{page4}' ORDER BY version_number DESC LIMIT 1;")
    other = [t for t in [A, B, C, D] if t != tenant][0]
    save_portal(other, page4, 4, content, True, user=editor, fails=True)
    broken = json.loads(json.dumps(content))
    broken['menus'][1]['parent_id'] = 'child'
    save_portal(tenant, page4, 4, broken, True, user=editor, fails=True)
    broken = json.loads(json.dumps(content))
    broken['settings']['social_links'] = {'facebook': 'javascript:alert(1)'}
    save_portal(tenant, page4, 4, broken, True, user=editor, fails=True)
    assert sql(f"SELECT revision FROM portal_editor_drafts WHERE page_id='{page4}';") == '4'
assert sql("SELECT count(DISTINCT contact_email) FROM site_settings WHERE contact_email LIKE 'contacto%@example.test';") == '4'
print('PASS: cuatro portales; contacto/redes; submenús; visibilidad; borrador privado; publicación; ciclos rechazados; aislamiento.', flush=True)
