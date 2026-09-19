export const samplePages = [
  { page: 1, text: "Cell Biology.\nA cell is the smallest structural and functional unit of life.\nThe cell membrane is a selectively permeable barrier that controls movement into and out of a cell.\nThe nucleus is the organelle that stores genetic information in eukaryotic cells.\nCytoplasm is the fluid-filled region in which many cellular reactions occur.\nRibosomes are structures that assemble proteins using instructions carried by messenger RNA.\nProkaryotic cells lack a membrane-bound nucleus, while eukaryotic cells have one." },
  { page: 2, text: "Energy in Cells.\nPhotosynthesis is the conversion of light energy into chemical energy stored in sugars.\nChlorophyll is a pigment that absorbs light in chloroplasts.\nRespiration is the process that releases usable energy from glucose.\nATP is a molecule that transfers energy for cellular processes.\nMitochondria are organelles where most stages of aerobic respiration take place.\nPhotosynthesis uses carbon dioxide and water and releases oxygen. Aerobic respiration uses oxygen to break down glucose." },
  { page: 3, text: "Transport and Balance.\nDiffusion is the net movement of particles from higher to lower concentration.\nOsmosis is the movement of water across a selectively permeable membrane.\nActive transport is the movement of substances against a concentration gradient using energy.\nHomeostasis is the maintenance of stable internal conditions.\nA concentration gradient is a difference in concentration between two regions.\nDiffusion and osmosis are passive processes and do not require a direct input of cellular energy." },
  { page: 4, text: "Genetics and Division.\nDNA is the molecule that carries genetic instructions in living organisms.\nA gene is a segment of DNA that contains instructions for a functional product.\nMitosis is cell division that produces two genetically identical daughter cells.\nMeiosis is cell division that produces gametes with half the original chromosome number.\nA mutation is a change in the DNA sequence.\nMitosis supports growth and repair. Meiosis creates genetic variation through crossing over and the independent assortment of chromosomes." },
];

export function samplePdf(): Uint8Array {
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const kids: number[] = [];
  for (const page of samplePages) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    kids.push(pageId);
    const lines = page.text.split("\n").flatMap(line => line.match(/.{1,80}(?:\s|$)/g) ?? [line]);
    const escaped = (s: string) => s.replace(/[\\()]/g, "\\$&");
    const stream = `BT /F1 11 Tf 16 TL 45 780 Td ${lines.map((line, i) => `${i ? "T* " : ""}(${escaped(line.trim())}) Tj`).join("\n")} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map(id => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
