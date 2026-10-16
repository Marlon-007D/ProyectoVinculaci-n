import { ArrowRight, BookOpenCheck, Building2, GraduationCap, HeartHandshake, LockKeyhole, PanelsTopLeft, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const areas = [
  { icon: HeartHandshake, title: 'Vinculación comunitaria', text: 'Organiza proyectos, equipos de trabajo y actividades que conectan el aprendizaje con la comunidad.', tone: 'mint' },
  { icon: GraduationCap, title: 'Acompañamiento DECE', text: 'Gestiona fichas y procesos de atención estudiantil desde un espacio ordenado y seguro.', tone: 'blue' },
  { icon: BookOpenCheck, title: 'Herramientas académicas', text: 'Ofrece recursos y simuladores para apoyar la práctica y el aprendizaje de tus estudiantes.', tone: 'amber' },
  { icon: PanelsTopLeft, title: 'Portal institucional', text: 'Comparte noticias, información y contenidos relevantes para toda la comunidad educativa.', tone: 'violet' },
];

export function InstitutionalEntryPage() {
  return (
    <div className="relative isolate overflow-hidden bg-[#f4f8fb] text-slate-900">
      <section className="relative overflow-hidden bg-[#0a233f] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 size-[520px] rounded-full bg-cyan-400/20 blur-[100px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 left-[20%] size-[500px] rounded-full bg-blue-500/20 blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/[.07] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-cyan-100 shadow-lg shadow-cyan-950/10 backdrop-blur">
              <Sparkles size={14} className="text-cyan-300" /> Plataforma educativa multiinstitucional
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-.045em] text-white sm:text-5xl lg:text-[58px]">
              Una comunidad educativa que <span className="bg-gradient-to-r from-cyan-200 via-teal-200 to-sky-300 bg-clip-text text-transparent">avanza conectada.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Un solo espacio para impulsar proyectos, acompañar a tus estudiantes y compartir lo mejor de cada institución.
            </p>
            <div className="mt-8">
              <Link to="/panel/admin" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-[#08233b] shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/50">
                Acceso institucional <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-slate-300">
              <span className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[.08] text-cyan-200"><LockKeyhole size={15} /></span>
              Acceso protegido y espacios separados por institución
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[510px] lg:justify-self-end">
            <div aria-hidden="true" className="absolute -inset-5 rounded-[34px] bg-gradient-to-br from-cyan-300/20 via-blue-400/10 to-violet-400/20 blur-2xl" />
            <div className="relative rounded-[28px] border border-white/15 bg-white/[.08] p-3 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-4">
              <div className="rounded-[21px] bg-[#f8fbfd] p-5 text-slate-900 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-[#0a233f] text-xs font-extrabold tracking-wide text-white">UE</div>
                    <div><p className="text-xs font-bold text-slate-900">Tu espacio educativo</p><p className="mt-0.5 text-[10px] text-slate-500">Todo conectado, en un solo lugar</p></div>
                  </div>
                  <span className="size-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-100" aria-label="Plataforma disponible" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {areas.map(({ icon: Icon, title, tone }) => (
                    <div key={title} className="min-h-[112px] rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_4px_14px_rgba(15,41,62,.05)] sm:p-4">
                      <span className={`grid size-9 place-items-center rounded-xl ${tone === 'mint' ? 'bg-teal-50 text-teal-700' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}><Icon size={18} /></span>
                      <p className="mt-3 text-[11px] font-bold leading-snug text-slate-800">{title}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#eaf7f7] to-[#eff5ff] p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-teal-700 shadow-sm"><Building2 size={18} /></span>
                  <div><p className="text-[11px] font-bold text-slate-800">Una red, muchas oportunidades</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Cada institución administra su propio entorno de trabajo.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experiencia" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-extrabold uppercase tracking-[.16em] text-teal-700">Un entorno integral</span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#102a43] sm:text-3xl">La tecnología al servicio de la educación</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">Herramientas pensadas para facilitar el trabajo de las instituciones y fortalecer el vínculo con su comunidad.</p>
        </div>
        <div className="mt-9 grid auto-rows-fr items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className="group flex h-full min-h-[218px] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_5px_22px_rgba(15,41,62,.04)] transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg hover:shadow-slate-900/5">
              <span className={`grid size-11 place-items-center rounded-[14px] transition-transform group-hover:scale-105 ${tone === 'mint' ? 'bg-teal-50 text-teal-700' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}><Icon size={20} /></span>
              <h3 className="mt-4 min-h-10 text-sm font-bold leading-5 text-slate-900">{title}</h3>
              <p className="mt-2 flex-1 text-xs leading-5 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-teal-100 bg-white/80 px-4 py-3 text-center text-xs text-slate-600">
          <LockKeyhole size={15} className="shrink-0 text-teal-700" />
          Ingresa con la cuenta que te asignó el responsable de tu institución.
        </div>
      </section>
    </div>
  );
}
