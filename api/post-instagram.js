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

// Cloudinary에 카드뉴스 이미지 생성 (텍스트 오버레이 방식 - 한글 지원)
async function createCardImage(cardText, caption) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary 환경변수가 설정되지 않았습니다.");
  }

  // 1. 먼저 배경 이미지를 생성/업로드 (한 번만 필요, 이후 캐시됨)
  const bgPublicId = "edgestats/card_bg";

  // 배경 이미지가 없으면 생성
  try {
    const checkRes = await fetch(`https://res.cloudinary.com/${cloudName}/image/upload/v1/${bgPublicId}.png`);
    if (!checkRes.ok) {
      // 배경 이미지 생성 (1080x1080 다크 그라디언트)
      const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
        <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0e13"/><stop offset="100%" style="stop-color:#1a2230"/>
        </linearGradient></defs>
        <rect width="1080" height="1080" fill="url(#bg)"/>
        <rect x="40" y="40" width="1000" height="1000" rx="20" fill="none" stroke="#00d4aa" stroke-width="2" opacity="0.3"/>
        <line x1="240" y1="260" x2="840" y2="260" stroke="#00d4aa" stroke-width="1" opacity="0.4"/>
        <line x1="240" y1="820" x2="840" y2="820" stroke="#00d4aa" stroke-width="1" opacity="0.2"/>
      </svg>`;
      const bgBase64 = Buffer.from(bgSvg).toString("base64");
      const bgDataUri = `data:image/svg+xml;base64,${bgBase64}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const params = { timestamp: timestamp.toString(), public_id: bgPublicId, overwrite: "true" };
      const signature = generateSignature(params, apiSecret);
      const formData = new URLSearchParams();
      formData.append("file", bgDataUri);
      formData.append("timestamp", params.timestamp);
      formData.append("public_id", params.public_id);
      formData.append("overwrite", "true");
      formData.append("signature", signature);
      formData.append("api_key", apiKey);
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
    }
  } catch (e) { /* 배경 이미지 체크/생성 실패 시 무시하고 진행 */ }

  // 2. 텍스트 오버레이로 최종 이미지 URL 생성
  const mainText = (cardText || caption || "EdgeStats").substring(0, 80);
  const subText = (caption || "").substring(0, 100);

  // Cloudinary URL 트랜스포메이션으로 텍스트 오버레이 (한글 지원)
  const encodeText = (text) => encodeURIComponent(text).replace(/%20/g, "%20");

  // 메인 텍스트 오버레이
  const mainOverlay = `l_text:Arial_46_bold:${encodeText(mainText)},co_rgb:ffffff,g_center,y_-80`;
  // 브랜드명 오버레이  
  const brandOverlay = `l_text:Arial_28_bold:${encodeText("⚡ EdgeStats")},co_rgb:00d4aa,g_north,y_180`;
  // 서브텍스트 오버레이
  const subOverlay = subText ? `l_text:Arial_22:${encodeText(subText.substring(0, 60))},co_rgb:888888,g_center,y_60` : "";
  // 하단 태그라인
  const tagOverlay = `l_text:Arial_18:${encodeText("@edgestats_ · Data-driven sports analysis")},co_rgb:505a6a,g_south,y_80`;

  const transforms = [brandOverlay, mainOverlay, subOverlay, tagOverlay].filter(Boolean).join("/");
  const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${bgPublicId}.png`;

  // 3. 이 URL이 유효한지 확인 (Cloudinary가 동적 생성)
  // 하지만 Instagram API는 서버에서 접근 가능한 URL이 필요하므로, 
  // 이 URL을 직접 사용하면 됨 (Cloudinary CDN이므로 공개 접근 가능)

  // 대안: URL 방식이 한글 인코딩 문제가 있을 수 있으므로
  // 직접 이미지를 업로드하는 방식도 병행
  
  // PNG로 직접 업로드 (Canvas 없이 SVG 기반이지만 한글 폰트 포함)
  const timestamp = Math.floor(Date.now() / 1000);
  
  // HTML을 이미지로 변환하는 대신, 심플한 영문+숫자 강조 카드 생성
  // 한글은 제목 부분만 사용하고 나머지는 숫자/영문 데이터로 강조
  const lines = splitText(mainText, 18);
  const captionLines = splitText(subText, 24);

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&amp;display=swap');
      text { font-family: 'Noto Sans KR', 'Arial', sans-serif; }
    </style>
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0a0e13"/>
        <stop offset="100%" style="stop-color:#1a2230"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect x="40" y="40" width="1000" height="1000" rx="24" fill="none" stroke="#00d4aa" stroke-width="2" opacity="0.3"/>
    <text x="540" y="200" text-anchor="middle" font-size="32" font-weight="700" fill="#00d4aa">⚡ EdgeStats</text>
    <line x1="300" y1="240" x2="780" y2="240" stroke="#00d4aa" stroke-width="1" opacity="0.4"/>
    ${lines.map((line, i) => `<text x="540" y="${400 + i * 64}" text-anchor="middle" font-size="44" font-weight="900" fill="#ffffff">${escapeXml(line)}</text>`).join("")}
    ${captionLines.slice(0, 3).map((line, i) => `<text x="540" y="${640 + i * 38}" text-anchor="middle" font-size="22" fill="#8a94a4">${escapeXml(line)}</text>`).join("")}
    <text x="540" y="980" text-anchor="middle" font-size="18" fill="#505a6a">@edgestats_ · Data-driven sports analysis</text>
  </svg>`;

  const svgBase64 = Buffer.from(svgContent).toString("base64");
  const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

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

function splitText(text, maxLen) {
  const lines = [];
  let remaining = text || "";
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { lines.push(remaining); break; }
    let cut = remaining.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    lines.push(remaining.substring(0, cut));
    remaining = remaining.substring(cut).trim();
  }
  return lines;
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
