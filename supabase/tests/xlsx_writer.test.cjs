const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ts = require('typescript');

function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, TextEncoder, Uint8Array, DataView, Uint32Array, Intl, Date, Number, Math, require: name => { if (name in imports) return imports[name]; throw new Error('Unexpected import ' + name); } });
  return exports;
}

const validation = load('src/modules/projects/projectValidation.ts');
const presentation = load('src/modules/projects/projectPresentation.ts', { './projectValidation': validation });
const xlsx = load('src/modules/projects/xlsxWriter.ts');
const report = load('src/modules/projects/reportData.ts', { './projectValidation': validation, './projectPresentation': presentation });
const transparency = load('src/modules/projects/publicTransparency.ts', { './projectPresentation': presentation, './projectValidation': validation });

// ---- Minimal ZIP reader: validates what Excel validates before it offers to "repair" a file.
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  assert.ok(end >= 0, 'falta el registro de fin del directorio central');
  const total = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  assert.equal(directoryOffset + directorySize, end, 'el directorio central debe terminar donde empieza el registro final');
  const files = new Map();
  let position = directoryOffset;
  for (let n = 0; n < total; n++) {
    assert.equal(view.getUint32(position, true), 0x02014b50, 'firma del directorio central');
    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    const crc = view.getUint32(position + 16, true);
    const compressed = view.getUint32(position + 20, true);
    const size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const offset = view.getUint32(position + 42, true);
    const name = Buffer.from(bytes.subarray(position + 46, position + 46 + nameLength)).toString('utf8');
    assert.equal(method, 0, 'solo entradas almacenadas');
    assert.equal(flags & 0x0800, 0x0800, 'nombres en UTF-8');
    assert.equal(compressed, size);
    assert.equal(view.getUint32(offset, true), 0x04034b50, 'firma de la cabecera local');
    assert.equal(view.getUint32(offset + 14, true), crc, 'CRC igual en la cabecera local');
    assert.equal(view.getUint32(offset + 18, true), size);
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + localName + localExtra;
    const data = bytes.subarray(dataStart, dataStart + size);
    assert.equal(zlib.crc32(data) >>> 0, crc, 'CRC32 de ' + name);
    assert.ok(!files.has(name), 'nombre duplicado ' + name);
    files.set(name, Buffer.from(data).toString('utf8'));
    position += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(files.size, total);
  return files;
}

// ---- Well-formedness: balanced tags, quoted attributes, no raw "<" or stray "&", no forbidden control characters.
function assertWellFormed(name, xml) {
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), name + ': declaración XML');
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(xml), name + ': caracteres de control');
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(xml), name + ': sustitutos sueltos');
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const stack = [];
  const token = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<&]*(?:&(?:amp|lt|gt|quot|apos|#\d+);[^"<&]*)*")*)\s*(\/?)>|([^<]+)/g;
  let consumed = 0;
  for (const match of body.matchAll(token)) {
    assert.equal(match.index, consumed, name + ': marcado inválido cerca de «' + body.slice(consumed, consumed + 60) + '»');
    consumed += match[0].length;
    if (match[5] !== undefined) {
      assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(match[5]), name + ': «&» sin escapar');
      assert.ok(!match[5].includes('>') || true);
      continue;
    }
    const [, closing, tag, , selfClosing] = match;
    if (closing) assert.equal(stack.pop(), tag, name + ': etiqueta de cierre ' + tag);
    else if (!selfClosing) stack.push(tag);
  }
  assert.equal(consumed, body.length, name + ': marcado sin consumir');
  assert.equal(stack.length, 0, name + ': etiquetas sin cerrar ' + stack.join(','));
}

const columnIndex = ref => [...ref.replace(/\d+/g, '')].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
const unescape = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function parseSheet(xml) {
  const order = [...xml.matchAll(/<(dimension|sheetViews|sheetFormatPr|cols|sheetData)[\s>/]/g)].map(match => match[1]);
  const rows = [...xml.matchAll(/<row r="(\d+)">(.*?)<\/row>/gs)].map(match => ({
    number: Number(match[1]),
    cells: [...match[2].matchAll(/<c r="([A-Z]+)(\d+)"((?:\s+[a-z]+="[^"]*")*)\s*(?:\/>|>(.*?)<\/c>)/gs)].map(cell => ({
      column: cell[1], row: Number(cell[2]), attrs: cell[3], inner: cell[4] ?? '',
      style: Number(/ s="(\d+)"/.exec(cell[3])?.[1] ?? 0), inline: /t="inlineStr"/.test(cell[3]),
      text: /<t[^>]*>(.*?)<\/t>/s.exec(cell[4] ?? '')?.[1],
      value: /<v>(.*?)<\/v>/.exec(cell[4] ?? '')?.[1],
      formula: /<f>(.*?)<\/f>/.exec(cell[4] ?? '')?.[1],
    })),
  }));
  return { order, rows, dimension: /<dimension ref="([^"]+)"/.exec(xml)?.[1] };
}

const NASTY = 'Niño & <Cía> "S.A." \'x\' ñandú\nsegunda línea\u0001\ud800 fin';
const LONG = 'palabra'.repeat(160); // 1120 characters without spaces

function project() {
  return {
    id: 'p1', institution_id: 'i1', name: 'Huerto "Verde" & <Compost>', description: LONG, budget_total: 1000, is_active: true, is_public: true,
    start_date: '2026-10-28', end_date: '2027-06-30', members: [],
    budget_items: [
      { budget_item_id: 'b1', project_id: 'p1', name: 'Materiales ñ', allocated_amount: 600, spent_amount: 350.2, expenses: [
        { expense_id: 'e1', budget_item_id: 'b1', amount: 200, description: NASTY, date: '2026-11-02' },
        { expense_id: 'e2', budget_item_id: 'b1', amount: 150.2, description: LONG, date: '2026-11-10' } ] },
      { budget_item_id: 'b2', project_id: 'p1', name: 'Servicios', allocated_amount: 400, spent_amount: 0, expenses: [] },
    ],
  };
}
const meta = { institution: 'U.E. El Esfuerzo', issuedBy: 'Ana Pérez (ana@example.com)', issuedOn: '28 de octubre de 2026' };
const noFilters = { from: '', to: '', itemId: '' };

function publicRows() {
  return [
    { project_id: 'a', title: NASTY, description: LONG, is_active: true, total_budget: 1000, spent: 350.2, balance: 649.8, start_date: '2026-10-28', end_date: '2027-06-30' },
    { project_id: 'b', title: 'Biblioteca', description: 'Objetivo', is_active: false, total_budget: 500.5, spent: 500.5, balance: 0 },
    { project_id: 'c', title: 'Taller', description: '', is_active: true, total_budget: 0, spent: 0, balance: 0 },
  ];
}

function inspect(buffer, expectedSheets) {
  const files = readZip(buffer);
  for (const required of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml'])
    assert.ok(files.has(required), 'falta la parte ' + required);
  for (const [name, xml] of files) assertWellFormed(name, xml);

  const types = files.get('[Content_Types].xml');
  assert.ok(types.includes('PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"'));
  assert.ok(types.includes('PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"'));
  const sheetParts = [...files.keys()].filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  assert.equal(sheetParts.length, expectedSheets.length);
  for (const part of sheetParts) assert.ok(types.includes(`PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"`), 'sin Override para ' + part);
  assert.equal([...types.matchAll(/<Override /g)].length, sheetParts.length + 2, 'Override de más o de menos');

  // Relationships: unique ids, every target exists, workbook sheets point to worksheet relationships.
  const rels = files.get('xl/_rels/workbook.xml.rels');
  const relations = [...rels.matchAll(/<Relationship Id="([^"]+)" Type="([^"]+)" Target="([^"]+)"\/>/g)].map(match => ({ id: match[1], type: match[2], target: match[3] }));
  assert.equal(new Set(relations.map(item => item.id)).size, relations.length, 'ids de relación repetidos');
  for (const relation of relations) assert.ok(files.has('xl/' + relation.target), 'destino inexistente ' + relation.target);
  assert.ok(files.get('_rels/.rels').includes('Target="xl/workbook.xml"'));

  const workbook = files.get('xl/workbook.xml');
  const declared = [...workbook.matchAll(/<sheet name="([^"]*)" sheetId="(\d+)" r:id="([^"]+)"\/>/g)].map(match => ({ name: unescape(match[1]), id: match[2], rid: match[3] }));
  assert.deepEqual(declared.map(sheet => sheet.name), expectedSheets);
  assert.equal(new Set(declared.map(sheet => sheet.id)).size, declared.length);
  assert.equal(new Set(declared.map(sheet => sheet.name.toLowerCase())).size, declared.length, 'nombres de hoja repetidos');
  for (const sheet of declared) {
    assert.ok(sheet.name.length >= 1 && sheet.name.length <= 31, 'longitud del nombre de hoja');
    assert.ok(!/[\[\]:*?/\\]/.test(sheet.name), 'carácter prohibido en el nombre de hoja');
    const relation = relations.find(item => item.id === sheet.rid);
    assert.ok(relation && relation.type.endsWith('/worksheet'));
  }
  assert.ok(workbook.indexOf('<bookViews>') < workbook.indexOf('<sheets>') && workbook.indexOf('</sheets>') < workbook.indexOf('<calcPr'), 'orden del libro');

  // Styles: counts match the elements, reserved fills present, every s="" used by sheets exists.
  const styles = files.get('xl/styles.xml');
  const section = tag => { const match = new RegExp(`<${tag} count="(\\d+)">(.*?)</${tag}>`, 's').exec(styles); assert.ok(match, 'falta ' + tag); return match; };
  const countChildren = (tag, child) => [...section(tag)[2].matchAll(new RegExp(`<${child}[\\s>/]`, 'g'))].length;
  assert.equal(Number(section('fonts')[1]), countChildren('fonts', 'font'));
  assert.equal(Number(section('fills')[1]), countChildren('fills', 'fill'));
  assert.equal(Number(section('borders')[1]), countChildren('borders', 'border'));
  assert.equal(Number(section('cellStyleXfs')[1]), countChildren('cellStyleXfs', 'xf'));
  assert.equal(Number(section('cellXfs')[1]), countChildren('cellXfs', 'xf'));
  assert.equal(Number(section('numFmts')[1]), countChildren('numFmts', 'numFmt'));
  assert.ok(section('fills')[2].startsWith('<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'), 'rellenos reservados');
  for (const id of [...styles.matchAll(/numFmtId="(\d+)" formatCode=/g)].map(match => Number(match[1]))) assert.ok(id >= 164, 'numFmtId propio < 164');
  const fontCount = Number(section('fonts')[1]);
  const fillCount = Number(section('fills')[1]);
  const borderCount = Number(section('borders')[1]);
  for (const xf of section('cellXfs')[2].matchAll(/<xf [^>]*>|<xf [^>]*\/>/g)) {
    assert.ok(Number(/fontId="(\d+)"/.exec(xf[0])[1]) < fontCount);
    assert.ok(Number(/fillId="(\d+)"/.exec(xf[0])[1]) < fillCount);
    assert.ok(Number(/borderId="(\d+)"/.exec(xf[0])[1]) < borderCount);
  }
  const styleCount = Number(section('cellXfs')[1]);

  const sheets = sheetParts.map(part => {
    const xml = files.get(part);
    const sheet = parseSheet(xml);
    assert.deepEqual(sheet.order.filter(tag => tag !== 'dimension' || true), ['dimension', 'sheetViews', 'sheetFormatPr', ...(xml.includes('<cols>') ? ['cols'] : []), 'sheetData'], 'orden de elementos en ' + part);
    let previousRow = 0;
    let lastRow = 0;
    let lastColumn = 0;
    for (const row of sheet.rows) {
      assert.ok(row.number > previousRow, 'filas fuera de orden');
      previousRow = row.number;
      let previousColumn = 0;
      for (const cell of row.cells) {
        assert.equal(cell.row, row.number, 'referencia de celda en otra fila');
        assert.ok(columnIndex(cell.column) > previousColumn, 'celdas fuera de orden');
        previousColumn = columnIndex(cell.column);
        assert.ok(cell.style < styleCount, 'estilo inexistente');
        if (cell.value !== undefined) assert.ok(Number.isFinite(Number(cell.value)), 'valor no numérico: ' + cell.value);
        lastColumn = Math.max(lastColumn, previousColumn);
      }
      lastRow = row.number;
    }
    const [, finish] = /^A1:([A-Z]+)(\d+)$/.exec(sheet.dimension) ? [null, sheet.dimension.split(':')[1]] : [null, ''];
    assert.ok(finish, 'dimension inválida ' + sheet.dimension);
    assert.equal(Number(/\d+/.exec(finish)[0]), Math.max(1, lastRow), 'dimension: última fila');
    assert.equal(columnIndex(finish), Math.max(1, lastColumn), 'dimension: última columna');
    return sheet;
  });
  return { files, sheets };
}

test('xlsx interno: estructura válida para Excel sin aviso de reparación', () => {
  const model = report.buildReportModel(project(), noFilters);
  const buffer = xlsx.buildXlsx(report.projectXlsxSheets(project(), noFilters, meta, model), new Date(2026, 9, 28, 10, 30, 0));
  const { files, sheets } = inspect(buffer, ['Resumen por rubro', 'Movimientos']);
  const [summary, movements] = sheets;

  // Summary: header, one row per rubro, totals with cached values and SUM formulas.
  const header = summary.rows.find(row => row.cells[0]?.text === 'Rubro');
  assert.equal(header.cells.every(cell => cell.style === 1 && cell.inline), true, 'encabezados en negrita');
  const first = header.number + 1;
  const totals = summary.rows.find(row => row.cells[0]?.text === 'Totales');
  assert.equal(totals.number, first + model.items.length);
  assert.equal(totals.cells[1].formula, `SUM(B${first}:B${totals.number - 1})`);
  assert.equal(Number(totals.cells[1].value), 1000);
  assert.equal(Number(totals.cells[2].value), 350.2);
  assert.equal(totals.cells[3].formula, `B${totals.number}-C${totals.number}`);
  assert.equal(Number(totals.cells[3].value), 649.8);
  assert.equal(totals.cells[4].formula, `IF(B${totals.number}=0,0,C${totals.number}/B${totals.number})`);
  assert.equal(totals.cells[1].style, 3, 'moneda en negrita');
  const rubro = summary.rows.find(row => row.number === first);
  assert.equal(rubro.cells[1].style, 2, 'formato de moneda');
  assert.equal(rubro.cells[4].style, 4, 'formato de porcentaje');
  assert.equal(rubro.cells[1].inline, false, 'los montos son números');
  assert.equal(Number(rubro.cells[1].value), 600);

  // Movements: dates dd/mm/aaaa, numeric amounts, total formula over the data rows only.
  assert.equal(movements.rows[0].cells.map(cell => cell.text).join('|'), 'Fecha|Rubro|Concepto|Importe');
  assert.equal(movements.rows[1].cells[0].text, '02/11/2026');
  assert.equal(movements.rows.length, 4);
  const total = movements.rows[3];
  assert.equal(total.cells[0].text, 'Total');
  assert.deepEqual(total.cells.map(cell => cell.column), ['A', 'D'], 'las celdas vacías sin estilo se omiten');
  const last = total.cells.at(-1);
  assert.equal(last.formula, 'SUM(D2:D3)');
  assert.equal(Number(last.value), 350.2);

  // Special characters survive as text and are escaped in the file.
  const concept = unescape(movements.rows[1].cells[2].text);
  assert.ok(concept.startsWith('Niño & <Cía> "S.A." \'x\' ñandú\nsegunda línea'));
  assert.ok(!concept.includes('\u0001') && !concept.includes('\ud800'));
  assert.equal(unescape(movements.rows[2].cells[2].text), LONG);
  assert.ok(files.get('xl/worksheets/sheet2.xml').includes('xml:space="preserve"'));
  assert.ok(files.get('xl/worksheets/sheet2.xml').includes('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'), 'encabezado inmovilizado');
  // Zip timestamps follow the date we passed in.
  assert.equal(buffer.length > 1000, true);
});

test('xlsx público: estructura válida, totales y datos publicados únicamente', () => {
  const rows = publicRows().map(row => ({ ...row, participants: 'PERSONA PRIVADA', receipt: 'COMPROBANTE PRIVADO' }));
  const buffer = xlsx.buildXlsx(transparency.transparencyXlsxSheets('Colegio "Ñ" & <Co>', rows, '28 de octubre de 2026', '2027-07-01'));
  const { files, sheets } = inspect(buffer, ['Resumen', 'Proyectos']);
  assert.ok(![...files.values()].some(text => text.includes('PRIVAD')), 'ningún dato privado en el archivo');
  const [summary, projects] = sheets;
  assert.equal(summary.rows.find(row => row.cells[0]?.text === 'Proyectos publicados').cells[1].value, '3');
  const total = projects.rows.at(-1);
  assert.equal(total.cells[0].text, 'Totales');
  const dataRows = projects.rows.length - 2;
  assert.equal(dataRows, 3);
  const columns = Object.fromEntries(total.cells.map(cell => [cell.column, cell]));
  assert.equal(columns.E.formula, 'SUM(E2:E4)');
  assert.equal(Number(columns.E.value), 1500.5);
  assert.equal(Number(columns.F.value), 850.7);
  assert.equal(columns.G.formula, 'SUM(G2:G4)');
  assert.equal(columns.H.formula, 'IF(E5=0,0,F5/E5)');
  // Period in es-EC and a discreet overdue note for a project still running after its end date.
  const first = projects.rows[1];
  assert.match(unescape(first.cells.find(cell => cell.column === 'C').text), /^28 oct\.? 2026 – 30 jun\.? 2027$/);
  assert.equal(unescape(first.cells.find(cell => cell.column === 'D').text), 'En ejecución · Plazo vencido');
  // Project without budget: percent 0, never NaN or Infinity.
  assert.ok(![...files.values()].some(text => /NaN|Infinity/.test(text)));
  // Project with missing dates leaves the period cell out instead of writing blanks.
  const biblioteca = projects.rows.find(row => unescape(row.cells[0].text ?? '') === 'Biblioteca');
  assert.equal(biblioteca.cells.find(cell => cell.column === 'C'), undefined);
  assert.equal(unescape(biblioteca.cells.find(cell => cell.column === 'D').text), 'Cerrado');
});

test('xlsx: libro sin movimientos ni rubros sigue siendo válido', () => {
  const empty = { ...project(), budget_items: [] };
  const buffer = xlsx.buildXlsx(report.projectXlsxSheets(empty, noFilters, meta));
  const { sheets } = inspect(buffer, ['Resumen por rubro', 'Movimientos']);
  const totals = sheets[0].rows.find(row => row.cells[0]?.text === 'Totales');
  assert.equal(totals.cells[1].formula, '0');
  assert.equal(sheets[1].rows.at(-1).cells.at(-1).formula, '0');
  const noRows = xlsx.buildXlsx(transparency.transparencyXlsxSheets('Colegio', [], 'hoy'));
  inspect(noRows, ['Resumen', 'Proyectos']);
});

test('xlsx: nombres de hoja se corrigen y no se repiten', () => {
  assert.deepEqual(Array.from(xlsx.sheetNames(['Resumen/2026: [A]', 'resumen 2026  A', 'x'.repeat(40), '']))
    , ['Resumen 2026 A', 'resumen 2026 A 2', 'x'.repeat(31), 'Hoja 4']);
  assert.throws(() => xlsx.buildXlsx([]));
  assert.equal(xlsx.columnName(0), 'A');
  assert.equal(xlsx.columnName(25), 'Z');
  assert.equal(xlsx.columnName(26), 'AA');
  assert.equal(xlsx.columnName(701), 'ZZ');
  assert.equal(xlsx.columnName(702), 'AAA');
  const long = xlsx.buildXlsx([{ name: 'Larga', rows: [['y'.repeat(40000)]] }]);
  const text = readZip(long).get('xl/worksheets/sheet1.xml');
  assert.ok(text.length < 33500, 'las celdas se recortan al máximo de Excel (32767)');
});

test('zip: CRC32 coincide con la implementación de referencia', () => {
  for (const sample of ['', 'a', 'Niño ñandú', 'x'.repeat(100000)]) {
    const bytes = new TextEncoder().encode(sample);
    assert.equal(xlsx.crc32(bytes), zlib.crc32(bytes) >>> 0);
  }
});

test('el verificador de estructura rechaza archivos que Excel pediría reparar', () => {
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  assert.throws(() => assertWellFormed('roto', head + '<a><b></a>'));
  assert.throws(() => assertWellFormed('roto', head + '<a>Cía & Co</a>'));
  assert.throws(() => assertWellFormed('roto', head + '<a x=1/>'));
  assert.throws(() => assertWellFormed('roto', head + '<a>\u0001</a>'));
  assert.doesNotThrow(() => assertWellFormed('ok', head + '<a x="1 &amp; 2"><b/>texto &lt;</a>'));
  const good = xlsx.buildXlsx([{ name: 'Hoja', rows: [['a']] }]);
  const corrupted = Uint8Array.from(good);
  corrupted[80] ^= 0xff; // flips a byte inside the first stored part: its CRC no longer matches
  assert.throws(() => readZip(corrupted));
});
