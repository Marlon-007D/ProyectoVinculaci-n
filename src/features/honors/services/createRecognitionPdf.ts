import { jsPDF } from 'jspdf'
import portrait01 from '../mocks/avatars/portrait-01.jpg?url'
import portrait02 from '../mocks/avatars/portrait-02.jpg?url'
import portrait03 from '../mocks/avatars/portrait-03.jpg?url'
import portrait04 from '../mocks/avatars/portrait-04.jpg?url'
import portrait05 from '../mocks/avatars/portrait-05.jpg?url'
import portrait06 from '../mocks/avatars/portrait-06.jpg?url'
import portrait07 from '../mocks/avatars/portrait-07.jpg?url'
import portrait08 from '../mocks/avatars/portrait-08.jpg?url'
import portrait09 from '../mocks/avatars/portrait-09.jpg?url'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'

type Color = [number, number, number]
type RecognitionPerson = Pick<AcademicContentEntry, 'studentName' | 'grade' | 'distinction'>

const portraits = [portrait01, portrait02, portrait03, portrait04, portrait05, portrait06, portrait07, portrait08, portrait09]

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

async function loadPortrait(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo cargar un avatar de demostración.')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('No se pudo procesar el avatar.'))
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      context.beginPath()
      context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      context.clip()
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('No se pudo leer el avatar.'))
    image.src = URL.createObjectURL(blob)
  })
}

function splitTwoLines(pdf: jsPDF, text: string, width: number): string[] {
  const lines = pdf.splitTextToSize(text, width) as string[]
  if (lines.length <= 2) return lines
  return [lines[0], `${lines[1].slice(0, Math.max(0, lines[1].length - 3)).trimEnd()}...`]
}

function drawHeader(pdf: jsPDF, institution: string, year: string, line: Color) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const centerX = pageWidth / 2
  const navy: Color = [14, 37, 72]
  const gold: Color = [224, 177, 77]
  const yellow: Color = [255, 210, 42]
  const blue: Color = [27, 79, 160]
  const red: Color = [207, 39, 55]
  pdf.setFillColor(250, 247, 238)
  pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F')
  pdf.setFillColor(248, 242, 226)
  pdf.circle(8, 115, 37, 'F')
  pdf.circle(pageWidth - 8, 186, 43, 'F')
  pdf.setFillColor(...navy)
  pdf.rect(0, 0, pageWidth, 39, 'F')
  pdf.setFillColor(...yellow)
  pdf.rect(0, 39, pageWidth, 4, 'F')
  pdf.setFillColor(...blue)
  pdf.rect(0, 43, pageWidth, 4, 'F')
  pdf.setFillColor(...red)
  pdf.rect(0, 47, pageWidth, 4, 'F')
  pdf.setTextColor(255, 218, 126)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.text('JURAMENTO A LA BANDERA', centerX, 12, { align: 'center' })
  pdf.setCharSpace(1.1)
  pdf.setFont('times', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.text('CUADRO DE HONOR', centerX, 26, { align: 'center' })
  pdf.setCharSpace(0)
  drawLaurel(pdf, 40, 27, gold, -1)
  drawLaurel(pdf, pageWidth - 40, 27, gold, 1)

  pdf.setFillColor(243, 214, 150)
  pdf.roundedRect(centerX - 49, 36, 98, 12, 6, 6, 'F')
  pdf.setDrawColor(...gold)
  pdf.setLineWidth(0.6)
  pdf.roundedRect(centerX - 49, 36, 98, 12, 6, 6, 'S')
  pdf.setTextColor(...navy)
  pdf.setFont('times', 'bold')
  pdf.setFontSize(12)
  pdf.text(institution.toLocaleUpperCase('es-EC'), centerX, 44, { align: 'center', maxWidth: 92 })
  pdf.setTextColor(...navy)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text(`PERÍODO ${year.replace(/[–—]/g, '-')}`, centerX, 58, { align: 'center' })
  pdf.setDrawColor(...gold)
  pdf.setLineWidth(0.6)
  pdf.line(42, 56, 65, 56)
  pdf.line(pageWidth - 65, 56, pageWidth - 42, 56)
  pdf.setTextColor(31, 49, 78)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.2)
  pdf.setCharSpace(0.65)
  pdf.text('ESTUDIANTES QUE REPRESENTAN CON ORGULLO A SU INSTITUCIÓN', centerX, 68, { align: 'center' })
  pdf.setCharSpace(0)
  pdf.setDrawColor(...line)
  pdf.setLineWidth(0.35)
  pdf.line(15, 72, pageWidth - 15, 72)
}

function drawLaurel(pdf: jsPDF, x: number, y: number, gold: Color, direction: -1 | 1) {
  pdf.setDrawColor(...gold)
  pdf.setFillColor(...gold)
  pdf.setLineWidth(0.75)
  pdf.line(x, y + 8, x + direction * 4, y - 7)
  for (let index = 0; index < 5; index += 1) {
    const leafY = y + 6 - index * 3
    const leafX = x + direction * (index * 0.7)
    pdf.ellipse(leafX - direction * 1.5, leafY, 1.05, 2.4, 'F')
    pdf.ellipse(leafX + direction * 1.5, leafY - 1.5, 1.05, 2.4, 'F')
  }
}

function drawPeriodRibbon(pdf: jsPDF, x: number, y: number, width: number, period: string) {
  const yellow: Color = [255, 205, 38]
  const blue: Color = [38, 77, 153]
  const red: Color = [205, 38, 53]
  const ribbonY = y + 37
  const ribbonHeight = 7
  const centerX = x + width / 2
  const tailWidth = 6

  pdf.setFillColor(...yellow)
  pdf.triangle(x, ribbonY, x + tailWidth, ribbonY, x + tailWidth, ribbonY + ribbonHeight / 3, 'F')
  pdf.setFillColor(...blue)
  pdf.triangle(x, ribbonY + ribbonHeight / 3, x + tailWidth, ribbonY + ribbonHeight / 3, x + tailWidth, ribbonY + ribbonHeight * 2 / 3, 'F')
  pdf.setFillColor(...red)
  pdf.triangle(x, ribbonY + ribbonHeight * 2 / 3, x + tailWidth, ribbonY + ribbonHeight * 2 / 3, x + tailWidth, ribbonY + ribbonHeight, 'F')

  pdf.setFillColor(...yellow)
  pdf.triangle(x + width, ribbonY, x + width - tailWidth, ribbonY, x + width - tailWidth, ribbonY + ribbonHeight / 3, 'F')
  pdf.setFillColor(...blue)
  pdf.triangle(x + width, ribbonY + ribbonHeight / 3, x + width - tailWidth, ribbonY + ribbonHeight / 3, x + width - tailWidth, ribbonY + ribbonHeight * 2 / 3, 'F')
  pdf.setFillColor(...red)
  pdf.triangle(x + width, ribbonY + ribbonHeight * 2 / 3, x + width - tailWidth, ribbonY + ribbonHeight * 2 / 3, x + width - tailWidth, ribbonY + ribbonHeight, 'F')

  const bandX = x + 3
  const bandWidth = width - 6
  const stripeHeight = ribbonHeight / 3
  pdf.setFillColor(...yellow)
  pdf.rect(bandX, ribbonY, bandWidth, stripeHeight, 'F')
  pdf.setFillColor(...blue)
  pdf.rect(bandX, ribbonY + stripeHeight, bandWidth, stripeHeight, 'F')
  pdf.setFillColor(...red)
  pdf.rect(bandX, ribbonY + stripeHeight * 2, bandWidth, stripeHeight, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(5.7)
  pdf.setTextColor(14, 37, 72)
  pdf.text(`PERÍODO ${period.replace(/[–—]/g, '-')}`, centerX, ribbonY + 2.2, { align: 'center', maxWidth: bandWidth - 1 })
  pdf.setFillColor(14, 37, 72)
  pdf.circle(centerX, ribbonY + ribbonHeight, 4.4, 'F')
  pdf.setDrawColor(...yellow)
  pdf.setLineWidth(0.7)
  pdf.circle(centerX, ribbonY + ribbonHeight, 3.7, 'S')
  pdf.setFillColor(255, 255, 255)
  pdf.triangle(centerX - 1.8, ribbonY + ribbonHeight - 0.6, centerX + 1.8, ribbonY + ribbonHeight - 0.6, centerX, ribbonY + ribbonHeight + 0.8, 'F')
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineWidth(0.55)
  pdf.line(centerX - 2, ribbonY + ribbonHeight + 1.1, centerX + 2, ribbonY + ribbonHeight + 1.1)
}

function drawPersonCard(pdf: jsPDF, person: RecognitionPerson, portrait: string, period: string, x: number, y: number, width: number, height: number) {
  const cardAccent: Color = [211, 159, 56]
  const cardPale: Color = [247, 236, 209]
  pdf.setDrawColor(...cardAccent)
  pdf.setLineWidth(0.55)
  pdf.setFillColor(255, 254, 250)
  pdf.roundedRect(x, y, width, height, 3.5, 3.5, 'FD')

  pdf.setTextColor(14, 37, 72)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6.2)
  pdf.text(`PERÍODO ${period.replace(/[–—]/g, '-')}`, x + width / 2, y + 7.4, { align: 'center' })
  pdf.setDrawColor(...cardAccent)
  pdf.setLineWidth(0.45)
  pdf.line(x + 5, y + 6.5, x + 10, y + 6.5)
  pdf.line(x + width - 10, y + 6.5, x + width - 5, y + 6.5)

  const portraitSize = 29
  const portraitX = x + (width - portraitSize) / 2
  const portraitY = y + 9
  pdf.setFillColor(255, 255, 255)
  pdf.circle(x + width / 2, portraitY + portraitSize / 2, portraitSize / 2 + 1.1, 'F')
  pdf.setDrawColor(...cardAccent)
  pdf.setLineWidth(1.2)
  pdf.circle(x + width / 2, portraitY + portraitSize / 2, portraitSize / 2 + 0.6, 'S')
  pdf.addImage(portrait, 'PNG', portraitX, portraitY, portraitSize, portraitSize, undefined, 'FAST')
  drawPeriodRibbon(pdf, x + 1.5, y, width - 3, period)

  const textWidth = width - 6
  pdf.setFont('times', 'bold')
  const nameSize = person.studentName.length > 25 ? 7.5 : 8.8
  pdf.setFontSize(nameSize)
  pdf.setTextColor(48, 44, 53)
  const nameLines = splitTwoLines(pdf, person.studentName, textWidth)
  const nameY = y + 52
  pdf.text(nameLines, x + width / 2, nameY, { align: 'center', lineHeightFactor: 1.05 })

  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(7)
  pdf.setTextColor(73, 76, 82)
  const distinctionLines = splitTwoLines(pdf, person.distinction, textWidth)
  const distinctionY = y + (nameLines.length > 1 ? 59.5 : 57.5)
  pdf.text(distinctionLines, x + width / 2, distinctionY, { align: 'center', lineHeightFactor: 1.05 })

  pdf.setFillColor(...cardPale)
  pdf.roundedRect(x + 9, y + height - 5.2, width - 18, 3.8, 1.9, 1.9, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(5.5)
  pdf.setTextColor(14, 37, 72)
  pdf.text(person.grade.toLocaleUpperCase('es-EC'), x + width / 2, y + height - 2.7, { align: 'center', maxWidth: width - 20 })
}

export async function createRecognitionPdf(
  people: RecognitionPerson[],
  institutionName: string,
  year: string,
  accentHex: string,
): Promise<string> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const accent = hexColor(accentHex)
  const line = mixWithWhite(accent, 0.58)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const columns = 3
  const rows = 3
  const pageCapacity = columns * rows
  const marginX = 15
  const gapX = 3.5
  const gapY = 3
  const cardWidth = (pageWidth - marginX * 2 - gapX * (columns - 1)) / columns
  const cardHeight = 66
  const gridTop = 76
  const gridHeight = rows * cardHeight + (rows - 1) * gapY
  const footerY = gridTop + gridHeight + 6
  const imageData = await Promise.all(portraits.map(loadPortrait))
  const pageCount = Math.max(1, Math.ceil(people.length / pageCapacity))

  pdf.setProperties({ title: `Cuadro de honor ${year}`, subject: institutionName, author: institutionName })
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) pdf.addPage('a4', 'portrait')
    drawHeader(pdf, institutionName, year, line)

    const pagePeople = people.slice(pageIndex * pageCapacity, (pageIndex + 1) * pageCapacity)
    pagePeople.forEach((person, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = marginX + column * (cardWidth + gapX)
      const y = gridTop + row * (cardHeight + gapY)
      const portrait = imageData[(pageIndex * pageCapacity + index) % imageData.length]
      if (portrait) drawPersonCard(pdf, person, portrait, year, x, y, cardWidth, cardHeight)
    })

    pdf.setDrawColor(...line)
    pdf.setLineWidth(0.4)
    pdf.line(15, footerY, pageWidth - 15, footerY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(115, 109, 120)
    pdf.setFontSize(6.5)
    pdf.text('Retratos de demostración - reemplazar por fotografías autorizadas.', pageWidth / 2, footerY + 5, { align: 'center' })
    pdf.setFontSize(7)
    pdf.text(`${pageIndex + 1} / ${pageCount}`, pageWidth / 2, pageHeight - 14, { align: 'center' })
  }

  return URL.createObjectURL(pdf.output('blob'))
}
