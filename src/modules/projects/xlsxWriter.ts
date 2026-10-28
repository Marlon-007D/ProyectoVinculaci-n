/**
 * Minimal .xlsx writer without dependencies: SpreadsheetML parts packed in an uncompressed ZIP.
 * It follows the order and counts that Excel validates, so the file opens without the repair prompt.
 */
export type XlsxStyle = 'header' | 'money' | 'moneyBold' | 'percent' | 'bold' | 'title';
export interface XlsxCell { value: string | number | null; style?: XlsxStyle; formula?: string }
export type XlsxRow = Array<XlsxCell | string | number | null>;
export interface XlsxSheet { name: string; rows: XlsxRow[]; widths?: number[]; freezeRows?: number }

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
// Index in cellXfs: 0 is the default style.
const STYLE_INDEX: Record<XlsxStyle, number> = { header: 1, money: 2, moneyBold: 3, percent: 4, bold: 5, title: 6 };
const MAX_CELL_TEXT = 32767;

/** Removes characters XML 1.0 forbids (including lone surrogates) and escapes the markup ones. */
export function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .slice(0, MAX_CELL_TEXT)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** Excel names: at most 31 characters, none of []:*?/\ , no edge apostrophes, unique ignoring case. */
export function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, index) => {
    const base = raw.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 31) || `Hoja ${index + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

function normalize(cell: XlsxRow[number]): XlsxCell {
  return cell !== null && typeof cell === 'object' ? cell : { value: cell };
}

function cellXml(cell: XlsxCell, ref: string): string {
  const style = cell.style ? ` s="${STYLE_INDEX[cell.style]}"` : '';
  const { value, formula } = cell;
  if (formula) return `<c r="${ref}"${style}><f>${xmlText(formula)}</f>${typeof value === 'number' && Number.isFinite(value) ? `<v>${value}</v>` : ''}</c>`;
  if (value === null || value === '') return style ? `<c r="${ref}"${style}/>` : '';
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${style}><v>${value}</v></c>` : '';
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}

function autoWidths(rows: XlsxCell[][]): number[] {
  const widths: number[] = [];
  for (const row of rows) row.forEach((cell, column) => {
    const text = typeof cell.value === 'number' ? cell.value.toFixed(2) : String(cell.value ?? '');
    const longest = Math.max(0, ...text.split('\n').map(line => line.length));
    widths[column] = Math.max(widths[column] ?? 8, Math.min(60, longest + 3));
  });
  return widths;
}

function sheetXml(sheet: XlsxSheet, selected: boolean): string {
  const rows = sheet.rows.map(row => row.map(normalize));
  const columns = Math.max(1, ...rows.map(row => row.length));
  const widths = sheet.widths ?? autoWidths(rows);
  const frozen = sheet.freezeRows ?? 0;
  const pane = frozen > 0 ? `<pane ySplit="${frozen}" topLeftCell="A${frozen + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${frozen + 1}" sqref="A${frozen + 1}"/>` : '';
  const cols = widths.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, column) => cellXml(cell, `${columnName(column)}${rowIndex + 1}`)).join('');
    return cells ? `<row r="${rowIndex + 1}">${cells}</row>` : '';
  }).join('');
  return `${XML_HEADER}<worksheet xmlns="${MAIN}"><dimension ref="A1:${columnName(columns - 1)}${Math.max(1, rows.length)}"/><sheetViews><sheetView${selected ? ' tabSelected="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body}</sheetData></worksheet>`;
}

const STYLES_XML = `${XML_HEADER}<styleSheet xmlns="${MAIN}">`
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>'
  + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font></fonts>'
  + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8DEF8"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="7">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
  + '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();
export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** ZIP with «stored» entries (no compression), UTF-8 names, local headers, central directory and end record. */
export function zipStored(files: Array<{ name: string; data: Uint8Array }>, now = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, file.data.length, true); lv.setUint32(22, file.data.length, true); lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    local.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true); cv.setUint32(24, file.data.length, true); cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);
    chunks.push(local, file.data);
    central.push(entry);
    offset += local.length + file.data.length;
  }
  const directorySize = central.reduce((total, entry) => total + entry.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
  const parts = [...chunks, ...central, end];
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) { output.set(part, position); position += part.length; }
  return output;
}

export function buildXlsx(sheets: XlsxSheet[], now = new Date()): Uint8Array<ArrayBuffer> {
  if (!sheets.length) throw new Error('El libro necesita al menos una hoja.');
  const names = sheetNames(sheets.map(sheet => sheet.name));
  const encoder = new TextEncoder();
  const part = (name: string, text: string) => ({ name, data: encoder.encode(text) });
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const rootRels = `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `${XML_HEADER}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets>`
    + names.map((name, index) => `<sheet name="${xmlText(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')
    + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  const workbookRels = `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL}">`
    + sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;
  return zipStored([
    part('[Content_Types].xml', contentTypes),
    part('_rels/.rels', rootRels),
    part('xl/workbook.xml', workbook),
    part('xl/_rels/workbook.xml.rels', workbookRels),
    part('xl/styles.xml', STYLES_XML),
    ...sheets.map((sheet, index) => part(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet, index === 0))),
  ], now);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
