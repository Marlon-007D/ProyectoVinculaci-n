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
  const navy: Color = [28, 43, 67]
  const yellow: Color = [255, 205, 38]
  const blue: Color = [38, 77, 153]
  const red: Color = [205, 38, 53]

  pdf.setFillColor(249, 250, 252)
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F')
  pdf.setFillColor(...navy)
  pdf.rect(0, 0, pageWidth, 34, 'F')
  pdf.setTextColor(229, 206, 151)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('RECONOCIMIENTO ACADÉMICO', centerX, 7.5, { align: 'center' })
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Cuadro de honor', centerX, 17.5, { align: 'center' })
  pdf.setTextColor(239, 242, 247)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(institution, centerX, 24.5, { align: 'center', maxWidth: pageWidth - 40 })
  pdf.setTextColor(229, 206, 151)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text(`Período ${year.replace(/[–—]/g, '-')}`, centerX, 31, { align: 'center' })

  const stripeWidth = pageWidth / 3
  pdf.setFillColor(...yellow)
  pdf.rect(0, 34, stripeWidth, 1.5, 'F')
  pdf.setFillColor(...blue)
  pdf.rect(stripeWidth, 34, stripeWidth, 1.5, 'F')
  pdf.setFillColor(...red)
  pdf.rect(stripeWidth * 2, 34, stripeWidth + 1, 1.5, 'F')

  pdf.setTextColor(...navy)
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

function drawGenericAvatar(pdf: jsPDF, centerX: number, centerY: number, size: number, paleAccent: Color) {
  const silhouette: Color = [133, 145, 162]
  pdf.setFillColor(...paleAccent)
  pdf.circle(centerX, centerY, size / 2, 'F')
  pdf.setFillColor(...silhouette)
  pdf.circle(centerX, centerY - size * 0.1, size * 0.14, 'F')
  pdf.ellipse(centerX, centerY + size * 0.23, size * 0.28, size * 0.17, 'F')
}

function drawPersonCard(pdf: jsPDF, person: RecognitionPerson, accent: Color, paleAccent: Color, x: number, y: number, width: number, height: number) {
  const navy: Color = [28, 43, 67]
  const muted: Color = [96, 105, 119]
  const border: Color = [222, 227, 235]
  const centerX = x + width / 2
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(...border)
  pdf.setLineWidth(0.35)
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
  drawGenericAvatar(pdf, centerX, avatarY, avatarSize, paleAccent)

  const textWidth = width - 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(person.studentName.length > 28 ? 9 : 10)
  pdf.setTextColor(...navy)
  const nameLines = fitLines(pdf, person.studentName, textWidth)
  const nameY = y + 34.5
  pdf.text(nameLines, centerX, nameY, { align: 'center', lineHeightFactor: 1.05 })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.8)
  pdf.setTextColor(...muted)
  const distinctionLines = fitLines(pdf, person.distinction, textWidth)
  const distinctionY = y + (nameLines.length > 1 ? 45.5 : 41.5)
  pdf.text(distinctionLines, centerX, distinctionY, { align: 'center', lineHeightFactor: 1.1 })

  const grade = person.grade.toLocaleUpperCase('es-EC')
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
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
  const gridTop = 58
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
