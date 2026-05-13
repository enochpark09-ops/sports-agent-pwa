// ═══════════════════════════════════════════════════════════════
// 네이버 OAuth 로그인 시작 - /api/naver-login.js
// 사용자를 네이버 로그인 페이지로 리다이렉트
// ═══════════════════════════════════════════════════════════════

export default function handler(req, res) {
  const clientId = process.env.NAVER_CLIENT_ID;
  
  if (!clientId) {
    return res.status(500).json({ error: "NAVER_CLIENT_ID 환경변수가 설정되지 않았습니다." });
  }

  const redirectUri = encodeURIComponent(`https://sports-agent-pwa.vercel.app/api/naver-callback`);
  const state = Math.random().toString(36).substring(2, 15);
  
  const authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
  
  res.redirect(302, authUrl);
}
