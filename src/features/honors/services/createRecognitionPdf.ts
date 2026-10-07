import { jsPDF } from 'jspdf'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'

type Color = [number, number, number]

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

export function createRecognitionPdf(
  entry: Pick<AcademicContentEntry, 'studentName' | 'grade' | 'distinction'>,
  institutionName: string,
  periodName: string,
  accentHex: string,
): string {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const accent = hexColor(accentHex)
  const accentLine = mixWithWhite(accent, 0.48)
  const accentPale = mixWithWhite(accent, 0.91)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const centerX = pageWidth / 2

  pdf.setProperties({
    title: `Reconocimiento - ${entry.studentName}`,
    subject: entry.distinction,
    author: institutionName,
  })
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')

  pdf.setDrawColor(...accent)
  pdf.setLineWidth(0.8)
  pdf.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 4, 4, 'S')
  pdf.setDrawColor(...accentLine)
  pdf.setLineWidth(0.35)
  pdf.roundedRect(16, 16, pageWidth - 32, pageHeight - 32, 3, 3, 'S')

  pdf.setFillColor(...accentPale)
  pdf.circle(centerX, 36, 9, 'F')
  pdf.setDrawColor(...accent)
  pdf.setLineWidth(0.7)
  pdf.circle(centerX, 36, 6.3, 'S')
  pdf.setLineWidth(1)
  pdf.line(centerX - 3.4, 36, centerX + 3.4, 36)
  pdf.line(centerX, 32.6, centerX, 39.4)
  pdf.setFillColor(...accent)
  pdf.circle(centerX, 36, 1.3, 'F')

  pdf.setTextColor(...accent)
  pdf.setFont('times', 'bold')
  pdf.setFontSize(13)
  pdf.text(institutionName.toLocaleUpperCase('es-EC'), centerX, 54, { align: 'center', maxWidth: 235 })
  pdf.setDrawColor(...accentLine)
  pdf.setLineWidth(0.5)
  pdf.line(72, 61, pageWidth - 72, 61)

  pdf.setTextColor(65, 61, 69)
  pdf.setFont('times', 'bold')
  pdf.setFontSize(11)
  pdf.text('RECONOCIMIENTO ACADÉMICO', centerX, 73, { align: 'center' })
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)
  pdf.text('Se otorga a', centerX, 86, { align: 'center' })

  pdf.setTextColor(...accent)
  pdf.setFont('times', 'bold')
  const studentFontSize = entry.studentName.length > 36 ? 23 : entry.studentName.length > 26 ? 26 : 30
  pdf.setFontSize(studentFontSize)
  const studentLines = pdf.splitTextToSize(entry.studentName, 235) as string[]
  const nameTop = 101
  pdf.text(studentLines, centerX, nameTop, { align: 'center', lineHeightFactor: 1.2 })
  const afterName = nameTop + studentLines.length * studentFontSize * 0.48

  pdf.setTextColor(83, 78, 88)
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)
  pdf.text('Por su destacada participación y mérito en', centerX, afterName + 7, { align: 'center' })

  const distinctionFontSize = entry.distinction.length > 44 ? 16 : 19
  pdf.setFont('times', 'bold')
  pdf.setFontSize(distinctionFontSize)
  pdf.setTextColor(...accent)
  const distinctionLines = pdf.splitTextToSize(entry.distinction, 226) as string[]
  const distinctionY = afterName + 17
  pdf.text(distinctionLines, centerX, distinctionY, { align: 'center', lineHeightFactor: 1.15 })

  const metaY = distinctionY + distinctionLines.length * distinctionFontSize * 0.47 + 6
  pdf.setTextColor(91, 86, 96)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const details = [entry.grade, periodName].filter(Boolean).join('   |   ')
  if (details) pdf.text(details, centerX, metaY, { align: 'center', maxWidth: 220 })

  const date = new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'America/Guayaquil' }).format(new Date())
  const footerY = 174
  pdf.setDrawColor(...accentLine)
  pdf.setLineWidth(0.45)
  pdf.line(37, footerY, 105, footerY)
  pdf.line(pageWidth - 105, footerY, pageWidth - 37, footerY)
  pdf.setTextColor(95, 90, 99)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text('AUTORIDAD INSTITUCIONAL', 71, footerY + 5, { align: 'center' })
  pdf.text('SELLO INSTITUCIONAL', pageWidth - 71, footerY + 5, { align: 'center' })
  pdf.setFont('times', 'normal')
  pdf.setFontSize(9)
  pdf.text(date, centerX, 189, { align: 'center' })

  return URL.createObjectURL(pdf.output('blob'))
}
