import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
const router = Router();

const employeeSchema = z.object({
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
  department: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  position: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// List employees with optional search
router.get('/', authenticate, async (req, res) => {
  const { q } = req.query as { q?: string };
  const where = q
    ? {
        OR: [
          { employeeCode: { contains: q } },
          { fullName: { contains: q } },
          { department: { contains: q } },
        ],
      }
    : {};
  const employees = await prisma.employee.findMany({
    where,
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true, department: true, email: true, position: true, isActive: true, createdAt: true },
  });
  res.json({ success: true, data: employees });
});

// Create employee
router.post('/', authenticate, async (req, res) => {
  const data = employeeSchema.parse(req.body);
  const employee = await prisma.employee.create({
    data: {
      employeeCode: data.employeeCode,
      fullName: data.fullName,
      department: data.department || null,
      email: data.email || null,
      position: data.position || null,
      isActive: data.isActive ?? true,
    },
  });
  res.status(201).json({ success: true, data: employee });
});

// Update employee
router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const data = employeeSchema.partial().parse(req.body);
  const employee = await prisma.employee.update({ where: { id }, data });
  res.json({ success: true, data: employee });
});

// Deactivate (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  await prisma.employee.update({ where: { id }, data: { isActive: false } });
  res.json({ success: true, message: 'Employee deactivated' });
});

// Import employees from Excel/CSV (base64-encoded file content)
router.post('/import', authenticate, async (req, res) => {
  const importSchema = z.object({
    fileName: z.string(),
    contentBase64: z.string(),
  });
  const { fileName, contentBase64 } = importSchema.parse(req.body);
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(contentBase64, 'base64');
  await workbook.xlsx.load(buffer as any);
  // Workbooks often start with a summary sheet; pick the one whose 3rd column is "Mã NV".
  const sheet =
    workbook.worksheets.find((ws) => {
      const header = ws.getRow(1).values as any[];
      return String(header?.[3] ?? '').trim().toLowerCase() === 'mã nv';
    }) ?? workbook.worksheets[0];
  const rows: any[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const vals = row.values as any[];
    if (!vals || vals.length < 2) return;
    const code = String(vals[3] ?? '').trim(); // Mã NV
    const name = String(vals[4] ?? '').trim(); // Họ và tên
    const email = String(vals[5] ?? '').trim();
    const dept = String(vals[6] ?? '').trim();
    const position = String(vals[7] ?? '').trim();
    const status = String(vals[8] ?? '').trim();
    if (!code || !name) return;
    // The same person appears once per group — keep the first occurrence only.
    if (seen.has(code)) return;
    seen.add(code);
    rows.push({
      employeeCode: code,
      fullName: name,
      department: dept || null,
      email: email || null,
      position: position || null,
      isActive: /Đang làm/i.test(status),
    });
  });
  const created: any[] = [];
  const errors: any[] = [];
  for (const r of rows) {
    try {
      const e = await prisma.employee.create({ data: r });
      created.push(e);
    } catch (e: any) {
      errors.push({ employeeCode: r.employeeCode, error: e.message });
    }
  }
  res.json({ success: true, data: { imported: created.length, errors, total: rows.length } });
});

export default router;