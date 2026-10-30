// Shared by the page and the nightly pre-fetch script: how a YouTube search is named and filed.
import { hash } from './util.js';
export const ytCacheKey = (q, { channelId, long, live } = {}) => `s|${q}|${channelId || ''}|${long ? 1 : 0}|${live ? 1 : 0}`;
export const ytCacheFile = key => hash(key).toString(16).padStart(8, '0') + '.json';
