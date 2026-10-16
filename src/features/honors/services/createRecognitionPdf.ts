import { jsPDF } from 'jspdf'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'
import { OFFICIAL_DISTINCTIONS } from '../utils/honorRules'

type Color = [number, number, number]
type RecognitionPerson = Pick<AcademicContentEntry, 'studentName' | 'grade' | 'distinction'>

function hexColor(value: string): Color {
  const normalized = value.trim().replace(/^#/, '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return [89, 64, 131]
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function mixWithWhite(color: Color, amount: number): Color {
  return color.map(channel => Math.round(channel + (255 - channel) * amount)) as Color
}

function fitLines(pdf: jsPDF, text: string, width: number, maxLines = 2): string[] {
  const lines = pdf.splitTextToSize(text, width) as string[]
  if (lines.length <= maxLines) return lines
  const lastLine = lines[maxLines - 1]
  return [...lines.slice(0, maxLines - 1), `${lastLine.slice(0, Math.max(0, lastLine.length - 3)).trimEnd()}…`]
}

function drawHeader(pdf: jsPDF, institution: string, year: string, accent: Color, paleAccent: Color) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const centerX = pageWidth / 2
  const ink: Color = [48, 42, 57]
  const muted: Color = [112, 109, 117]

  pdf.setFillColor(248, 247, 250)
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F')
  pdf.setFillColor(...paleAccent)
  pdf.rect(0, 0, pageWidth, 34, 'F')
  pdf.setFillColor(...accent)
  pdf.roundedRect(15, 7, 1.4, 20, 0.7, 0.7, 'F')
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.text('RECONOCIMIENTO ACADÉMICO', centerX, 8.5, { align: 'center' })
  pdf.setTextColor(...ink)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('Cuadro de honor', centerX, 18, { align: 'center' })
  pdf.setTextColor(...muted)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.text(institution, centerX, 25, { align: 'center', maxWidth: pageWidth - 40 })
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text(`Período ${year.replace(/[–—]/g, '-')}`, centerX, 31, { align: 'center' })

  pdf.setTextColor(...ink)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Estudiantes destacados', centerX, 44, { align: 'center' })
  pdf.setTextColor(112, 119, 132)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('Esfuerzo, trayectoria y participación estudiantil', centerX, 49, { align: 'center', maxWidth: pageWidth - 30 })
  pdf.setDrawColor(...paleAccent)
  pdf.setLineWidth(0.45)
  pdf.line(15, 53, pageWidth - 15, 53)
  pdf.setDrawColor(...accent)
}

function drawGenericAvatar(pdf: jsPDF, centerX: number, centerY: number, size: number, paleAccent: Color, accent: Color) {
  pdf.setFillColor(...paleAccent)
  pdf.circle(centerX, centerY, size / 2, 'F')
  pdf.setFillColor(...accent)
  pdf.circle(centerX, centerY - size * 0.1, size * 0.14, 'F')
  pdf.ellipse(centerX, centerY + size * 0.23, size * 0.28, size * 0.17, 'F')
}

function drawPersonCard(pdf: jsPDF, person: RecognitionPerson, accent: Color, paleAccent: Color, x: number, y: number, width: number, height: number) {
  const ink: Color = [48, 42, 57]
  const muted: Color = [96, 105, 119]
  const border: Color = [229, 225, 234]
  const centerX = x + width / 2
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(...border)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(x, y, width, height, 3, 3, 'FD')

  pdf.setFillColor(...paleAccent)
  pdf.roundedRect(centerX - 9, y + 4, 18, 6.3, 3, 3, 'F')
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  const distinctionIndex = OFFICIAL_DISTINCTIONS.indexOf(person.distinction as typeof OFFICIAL_DISTINCTIONS[number])
  const positionLabel = distinctionIndex >= 0 ? `PUESTO ${distinctionIndex + 1}` : 'RECONOCIMIENTO'
  pdf.text(positionLabel, centerX, y + 8.3, { align: 'center' })

  const avatarSize = 17
  const avatarY = y + 20.5
  pdf.setFillColor(255, 255, 255)
  pdf.circle(centerX, avatarY, avatarSize / 2 + 1, 'F')
  pdf.setDrawColor(...paleAccent)
  pdf.setLineWidth(1)
  pdf.circle(centerX, avatarY, avatarSize / 2 + 0.5, 'S')
  drawGenericAvatar(pdf, centerX, avatarY, avatarSize, paleAccent, accent)

  const textWidth = width - 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(person.studentName.length > 28 ? 9 : 10)
  pdf.setTextColor(...ink)
  const nameLines = fitLines(pdf, person.studentName, textWidth)
  const nameY = y + 34.5
  pdf.text(nameLines, centerX, nameY, { align: 'center', lineHeightFactor: 1.05 })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.8)
  pdf.setTextColor(...muted)
  const distinctionLines = fitLines(pdf, person.distinction, textWidth)
  const distinctionY = y + (nameLines.length > 1 ? 45.5 : 41.5)
  pdf.text(distinctionLines, centerX, distinctionY, { align: 'center', lineHeightFactor: 1.1 })

  const grade = person.grade
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...muted)
  pdf.text(grade, centerX, y + height - 4.2, { align: 'center', maxWidth: textWidth })
}

export async function createRecognitionPdf(
  people: RecognitionPerson[],
  institutionName: string,
  year: string,
  accentHex: string,
): Promise<string> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const accent = hexColor(accentHex)
  const paleAccent = mixWithWhite(accent, 0.88)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const columns = 3
  const rows = 3
  const pageCapacity = columns * rows
  const marginX = 15
  const gapX = 4
  const gapY = 4
  const cardWidth = (pageWidth - marginX * 2 - gapX * (columns - 1)) / columns
  const cardHeight = 58
  const gridTop = 57
  const gridHeight = rows * cardHeight + (rows - 1) * gapY
  const footerY = gridTop + gridHeight + 6
  const pageCount = Math.max(1, Math.ceil(people.length / pageCapacity))

  pdf.setProperties({ title: `Cuadro de honor ${year}`, subject: institutionName, author: institutionName })
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) pdf.addPage('a4', 'portrait')
    drawHeader(pdf, institutionName, year, accent, paleAccent)

    const pagePeople = people.slice(pageIndex * pageCapacity, (pageIndex + 1) * pageCapacity)
    pagePeople.forEach((person, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = marginX + column * (cardWidth + gapX)
      const y = gridTop + row * (cardHeight + gapY)
      drawPersonCard(pdf, person, accent, paleAccent, x, y, cardWidth, cardHeight)
    })

    pdf.setDrawColor(...paleAccent)
    pdf.setLineWidth(0.4)
    pdf.line(15, footerY, pageWidth - 15, footerY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(112, 119, 132)
    pdf.setFontSize(8)
    pdf.text(`${institutionName} · Período ${year.replace(/[–—]/g, '-')}`, 15, footerY + 5)
    pdf.text(`${pageIndex + 1} / ${pageCount}`, pageWidth - 15, footerY + 5, { align: 'right' })
  }

  return URL.createObjectURL(pdf.output('blob'))
}
