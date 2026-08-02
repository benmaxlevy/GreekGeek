import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
export const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:3001';
export const OUT_DIR = path.resolve('/root/rally/rally/demo-videos');
export const ADMIN_EMAIL = 'admin@rally.local';
export const ADMIN_PASSWORD = 'RallyAdmin123!';
export const DEMO_PASSWORD = 'RallyDemo123!';
export const UNI_NAME = 'Demo State University';
export const ORG_LABEL = 'Alpha Demo Fraternity (FRATERNITY)';

fs.mkdirSync(OUT_DIR, { recursive: true });

export function ts() {
  return Date.now().toString();
}

export async function launchDemo() {
  const slowMo = Number(process.env.DEMO_SLOW_MO ?? 900);
  const browser = await chromium.launch({
    headless: true,
    slowMo,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function finalizeVideo(page, context, browser, finalName) {
  const video = page.video();
  if (!video) throw new Error('No video object');
  const finalPath = path.join(OUT_DIR, finalName);
  await page.close();
  await context.close();
  const autoPath = await video.path();
  if (!autoPath || !fs.existsSync(autoPath)) {
    throw new Error('Video file missing after context close');
  }
  fs.renameSync(autoPath, finalPath);
  await browser.close();
  const stat = fs.statSync(finalPath);
  if (stat.size <= 0) throw new Error(`Empty video: ${finalPath}`);
  console.log(finalPath);
  return finalPath;
}

export async function pause(page, ms = 2000) {
  await page.waitForTimeout(ms);
}

/** Full-viewport title card between demo flows. Hold ≥1200ms, then remove overlay. */
export async function showFlowTitle(page, label) {
  await page.evaluate((text) => {
    const overlay = document.createElement('div');
    overlay.id = 'demo-flow-title-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.88);pointer-events:none';
    const title = document.createElement('div');
    title.style.cssText =
      'color:#fff;font-family:system-ui,-apple-system,sans-serif;font-size:68px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:40px;line-height:1.2';
    title.textContent = text;
    overlay.appendChild(title);
    document.body.appendChild(overlay);
  }, label);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    document.getElementById('demo-flow-title-overlay')?.remove();
  });
}

export async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
}

export async function signupCascade(page, { name, email, password }) {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('University').selectOption({ label: UNI_NAME });
  await page.waitForFunction(() => {
    const sel = document.querySelector('#organizationId');
    return sel && [...sel.options].some((o) => o.value && o.text.includes('Alpha Demo'));
  });
  await page.getByLabel('Organization').selectOption({ label: ORG_LABEL });
  await pause(page, 600);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL(/\/login/, { timeout: 45000 });
  await page
    .getByText(/awaits admin approval|pending admin review|must approve/i)
    .waitFor({ timeout: 15000 });
}

/** Org-less signup → /login with ready-to-sign-in banner. */
export async function signupWithoutOrg(page, { name, email, password }) {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await pause(page, 400);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL(/\/login/, { timeout: 45000 });
  await page.getByText(/ready to sign in|sign in now/i).waitFor({ timeout: 15000 });
}

export async function apiJson(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${text}`);
  }
  return data;
}

export async function adminToken() {
  const data = await apiJson('/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return data.accessToken;
}

export async function apiSignup({ name, email, password, organizationId }) {
  return apiJson('/api/auth/signup', {
    method: 'POST',
    body: { name, email, password, organizationId },
  });
}

export async function seedOrgId() {
  const orgs = await apiJson('/api/organizations?universityId=seed-university-demo');
  const alpha = orgs.find((o) => o.name === 'Alpha Demo Fraternity');
  if (!alpha) throw new Error('Alpha Demo Fraternity missing');
  return alpha.id;
}

export async function findUserRow(page, email) {
  const row = page.locator('li').filter({ hasText: email });
  await row.first().waitFor({ timeout: 15000 });
  return row.first();
}

export async function adminApproveUserByEmail(email) {
  const token = await adminToken();
  const users = await apiJson('/api/admin/users?status=PENDING', { token });
  const user = users.find((u) => u.email === email);
  if (!user) throw new Error(`Pending user not found: ${email}`);
  return apiJson(`/api/admin/users/${user.id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'ACTIVE' },
  });
}

export async function grantManagePermissionsByEmail(userEmail) {
  return grantPermissionsByEmail(userEmail, ['members.manage_permissions']);
}

export async function grantPermissionsByEmail(userEmail, permissionKeys) {
  const token = await adminToken();
  const users = await apiJson('/api/admin/users?status=ACTIVE', { token });
  const user = users.find((u) => u.email === userEmail);
  if (!user) throw new Error(`Active user not found: ${userEmail}`);

  const memberships = await apiJson('/api/memberships', { token });
  const membership = memberships.find((m) => m.userId === user.id);
  if (!membership) throw new Error(`Membership not found for ${userEmail}`);

  for (const permissionKey of permissionKeys) {
    await apiJson(`/api/memberships/${membership.id}/permissions`, {
      method: 'POST',
      token,
      body: { permissionKey },
    });
  }
}

export async function grantEventPermissionsByEmail(userEmail) {
  return grantPermissionsByEmail(userEmail, ['events.create', 'events.manage']);
}

export async function grantTicketPermissionsByEmail(userEmail) {
  return grantPermissionsByEmail(userEmail, [
    'events.create',
    'events.manage',
    'tickets.manage',
  ]);
}

export async function grantTicketAndPaymentsPermissionsByEmail(userEmail) {
  return grantPermissionsByEmail(userEmail, [
    'events.create',
    'events.manage',
    'tickets.manage',
    'payments.manage',
  ]);
}

export async function setupTicketingEvent({
  hostEmail,
  eventName,
  hostPassword = DEMO_PASSWORD,
  organizationId: orgIdOverride,
}) {
  const token = await loginToken(hostEmail, hostPassword);
  const organizationId = orgIdOverride ?? (await seedOrgId());
  const event = await apiJson('/api/events', {
    method: 'POST',
    token,
    body: {
      organizationId,
      name: eventName,
      type: 'Public Party',
      maxHeadcount: 50,
      location: 'Campus Lawn',
    },
  });
  await apiJson(`/api/events/${event.id}/ticketing`, {
    method: 'PATCH',
    token,
    body: {
      ticketingEnabled: true,
      ticketCapacity: 20,
      ticketSaleStatus: 'draft',
    },
  });
  return { eventId: event.id, eventName: event.name, organizationId, token };
}

export async function loginToken(email, password) {
  const data = await apiJson('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return data.accessToken;
}

export async function createOrgViaAdmin({
  name,
  type = 'SORORITY',
  universityId = 'seed-university-demo',
}) {
  const token = await adminToken();
  return apiJson('/api/organizations', {
    method: 'POST',
    token,
    body: { name, type, universityId },
  });
}

/** On_sale event with public pool only (API fixture for guest-claim demo). */
export async function setupOnSalePublicEvent({
  hostEmail,
  hostPassword = DEMO_PASSWORD,
  eventName,
  publicQty = 10,
}) {
  const token = await loginToken(hostEmail, hostPassword);
  const organizationId = await seedOrgId();
  const event = await apiJson('/api/events', {
    method: 'POST',
    token,
    body: {
      organizationId,
      name: eventName,
      type: 'Public Party',
      maxHeadcount: 50,
      location: 'Campus Lawn',
    },
  });
  await apiJson(`/api/events/${event.id}/ticketing`, {
    method: 'PATCH',
    token,
    body: {
      ticketingEnabled: true,
      ticketCapacity: publicQty,
      ticketSaleStatus: 'draft',
    },
  });
  await apiJson(`/api/events/${event.id}/allocations`, {
    method: 'POST',
    token,
    body: { organizationId: null, quantity: publicQty },
  });
  await apiJson(`/api/events/${event.id}/ticketing`, {
    method: 'PATCH',
    token,
    body: { ticketSaleStatus: 'on_sale' },
  });
  return { eventId: event.id, eventName: event.name };
}

export async function setupActiveMember({ name, email, password = DEMO_PASSWORD, grantEventPerms = false }) {
  const organizationId = await seedOrgId();
  await apiSignup({ name, email, password, organizationId });
  await adminApproveUserByEmail(email);
  if (grantEventPerms) {
    await grantEventPermissionsByEmail(email);
  }
  return { organizationId };
}

/** ACTIVE officer with members.manage_permissions + PENDING applicant on seed org. */
export async function setupOfficerAndApplicant({
  officerEmail,
  officerName,
  applicantEmail,
  applicantName,
  password = DEMO_PASSWORD,
  grantOfficerPermission = true,
}) {
  const organizationId = await seedOrgId();
  await apiSignup({ name: officerName, email: officerEmail, password, organizationId });
  if (applicantEmail) {
    await apiSignup({
      name: applicantName,
      email: applicantEmail,
      password,
      organizationId,
    });
  }
  await adminApproveUserByEmail(officerEmail);
  if (grantOfficerPermission) {
    await grantManagePermissionsByEmail(officerEmail);
  }
  return { organizationId };
}

export async function logout(page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });
}
