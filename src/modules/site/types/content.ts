export interface ThemeRow {
  theme_id: string;
  institution_id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  tertiary_color: string | null;
  font_family: string;
  base_font_size: number | string | null;
}

export interface NewsItem {
  news_id: string;
  institution_id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
}

export interface StaffMember {
  staff_id: string;
  institution_id: string;
  full_name: string;
  position: string;
  photo_url: string | null;
  bio: string | null;
  position_order: number;
  email?: string | null;
}

export interface Honor {
  honor_id: string;
  institution_id: string;
  achievement: string;
  score: number | string | null;
  photo_url: string | null;
  student_name: string;
  grade_level: string | null;
  schedule?: string | null;
}

export interface EventItem {
  event_id: string;
  institution_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time?: string | null;
  location: string | null;
}
