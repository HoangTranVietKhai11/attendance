from pathlib import Path
import docx

base = Path(r"D:\khai\Document_D-HRM")
docx_files = list(base.glob("*.docx"))
print("FILES:", [p.name for p in docx_files])
d = docx.Document(docx_files[0])
for p in d.paragraphs:
    text = p.text.strip()
    if text and p.style.name.lower().startswith("heading"):
        print(f"{p.style.name} | {text}")
print("TABLES:", len(d.tables))
