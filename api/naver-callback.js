// ═══════════════════════════════════════════════════════════════
// 네이버 OAuth 콜백 - /api/naver-callback.js
// 인증 코드로 access_token 발급 → 앱으로 리다이렉트
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(302, `/?naver_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect(302, `/?naver_error=no_code`);
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(302, `/?naver_error=missing_env`);
  }

  try {
    // Access Token 요청
    const tokenUrl = `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}&state=${state}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.redirect(302, `/?naver_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // 앱으로 리다이렉트 (토큰을 URL 파라미터로 전달)
    return res.redirect(302, `/?naver_token=${accessToken}&naver_refresh=${refreshToken || ""}`);

  } catch (err) {
    return res.redirect(302, `/?naver_error=${encodeURIComponent(err.message)}`);
  }
}
