// ═══════════════════════════════════════════════════════════════
// Instagram Graph API - 카드뉴스 자동 생성 + 포스팅
// 1. Cloudinary 텍스트 오버레이로 카드뉴스 이미지 생성
// 2. Instagram Graph API로 자동 포스팅
// ═══════════════════════════════════════════════════════════════

import crypto from "crypto";

const GRAPH_API = "https://graph.facebook.com/v25.0";

// Cloudinary 서명 생성
function generateSignature(params, apiSecret) {
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(signStr + apiSecret).digest("hex");
}

// Cloudinary에 카드뉴스 이미지 업로드 (텍스트 → 이미지)
async function createCardImage(cardText, caption) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary 환경변수가 설정되지 않았습니다.");
  }

  // SVG로 카드뉴스 이미지 생성 (1080x1080 인스타 정사각형)
  const displayText = (cardText || caption || "EdgeStats").substring(0, 80);
  const lines = [];
  for (let i = 0; i < displayText.length; i += 20) {
    lines.push(displayText.substring(i, i + 20));
  }
  const textLines = lines.map((line, i) => 
    `<text x="540" y="${420 + i * 60}" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="white">${escapeXml(line)}</text>`
  ).join("");

  const shortCaption = (caption || "").substring(0, 60);
  const captionLines = [];
  for (let i = 0; i < shortCaption.length; i += 28) {
    captionLines.push(shortCaption.substring(i, i + 28));
  }
  const captionSvg = captionLines.map((line, i) =>
    `<text x="540" y="${620 + i * 36}" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#cccccc">${escapeXml(line)}</text>`
  ).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0a0e13"/>
        <stop offset="100%" style="stop-color:#1a2230"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect x="40" y="40" width="1000" height="1000" rx="20" fill="none" stroke="#00d4aa" stroke-width="2" opacity="0.3"/>
    <text x="540" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="#00d4aa">⚡ EdgeStats</text>
    <line x1="340" y1="240" x2="740" y2="240" stroke="#00d4aa" stroke-width="1" opacity="0.5"/>
    ${textLines}
    ${captionSvg}
    <text x="540" y="980" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#505a6a">@edgestats_ · Data-driven sports analysis</text>
  </svg>`;

  // SVG를 base64로 변환하여 Cloudinary에 업로드
  const svgBase64 = Buffer.from(svg).toString("base64");
  const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp: timestamp.toString(),
    folder: "edgestats",
    public_id: `card_${timestamp}`,
  };

  const signature = generateSignature(params, apiSecret);

  const formData = new URLSearchParams();
  formData.append("file", dataUri);
  formData.append("timestamp", params.timestamp);
  formData.append("folder", params.folder);
  formData.append("public_id", params.public_id);
  formData.append("signature", signature);
  formData.append("api_key", apiKey);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const uploadData = await uploadRes.json();

  if (uploadData.error) {
    throw new Error(`Cloudinary 업로드 실패: ${uploadData.error.message}`);
  }

  return uploadData.secure_url;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caption, card_text, image_url } = req.body;

    if (!caption) {
      return res.status(400).json({ error: "caption이 필요합니다." });
    }

    const accessToken = process.env.IG_ACCESS_TOKEN;
    const igUserId = process.env.IG_USER_ID;

    if (!accessToken || !igUserId) {
      return res.status(500).json({ error: "IG_ACCESS_TOKEN 또는 IG_USER_ID가 설정되지 않았습니다." });
    }

    // 이미지 URL 결정: 직접 입력 > 카드뉴스 자동 생성
    let finalImageUrl = image_url;
    if (!finalImageUrl) {
      // 카드뉴스 이미지 자동 생성
      finalImageUrl = await createCardImage(card_text, caption);
    }

    // ── 1단계: 미디어 컨테이너 생성 ──
    const createRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: finalImageUrl,
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
      image_url: finalImageUrl,
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
