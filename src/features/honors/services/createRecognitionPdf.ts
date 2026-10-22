import { jsPDF } from 'jspdf'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'
import { getStudentAvatar, getStudentInitials } from '../utils/studentAvatar'

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

function drawSparkle(pdf: jsPDF, x: number, y: number, size: number, color: Color) {
  pdf.setDrawColor(...color)
  pdf.setLineWidth(0.55)
  pdf.line(x, y - size, x, y + size)
  pdf.line(x - size, y, x + size, y)
  pdf.line(x - size * 0.65, y - size * 0.65, x + size * 0.65, y + size * 0.65)
  pdf.line(x - size * 0.65, y + size * 0.65, x + size * 0.65, y - size * 0.65)
}

function drawMedal(pdf: jsPDF, centerX: number, centerY: number, size: number, accent: Color, paleAccent: Color) {
  const ribbonTop = centerY + size * 0.15
  pdf.setFillColor(...paleAccent)
  pdf.triangle(centerX - size * 0.42, ribbonTop, centerX - size * 0.03, ribbonTop, centerX - size * 0.34, centerY + size * 0.9, 'F')
  pdf.triangle(centerX + size * 0.03, ribbonTop, centerX + size * 0.42, ribbonTop, centerX + size * 0.34, centerY + size * 0.9, 'F')
  pdf.setFillColor(...accent)
  pdf.circle(centerX, centerY, size * 0.48, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.circle(centerX, centerY, size * 0.29, 'F')
  drawSparkle(pdf, centerX, centerY, size * 0.16, accent)
}

function drawDistinctiveIcon(pdf: jsPDF, kind: number, centerX: number, centerY: number, accent: Color, paleAccent: Color) {
  const x = centerX - 3
  const y = centerY - 3
  pdf.setDrawColor(...accent)
  pdf.setFillColor(...paleAccent)
  pdf.setLineWidth(0.65)

  switch (kind % 9) {
    case 0: // Bandera
      pdf.line(x + 1, y, x + 1, y + 7)
      pdf.triangle(x + 1, y, x + 6, y + 1.5, x + 1, y + 3, 'F')
      pdf.line(x - 0.5, y + 7, x + 3, y + 7)
      break
    case 1: // Monumento
      pdf.triangle(x, y + 2, x + 3, y, x + 6, y + 2, 'F')
      pdf.line(x, y + 2, x + 6, y + 2)
      pdf.line(x + 0.5, y + 6, x + 5.5, y + 6)
      pdf.line(x, y + 7, x + 6, y + 7)
      pdf.line(x + 1.2, y + 2.4, x + 1.2, y + 5.7)
      pdf.line(x + 3, y + 2.4, x + 3, y + 5.7)
      pdf.line(x + 4.8, y + 2.4, x + 4.8, y + 5.7)
      break
    case 2: // Birrete
      pdf.triangle(x - 0.5, y + 2.5, x + 3, y + 0.5, x + 6.5, y + 2.5, 'F')
      pdf.line(x + 1, y + 3.2, x + 1, y + 5)
      pdf.line(x + 1, y + 5, x + 3, y + 6)
      pdf.line(x + 3, y + 6, x + 5, y + 5)
      pdf.line(x + 5, y + 2.5, x + 5, y + 5.8)
      pdf.circle(x + 5, y + 6.3, 0.45, 'F')
      break
    case 3: // Estrella
      drawSparkle(pdf, centerX, centerY, 2.8, accent)
      pdf.circle(centerX, centerY, 0.8, 'F')
      break
    case 4: // Escudo
      pdf.line(x + 0.5, y + 0.5, x + 5.5, y + 0.5)
      pdf.line(x + 0.5, y + 0.5, x + 1, y + 4.5)
      pdf.line(x + 5.5, y + 0.5, x + 5, y + 4.5)
      pdf.line(x + 1, y + 4.5, x + 3, y + 7)
      pdf.line(x + 5, y + 4.5, x + 3, y + 7)
      pdf.line(x + 1.7, y + 2.7, x + 4.3, y + 2.7)
      break
    case 5: // Libro
      pdf.roundedRect(x, y + 0.5, 2.8, 6, 0.5, 0.5, 'S')
      pdf.roundedRect(x + 3.2, y + 0.5, 2.8, 6, 0.5, 0.5, 'S')
      pdf.line(centerX, y + 1, centerX, y + 6.5)
      break
    case 6: // Antorcha
      pdf.line(centerX, y + 3, centerX, y + 7)
      pdf.line(x + 1.7, y + 3.5, x + 4.3, y + 3.5)
      pdf.triangle(centerX, y - 0.5, x + 1.5, y + 3, x + 4.5, y + 3, 'F')
      pdf.circle(centerX, y + 2, 0.65, 'F')
      break
    case 7: // Laurel
      pdf.line(x + 3, y + 7, x + 3, y + 1)
      pdf.ellipse(x + 1.4, y + 2, 0.8, 0.35, 'F')
      pdf.ellipse(x + 4.6, y + 3, 0.8, 0.35, 'F')
      pdf.ellipse(x + 1.4, y + 4.2, 0.8, 0.35, 'F')
      pdf.ellipse(x + 4.6, y + 5.2, 0.8, 0.35, 'F')
      break
    default: // Diploma
      pdf.roundedRect(x + 0.2, y + 0.5, 5.6, 4.6, 0.6, 0.6, 'S')
      pdf.line(x + 1.2, y + 2, x + 4.8, y + 2)
      pdf.line(x + 1.2, y + 3.2, x + 4.1, y + 3.2)
      pdf.triangle(x + 3.2, y + 5.2, x + 4.3, y + 5.2, x + 3.4, y + 7, 'F')
      pdf.triangle(x + 4.1, y + 5.2, x + 5.2, y + 5.2, x + 5, y + 7, 'F')
      break
  }
}

function drawHeader(pdf: jsPDF, institution: string, year: string, accent: Color, paleAccent: Color) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const centerX = pageWidth / 2
  const ink: Color = [48, 42, 57]

  pdf.setFillColor(248, 247, 250)
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F')
  pdf.setFillColor(...paleAccent)
  pdf.rect(0, 0, pageWidth, 39, 'F')
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.text('RECONOCIMIENTO ACADÉMICO', centerX, 9, { align: 'center' })
  drawMedal(pdf, centerX - 25, 8, 4, accent, mixWithWhite(accent, 0.72))
  pdf.setTextColor(...ink)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('Cuadro de honor', centerX, 19, { align: 'center' })
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.text(institution, centerX, 26, { align: 'center', maxWidth: pageWidth - 40 })
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text(`Período ${year.replace(/[–—]/g, '-')}`, centerX, 33, { align: 'center' })

  pdf.setTextColor(...ink)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Estudiantes destacados', centerX, 47, { align: 'center' })
  pdf.setTextColor(112, 119, 132)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('Esfuerzo, trayectoria y participación estudiantil', centerX, 52, { align: 'center', maxWidth: pageWidth - 30 })
  pdf.setDrawColor(226, 224, 229)
  pdf.setLineWidth(0.45)
  pdf.line(15, 56, pageWidth - 15, 56)
  pdf.setDrawColor(...accent)
}

async function loadCircularAvatar(path: string): Promise<string | undefined> {
  const response = await fetch(path)
  if (!response.ok) return undefined

  const bitmap = await createImageBitmap(await response.blob())
  const canvas = document.createElement('canvas')
  const size = 256
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return undefined
  }

  const cropSize = Math.min(bitmap.width, bitmap.height)
  const cropX = (bitmap.width - cropSize) / 2
  const cropY = (bitmap.height - cropSize) / 2
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  context.clip()
  context.drawImage(bitmap, cropX, cropY, cropSize, cropSize, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

function drawStudentAvatar(pdf: jsPDF, centerX: number, centerY: number, size: number, paleAccent: Color, accent: Color, image?: string, name = '') {
  pdf.setFillColor(...paleAccent)
  pdf.circle(centerX, centerY, size / 2, 'F')
  if (image) {
    pdf.addImage(image, 'PNG', centerX - size / 2, centerY - size / 2, size, size)
    return
  }
  pdf.setFillColor(...accent)
  pdf.setTextColor(...accent)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text(getStudentInitials(name), centerX, centerY + 1, { align: 'center' })
}

function drawPersonCard(pdf: jsPDF, person: RecognitionPerson, iconKind: number, accent: Color, paleAccent: Color, x: number, y: number, width: number, height: number, avatar?: string) {
  const ink: Color = [48, 42, 57]
  const muted: Color = [96, 105, 119]
  const centerX = x + width / 2
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(x, y, width, height, 3, 3, 'F')

  drawDistinctiveIcon(pdf, iconKind, centerX, y + 53, accent, paleAccent)

  const avatarSize = 17
  const avatarY = y + 18
  drawStudentAvatar(pdf, centerX, avatarY, avatarSize, paleAccent, accent, avatar, person.studentName)

  const textWidth = width - 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(person.studentName.length > 28 ? 9 : 10)
  pdf.setTextColor(...ink)
  const nameLines = fitLines(pdf, person.studentName, textWidth)
  const nameY = y + 32
  pdf.text(nameLines, centerX, nameY, { align: 'center', lineHeightFactor: 1.05 })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.8)
  pdf.setTextColor(...muted)
  const distinction = person.distinction.replace(/ciudad o cantón/gi, 'ciudad')
  const distinctionLines = fitLines(pdf, distinction, textWidth)
  const distinctionY = y + (nameLines.length > 1 ? 43 : 39)
  pdf.text(distinctionLines, centerX, distinctionY, { align: 'center', lineHeightFactor: 1.1 })

  const grade = person.grade
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...muted)
  pdf.text(grade, centerX, y + height - 4, { align: 'center', maxWidth: textWidth })
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
  const cardHeight = 66
  const gridTop = 60
  const pageCount = Math.max(1, Math.ceil(people.length / pageCapacity))
  const avatarImages = await Promise.all(people.map(async person => {
    const avatarPath = getStudentAvatar(person.studentName)
    if (!avatarPath) return undefined
    try {
      return await loadCircularAvatar(avatarPath)
    } catch {
      return undefined
    }
  }))

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
      drawPersonCard(pdf, person, pageIndex * pageCapacity + index, accent, paleAccent, x, y, cardWidth, cardHeight, avatarImages[pageIndex * pageCapacity + index])
    })

  }

  return URL.createObjectURL(pdf.output('blob'))
}
