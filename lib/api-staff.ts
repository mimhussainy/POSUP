const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

export async function verifyAdminPin(code: string, admin_pin: string) {
  const res = await fetch(`${BACKEND}/posup/staff/verify-admin-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, admin_pin }),
  });
  return res.json();
}

export async function fetchStaffEmployees(code: string) {
  const res = await fetch(`${BACKEND}/posup/staff/employees/${code}`);
  return res.json();
}

export async function addStaffEmployee(code: string, name: string) {
  const res = await fetch(`${BACKEND}/posup/staff/employees/${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deactivateStaffEmployee(id: string) {
  const res = await fetch(`${BACKEND}/posup/staff/employees/${id}/deactivate`, {
    method: 'PATCH',
  });
  return res.json();
}

export async function toggleStaffClock(employeeId: string, code: string) {
  const res = await fetch(`${BACKEND}/posup/staff/clock/${employeeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function fetchStaffReport(code: string, month: string) {
  const res = await fetch(`${BACKEND}/posup/staff/report/${code}?month=${month}`);
  return res.json();
}