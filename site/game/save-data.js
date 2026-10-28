/* Encrypted transport for UI and optional home-only prototype state. */
import { normalizeRankPoints, getRankProgress } from './rank-progress.js';
import { validateSessionState } from './game-session.js';
import { validateVisitorProgress } from './visitor-profile.js';
const FORMAT = 'okoteiyu-ui-preview';
const VERSION = 1;
const ITERATIONS = 210000;
const MAX_FILE_BYTES = 1024 * 1024;
// Base64 uses four characters per three bytes; the complete file stays below 1MiB.
const MAX_CIPHERTEXT_BYTES = Math.floor(MAX_FILE_BYTES * 3 / 4);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const additionalData = encoder.encode(FORMAT + '|1|PBKDF2-SHA256|210000|AES-GCM-256');
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function record(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key));
}
function invalidState() { return new Error('セーブデータの表示内容が正しくありません。'); }

/** Return a new object containing only supported, validated state fields. */
export function validatePreviewState(state) {
  const hasRankPoints = record(state) && own(state, 'rankPoints');
  const hasPrototype = record(state) && own(state, 'prototype');
  const fields = ['rank', 'location', 'gauges'];
  if (hasRankPoints) fields.push('rankPoints');
  if (hasPrototype) fields.push('prototype');
  if (!exactKeys(state, fields) ||
      typeof state.rank !== 'string' || !/^[A-Z][A-Z0-9]{0,7}$/.test(state.rank) ||
      typeof state.location !== 'string' || !state.location.trim() ||
      Array.from(state.location).length > 80 || /[\u0000-\u001f\u007f]/u.test(state.location) ||
      !(exactKeys(state.gauges, ['experience'])||exactKeys(state.gauges, ['experience','anger']))) throw invalidState();
  const { experience, anger } = state.gauges;
  if (typeof experience !== 'number' || !Number.isFinite(experience) || experience < 0 || experience > 1 ||
      anger!==undefined&&(typeof anger !== 'number' || !Number.isFinite(anger) || anger < 0 || anger > 1)) throw invalidState();
  const safeState = { rank: state.rank, location: state.location, gauges: { experience } };
  // A v1 save without this optional field keeps its original three-key shape.
  if (hasRankPoints) {
    if (state.rankPoints === null) safeState.rankPoints = null;
    else {
      if (typeof state.rankPoints !== 'string' &&
          !(typeof state.rankPoints === 'number' && Number.isSafeInteger(state.rankPoints))) throw invalidState();
      let points;
      try {
        points = normalizeRankPoints(state.rankPoints);
        if (getRankProgress(points).rank !== state.rank) throw invalidState();
      } catch { throw invalidState(); }
      safeState.rankPoints = points;
    }
  }
  // Progress never includes an in-progress battle. An unnamed save must
  // provide the exact initial level and calm points.
  if (hasPrototype) {
    const prototype = state.prototype;
    if (state.location !== 'おこていゆハウス' ||
        !exactKeys(prototype, ['session', 'relaxStreak']) ||
        !Number.isSafeInteger(prototype.relaxStreak) || prototype.relaxStreak < 0) throw invalidState();
    let session;
    try { session = validateSessionState(prototype.session); }
    catch { throw invalidState(); }
    validateVisitorProgress(session,prototype.relaxStreak);
    safeState.prototype = { session, relaxStreak: Math.min(99,prototype.relaxStreak) };
  }
  // UI-only legacy data cannot establish the required initial level and calm points.
  if(!hasPrototype)throw invalidState();
  return safeState;
}

function requireCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('このブラウザでは暗号化セーブを利用できません。HTTPSで開いてください。');
  }
  return globalThis.crypto;
}
function requirePassword(password) {
  if (typeof password !== 'string' || password.length === 0) throw new Error('パスワードを入力してください。');
  if (password.length > 1024) throw new Error('パスワードが長すぎます。');
}
function toBase64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  }
  return btoa(binary);
}
function fromBase64(value, expectedLength = null) {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(MAX_CIPHERTEXT_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('セーブデータの形式が正しくありません。');
  }
  let binary;
  try { binary = atob(value); } catch { throw new Error('セーブデータの形式が正しくありません。'); }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (toBase64(bytes) !== value || (expectedLength !== null && bytes.length !== expectedLength)) {
    throw new Error('セーブデータの形式が正しくありません。');
  }
  return bytes;
}
async function deriveKey(password, salt, usage) {
  const crypto = requireCrypto();
  const passwordBytes = encoder.encode(password);
  let material;
  try { material = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']); }
  finally { passwordBytes.fill(0); }
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, [usage]
  );
}

/** Encode the current preview state as a password-encrypted JSON text file. */
export async function encodeSave(state, password) {
  const safeState = validatePreviewState(state);
  requirePassword(password);
  const crypto = requireCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, 'encrypt');
  const plaintext = encoder.encode(JSON.stringify({ version: VERSION, state: safeState }));
  if (plaintext.length + 16 > MAX_CIPHERTEXT_BYTES) {
    plaintext.fill(0);
    throw new Error('保存するデータが大きすぎます。');
  }
  let encrypted;
  try {
    encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, plaintext);
  } catch { throw new Error('セーブデータを暗号化できませんでした。'); }
  finally { plaintext.fill(0); }
  const text = JSON.stringify({
    type: FORMAT, version: VERSION, cipher: 'AES-GCM-256', kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted))
  }, null, 2) + '\n';
  if (encoder.encode(text).length > MAX_FILE_BYTES) throw new Error('保存するデータが大きすぎます。');
  return text;
}

/** Decrypt and validate before returning data; the caller chooses when to apply it. */
export async function decodeSave(text, password) {
  requirePassword(password);
  if (typeof text !== 'string' || !text.length || text.length > MAX_FILE_BYTES || encoder.encode(text).length > MAX_FILE_BYTES) {
    throw new Error('セーブファイルは1MiB以下のテキストを選んでください。');
  }
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('セーブデータの形式が正しくありません。'); }
  if (!record(envelope) || envelope.type !== FORMAT) throw new Error('このセーブデータの形式には対応していません。');
  if (envelope.version !== VERSION) throw new Error('このバージョンのセーブデータには対応していません。');
  if (!exactKeys(envelope, ['type', 'version', 'cipher', 'kdf', 'iterations', 'salt', 'iv', 'data']) ||
      envelope.cipher !== 'AES-GCM-256' || envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== ITERATIONS) {
    throw new Error('セーブデータの暗号形式が正しくありません。');
  }
  const salt = fromBase64(envelope.salt, 16);
  const iv = fromBase64(envelope.iv, 12);
  const ciphertext = fromBase64(envelope.data);
  if (ciphertext.length < 17 || ciphertext.length > MAX_CIPHERTEXT_BYTES) throw new Error('セーブデータの長さが正しくありません。');
  const key = await deriveKey(password, salt, 'decrypt');
  let plaintext;
  try {
    plaintext = new Uint8Array(await requireCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, ciphertext
    ));
  } catch { throw new Error('パスワードが違うか、セーブデータが壊れています。'); }
  try {
    const payload = JSON.parse(decoder.decode(plaintext));
    if (!exactKeys(payload, ['version', 'state']) || payload.version !== VERSION) throw invalidState();
    return validatePreviewState(payload.state);
  } catch { throw invalidState(); }
  finally { plaintext.fill(0); }
}
