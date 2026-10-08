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
    phone VARCHAR(20),
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_auth_users
        FOREIGN KEY (profile_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

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

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.roles AS r ON r.role_id = m.role_id
        WHERE m.profile_id = auth.uid()
          AND r.name = 'super_admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

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
    USING (institution_id = get_current_institution_id() OR is_super_admin())
    WITH CHECK (institution_id = get_current_institution_id() OR is_super_admin());

CREATE POLICY module_settings_tenant_policy ON module_settings
    FOR ALL TO authenticated
    USING (institution_id = get_current_institution_id() OR is_super_admin())
    WITH CHECK (institution_id = get_current_institution_id() OR is_super_admin());

CREATE POLICY audit_events_tenant_policy ON audit_events
    FOR SELECT TO authenticated
    USING (institution_id = get_current_institution_id() OR is_super_admin());

CREATE POLICY audit_events_insert_authenticated ON audit_events
    FOR INSERT TO authenticated
    WITH CHECK (
        profile_id = auth.uid()
        AND (is_super_admin() OR institution_id = get_current_institution_id())
    );

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
    USING (institution_id = get_current_institution_id() OR is_super_admin())
    WITH CHECK (institution_id = get_current_institution_id() OR is_super_admin());

CREATE POLICY memberships_self_read ON memberships
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- Perfiles: cada usuario puede consultar/modificar su propio perfil.
CREATE POLICY profiles_owner_policy ON profiles
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY profiles_super_admin_read ON profiles
    FOR SELECT TO authenticated
    USING (is_super_admin());

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
