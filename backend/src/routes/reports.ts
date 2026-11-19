import { Router } from 'express';
import { prisma } from '../lib/prisma';
import ExcelJS from 'exceljs';

const router = Router();

router.get('/export', async (req, res) => {
  const { sessionId } = req.query as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ success: false, error: 'Missing sessionId' });
    return;
  }
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      records: { include: { employee: true }, orderBy: { checkInTime: 'asc' } },
    },
  });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');
  sheet.columns = [
    { header: 'Employee ID', key: 'employeeCode', width: 20 },
    { header: 'Full Name', key: 'fullName', width: 30 },
    { header: 'Department', key: 'department', width: 25 },
    { header: 'Check-in Time', key: 'checkInTime', width: 25 },
    { header: 'Client IP', key: 'clientIp', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
  ];
  for (const r of session.records) {
    sheet.addRow({
      employeeCode: r.employee.employeeCode,
      fullName: r.employee.fullName,
      department: r.employee.department || '',
      checkInTime: r.checkInTime.toISOString(),
      clientIp: r.clientIp,
      status: 'Checked-in',
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${sessionId}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;