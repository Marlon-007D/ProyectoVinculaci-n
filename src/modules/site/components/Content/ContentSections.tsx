import { useSearchParams } from "react-router-dom";
import { AsyncView } from "../states/AsyncView";
import { ImageAsset } from "../Media/ImageAsset";
import { useEvents, useHonors, useNews, useStaff } from "../../hooks/useContent";
import honorsStyles from "./HonorsSection.module.css";

interface Props {
  title?: string;
  limit?: number;
  position?: string;
}

function Photo({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  if (!url) return null;
  return /^(https?:\/\/|data:image\/|\/)/i.test(url) ? (
    <ImageAsset src={url} alt={alt} aspectRatio="4 / 3" className={className} />
  ) : (
    <ImageAsset path={url} alt={alt} aspectRatio="4 / 3" className={className} />
  );
}

const honorAvatars = [
  ["emilia zambrano", "/avatares/01_Emilia_Zambrano.png"],
  ["mateo cedeno", "/avatares/02_Mateo_Cedeno.png"],
  ["sofia paredes", "/avatares/03_Sofia_Paredes.png"],
  ["joaquin moreira", "/avatares/04_Joaquin_Moreira.png"],
  ["valentina vera", "/avatares/05_Valentina_Vera.png"],
  ["andres mera", "/avatares/06_Andres_Mera.png"],
  ["camila loor", "/avatares/07_Camila_Loor.png"],
  ["daniel mina", "/avatares/08_Daniel_Mina.png"],
  ["luciana galarza", "/avatares/09_Luciana_Galarza.png"],
] as const;

function localHonorAvatar(studentName: string): string | null {
  const normalizedName = studentName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
  const match = honorAvatars.find(([name]) => normalizedName.includes(name));
  return match?.[1] ?? null;
}

function initials(name: string): string {
  return name
    .replace(/^(mg|lic|psic|dr|dra|ing|msc|phd)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" }) : null;

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`site-section site-block ${className ?? ""}`}>
      <div className="site-container">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function NewsSection({ title = "Noticias", limit = 3 }: Props) {
  const { state, reload } = useNews(limit);
  const [, setSearchParams] = useSearchParams();
  return (
    <Block title={title}>
      <AsyncView state={state} onRetry={reload} emptyMessage="Aún no hay noticias publicadas.">
        {(list) => (
          <ul className="site-cards">
            {list.map((n) => (
              <li key={n.news_id} className="site-card site-news">
                <button type="button" className="site-news__open" onClick={() => setSearchParams(current => { const next = new URLSearchParams(current); next.set("noticia", n.news_id); return next; })} aria-label={`Abrir noticia: ${n.title}`}>
                  <Photo url={n.cover_image_url} alt={n.title} />
                  {formatDate(n.published_at) && <p className="site-muted site-news__date">{formatDate(n.published_at)}</p>}
                  <h3>{n.title}</h3>
                  {n.summary && <p>{n.summary}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </Block>
  );
}

export function StaffSection({ title = "Nuestro equipo", position }: Props) {
  const { state, reload } = useStaff(position);
  if (position && state.status !== "success") return null;
  return (
    <Block title={title}>
      <AsyncView state={state} onRetry={reload} emptyMessage="Aún no hay personal publicado.">
        {(list) => (
          <ul className="site-cards">
            {list.map((m) => (
              <li key={m.staff_id} className="site-card site-person">
                {m.photo_url ? (
                  <Photo url={m.photo_url} alt={m.full_name} />
                ) : (
                  <span className="site-avatar" aria-hidden="true">{initials(m.full_name)}</span>
                )}
                <h3>{m.full_name}</h3>
                <p className="site-person__role">{m.position}</p>
                {safeStaffEmail(m.email) && <p><a href={`mailto:${safeStaffEmail(m.email)}`}>{m.email}</a></p>}
                {m.bio && <p className="site-muted">{m.bio}</p>}
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </Block>
  );
}

function safeStaffEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const email = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/.test(email) ? email : null;
}

export function HonorsSection({ title = "Cuadro de honor", limit = 6, className }: Props & { className?: string }) {
  const { state, reload } = useHonors(limit);
  return (
    <Block title={title} className={className}>
      <AsyncView state={state} onRetry={reload} emptyMessage="Aún no hay reconocimientos publicados.">
        {(list) => (
          <ul className={`site-cards ${className ? honorsStyles.cards : ""}`}>
            {list.map((h) => (
              <li key={h.honor_id} className="site-card site-person">
                <div className={className ? honorsStyles.profile : undefined}>
                  {h.photo_url || localHonorAvatar(h.student_name) ? (
                    <Photo className={className ? honorsStyles.photo : undefined} url={h.photo_url || localHonorAvatar(h.student_name)} alt={`Foto de ${h.student_name}`} />
                  ) : (
                    <span className={`site-avatar ${className ? honorsStyles.avatar : ""}`} aria-hidden="true">{initials(h.student_name)}</span>
                  )}
                  <div className={className ? honorsStyles.details : undefined}>
                    <h3>{h.student_name}</h3>
                    <p className="site-person__role">{h.achievement}</p>
                    <p className="site-muted">{[h.grade_level, h.score != null ? `Promedio ${Number(h.score).toFixed(2)}` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </Block>
  );
}

export function EventsSection({ title = "Próximos eventos", limit = 4 }: Props) {
  const { state, reload } = useEvents(limit);
  const [, setSearchParams] = useSearchParams();
  return (
    <Block title={title}>
      <AsyncView state={state} onRetry={reload} emptyMessage="No hay eventos próximos.">
        {(list) => (
          <ul className="site-cards">
            {list.map((e) => {
              const d = new Date(`${e.event_date.slice(0, 10)}T12:00:00Z`);
              const time = e.event_time
                ? new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(`1970-01-01T${e.event_time}:00Z`))
                : e.event_date.length > 10 ? new Date(e.event_date).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : null;
              return (
                <li key={e.event_id} className="site-card site-event">
                  <button type="button" className="site-event__open" onClick={() => setSearchParams(current => { const next = new URLSearchParams(current); next.set("evento", e.event_id); return next; })} aria-label={`Abrir evento: ${e.title}`}>
                    <time className="site-event__date" dateTime={e.event_date}>
                      <strong>{d.toLocaleDateString("es-EC", { day: "2-digit" })}</strong>
                      <span>{d.toLocaleDateString("es-EC", { month: "short" }).replace(".", "")}</span>
                    </time>
                    <span className="site-event__copy">
                      <h3>{e.title}</h3>
                      <span className="site-muted">{[time, e.location].filter(Boolean).join(" · ")}</span>
                      {e.description && <span>{e.description}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>
    </Block>
  );
}
