// ═══════════════════════════════════════════════════════════════
// 네이버 블로그 글쓰기 - /api/post-naver.js
// access_token으로 네이버 블로그에 글 게시
// ═══════════════════════════════════════════════════════════════

const NAVER_BLOG_API = "https://openapi.naver.com/blog/writePost.json";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { title, contents, tags, accessToken, categoryNo } = req.body;

    if (!title || !contents) {
      return res.status(400).json({ error: "title과 contents가 필요합니다." });
    }

    if (!accessToken) {
      return res.status(401).json({ error: "네이버 로그인이 필요합니다. 설정 탭에서 네이버 로그인을 해주세요." });
    }

    // HTML 본문 구성
    const htmlContents = contents
      .replace(/\n/g, "<br/>")
      .replace(/■\s*(.+)/g, "<h3>$1</h3>");

    // 태그 문자열 (쉼표 구분)
    const tagString = tags ? (Array.isArray(tags) ? tags.join(",") : tags) : "";

    // form-urlencoded 데이터 구성
    const formData = new URLSearchParams();
    formData.append("title", title);
    formData.append("contents", htmlContents);
    if (tagString) formData.append("tag", tagString);
    if (categoryNo) formData.append("categoryNo", categoryNo);
    formData.append("openType", "all"); // 공개
    formData.append("scrapType", "content"); // 스크랩 허용

    const apiRes = await fetch(NAVER_BLOG_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await apiRes.json();

    if (!apiRes.ok || data.error) {
      const errMsg = data.error_description || data.message || data.error || `HTTP ${apiRes.status}`;
      throw new Error(`네이버 API: ${errMsg}`);
    }

    return res.status(200).json({
      success: true,
      message: "네이버 블로그에 글이 게시되었습니다.",
      url: data.url || `https://blog.naver.com/edgestat`,
      data,
    });

  } catch (error) {
    console.error("Naver blog posting error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
