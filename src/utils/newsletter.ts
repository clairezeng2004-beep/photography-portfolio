/**
 * Newsletter service — Buttondown integration.
 *
 * Setup:
 *   1. Go to https://buttondown.com and sign up (free, no credit card)
 *   2. Go to Settings → API → copy your API key
 *   3. Paste it in Admin → Newsletter → API Key
 *
 * Free tier: 100 subscribers, unlimited emails.
 *
 * In production (Netlify), API calls are proxied through /api/buttondown/*
 * to avoid CORS issues. See netlify.toml for the redirect rule.
 */

const STORAGE_KEY = 'buttondown_api_key';

/**
 * Get the API base URL — use Netlify proxy in production, direct API in dev.
 */
function getApiBase(): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://api.buttondown.com/v1';
  }
  return '/api/buttondown';
}

export function getNewsletterApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setNewsletterApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
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
 * Subscribe an email to the Buttondown newsletter.
 * If Buttondown is not configured, falls back to localStorage.
 */
export async function subscribeEmail(email: string): Promise<SubscribeResult> {
  const apiKey = getNewsletterApiKey();

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

  // Use Buttondown API (proxied in production)
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/subscribers`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        type: 'regular',
      }),
    });

    if (res.status === 201) {
      return { success: true, message: '订阅成功！感谢你的关注。' };
    }

    // Handle known error cases
    const data = await res.json().catch(() => null);
    const errorCode = data?.code || '';
    const errorDetail = Array.isArray(data) ? data[0] : (data?.detail || data?.email_address?.[0] || '');

    if (res.status === 400) {
      if (errorCode === 'email_already_exists' || errorDetail?.includes('already')) {
        return { success: true, message: '你已经订阅过了', alreadySubscribed: true };
      }
      if (errorCode === 'email_invalid' || errorDetail?.includes('valid')) {
        return { success: false, message: '邮箱地址格式不正确' };
      }
      return { success: false, message: errorDetail || '订阅失败，请稍后重试' };
    }

    if (res.status === 403) {
      return { success: false, message: 'API Key 无效，请检查 Newsletter 配置' };
    }

    if (res.status === 429) {
      return { success: false, message: '请求太频繁，请稍后再试' };
    }

    return { success: false, message: `订阅失败 (${res.status})` };
  } catch (err: any) {
    console.error('Newsletter subscribe error:', err);
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
