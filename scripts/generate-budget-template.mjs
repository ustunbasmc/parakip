/**
 * Ücretsiz aylık bütçe şablonunu (Excel .xlsx) üretir:
 *   node scripts/generate-budget-template.mjs
 * Çıktı: public/butce-sablonu/parakip-aylik-butce-sablonu.xlsx
 *
 * Ek paket kullanılmaz: .xlsx bir ZIP içindeki XML dosyalarıdır; ZIP'i
 * Node'un zlib'i (deflateRaw + crc32) ile yazarız. Toplamlar Excel
 * formülüdür; dosya açıldığında hesaplanır (fullCalcOnLoad).
 */
import { deflateRawSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/butce-sablonu/parakip-aylik-butce-sablonu.xlsx");

// ── Sayfa içeriği ──────────────────────────────────────────────
const S = { text: 0, bold: 1, title: 2, money: 3, totalMoney: 4, header: 5, pct: 6, totalLabel: 7, note: 8 };
const rows = []; // [rowNumber, cells[]] ; cell = { col, v?, f?, s }
const put = (r, cells) => rows.push([r, cells]);
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

put(1, [{ col: "A", v: "Parakip — Aylık Bütçe Şablonu", s: S.title }]);
put(2, [{ col: "A", v: "Ay:", s: S.bold }]);
put(3, [{ col: "A", v: "Tutarları TL olarak gir; toplamlar ve oranlar kendiliğinden hesaplanır. Planlanan: ay başındaki hedefin, Gerçekleşen: ay sonundaki durum.", s: S.note }]);

let r = 5;
const sections = [];
function section(title, items) {
  put(r, [
    { col: "A", v: title, s: S.header },
    { col: "B", v: "Planlanan", s: S.header },
    { col: "C", v: "Gerçekleşen", s: S.header },
  ]);
  const start = r + 1;
  for (const item of items) {
    r++;
    put(r, [{ col: "A", v: item, s: S.text }, { col: "B", s: S.money }, { col: "C", s: S.money }]);
  }
  r++;
  const total = r;
  put(r, [
    { col: "A", v: `Toplam ${title.toLocaleLowerCase("tr-TR")}`, s: S.totalLabel },
    { col: "B", f: `SUM(B${start}:B${total - 1})`, s: S.totalMoney },
    { col: "C", f: `SUM(C${start}:C${total - 1})`, s: S.totalMoney },
  ]);
  r += 2;
  sections.push(total);
  return total;
}

const income = section("Gelirler", ["Maaş 1", "Maaş 2", "Ek gelir / prim", "Kira geliri", "Diğer gelir"]);
const needs = section("İhtiyaçlar", [
  "Kira / konut kredisi",
  "Aidat",
  "Elektrik",
  "Su",
  "Doğalgaz",
  "İnternet ve telefon",
  "Market ve mutfak",
  "Ulaşım",
  "Sağlık ve sigorta",
  "Eğitim ve çocuk",
  "Kredi ve kart asgari ödemeleri",
]);
const wants = section("İstekler", ["Dışarıda yeme-içme", "Giyim", "Eğlence ve hobi", "Abonelikler", "Tatil", "Hediye", "Diğer"]);
const savings = section("Birikim ve borç kapatma", ["Acil durum fonu", "Birikim hedefi", "Asgarinin üzerindeki borç ödemesi"]);

put(r, [{ col: "A", v: "Özet", s: S.header }, { col: "B", v: "Planlanan", s: S.header }, { col: "C", v: "Gerçekleşen", s: S.header }]);
const sum = (c) => [
  ["Toplam gelir", `${c}${income}`, S.totalMoney],
  ["Toplam gider (ihtiyaç + istek)", `${c}${needs}+${c}${wants}`, S.money],
  ["Birikim ve borç kapatma", `${c}${savings}`, S.money],
  ["Kalan (gelir − gider − birikim)", `${c}${income}-${c}${needs}-${c}${wants}-${c}${savings}`, S.totalMoney],
];
for (let i = 0; i < 4; i++) {
  r++;
  const [label, fB] = sum("B")[i];
  const [, fC, style] = sum("C")[i];
  put(r, [{ col: "A", v: label, s: i === 3 ? S.totalLabel : S.text }, { col: "B", f: fB, s: style }, { col: "C", f: fC, s: style }]);
}
r += 2;
put(r, [{ col: "A", v: "Dağılım (gelire oranı)", s: S.header }, { col: "B", v: "Planlanan", s: S.header }, { col: "C", v: "Gerçekleşen", s: S.header }]);
const pctRows = [
  ["İhtiyaçlar (öneri: %50–60)", needs],
  ["İstekler (öneri: %20–30)", wants],
  ["Birikim ve borç (öneri: %15–20)", savings],
];
for (const [label, row] of pctRows) {
  r++;
  put(r, [
    { col: "A", v: label, s: S.text },
    { col: "B", f: `IF(B${income}>0,B${row}/B${income},0)`, s: S.pct },
    { col: "C", f: `IF(C${income}>0,C${row}/C${income},0)`, s: S.pct },
  ]);
}
r += 2;
put(r, [{ col: "A", v: "Her ay elle doldurmak istemiyorsan: Parakip harcamalarını kategorilere ayırır ve bütçeni otomatik takip eder — www.parakip.com", s: S.note }]);

// ── XML parçaları ──────────────────────────────────────────────
const cellXml = (row, c) => {
  const ref = `${c.col}${row}`;
  if (c.f) return `<c r="${ref}" s="${c.s}"><f>${esc(c.f)}</f></c>`;
  if (c.v !== undefined) return `<c r="${ref}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
  return `<c r="${ref}" s="${c.s}"/>`;
};
const sheetData = rows
  .sort((a, b) => a[0] - b[0])
  .map(([row, cells]) => `<row r="${row}">${cells.map((c) => cellXml(row, c)).join("")}</row>`)
  .join("");

const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<cols><col min="1" max="1" width="44" customWidth="1"/><col min="2" max="3" width="18" customWidth="1"/></cols>
<sheetData>${sheetData}</sheetData>
<mergeCells count="2"><mergeCell ref="A3:C3"/><mergeCell ref="A${r}:C${r}"/></mergeCells>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
</worksheet>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₺&quot;"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF0D9488"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF52627A"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE6F6F4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FFCBD5E1"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
  "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Parakip Aylık Bütçe Şablonu</dc:title><dc:creator>Parakip</dc:creator>
</cp:coreProperties>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Aylık Bütçe" sheetId="1" r:id="rId1"/></sheets>
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  "xl/worksheets/sheet1.xml": sheet,
  "xl/styles.xml": styles,
};

// ── Basit ZIP yazıcı (deflate) ─────────────────────────────────
function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  // Sabit tarih: dosya her üretimde aynı baytlara sahip olsun.
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    local.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuf, end]);
}

mkdirSync(dirname(out), { recursive: true });
const buf = zip(files);
writeFileSync(out, buf);
console.log(`Yazıldı: ${out} (${buf.length} bayt, ${rows.length} satır)`);
