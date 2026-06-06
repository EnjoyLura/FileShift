/**
 * 微信开放平台 API 工具函数
 * 文档: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
 */

// ========== 类型定义 ==========

export interface WechatTokenResult {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}

export interface WechatUserInfo {
  openid: string;
  nickname: string;
  sex: number; // 1=男, 2=女, 0=未知
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

export interface WechatApiError {
  errcode: number;
  errmsg: string;
}

// ========== 微信 API 端点 ==========

const WECHAT_API = {
  /** code 换取 access_token */
  ACCESS_TOKEN: 'https://api.weixin.qq.com/sns/oauth2/access_token',
  /** 获取用户信息 */
  USER_INFO: 'https://api.weixin.qq.com/sns/userinfo',
  /** 刷新 access_token */
  REFRESH_TOKEN: 'https://api.weixin.qq.com/sns/oauth2/refresh_token',
  /** 校验 access_token 是否有效 */
  AUTH_CHECK: 'https://api.weixin.qq.com/sns/auth',
} as const;

// ========== 配置获取 ==========

function getWechatConfig() {
  return {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
    redirectUri: process.env.WECHAT_REDIRECT_URI || 'http://localhost:5173/auth/wechat/callback',
  };
}

// ========== API 调用 ==========

/**
 * 用授权码换取 access_token 和 openid
 */
export async function getAccessToken(code: string): Promise<WechatTokenResult> {
  const { appId, appSecret } = getWechatConfig();

  if (!appId || !appSecret) {
    throw new Error('微信开放平台未配置 (WECHAT_APP_ID / WECHAT_APP_SECRET)');
  }

  const url = new URL(WECHAT_API.ACCESS_TOKEN);
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const response = await fetch(url.toString());
  const data = (await response.json()) as WechatTokenResult & WechatApiError;

  if ('errcode' in data && data.errcode !== 0) {
    throw new Error(`微信 API 错误 [${data.errcode}]: ${data.errmsg}`);
  }

  return data as WechatTokenResult;
}

/**
 * 获取微信用户信息
 */
export async function getUserInfo(
  accessToken: string,
  openid: string
): Promise<WechatUserInfo> {
  const url = new URL(WECHAT_API.USER_INFO);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('openid', openid);
  url.searchParams.set('lang', 'zh_CN');

  const response = await fetch(url.toString());
  const data = (await response.json()) as WechatUserInfo & WechatApiError;

  if ('errcode' in data && data.errcode !== 0) {
    throw new Error(`微信 API 错误 [${data.errcode}]: ${data.errmsg}`);
  }

  return data as WechatUserInfo;
}

/**
 * 校验 access_token 是否有效
 */
export async function checkAccessToken(
  accessToken: string,
  openid: string
): Promise<boolean> {
  const url = new URL(WECHAT_API.AUTH_CHECK);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('openid', openid);

  try {
    const response = await fetch(url.toString());
    const data = (await response.json()) as WechatApiError;
    return data.errcode === 0;
  } catch {
    return false;
  }
}

/**
 * 刷新微信 access_token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<WechatTokenResult> {
  const { appId } = getWechatConfig();

  const url = new URL(WECHAT_API.REFRESH_TOKEN);
  url.searchParams.set('appid', appId);
  url.searchParams.set('grant_type', 'refresh_token');
  url.searchParams.set('refresh_token', refreshToken);

  const response = await fetch(url.toString());
  const data = (await response.json()) as WechatTokenResult & WechatApiError;

  if ('errcode' in data && data.errcode !== 0) {
    throw new Error(`微信 API 错误 [${data.errcode}]: ${data.errmsg}`);
  }

  return data as WechatTokenResult;
}

/**
 * 生成微信 OAuth 授权 URL
 */
export function buildAuthUrl(state: string, mode: 'pc' | 'mobile' = 'pc'): string {
  const { appId, redirectUri } = getWechatConfig();

  const url = new URL('https://open.weixin.qq.com/connect/qrconnect');
  url.searchParams.set('appid', appId);
  url.searchParams.set('redirect_uri', encodeURIComponent(redirectUri));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'snsapi_login');
  url.searchParams.set('state', state);

  if (mode === 'mobile') {
    // 移动端使用不同的样式参数
    url.searchParams.set('href',
      'data:text/css,base64,' +
      Buffer.from('.impowerBox .qrcode {width: 200px;}' +
      '.impowerBox .title {display: none;}' +
      '.impowerBox .info {display: none;}').toString('base64')
    );
  }

  return url.toString() + '#wechat_redirect';
}
