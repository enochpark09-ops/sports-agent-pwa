// ═══════════════════════════════════════════════════════════════
// Instagram Graph API - 자동 포스팅
// Vercel Serverless Function
// 
// 포스팅 프로세스 (2단계):
// 1. POST /{ig-user-id}/media → 미디어 컨테이너 생성
// 2. POST /{ig-user-id}/media_publish → 컨테이너 발행
// ═══════════════════════════════════════════════════════════════

const GRAPH_API = "https://graph.facebook.com/v25.0";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caption, image_url } = req.body;

    if (!caption) {
      return res.status(400).json({ error: "caption이 필요합니다." });
    }

    const accessToken = process.env.IG_ACCESS_TOKEN;
    const igUserId = process.env.IG_USER_ID;

    if (!accessToken || !igUserId) {
      return res.status(500).json({ error: "IG_ACCESS_TOKEN 또는 IG_USER_ID 환경변수가 설정되지 않았습니다." });
    }

    // ── 이미지 없는 경우: 텍스트 전용은 인스타에서 불가 → 캡션만 반환 ──
    if (!image_url) {
      return res.status(200).json({
        success: false,
        error: "Instagram API는 이미지 URL이 필수입니다. 이미지 없이는 포스팅할 수 없습니다.",
        caption_ready: caption,
        tip: "이미지를 생성하거나 업로드한 후 image_url과 함께 다시 요청하세요.",
      });
    }

    // ── 1단계: 미디어 컨테이너 생성 ──
    const createRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: image_url,
        caption: caption,
        access_token: accessToken,
      }),
    });

    const createData = await createRes.json();

    if (createData.error) {
      throw new Error(`미디어 생성 실패: ${createData.error.message}`);
    }

    const containerId = createData.id;
    if (!containerId) {
      throw new Error("미디어 컨테이너 ID를 받지 못했습니다.");
    }

    // ── 컨테이너 상태 확인 (최대 30초 대기) ──
    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 10) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code || "FINISHED";
      attempts++;
    }

    if (status === "ERROR") {
      throw new Error("미디어 처리 중 오류가 발생했습니다.");
    }

    // ── 2단계: 미디어 발행 ──
    const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();

    if (publishData.error) {
      throw new Error(`발행 실패: ${publishData.error.message}`);
    }

    return res.status(200).json({
      success: true,
      media_id: publishData.id,
      message: "인스타그램에 포스팅되었습니다!",
      url: `https://www.instagram.com/edgestats_/`,
    });

  } catch (error) {
    console.error("Instagram posting error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
