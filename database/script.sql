-- =========================================================
-- PORTAL INSTITUCIONAL MULTITENANT - MODELO ACTUALIZADO
-- PostgreSQL / Supabase
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. TIPOS ENUM
-- =========================================================

CREATE TYPE user_role_type AS ENUM (
    'super_admin',
    'institution_admin',
    'dece_staff',
    'project_manager',
    'editor',
    'viewer'
);

CREATE TYPE case_status_type AS ENUM (
    'registered',
    'in_progress',
    'under_monitoring',
    'closed'
);

CREATE TYPE page_status_type AS ENUM (
    'draft',
    'published',
    'archived'
);

CREATE TYPE section_type AS ENUM (
    'banner',
    'text',
    'news',
    'events',
    'staff',
    'honors',
    'gallery',
    'links',
    'simulators',
    'transparency',
    'social_links'
);

CREATE TYPE dece_observation_category AS ENUM (
    'physical',
    'psychological',
    'social',
    'family',
    'academic',
    'behavioral',
    'other'
);

CREATE TYPE dece_risk_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE dece_confidentiality_level AS ENUM (
    'restricted',
    'highly_restricted'
);

-- =========================================================
-- 2. FUNCIÓN GENERAL PARA updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 3. MULTITENANCY, USUARIOS, ROLES Y AUDITORÍA
-- Responsable: Dylan Sosa
-- =========================================================

CREATE TABLE institutions (
    institution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
    profile_id UUID PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(10) NOT NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_auth_users
        FOREIGN KEY (profile_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,
    CONSTRAINT profiles_phone_ec_mobile_check
        CHECK (phone ~ '^09[0-9]{8}$')
);

-- Los datos personales se reciben en metadata durante el registro de Auth.
CREATE OR REPLACE FUNCTION public.handle_new_auth_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    metadata_phone TEXT := NEW.raw_user_meta_data->>'phone';
    metadata_first_name TEXT := NEW.raw_user_meta_data->>'first_name';
    metadata_last_name TEXT := NEW.raw_user_meta_data->>'last_name';
BEGIN
    -- Usuarios creados manualmente sin datos personales pueden completar el perfil
    -- cuando el administrador les asigne un rol.
    IF NULLIF(trim(metadata_first_name), '') IS NULL
       OR NULLIF(trim(metadata_last_name), '') IS NULL
       OR COALESCE(metadata_phone, '') !~ '^09[0-9]{8}$' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.profiles (profile_id, first_name, last_name, email, phone)
    VALUES (NEW.id, trim(metadata_first_name), trim(metadata_last_name), NEW.email, metadata_phone)
    ON CONFLICT (profile_id) DO UPDATE
      SET first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_profile();

CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name user_role_type NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memberships (
    membership_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    role_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_memberships_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_memberships_profile
        FOREIGN KEY (profile_id)
        REFERENCES profiles(profile_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_memberships_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
        ON DELETE RESTRICT,
    CONSTRAINT unique_membership_per_institution
        UNIQUE (institution_id, profile_id)
);

CREATE TABLE module_settings (
    module_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_module_settings_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_institution_module
        UNIQUE (institution_id, module_name)
);

CREATE TABLE audit_events (
    audit_event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID,
    profile_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_events_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_audit_events_profile
        FOREIGN KEY (profile_id)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL
);

-- =========================================================
-- 4. PERSONALIZACIÓN DEL PORTAL Y CONTENIDO DINÁMICO
-- Responsable: Marlon Demera
-- =========================================================

CREATE TABLE themes (
    theme_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    primary_color VARCHAR(10) NOT NULL,
    secondary_color VARCHAR(10) NOT NULL,
    tertiary_color VARCHAR(10),
    font_family VARCHAR(100) NOT NULL,
    base_font_size NUMERIC(5,2) NOT NULL DEFAULT 16,
    heading_1_size NUMERIC(5,2),
    heading_2_size NUMERIC(5,2),
    heading_3_size NUMERIC(5,2),
    visual_scale NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    appearance_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_themes_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_theme_name_per_institution
        UNIQUE (institution_id, name),
    -- Permite una FK compuesta desde site_settings.
    CONSTRAINT unique_theme_same_institution
        UNIQUE (institution_id, theme_id),
    CONSTRAINT check_visual_scale_positive
        CHECK (visual_scale > 0)
);

CREATE TABLE site_settings (
    site_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL UNIQUE,
    site_title VARCHAR(255) NOT NULL,
    logo_url TEXT,
    theme_id UUID,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    footer_text TEXT,
    social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_site_settings_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    -- Impide elegir un tema perteneciente a otra institución.
    CONSTRAINT fk_site_settings_theme_same_institution
        FOREIGN KEY (institution_id, theme_id)
        REFERENCES themes(institution_id, theme_id)
        ON DELETE SET NULL
);

CREATE TABLE pages (
    page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status page_status_type NOT NULL DEFAULT 'draft',
    is_homepage BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pages_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_institution_page_slug
        UNIQUE (institution_id, slug)
);

-- Define la estructura JSONB esperada para cada tipo de sección.
CREATE TABLE section_type_schemas (
    type section_type PRIMARY KEY,
    properties_schema JSONB NOT NULL,
    default_properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE page_sections (
    page_section_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL,
    type section_type NOT NULL,
    position INTEGER NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_page_sections_page
        FOREIGN KEY (page_id)
        REFERENCES pages(page_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_page_sections_type_schema
        FOREIGN KEY (type)
        REFERENCES section_type_schemas(type)
        ON DELETE RESTRICT,
    CONSTRAINT unique_page_section_position
        UNIQUE (page_id, position),
    CONSTRAINT check_page_section_position
        CHECK (position >= 0)
);

CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_budget NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_project_same_institution
        UNIQUE (institution_id, project_id),
    CONSTRAINT check_project_budget_positive
        CHECK (total_budget >= 0),
    CONSTRAINT check_project_dates
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE project_members (
    project_member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    role VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_members_project
        FOREIGN KEY (project_id)
        REFERENCES projects(project_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_members_profile
        FOREIGN KEY (profile_id)
        REFERENCES profiles(profile_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_project_profile
        UNIQUE (project_id, profile_id)
);

CREATE TABLE budget_items (
    budget_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_budget_items_project
        FOREIGN KEY (project_id)
        REFERENCES projects(project_id)
        ON DELETE CASCADE,
    CONSTRAINT check_budget_item_allocation
        CHECK (allocated_amount >= 0)
);

CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_item_id UUID NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_budget_item
        FOREIGN KEY (budget_item_id)
        REFERENCES budget_items(budget_item_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_expenses_profile
        FOREIGN KEY (created_by)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL,
    CONSTRAINT check_expense_amount
        CHECK (amount > 0)
);

CREATE TABLE expense_files (
    expense_file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_files_expense
        FOREIGN KEY (expense_id)
        REFERENCES expenses(expense_id)
        ON DELETE CASCADE
);

-- =========================================================
-- 5. NAVEGACIÓN, MEDIOS Y VERSIONES
-- Responsable: Axel Molina
-- =========================================================

CREATE TABLE menus (
    menu_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    label VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    parent_id UUID,
    position INTEGER NOT NULL,
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menus_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_menus_parent
        FOREIGN KEY (parent_id)
        REFERENCES menus(menu_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_menu_position_per_level
        UNIQUE (institution_id, parent_id, position)
);

CREATE TABLE media_assets (
    media_asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_media_assets_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_media_assets_profile
        FOREIGN KEY (uploaded_by)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL,
    CONSTRAINT check_media_file_size
        CHECK (file_size >= 0)
);

CREATE TABLE publication_versions (
    publication_version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    content_snapshot JSONB NOT NULL,
    published_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_publication_versions_page
        FOREIGN KEY (page_id)
        REFERENCES pages(page_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_publication_versions_profile
        FOREIGN KEY (published_by)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL,
    CONSTRAINT unique_page_version
        UNIQUE (page_id, version_number),
    CONSTRAINT check_version_number
        CHECK (version_number > 0)
);

-- =========================================================
-- 6. CONTENIDO ACADÉMICO Y SIMULADORES
-- Responsable: Brigitte Rodríguez
-- =========================================================

CREATE TABLE academic_periods (
    academic_period_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_academic_periods_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_period_name_per_institution
        UNIQUE (institution_id, name),
    CONSTRAINT unique_period_same_institution
        UNIQUE (institution_id, academic_period_id),
    CONSTRAINT check_academic_period_dates
        CHECK (end_date >= start_date)
);

CREATE TABLE news (
    news_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    academic_period_id UUID,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_news_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_news_period_same_institution
        FOREIGN KEY (institution_id, academic_period_id)
        REFERENCES academic_periods(institution_id, academic_period_id)
        ON DELETE SET NULL,
    CONSTRAINT unique_institution_news_slug
        UNIQUE (institution_id, slug)
);

CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    academic_period_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_events_period_same_institution
        FOREIGN KEY (institution_id, academic_period_id)
        REFERENCES academic_periods(institution_id, academic_period_id)
        ON DELETE SET NULL
);

CREATE TABLE staff (
    staff_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    photo_url TEXT,
    bio TEXT,
    position_order INTEGER NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE
);

CREATE TABLE students (
    student_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    national_id VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    grade_level VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_students_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_institution_student_national_id
        UNIQUE (institution_id, national_id),
    CONSTRAINT unique_student_same_institution
        UNIQUE (institution_id, student_id)
);

CREATE TABLE honors (
    honor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    academic_period_id UUID NOT NULL,
    student_id UUID NOT NULL,
    achievement VARCHAR(255) NOT NULL,
    score NUMERIC(4,2),
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_honors_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_honors_period_same_institution
        FOREIGN KEY (institution_id, academic_period_id)
        REFERENCES academic_periods(institution_id, academic_period_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_honors_student_same_institution
        FOREIGN KEY (institution_id, student_id)
        REFERENCES students(institution_id, student_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_honor_per_student_period
        UNIQUE (academic_period_id, student_id, achievement)
);

CREATE TABLE simulation_catalog (
    simulation_catalog_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE simulation_settings (
    simulation_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    simulation_catalog_id UUID NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_simulation_settings_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_simulation_settings_catalog
        FOREIGN KEY (simulation_catalog_id)
        REFERENCES simulation_catalog(simulation_catalog_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_institution_simulation
        UNIQUE (institution_id, simulation_catalog_id)
);

-- =========================================================
-- 7. DECE: CASOS, ATENCIONES, OBSERVACIONES Y SEGUIMIENTO
-- Responsable: Elkin Vera
-- =========================================================

CREATE TABLE dece_cases (
    dece_case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL,
    student_id UUID NOT NULL,
    case_number VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    primary_category dece_observation_category NOT NULL,
    risk_level dece_risk_level NOT NULL DEFAULT 'low',
    confidentiality_level dece_confidentiality_level NOT NULL DEFAULT 'restricted',
    status case_status_type NOT NULL DEFAULT 'registered',
    opened_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dece_cases_institution
        FOREIGN KEY (institution_id)
        REFERENCES institutions(institution_id)
        ON DELETE CASCADE,
    -- Evita asignar a un caso un estudiante de otra institución.
    CONSTRAINT fk_dece_cases_student_same_institution
        FOREIGN KEY (institution_id, student_id)
        REFERENCES students(institution_id, student_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dece_cases_opened_by
        FOREIGN KEY (opened_by)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL,
    CONSTRAINT unique_institution_case_number
        UNIQUE (institution_id, case_number)
);

CREATE TABLE dece_case_assignments (
    dece_case_assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dece_case_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    assignment_role VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dece_assignments_case
        FOREIGN KEY (dece_case_id)
        REFERENCES dece_cases(dece_case_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dece_assignments_profile
        FOREIGN KEY (profile_id)
        REFERENCES profiles(profile_id)
        ON DELETE CASCADE,
    CONSTRAINT unique_dece_case_assigned_profile
        UNIQUE (dece_case_id, profile_id)
);

CREATE TABLE dece_visits (
    dece_visit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dece_case_id UUID NOT NULL,
    visit_date TIMESTAMPTZ NOT NULL,
    summary TEXT NOT NULL,
    attention_notes TEXT,
    attended_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dece_visits_case
        FOREIGN KEY (dece_case_id)
        REFERENCES dece_cases(dece_case_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dece_visits_profile
        FOREIGN KEY (attended_by)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL
);

CREATE TABLE dece_observations (
    dece_observation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dece_visit_id UUID NOT NULL,
    category dece_observation_category NOT NULL,
    description TEXT NOT NULL,
    severity dece_risk_level NOT NULL DEFAULT 'low',
    requires_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dece_observations_visit
        FOREIGN KEY (dece_visit_id)
        REFERENCES dece_visits(dece_visit_id)
        ON DELETE CASCADE
);

CREATE TABLE dece_actions (
    dece_action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dece_case_id UUID NOT NULL,
    description TEXT NOT NULL,
    due_date DATE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    responsible_profile_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dece_actions_case
        FOREIGN KEY (dece_case_id)
        REFERENCES dece_cases(dece_case_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dece_actions_responsible
        FOREIGN KEY (responsible_profile_id)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL,
    CONSTRAINT check_dece_action_completion
        CHECK (
            (is_completed = FALSE AND completed_at IS NULL)
            OR (is_completed = TRUE AND completed_at IS NOT NULL)
        )
);

CREATE TABLE dece_documents (
    dece_document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dece_case_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dece_documents_case
        FOREIGN KEY (dece_case_id)
        REFERENCES dece_cases(dece_case_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_dece_documents_profile
        FOREIGN KEY (uploaded_by)
        REFERENCES profiles(profile_id)
        ON DELETE SET NULL
);

-- =========================================================
-- 8. ÍNDICES DE CONSULTA
-- =========================================================

CREATE INDEX idx_memberships_profile ON memberships(profile_id);
CREATE INDEX idx_pages_institution_status ON pages(institution_id, status);
CREATE INDEX idx_news_institution_published ON news(institution_id, is_published, published_at);
CREATE INDEX idx_events_institution_date ON events(institution_id, event_date);
CREATE INDEX idx_projects_institution ON projects(institution_id);
CREATE INDEX idx_expenses_budget_item ON expenses(budget_item_id);
CREATE INDEX idx_students_institution ON students(institution_id);
CREATE INDEX idx_dece_cases_institution_status ON dece_cases(institution_id, status);
CREATE INDEX idx_dece_visits_case ON dece_visits(dece_case_id);
CREATE INDEX idx_audit_events_institution_date ON audit_events(institution_id, created_at DESC);

-- =========================================================
-- 9. TRIGGERS updated_at
-- =========================================================

CREATE TRIGGER trg_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_module_settings_updated_at BEFORE UPDATE ON module_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_themes_updated_at BEFORE UPDATE ON themes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_section_type_schemas_updated_at BEFORE UPDATE ON section_type_schemas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_page_sections_updated_at BEFORE UPDATE ON page_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_project_members_updated_at BEFORE UPDATE ON project_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_budget_items_updated_at BEFORE UPDATE ON budget_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_expense_files_updated_at BEFORE UPDATE ON expense_files FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_menus_updated_at BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_media_assets_updated_at BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_academic_periods_updated_at BEFORE UPDATE ON academic_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_news_updated_at BEFORE UPDATE ON news FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_honors_updated_at BEFORE UPDATE ON honors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_simulation_catalog_updated_at BEFORE UPDATE ON simulation_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_simulation_settings_updated_at BEFORE UPDATE ON simulation_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dece_cases_updated_at BEFORE UPDATE ON dece_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dece_case_assignments_updated_at BEFORE UPDATE ON dece_case_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dece_visits_updated_at BEFORE UPDATE ON dece_visits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dece_observations_updated_at BEFORE UPDATE ON dece_observations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dece_actions_updated_at BEFORE UPDATE ON dece_actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dece_documents_updated_at BEFORE UPDATE ON dece_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 10. VISTAS DE PRESUPUESTO CALCULADO
-- No guardar executed_budget ni used_amount manualmente.
-- =========================================================

CREATE OR REPLACE VIEW budget_item_execution_summary AS
SELECT
    bi.budget_item_id,
    bi.project_id,
    bi.name,
    bi.allocated_amount,
    COALESCE(SUM(e.amount), 0)::NUMERIC(12,2) AS used_amount,
    (bi.allocated_amount - COALESCE(SUM(e.amount), 0))::NUMERIC(12,2) AS available_amount
FROM budget_items bi
LEFT JOIN expenses e ON e.budget_item_id = bi.budget_item_id
GROUP BY bi.budget_item_id, bi.project_id, bi.name, bi.allocated_amount;

CREATE OR REPLACE VIEW project_budget_summary AS
SELECT
    p.project_id,
    p.institution_id,
    p.title,
    p.total_budget,
    COALESCE(SUM(e.amount), 0)::NUMERIC(12,2) AS executed_budget,
    (p.total_budget - COALESCE(SUM(e.amount), 0))::NUMERIC(12,2) AS available_budget
FROM projects p
LEFT JOIN budget_items bi ON bi.project_id = p.project_id
LEFT JOIN expenses e ON e.budget_item_id = bi.budget_item_id
GROUP BY p.project_id, p.institution_id, p.title, p.total_budget;

-- =========================================================
-- 11. FUNCIONES DE SEGURIDAD MULTITENANT Y RLS
-- =========================================================

-- El JWT debe incluir: { "active_institution_id": "uuid-de-la-institucion" }
CREATE OR REPLACE FUNCTION get_current_institution_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(
        current_setting('request.jwt.claims', true)::jsonb
            ->> 'active_institution_id',
        ''
    )::uuid;
$$;

CREATE OR REPLACE FUNCTION is_member_of_institution(target_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM memberships m
        WHERE m.profile_id = auth.uid()
          AND m.institution_id = target_institution_id
    );
$$;

CREATE OR REPLACE FUNCTION has_institution_role(
    target_institution_id UUID,
    required_roles user_role_type[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM memberships m
        JOIN roles r ON r.role_id = m.role_id
        WHERE m.profile_id = auth.uid()
          AND m.institution_id = target_institution_id
          AND r.name = ANY(required_roles)
    );
$$;

-- DECE: super_admin, institution_admin o profesional DECE asignado al caso.
CREATE OR REPLACE FUNCTION can_access_dece_case(target_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM dece_cases dc
        WHERE dc.dece_case_id = target_case_id
          AND dc.institution_id = get_current_institution_id()
          AND (
              has_institution_role(
                  dc.institution_id,
                  ARRAY['super_admin', 'institution_admin']::user_role_type[]
              )
              OR EXISTS (
                  SELECT 1
                  FROM dece_case_assignments dca
                  JOIN memberships m ON m.profile_id = dca.profile_id
                  JOIN roles r ON r.role_id = m.role_id
                  WHERE dca.dece_case_id = dc.dece_case_id
                    AND dca.profile_id = auth.uid()
                    AND dca.is_active = TRUE
                    AND m.institution_id = dc.institution_id
                    AND r.name = 'dece_staff'
              )
          )
    );
$$;

-- =========================================================
-- 12. ACTIVACIÓN RLS
-- =========================================================

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE honors ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dece_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dece_case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dece_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dece_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dece_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dece_documents ENABLE ROW LEVEL SECURITY;

-- Tablas globales de catálogo: solo lectura autenticada.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_type_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_read_authenticated ON roles
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY section_schemas_read_authenticated ON section_type_schemas
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY simulation_catalog_read_authenticated ON simulation_catalog
    FOR SELECT TO authenticated USING (TRUE);

-- Política genérica de aislamiento para tablas con institution_id directo.
CREATE POLICY institutions_tenant_policy ON institutions
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY module_settings_tenant_policy ON module_settings
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY audit_events_tenant_policy ON audit_events
    FOR SELECT TO authenticated
    USING (institution_id = get_current_institution_id());

CREATE POLICY themes_tenant_policy ON themes
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY site_settings_tenant_policy ON site_settings
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY pages_tenant_policy ON pages
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY projects_tenant_policy ON projects
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY menus_tenant_policy ON menus
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY media_assets_tenant_policy ON media_assets
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY academic_periods_tenant_policy ON academic_periods
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY news_tenant_policy ON news
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY events_tenant_policy ON events
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY staff_tenant_policy ON staff
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY students_tenant_policy ON students
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY honors_tenant_policy ON honors
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

CREATE POLICY simulation_settings_tenant_policy ON simulation_settings
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

-- Membresías: se ven únicamente dentro de la institución activa.
CREATE POLICY memberships_tenant_policy ON memberships
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id())
    WITH CHECK (institution_id = get_current_institution_id());

-- Perfiles: cada usuario puede consultar/modificar su propio perfil.
CREATE POLICY profiles_owner_policy ON profiles
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Tablas con tenant indirecto por páginas.
CREATE POLICY page_sections_tenant_policy ON page_sections
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pages p
            WHERE p.page_id = page_sections.page_id
              AND p.institution_id = get_current_institution_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pages p
            WHERE p.page_id = page_sections.page_id
              AND p.institution_id = get_current_institution_id()
        )
    );

CREATE POLICY publication_versions_tenant_policy ON publication_versions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pages p
            WHERE p.page_id = publication_versions.page_id
              AND p.institution_id = get_current_institution_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pages p
            WHERE p.page_id = publication_versions.page_id
              AND p.institution_id = get_current_institution_id()
        )
    );

-- Tablas con tenant indirecto por proyectos.
CREATE POLICY budget_items_tenant_policy ON budget_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.project_id = budget_items.project_id
              AND p.institution_id = get_current_institution_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.project_id = budget_items.project_id
              AND p.institution_id = get_current_institution_id()
        )
    );

CREATE POLICY expenses_tenant_policy ON expenses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM budget_items bi
            JOIN projects p ON p.project_id = bi.project_id
            WHERE bi.budget_item_id = expenses.budget_item_id
              AND p.institution_id = get_current_institution_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM budget_items bi
            JOIN projects p ON p.project_id = bi.project_id
            WHERE bi.budget_item_id = expenses.budget_item_id
              AND p.institution_id = get_current_institution_id()
        )
    );

-- RLS DECE: acceso condicionado a caso, institución, rol y asignación.
CREATE POLICY dece_cases_access_policy ON dece_cases
    FOR ALL TO authenticated
    USING (can_access_dece_case(dece_case_id))
    WITH CHECK (
        institution_id = get_current_institution_id()
        AND has_institution_role(
            institution_id,
            ARRAY['super_admin', 'institution_admin', 'dece_staff']::user_role_type[]
        )
    );

CREATE POLICY dece_visits_access_policy ON dece_visits
    FOR ALL TO authenticated
    USING (can_access_dece_case(dece_case_id))
    WITH CHECK (can_access_dece_case(dece_case_id));

CREATE POLICY dece_observations_access_policy ON dece_observations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM dece_visits dv
            WHERE dv.dece_visit_id = dece_observations.dece_visit_id
              AND can_access_dece_case(dv.dece_case_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dece_visits dv
            WHERE dv.dece_visit_id = dece_observations.dece_visit_id
              AND can_access_dece_case(dv.dece_case_id)
        )
    );

CREATE POLICY dece_actions_access_policy ON dece_actions
    FOR ALL TO authenticated
    USING (can_access_dece_case(dece_case_id))
    WITH CHECK (can_access_dece_case(dece_case_id));

CREATE POLICY dece_documents_access_policy ON dece_documents
    FOR ALL TO authenticated
    USING (can_access_dece_case(dece_case_id))
    WITH CHECK (can_access_dece_case(dece_case_id));

CREATE POLICY dece_assignments_access_policy ON dece_case_assignments
    FOR ALL TO authenticated
    USING (can_access_dece_case(dece_case_id))
    WITH CHECK (can_access_dece_case(dece_case_id));

-- =========================================================
-- 13. LECTURA PÚBLICA PARA EL PORTAL (visitantes sin sesión y usuarios con sesión)
-- El portal solo lee contenido publicado. Es repetible.
-- Se abre a anon Y authenticated: dentro de la app el usuario ya inició sesión
-- (rol authenticated) y sin esto las políticas por institución le ocultan todo.
-- =========================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON institutions, site_settings, themes, menus, pages,
                publication_versions, media_assets, news, staff, events TO anon, authenticated;

DROP POLICY IF EXISTS institutions_public_read ON institutions;
CREATE POLICY institutions_public_read ON institutions
    FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS site_settings_public_read ON site_settings;
CREATE POLICY site_settings_public_read ON site_settings
    FOR SELECT TO anon, authenticated USING (
        EXISTS (SELECT 1 FROM institutions i
                WHERE i.institution_id = site_settings.institution_id AND i.is_active));

DROP POLICY IF EXISTS themes_public_read ON themes;
CREATE POLICY themes_public_read ON themes
    FOR SELECT TO anon, authenticated USING (
        EXISTS (SELECT 1 FROM institutions i
                WHERE i.institution_id = themes.institution_id AND i.is_active));

DROP POLICY IF EXISTS menus_public_read ON menus;
CREATE POLICY menus_public_read ON menus
    FOR SELECT TO anon, authenticated USING (
        EXISTS (SELECT 1 FROM institutions i
                WHERE i.institution_id = menus.institution_id AND i.is_active));

DROP POLICY IF EXISTS pages_public_read ON pages;
CREATE POLICY pages_public_read ON pages
    FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS publication_versions_public_read ON publication_versions;
CREATE POLICY publication_versions_public_read ON publication_versions
    FOR SELECT TO anon, authenticated USING (
        EXISTS (SELECT 1 FROM pages p
                WHERE p.page_id = publication_versions.page_id AND p.status = 'published'));

DROP POLICY IF EXISTS media_assets_public_read ON media_assets;
CREATE POLICY media_assets_public_read ON media_assets
    FOR SELECT TO anon, authenticated USING (is_public);

DROP POLICY IF EXISTS news_public_read ON news;
CREATE POLICY news_public_read ON news
    FOR SELECT TO anon, authenticated USING (
        is_published
        AND (published_at IS NULL OR published_at <= CURRENT_TIMESTAMP)
        AND EXISTS (SELECT 1 FROM institutions i
                    WHERE i.institution_id = news.institution_id AND i.is_active));

DROP POLICY IF EXISTS staff_public_read ON staff;
CREATE POLICY staff_public_read ON staff
    FOR SELECT TO anon, authenticated USING (
        is_public
        AND EXISTS (SELECT 1 FROM institutions i
                    WHERE i.institution_id = staff.institution_id AND i.is_active));

DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
    FOR SELECT TO anon, authenticated USING (
        EXISTS (SELECT 1 FROM institutions i
                WHERE i.institution_id = events.institution_id AND i.is_active));

-- Cuadro de honor: vista pública que expone SOLO nombre y grado del estudiante.
-- La tabla students (cédula, fecha de nacimiento) NO se abre a visitantes.
-- Publicar nombres de menores requiere autorización de sus representantes.
CREATE OR REPLACE VIEW public_honors AS
SELECT
    h.honor_id,
    h.institution_id,
    h.academic_period_id,
    h.achievement,
    h.score,
    h.photo_url,
    (s.first_name || ' ' || s.last_name) AS student_name,
    s.grade_level
FROM honors h
JOIN students s
  ON s.institution_id = h.institution_id AND s.student_id = h.student_id
JOIN institutions i
  ON i.institution_id = h.institution_id
WHERE i.is_active;

GRANT SELECT ON public_honors TO anon, authenticated;

-- =========================================================
-- 14. COLEGIO DEMO: sitio de ejemplo COMPLETO (solo demostración)
-- Muestra todo lo que puede tener una portada: banner, cifras,
-- noticias, eventos, equipo, cuadro de honor, enlaces, redes, 5 páginas
-- y menú con submenú. Se puede ejecutar varias veces: reemplaza
-- únicamente los datos de "colegio-demo". Nombres y cédulas ficticios.
-- =========================================================

DO $$
DECLARE
    rec RECORD;
    inst UUID;
    th UUID;
    pg UUID;
    per UUID;
    parent UUID;
BEGIN
    INSERT INTO institutions (name, slug, is_active)
    VALUES ('Colegio Demo', 'colegio-demo', TRUE)
    ON CONFLICT (slug) DO UPDATE SET is_active = TRUE
    RETURNING institution_id INTO inst;

    INSERT INTO themes (institution_id, name, primary_color, secondary_color, font_family)
    VALUES (inst, 'Tema principal', '#1d4e89', '#f2a900', 'system-ui, sans-serif')
    ON CONFLICT (institution_id, name) DO UPDATE
        SET primary_color = EXCLUDED.primary_color,
            secondary_color = EXCLUDED.secondary_color,
            font_family = EXCLUDED.font_family
    RETURNING theme_id INTO th;

    INSERT INTO site_settings (institution_id, site_title, logo_url, theme_id, contact_email, contact_phone, footer_text, social_links)
    VALUES (inst, 'Colegio Demo', 'data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 48 48%27%3E%3Ccircle cx=%2724%27 cy=%2724%27 r=%2722%27 fill=%27%231d4e89%27/%3E%3Ccircle cx=%2724%27 cy=%2724%27 r=%2719%27 fill=%27none%27 stroke=%27%23f2a900%27 stroke-width=%273%27/%3E%3Ctext x=%2724%27 y=%2730%27 font-size=%2717%27 text-anchor=%27middle%27 fill=%27white%27 font-family=%27Arial%27 font-weight=%27700%27%3ECD%3C/text%3E%3C/svg%3E', th, 'info@colegio-demo.test', '0999999999',
            'Av. Principal y Calle 1 · Quito, Ecuador', '{"facebook": "https://facebook.com/colegiodemo", "instagram": "https://instagram.com/colegiodemo", "youtube": "https://youtube.com/@colegiodemo"}'::jsonb)
    ON CONFLICT (institution_id) DO UPDATE
        SET site_title = EXCLUDED.site_title, logo_url = EXCLUDED.logo_url, theme_id = EXCLUDED.theme_id,
            contact_email = EXCLUDED.contact_email, contact_phone = EXCLUDED.contact_phone,
            footer_text = EXCLUDED.footer_text, social_links = EXCLUDED.social_links;

    -- Menú: Inicio | Institución ▾ (Nosotros, Oferta educativa) | Noticias | Contacto
    DELETE FROM menus WHERE institution_id = inst;
    INSERT INTO menus (institution_id, label, url, position, is_external)
    VALUES (inst, 'Inicio', '/', 1, FALSE);
    INSERT INTO menus (institution_id, label, url, position, is_external)
    VALUES (inst, 'Institución', '/?slug=nosotros', 2, FALSE)
    RETURNING menu_id INTO parent;
    INSERT INTO menus (institution_id, label, url, parent_id, position, is_external)
    VALUES (inst, 'Nosotros', '/?slug=nosotros', parent, 1, FALSE),
           (inst, 'Oferta educativa', '/?slug=oferta-educativa', parent, 2, FALSE);
    INSERT INTO menus (institution_id, label, url, position, is_external)
    VALUES (inst, 'Noticias', '/?slug=noticias', 3, FALSE),
           (inst, 'Contacto', '/?slug=contacto', 4, FALSE);

    -- Páginas publicadas
    FOR rec IN
        SELECT * FROM (VALUES
            ('inicio', 'Inicio', TRUE, $j${"title": "Inicio", "sections": [{"type": "banner", "position": 0, "is_visible": true, "properties": {"title": "Bienvenidos al Colegio Demo", "subtitle": "Formamos personas íntegras, críticas y solidarias.", "button_label": "Conoce nuestra oferta", "button_url": "/?slug=oferta-educativa", "secondary_label": "Contáctanos", "secondary_url": "/?slug=contacto"}}, {"type": "text", "position": 1, "is_visible": true, "properties": {"title": "Colegio Demo en cifras", "layout": "stats", "items": [{"title": "25+", "description": "Años de trayectoria"}, {"title": "1.200", "description": "Estudiantes"}, {"title": "85", "description": "Docentes y personal"}, {"title": "98%", "description": "Bachilleres que continúan estudios superiores"}]}}, {"type": "text", "position": 2, "is_visible": true, "properties": {"title": "¿Por qué elegirnos?", "body": "Una propuesta educativa integral que acompaña a cada estudiante dentro y fuera del aula.", "items": [{"title": "Excelencia académica", "description": "Docentes certificados y planes de estudio actualizados."}, {"title": "Formación en valores", "description": "Respeto, solidaridad y responsabilidad en cada actividad."}, {"title": "Ciencia y tecnología", "description": "Laboratorios equipados y proyectos de innovación."}, {"title": "Bienestar estudiantil", "description": "Acompañamiento psicológico y orientación vocacional (DECE)."}]}}, {"type": "news", "position": 3, "is_visible": true, "properties": {"title": "Últimas noticias", "limit": 3}}, {"type": "events", "position": 4, "is_visible": true, "properties": {"title": "Próximos eventos", "limit": 4}}, {"type": "staff", "position": 5, "is_visible": true, "properties": {"title": "Nuestro equipo directivo"}}, {"type": "honors", "position": 6, "is_visible": true, "properties": {"title": "Cuadro de honor", "limit": 6}}, {"type": "links", "position": 7, "is_visible": true, "properties": {"title": "Enlaces de interés", "items": [{"title": "Oferta educativa", "description": "Conoce nuestros niveles y servicios.", "url": "/?slug=oferta-educativa"}, {"title": "Noticias", "description": "Todo lo que pasa en el colegio.", "url": "/?slug=noticias"}, {"title": "Contacto", "description": "Escríbenos o visítanos.", "url": "/?slug=contacto"}, {"title": "Ministerio de Educación", "description": "Información oficial del sistema educativo.", "url": "https://educacion.gob.ec"}]}}, {"type": "social_links", "position": 8, "is_visible": true, "properties": {"title": "Síguenos en redes"}}, {"type": "banner", "position": 9, "is_visible": true, "properties": {"size": "compact", "title": "¿Listo para ser parte de nuestra comunidad?", "subtitle": "Escríbenos y te contamos todo sobre el proceso de admisión.", "button_label": "Contáctanos", "button_url": "/?slug=contacto"}}]}$j$::jsonb),
            ('nosotros', 'Nosotros', FALSE, $j${"title": "Nosotros", "sections": [{"type": "banner", "position": 0, "is_visible": true, "properties": {"size": "compact", "title": "Quiénes somos", "subtitle": "Más de 25 años educando con valores."}}, {"type": "text", "position": 1, "is_visible": true, "properties": {"title": "Nuestra historia", "body": "El Colegio Demo nació en 1998 con una idea sencilla: que cada niño y joven encuentre un lugar donde aprender con curiosidad y alegría.\nHoy somos una comunidad de más de mil estudiantes, docentes y familias que comparten el mismo compromiso con la educación."}}, {"type": "text", "position": 2, "is_visible": true, "properties": {"title": "Misión, visión y valores", "items": [{"title": "Misión", "description": "Brindar una educación de calidad que fomente el pensamiento crítico, la creatividad y el compromiso social."}, {"title": "Visión", "description": "Ser una institución referente por la formación integral de personas íntegras y solidarias."}, {"title": "Valores", "description": "Respeto, honestidad, responsabilidad, solidaridad y excelencia."}]}}, {"type": "text", "position": 3, "is_visible": true, "properties": {"title": "Nuestros hitos", "layout": "stats", "items": [{"title": "1998", "description": "Fundación con 60 estudiantes"}, {"title": "2008", "description": "Apertura del Bachillerato"}, {"title": "2016", "description": "Laboratorios de ciencias"}, {"title": "2024", "description": "Transformación digital"}]}}, {"type": "staff", "position": 4, "is_visible": true, "properties": {"title": "Equipo directivo y docente"}}, {"type": "banner", "position": 5, "is_visible": true, "properties": {"size": "compact", "title": "¿Listo para ser parte de nuestra comunidad?", "subtitle": "Escríbenos y te contamos todo sobre el proceso de admisión.", "button_label": "Contáctanos", "button_url": "/?slug=contacto"}}]}$j$::jsonb),
            ('oferta-educativa', 'Oferta educativa', FALSE, $j${"title": "Oferta educativa", "sections": [{"type": "banner", "position": 0, "is_visible": true, "properties": {"size": "compact", "title": "Oferta educativa", "subtitle": "Un camino completo, de Inicial a Bachillerato."}}, {"type": "text", "position": 1, "is_visible": true, "properties": {"title": "Niveles educativos", "body": "Acompañamos a cada estudiante en todas sus etapas.", "items": [{"title": "Educación Inicial", "description": "Juego, lenguaje y primeras habilidades sociales."}, {"title": "Básica Elemental", "description": "Lectoescritura, cálculo y hábitos de estudio."}, {"title": "Básica Media", "description": "Pensamiento científico y trabajo colaborativo."}, {"title": "Básica Superior", "description": "Proyectos interdisciplinarios y orientación."}, {"title": "Bachillerato General Unificado", "description": "Preparación académica y vocacional para la universidad."}]}}, {"type": "text", "position": 2, "is_visible": true, "properties": {"title": "Jornada y horarios", "body": "Jornada matutina de 07:00 a 13:00.\nActividades extracurriculares de lunes a jueves, de 13:30 a 15:30."}}, {"type": "text", "position": 3, "is_visible": true, "properties": {"title": "Servicios para estudiantes", "items": [{"title": "DECE", "description": "Departamento de Consejería Estudiantil."}, {"title": "Biblioteca", "description": "Más de 5.000 títulos y salas de estudio."}, {"title": "Laboratorios", "description": "Ciencias y computación."}, {"title": "Deportes y arte", "description": "Fútbol, baloncesto, música y danza."}]}}, {"type": "links", "position": 4, "is_visible": true, "properties": {"title": "Proceso de admisión", "items": [{"title": "Solicitar información", "description": "Déjanos tus datos y te contactamos.", "url": "/?slug=contacto"}, {"title": "Ver próximos eventos", "description": "Casa abierta y reuniones informativas.", "url": "/"}, {"title": "Ministerio de Educación", "description": "Requisitos y normativa oficial.", "url": "https://educacion.gob.ec"}]}}, {"type": "banner", "position": 5, "is_visible": true, "properties": {"size": "compact", "title": "¿Listo para ser parte de nuestra comunidad?", "subtitle": "Escríbenos y te contamos todo sobre el proceso de admisión.", "button_label": "Contáctanos", "button_url": "/?slug=contacto"}}]}$j$::jsonb),
            ('noticias', 'Noticias', FALSE, $j${"title": "Noticias", "sections": [{"type": "banner", "position": 0, "is_visible": true, "properties": {"size": "compact", "title": "Noticias", "subtitle": "Lo que ocurre en nuestra comunidad educativa."}}, {"type": "news", "position": 1, "is_visible": true, "properties": {"title": "Últimas noticias", "limit": 12}}, {"type": "events", "position": 2, "is_visible": true, "properties": {"title": "Agenda", "limit": 6}}]}$j$::jsonb),
            ('contacto', 'Contacto', FALSE, $j${"title": "Contacto", "sections": [{"type": "banner", "position": 0, "is_visible": true, "properties": {"size": "compact", "title": "Contáctanos", "subtitle": "Estamos para ayudarte."}}, {"type": "text", "position": 1, "is_visible": true, "properties": {"title": "Dónde estamos", "body": "Av. Principal y Calle 1, Quito, Ecuador.\nHorario de atención: lunes a viernes, de 07:00 a 16:00."}}, {"type": "links", "position": 2, "is_visible": true, "properties": {"title": "Escríbenos o llámanos", "items": [{"title": "Correo electrónico", "description": "info@colegio-demo.test", "url": "mailto:info@colegio-demo.test"}, {"title": "Teléfono", "description": "099 999 9999", "url": "tel:0999999999"}]}}, {"type": "social_links", "position": 3, "is_visible": true, "properties": {"title": "Síguenos en redes"}}]}$j$::jsonb)
        ) AS t(page_slug, page_title, is_home, snap)
    LOOP
        INSERT INTO pages (institution_id, slug, title, status, is_homepage)
        VALUES (inst, rec.page_slug, rec.page_title, 'published', rec.is_home)
        ON CONFLICT (institution_id, slug) DO UPDATE
            SET title = EXCLUDED.title, status = 'published', is_homepage = EXCLUDED.is_homepage
        RETURNING page_id INTO pg;

        INSERT INTO publication_versions (page_id, version_number, content_snapshot)
        VALUES (pg, 1, rec.snap)
        ON CONFLICT (page_id, version_number) DO UPDATE SET content_snapshot = EXCLUDED.content_snapshot;
    END LOOP;

    -- Noticias
    INSERT INTO news (institution_id, title, slug, summary, content, is_published, published_at)
    SELECT inst, v.title, v.slug, v.summary, v.content, TRUE, v.published_at
    FROM (VALUES
            ('inicio-del-ano-lectivo', 'Inicio del año lectivo 2026-2027', 'Damos la bienvenida a estudiantes y familias.', E'Iniciamos un nuevo año lectivo lleno de proyectos.\n\nGracias a toda la comunidad por su confianza.', CURRENT_TIMESTAMP - INTERVAL '25 days'),
            ('feria-de-ciencias', 'Feria de ciencias: ¡ya tenemos proyectos!', 'Más de 40 equipos presentarán sus experimentos.', E'Los estudiantes presentarán sus experimentos ante la comunidad.\n\nLas familias están invitadas a participar.', CURRENT_TIMESTAMP - INTERVAL '12 days'),
            ('campeonato-de-futbol', 'Campeonato interinstitucional de fútbol', 'Nuestro equipo avanzó a las semifinales.', E'Con un gran partido, nuestros estudiantes lograron el pase a semifinales.\n\n¡Todos a apoyar al equipo!', CURRENT_TIMESTAMP - INTERVAL '7 days'),
            ('jornada-puertas-abiertas', 'Jornada de puertas abiertas', 'Conoce nuestras instalaciones y propuesta educativa.', E'Las familias interesadas pueden recorrer el colegio y conversar con docentes y directivos.', CURRENT_TIMESTAMP - INTERVAL '3 days'),
            ('nuevo-laboratorio', 'Nuevo laboratorio de computación', 'Equipos modernos para el aprendizaje digital.', E'Inauguramos un laboratorio con 30 equipos para clases de programación y robótica.', CURRENT_TIMESTAMP - INTERVAL '1 days')
    ) AS v(slug, title, summary, content, published_at)
    ON CONFLICT (institution_id, slug) DO UPDATE
        SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content,
            is_published = TRUE, published_at = EXCLUDED.published_at;

    -- Eventos próximos (se recalculan respecto a hoy)
    DELETE FROM events WHERE institution_id = inst;
    INSERT INTO events (institution_id, title, description, location, event_date)
    SELECT inst, v.title, v.description, v.location, v.event_date
    FROM (VALUES
            ('Reunión de padres de familia', 'Entrega de informes y planificación del quimestre.', 'Auditorio', date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '5 days 23 hours'),
            ('Casa abierta de ciencias', 'Exposición de proyectos de todos los niveles.', 'Patio central', date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '12 days 14 hours'),
            ('Festival artístico y cultural', 'Música, danza y teatro a cargo de los estudiantes.', 'Coliseo', date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '20 days 22 hours'),
            ('Entrega de libretas', 'Primer quimestre, por cursos.', 'Aulas', date_trunc('day', CURRENT_TIMESTAMP) + INTERVAL '40 days 13 hours')
    ) AS v(title, description, location, event_date);

    -- Personal
    DELETE FROM staff WHERE institution_id = inst;
    INSERT INTO staff (institution_id, full_name, position, bio, position_order, is_public)
    SELECT inst, v.full_name, v.position, v.bio, v.ord, TRUE
    FROM (VALUES
            ('Mg. María Fernanda Salazar', 'Rectora', 'Más de 15 años en gestión educativa.', 1),
            ('Lic. Carlos Andrés Vera', 'Vicerrector', 'Especialista en planificación curricular.', 2),
            ('Mg. Patricia Elena Cordero', 'Inspectora General', NULL::text, 3),
            ('Psic. Lucía Elizabeth Mora', 'Coordinadora DECE', 'Acompañamiento psicológico y orientación vocacional.', 4),
            ('Lic. Jorge Luis Paredes', 'Coordinador de Matemática', NULL::text, 5),
            ('Ing. Andrea Carolina Ruiz', 'Coordinadora de Tecnología', NULL::text, 6)
    ) AS v(full_name, position, bio, ord);

    -- Cuadro de honor
    INSERT INTO academic_periods (institution_id, name, is_active, start_date, end_date)
    VALUES (inst, 'Año lectivo 2026-2027', TRUE, DATE '2026-09-01', DATE '2027-06-30')
    ON CONFLICT (institution_id, name) DO UPDATE SET is_active = TRUE
    RETURNING academic_period_id INTO per;

    INSERT INTO students (institution_id, national_id, first_name, last_name, grade_level)
    VALUES
        (inst, '0000000001', 'Sofía', 'Salazar', 'Tercero de Bachillerato'),
        (inst, '0000000002', 'Mateo', 'Vera', 'Décimo de Básica'),
        (inst, '0000000003', 'Valentina', 'Cordero', 'Noveno de Básica'),
        (inst, '0000000004', 'Daniel', 'Paredes', 'Primero de Bachillerato')
    ON CONFLICT (institution_id, national_id) DO UPDATE
        SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, grade_level = EXCLUDED.grade_level;

    DELETE FROM honors WHERE institution_id = inst;
    INSERT INTO honors (institution_id, academic_period_id, student_id, achievement, score)
    SELECT inst, per, s.student_id, v.achievement, v.score
    FROM (VALUES
            ('0000000001', 'Mejor promedio', 9.85),
            ('0000000004', 'Olimpiada de matemática', 9.7),
            ('0000000003', 'Mérito artístico', 9.55),
            ('0000000002', 'Excelencia deportiva', 9.4)
    ) AS v(nid, achievement, score)
    JOIN students s ON s.institution_id = inst AND s.national_id = v.nid;
END $$;

-- =========================================================
-- 15. TEMA Y PORTADA INICIAL PARA LAS INSTITUCIONES REALES
-- NO crea instituciones ni inventa noticias, personal u honores.
-- NO pisa nada existente: cada paso solo se aplica si la institución
-- todavía no tiene tema / menú / páginas. Es repetible.
-- =========================================================

DO $$
DECLARE
    rec RECORD;
    inst UUID;
    inst_title TEXT;
    th UUID;
    pg UUID;
BEGIN
    FOR rec IN
        SELECT * FROM (VALUES
            ('ue-luz-de-america', '#1e4d8c', '#f2b705', 'system-ui, sans-serif'),
            ('ue-puerto-limon',   '#4c7a1b', '#f5c400', 'Verdana, sans-serif'),
            ('ue-la-concordia',   '#7a1f3d', '#e0b13a', 'Georgia, serif'),
            ('ue-el-esfuerzo',    '#b4501a', '#1b6b6b', '"Trebuchet MS", sans-serif')
        ) AS t(inst_slug, color_primary, color_secondary, font)
    LOOP
        SELECT i.institution_id, i.name INTO inst, inst_title
        FROM institutions i WHERE i.slug = rec.inst_slug;
        CONTINUE WHEN inst IS NULL;

        -- Tema: solo si no tiene ninguno (no pisa el que cree el editor).
        SELECT t.theme_id INTO th FROM themes t
        WHERE t.institution_id = inst ORDER BY t.created_at LIMIT 1;
        IF th IS NULL THEN
            INSERT INTO themes (institution_id, name, primary_color, secondary_color, font_family)
            VALUES (inst, 'Tema principal', rec.color_primary, rec.color_secondary, rec.font)
            RETURNING theme_id INTO th;
        END IF;

        -- Configuración del sitio: crea si falta; si existe, solo completa el tema vacío.
        INSERT INTO site_settings (institution_id, site_title, theme_id, footer_text)
        VALUES (inst, inst_title, th, '© ' || inst_title)
        ON CONFLICT (institution_id) DO UPDATE
            SET theme_id = COALESCE(site_settings.theme_id, EXCLUDED.theme_id);

        -- Portada inicial y menú: solo si la institución no tiene ninguna página.
        IF NOT EXISTS (SELECT 1 FROM pages p WHERE p.institution_id = inst) THEN
            INSERT INTO pages (institution_id, slug, title, status, is_homepage)
            VALUES (inst, 'inicio', 'Inicio', 'published', TRUE)
            RETURNING page_id INTO pg;

            INSERT INTO publication_versions (page_id, version_number, content_snapshot)
            VALUES (pg, 1, jsonb_build_object('title', 'Inicio', 'sections', jsonb_build_array(
                jsonb_build_object('type', 'banner', 'position', 0, 'is_visible', TRUE, 'properties', jsonb_build_object(
                    'title', 'Bienvenidos a ' || inst_title, 'subtitle', 'Portal institucional')),
                jsonb_build_object('type', 'text', 'position', 1, 'is_visible', TRUE, 'properties', jsonb_build_object(
                    'title', 'Nuestra comunidad',
                    'body', 'Esta es la portada inicial de ' || inst_title || '. El contenido se administra desde el editor del portal.')),
                jsonb_build_object('type', 'news',   'position', 2, 'is_visible', TRUE, 'properties', jsonb_build_object('title', 'Noticias', 'limit', 3)),
                jsonb_build_object('type', 'staff',  'position', 3, 'is_visible', TRUE, 'properties', jsonb_build_object('title', 'Nuestro equipo')),
                jsonb_build_object('type', 'honors', 'position', 4, 'is_visible', TRUE, 'properties', jsonb_build_object('title', 'Cuadro de honor', 'limit', 6))
            )))
            ON CONFLICT (page_id, version_number) DO NOTHING;

            IF NOT EXISTS (SELECT 1 FROM menus m WHERE m.institution_id = inst) THEN
                INSERT INTO menus (institution_id, label, url, position, is_external)
                VALUES (inst, 'Inicio', '/', 1, FALSE);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Refresca la caché de la API para que reconozca la vista public_honors.
NOTIFY pgrst, 'reload schema';

-- Verificación: una fila por institución con lo que tiene cada una.
SELECT i.slug,
       (SELECT count(*) FROM themes t WHERE t.institution_id = i.institution_id) AS temas,
       (SELECT count(*) FROM pages p WHERE p.institution_id = i.institution_id AND p.status = 'published') AS paginas,
       (SELECT count(*) FROM news n WHERE n.institution_id = i.institution_id AND n.is_published) AS noticias,
       (SELECT count(*) FROM staff st WHERE st.institution_id = i.institution_id) AS personal,
       (SELECT count(*) FROM public_honors ph WHERE ph.institution_id = i.institution_id) AS honores
FROM institutions i
ORDER BY i.slug;
