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
  const browser = await chromium.launch({
    headless: true,
    slowMo: 400,
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

export async function pause(page, ms = 1000) {
  await page.waitForTimeout(ms);
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
  await page.getByText('Awaiting approval', { exact: true }).waitFor({ timeout: 15000 });
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
