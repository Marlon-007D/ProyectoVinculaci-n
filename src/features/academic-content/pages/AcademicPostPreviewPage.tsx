import { useEffect, useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import authorAvatar from '../../honors/mocks/avatars/portrait-01.jpg'
import type { AcademicContentEntry } from '../types/academicContent.types'
import { blogPreviewMock, blogPreviewSections } from '../mocks/blogPreviewMock'
import './AcademicPostPreviewPage.css'

interface Props { entry: AcademicContentEntry }

function dateLabel(value: string) {
  if (!value) return 'Fecha por definir'
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

export function AcademicPostPreviewPage({ entry }: Props) {
  const [activeSection, setActiveSection] = useState(0)
  const isEvent = entry.kind === 'event'
  const author = entry.author?.trim() || 'Brigitte Rodríguez'
  const fallbackImage = isEvent
    ? 'https://socialsciences.careers.mcmaster.ca/app/uploads/2025/10/Untitled-design-27.png'
    : 'https://futuresocsci.mcmaster.ca/app/uploads/2024/07/Thubnail-photo-2-1400x600.jpg'
  const writtenParagraphs = entry.description.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean)
  const paragraphs = writtenParagraphs.length >= 6
    ? writtenParagraphs
    : [...writtenParagraphs, ...blogPreviewMock.slice(writtenParagraphs.length)]
  const sections = Array.from({ length: Math.ceil(paragraphs.length / 2) }, (_, index) => ({
    id: `post-section-${index + 1}`,
    title: blogPreviewSections[index] ?? `Sección ${index + 1}`,
    paragraphs: paragraphs.slice(index * 2, index * 2 + 2),
  }))

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(item => item.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const index = visible ? sections.findIndex(section => section.id === visible.target.id) : -1
      if (index >= 0) setActiveSection(index)
    }, { rootMargin: '-15% 0px -65% 0px', threshold: [0, 0.2, 0.6] })
    sections.forEach(section => {
      const target = document.getElementById(section.id)
      if (target) observer.observe(target)
    })
    return () => observer.disconnect()
  }, [entry.id, sections.length])

  return <section className="post-preview-page page-content">
    <article className="post-article">
      <img className="post-article-cover" src={entry.imageUrl || fallbackImage} alt="Foto de portada" />
      <div className="post-article-content">
        <p className="post-article-category">{isEvent ? 'EVENTO INSTITUCIONAL' : 'NOTICIAS'}</p>
        <h1>{entry.title}</h1>
        <div className="post-article-meta">
          <span className="post-author"><img className="post-author-avatar" src={authorAvatar} alt="" /><span className="post-author-name">{author}</span></span>
          <span><CalendarDays size={16} />{dateLabel(entry.date)}</span>
          {isEvent && entry.location && <span><MapPin size={16} />{entry.location}</span>}
        </div>
        <div className="post-article-layout">
          <div className="post-article-body">{sections.map(section => <section id={section.id} className="post-article-section" key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}</section>)}</div>
          <nav className="post-article-toc" aria-label="Secciones del artículo"><strong>En este artículo</strong>{sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className={activeSection === index ? 'is-active' : ''} aria-current={activeSection === index ? 'location' : undefined}>{section.title}</a>)}</nav>
        </div>
      </div>
    </article>
  </section>
}
