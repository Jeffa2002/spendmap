import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import Database from 'better-sqlite3';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

const port = Number(process.env.PORT || 3308);
const origin = process.env.SITE_ORIGIN || 'http://localhost:3308';
const rpID = process.env.RP_ID || new URL(origin).hostname;
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '40kb' }));

const dataDir = process.env.DATA_DIR || '/var/lib/spendmap';
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const db = new Database(path.join(dataDir, 'spendmap.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    totp_secret TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pending_mfa INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key BLOB NOT NULL, counter INTEGER NOT NULL, transports TEXT, name TEXT NOT NULL,
    created_at TEXT NOT NULL, last_used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL, challenge TEXT NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS financial_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_payload TEXT NOT NULL, updated_at TEXT NOT NULL
  );
`);

const sessionSecret = process.env.SESSION_SECRET;
const totpEncryptionKey = process.env.TOTP_ENCRYPTION_KEY;
const profileEncryptionKey = process.env.PROFILE_ENCRYPTION_KEY;
if (!sessionSecret || !totpEncryptionKey || !profileEncryptionKey || totpEncryptionKey.length < 32 || profileEncryptionKey.length < 32) throw new Error('Missing secure Spendmap runtime secrets');
const totpKey = crypto.createHash('sha256').update(totpEncryptionKey).digest();
const profileKey = crypto.createHash('sha256').update(profileEncryptionKey).digest();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const id = () => crypto.randomUUID();
const now = () => Date.now();

function encrypt(value, key) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const out = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${out.toString('base64url')}`; }
function decrypt(value, key) { const [iv, tag, out] = value.split('.').map(v => Buffer.from(v, 'base64url')); const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(out), decipher.final()]).toString('utf8'); }
function passwordHash(password, salt = crypto.randomBytes(16).toString('base64url')) { return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, derived) => err ? reject(err) : resolve(`${salt}:${derived.toString('base64url')}`))); }
async function passwordMatches(password, saved) { const [salt, encoded] = saved.split(':'); const candidate = await passwordHash(password, salt); return crypto.timingSafeEqual(Buffer.from(candidate.split(':')[1]), Buffer.from(encoded)); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2)); }
function setCookie(res, name, value, maxAge = 60 * 60 * 24 * 30) { res.cookie(name, value, { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'strict', path: '/', maxAge: maxAge * 1000 }); }
function clearCookie(res) { res.clearCookie('spendmap_session', { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'strict', path: '/' }); }
function createSession(res, userId, pendingMfa = false) { const token = crypto.randomBytes(32).toString('base64url'); db.prepare('INSERT INTO sessions(token_hash,user_id,pending_mfa,expires_at) VALUES(?,?,?,?)').run(hash(token), userId, pendingMfa ? 1 : 0, now() + 30 * 86400000); setCookie(res, 'spendmap_session', token); }
function getSession(req) { const token = parseCookies(req).spendmap_session; if (!token) return null; const session = db.prepare('SELECT sessions.*, users.email, users.totp_enabled FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hash(token), now()); return session || null; }
function requireOrigin(req, res, next) { if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== origin) return res.status(403).json({ error: 'Invalid request origin.' }); next(); }
function rateLimit(limit = 12, windowMs = 60000) { const hits = new Map(); return (req, res, next) => { const k = `${req.ip}:${req.path}`; const record = hits.get(k) || { count: 0, at: now() }; if (now() - record.at > windowMs) { record.count = 0; record.at = now(); } record.count++; hits.set(k, record); if (record.count > limit) return res.status(429).json({ error: 'Please wait a minute and try again.' }); next(); }; }
function saveChallenge(userId, purpose, challenge) { db.prepare('DELETE FROM challenges WHERE expires_at<?').run(now()); db.prepare('INSERT INTO challenges(id,user_id,purpose,challenge,expires_at) VALUES(?,?,?,?,?)').run(id(), userId, purpose, challenge, now() + 5 * 60000); }
function takeChallenge(userId, purpose) { const record = db.prepare('SELECT * FROM challenges WHERE user_id IS ? AND purpose=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1').get(userId, purpose, now()); if (record) db.prepare('DELETE FROM challenges WHERE id=?').run(record.id); return record?.challenge; }
function publicUser(session) { return session ? { email: session.email, mfaPending: Boolean(session.pending_mfa), totpEnabled: Boolean(session.totp_enabled) } : null; }
function validProfile(profile) {
  if (!profile || typeof profile !== 'object' || !Array.isArray(profile.incomes) || !Array.isArray(profile.expenses)) return false;
  const entries = [...profile.incomes, ...profile.expenses];
  return entries.length <= 250 && entries.every(entry => entry && typeof entry.name === 'string' && entry.name.length <= 120 && Number.isFinite(Number(entry.amount)) && Number(entry.amount) >= 0 && ['weekly', 'fortnightly', 'monthly', 'yearly'].includes(entry.frequency));
}

app.use(requireOrigin);
app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(getSession(req)) }));
app.get('/api/profile', (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); const record = db.prepare('SELECT encrypted_payload,updated_at FROM financial_profiles WHERE user_id=?').get(session.user_id); if (!record) return res.json({ profile: null }); try { res.json({ profile: JSON.parse(decrypt(record.encrypted_payload, profileKey)), updatedAt: record.updated_at }); } catch { res.status(500).json({ error: 'Saved profile could not be read.' }); } });
app.put('/api/profile', (req, res) => { const session = getSession(req); const profile = req.body?.profile; if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); if (!validProfile(profile)) return res.status(400).json({ error: 'That profile is not valid.' }); const payload = JSON.stringify(profile); if (Buffer.byteLength(payload) > 64 * 1024) return res.status(413).json({ error: 'Profile is too large.' }); const updatedAt = new Date().toISOString(); db.prepare('INSERT INTO financial_profiles(user_id,encrypted_payload,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET encrypted_payload=excluded.encrypted_payload,updated_at=excluded.updated_at').run(session.user_id, encrypt(payload, profileKey), updatedAt); res.json({ updatedAt }); });
app.post('/api/auth/signup', rateLimit(), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(); const password = String(req.body?.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return res.status(400).json({ error: 'Use a valid email and a password of at least 12 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account already exists for that email.' });
  const userId = id(); db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(userId, email, await passwordHash(password), new Date().toISOString()); createSession(res, userId); res.status(201).json({ user: { email, mfaPending: false, totpEnabled: false } });
});
app.post('/api/auth/signin', rateLimit(), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(); const password = String(req.body?.password || ''); const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !(await passwordMatches(password, user.password_hash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  createSession(res, user.id, Boolean(user.totp_enabled)); res.json({ user: { email: user.email, mfaPending: Boolean(user.totp_enabled), totpEnabled: Boolean(user.totp_enabled) } });
});
app.post('/api/auth/signout', (req, res) => { const token = parseCookies(req).spendmap_session; if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); clearCookie(res); res.status(204).end(); });
app.post('/api/auth/totp/setup', async (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); if (session.totp_enabled) return res.status(400).json({ error: 'Authenticator already enabled.' }); const totp = new OTPAuth.TOTP({ issuer: 'Spendmap', label: session.email, algorithm: 'SHA1', digits: 6, period: 30, secret: new OTPAuth.Secret({ size: 20 }) }); db.prepare('UPDATE users SET totp_secret=?,totp_enabled=0 WHERE id=?').run(encrypt(totp.secret.base32, totpKey), session.user_id); res.json({ uri: totp.toString(), secret: totp.secret.base32, qrCode: await QRCode.toDataURL(totp.toString(), { margin: 1, width: 220 }) }); });
function validTotp(secret, code) { const totp = new OTPAuth.TOTP({ issuer: 'Spendmap', secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }); return totp.validate({ token: String(code || '').replace(/\s/g, ''), window: 1 }) !== null; }
app.post('/api/auth/totp/enable', (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); const user = db.prepare('SELECT totp_secret FROM users WHERE id=?').get(session.user_id); if (!user?.totp_secret || !validTotp(decrypt(user.totp_secret, totpKey), req.body?.code)) return res.status(400).json({ error: 'That code is not valid.' }); db.prepare('UPDATE users SET totp_enabled=1 WHERE id=?').run(session.user_id); res.json({ enabled: true }); });
app.post('/api/auth/totp/verify-login', rateLimit(), (req, res) => { const session = getSession(req); if (!session?.pending_mfa) return res.status(400).json({ error: 'No MFA challenge is pending.' }); const user = db.prepare('SELECT totp_secret FROM users WHERE id=?').get(session.user_id); if (!user?.totp_secret || !validTotp(decrypt(user.totp_secret, totpKey), req.body?.code)) return res.status(401).json({ error: 'That code is not valid.' }); db.prepare('UPDATE sessions SET pending_mfa=0 WHERE token_hash=?').run(session.token_hash); res.json({ ok: true }); });
app.post('/api/auth/totp/disable', (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); db.prepare('UPDATE users SET totp_secret=NULL,totp_enabled=0 WHERE id=?').run(session.user_id); res.status(204).end(); });

app.post('/api/auth/passkey/register/options', (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); const credentials = db.prepare('SELECT id,transports FROM passkeys WHERE user_id=?').all(session.user_id); const options = generateRegistrationOptions({ rpName: 'Spendmap', rpID, userID: Buffer.from(session.user_id), userName: session.email, attestationType: 'none', authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }, excludeCredentials: credentials.map(c => ({ id: c.id, transports: JSON.parse(c.transports || '[]') })) }); saveChallenge(session.user_id, 'register', options.challenge); res.json(options); });
app.post('/api/auth/passkey/register/verify', async (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); const expectedChallenge = takeChallenge(session.user_id, 'register'); if (!expectedChallenge) return res.status(400).json({ error: 'Passkey request expired. Try again.' }); try { const result = await verifyRegistrationResponse({ response: req.body?.credential, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true }); if (!result.verified || !result.registrationInfo) throw new Error('Not verified'); const { credential } = result.registrationInfo; db.prepare('INSERT INTO passkeys(id,user_id,public_key,counter,transports,name,created_at) VALUES(?,?,?,?,?,?,?)').run(credential.id, session.user_id, credential.publicKey, credential.counter, JSON.stringify(credential.transports || []), String(req.body?.name || 'Passkey').slice(0, 60), new Date().toISOString()); res.json({ verified: true }); } catch { res.status(400).json({ error: 'Passkey registration could not be verified.' }); } });
app.post('/api/auth/passkey/authenticate/options', rateLimit(), (req, res) => { const email = String(req.body?.email || '').trim().toLowerCase(); const user = db.prepare('SELECT id FROM users WHERE email=?').get(email); if (!user) return res.status(404).json({ error: 'No passkey is available for that email.' }); const credentials = db.prepare('SELECT id,transports FROM passkeys WHERE user_id=?').all(user.id); if (!credentials.length) return res.status(404).json({ error: 'No passkey is available for that email.' }); const options = generateAuthenticationOptions({ rpID, userVerification: 'preferred', allowCredentials: credentials.map(c => ({ id: c.id, transports: JSON.parse(c.transports || '[]') })) }); saveChallenge(user.id, 'authenticate', options.challenge); res.json(options); });
app.post('/api/auth/passkey/authenticate/verify', rateLimit(), async (req, res) => { const credentialId = req.body?.credential?.id; const passkey = db.prepare('SELECT passkeys.*,users.email FROM passkeys JOIN users ON users.id=passkeys.user_id WHERE passkeys.id=?').get(credentialId); if (!passkey) return res.status(401).json({ error: 'Unknown passkey.' }); const expectedChallenge = takeChallenge(passkey.user_id, 'authenticate'); if (!expectedChallenge) return res.status(400).json({ error: 'Passkey request expired. Try again.' }); try { const result = await verifyAuthenticationResponse({ response: req.body.credential, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, credential: { id: passkey.id, publicKey: passkey.public_key, counter: passkey.counter, transports: JSON.parse(passkey.transports || '[]') }, requireUserVerification: true }); if (!result.verified) throw new Error('Not verified'); db.prepare('UPDATE passkeys SET counter=?,last_used_at=? WHERE id=?').run(result.authenticationInfo.newCounter, new Date().toISOString(), passkey.id); createSession(res, passkey.user_id); res.json({ user: { email: passkey.email, mfaPending: false } }); } catch { res.status(401).json({ error: 'Passkey sign-in could not be verified.' }); } });
app.get('/api/auth/passkeys', (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); res.json({ passkeys: db.prepare('SELECT id,name,created_at,last_used_at FROM passkeys WHERE user_id=?').all(session.user_id) }); });
app.delete('/api/auth/passkeys/:id', (req, res) => { const session = getSession(req); if (!session || session.pending_mfa) return res.status(401).json({ error: 'Sign in first.' }); db.prepare('DELETE FROM passkeys WHERE id=? AND user_id=?').run(req.params.id, session.user_id); res.status(204).end(); });

app.listen(port, '127.0.0.1', () => console.log(`Spendmap auth listening on ${port}`));
