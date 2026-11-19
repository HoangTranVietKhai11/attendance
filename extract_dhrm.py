from pathlib import Path
import fitz
import docx

base = Path(r"D:\khai\Document_D-HRM")
out = base / "_extracted"
out.mkdir(exist_ok=True)

for pdf in sorted(base.glob("*.pdf")):
    doc = fitz.open(pdf)
    chunks = []
    for i, page in enumerate(doc):
        chunks.append(f"\n\n===== PAGE {i + 1} =====\n")
        chunks.append(page.get_text())
    text = "".join(chunks)
    target = out / (pdf.stem + ".txt")
    target.write_text(text, encoding="utf-8")
    print(f"PDF  {pdf.name}: pages={doc.page_count} chars={len(text)}")

for docx_file in sorted(base.glob("*.docx")):
    d = docx.Document(docx_file)
    parts = []
    for p in d.paragraphs:
        if p.text.strip():
            parts.append(p.text)
    for table in d.tables:
        for row in table.rows:
            cells = [c.text.strip().replace("\n", " ") for c in row.cells]
            parts.append(" | ".join(cells))
    text = "\n".join(parts)
    target = out / (docx_file.stem + ".docx.txt")
    target.write_text(text, encoding="utf-8")
    print(f"DOCX {docx_file.name}: paragraphs+tables={len(parts)} chars={len(text)}")

for md in sorted(base.glob("*.md")):
    text = md.read_text(encoding="utf-8")
    target = out / (md.stem + ".md.txt")
    target.write_text(text, encoding="utf-8")
    print(f"MD   {md.name}: chars={len(text)}")

print("DONE")
