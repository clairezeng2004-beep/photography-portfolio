/**
 * Newsletter service — MailerLite integration.
 *
 * Setup:
 *   1. Go to https://www.mailerlite.com and sign up (free, no credit card)
 *   2. Go to Integrations → MailerLite API → Generate new token
 *   3. Paste the API token in Admin → Newsletter → API Key
 *
 * Free tier: 1,000 subscribers, 12,000 emails/month.
 *
 * In production, API calls are proxied through /api/mailerlite/*
 * to avoid CORS issues. See vercel.json / netlify.toml for the rewrite rules.
 */

import { isSupabaseConfigured, supabaseGet, supabaseSet } from './supabase';

const STORAGE_KEY = 'mailerlite_api_key';
const CLOUD_KEY = 'mailerlite_api_key';

/**
 * Get the API base URL — use proxy in production, direct API in dev.
 */
function getApiBase(): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://connect.mailerlite.com/api';
  }
  return '/api/mailerlite';
}

export function getNewsletterApiKey(): string {
  // Also check old Buttondown key for migration
  return localStorage.getItem(STORAGE_KEY) || localStorage.getItem('buttondown_api_key') || '';
}

export function setNewsletterApiKey(key: string): void {
  const trimmed = key.trim();
  localStorage.setItem(STORAGE_KEY, trimmed);
  // Clean up old Buttondown key if it exists
  localStorage.removeItem('buttondown_api_key');
  if (isSupabaseConfigured()) {
    supabaseSet(CLOUD_KEY, trimmed).catch(e =>
      console.warn('[newsletter] Failed to sync key to cloud:', e)
    );
  }
}

/** Load newsletter key from Supabase if local is empty. */
export async function syncNewsletterKeyFromCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const local = getNewsletterApiKey();
  if (local) {
    supabaseSet(CLOUD_KEY, local).catch(() => {});
    return;
  }
  try {
    // Try new MailerLite key first, then fall back to old Buttondown key
    let cloudKey = await supabaseGet<string>(CLOUD_KEY);
    if (!cloudKey) {
      cloudKey = await supabaseGet<string>('buttondown_api_key');
    }
    if (cloudKey) {
      localStorage.setItem(STORAGE_KEY, cloudKey);
      console.log('[newsletter] Synced key from cloud');
    }
  } catch (e) {
    console.warn('[newsletter] Failed to sync key from cloud:', e);
  }
}

export function isNewsletterConfigured(): boolean {
  return getNewsletterApiKey().length > 0;
}

export interface SubscribeResult {
  success: boolean;
  message: string;
  alreadySubscribed?: boolean;
}

/**
 * Subscribe an email to the MailerLite newsletter.
 * If MailerLite is not configured, falls back to localStorage.
 */
export async function subscribeEmail(email: string): Promise<SubscribeResult> {
  const apiKey = getNewsletterApiKey();
  console.log('[newsletter] subscribeEmail called, email:', email);
  console.log('[newsletter] API key present:', !!apiKey, 'length:', apiKey.length);

  if (!apiKey) {
    // Fallback: save to localStorage
    const subscribers: string[] = JSON.parse(
      localStorage.getItem('newsletter_subscribers') || '[]'
    );
    if (subscribers.includes(email)) {
      return { success: true, message: '你已经订阅过了', alreadySubscribed: true };
    }
    subscribers.push(email);
    localStorage.setItem('newsletter_subscribers', JSON.stringify(subscribers));
    return { success: true, message: '订阅成功' };
  }

  // Use MailerLite API (proxied in production)
  const apiBase = getApiBase();
  const url = `${apiBase}/subscribers`;
  console.log('[newsletter] Sending request to:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
      }),
    });

    console.log('[newsletter] MailerLite API response:', res.status, res.statusText);

    // 200 = updated existing subscriber, 201 = created new subscriber
    if (res.status === 200 || res.status === 201) {
      const data = await res.json().catch(() => null);
      console.log('[newsletter] Subscription successful for:', email);

      // Check if subscriber already existed (status check)
      if (data?.data?.status === 'active' && res.status === 200) {
        return { success: true, message: '你已经订阅过了', alreadySubscribed: true };
      }
      return { success: true, message: '订阅成功！感谢你的关注。' };
    }

    // Handle known error cases
    const data = await res.json().catch(() => null);
    console.log('[newsletter] Response data:', data);

    if (res.status === 422) {
      // Validation error
      const errorMsg = data?.message || '';
      if (errorMsg.includes('already') || errorMsg.includes('exists')) {
        return { success: true, message: '你已经订阅过了', alreadySubscribed: true };
      }
      if (errorMsg.includes('email') || errorMsg.includes('valid')) {
        return { success: false, message: '邮箱地址格式不正确' };
      }
      return { success: false, message: errorMsg || '订阅失败，请稍后重试' };
    }

    if (res.status === 401) {
      return { success: false, message: 'API Key 无效，请检查 Newsletter 配置' };
    }

    if (res.status === 429) {
      return { success: false, message: '请求太频繁，请稍后再试' };
    }

    return { success: false, message: `订阅失败 (${res.status})` };
  } catch (err: any) {
    console.error('[newsletter] Subscribe error:', err?.message || err);
    console.error('[newsletter] Error details:', err);
    // Network error — fallback to localStorage
    const subscribers: string[] = JSON.parse(
      localStorage.getItem('newsletter_subscribers') || '[]'
    );
    if (!subscribers.includes(email)) {
      subscribers.push(email);
      localStorage.setItem('newsletter_subscribers', JSON.stringify(subscribers));
    }
    return {
      success: true,
      message: '订阅成功（网络异常，已暂存本地）',
    };
  }
}
