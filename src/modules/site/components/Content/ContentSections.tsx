import { AsyncView } from "../states/AsyncView";
import { ImageAsset } from "../Media/ImageAsset";
import { useEvents, useHonors, useNews, useStaff } from "../../hooks/useContent";

interface Props {
  title?: string;
  limit?: number;
  position?: string;
}

function Photo({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? (
    <ImageAsset src={url} alt={alt} aspectRatio="4 / 3" />
  ) : (
    <ImageAsset path={url} alt={alt} aspectRatio="4 / 3" />
  );
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="site-section site-block">
      <div className="site-container">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function NewsSection({ title = "Noticias", limit = 3 }: Props) {
  const { state, reload } = useNews(limit);
  return (
    <Block title={title}>
      <AsyncView state={state} onRetry={reload} emptyMessage="Aún no hay noticias publicadas.">
        {(list) => (
          <ul className="site-cards">
            {list.map((n) => (
              <li key={n.news_id} className="site-card site-news">
                <Photo url={n.cover_image_url} alt={n.title} />
                {formatDate(n.published_at) && <p className="site-muted site-news__date">{formatDate(n.published_at)}</p>}
                <h3>{n.title}</h3>
                {n.summary && <p>{n.summary}</p>}
                <details>
                  <summary>Leer más</summary>
                  {n.content.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
                </details>
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

export function HonorsSection({ title = "Cuadro de honor", limit = 6 }: Props) {
  const { state, reload } = useHonors(limit);
  return (
    <Block title={title}>
      <AsyncView state={state} onRetry={reload} emptyMessage="Aún no hay reconocimientos publicados.">
        {(list) => (
          <ul className="site-cards">
            {list.map((h) => (
              <li key={h.honor_id} className="site-card site-person">
                {h.photo_url ? (
                  <Photo url={h.photo_url} alt={h.student_name} />
                ) : (
                  <span className="site-avatar" aria-hidden="true">{initials(h.student_name)}</span>
                )}
                <h3>{h.student_name}</h3>
                <p className="site-person__role">{h.achievement}</p>
                <p className="site-muted">
                  {[h.grade_level, h.score != null ? `Promedio ${Number(h.score).toFixed(2)}` : null].filter(Boolean).join(" · ")}
                </p>
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
  return (
    <Block title={title}>
      <AsyncView state={state} onRetry={reload} emptyMessage="No hay eventos próximos.">
        {(list) => (
          <ul className="site-cards">
            {list.map((e) => {
              const d = new Date(e.event_date);
              return (
                <li key={e.event_id} className="site-card site-event">
                  <time className="site-event__date" dateTime={e.event_date}>
                    <strong>{d.toLocaleDateString("es-EC", { day: "2-digit" })}</strong>
                    <span>{d.toLocaleDateString("es-EC", { month: "short" }).replace(".", "")}</span>
                  </time>
                  <div>
                    <h3>{e.title}</h3>
                    <p className="site-muted">
                      {[d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }), e.location].filter(Boolean).join(" · ")}
                    </p>
                    {e.description && <p>{e.description}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>
    </Block>
  );
}
