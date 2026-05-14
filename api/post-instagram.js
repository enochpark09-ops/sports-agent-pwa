// ═══════════════════════════════════════════════════════════════
// Instagram 자동 포스팅 — Gemini 카드뉴스 생성 + Cloudinary + IG API
// 
// 파이프라인:
// 1. Gemini 2.5 Flash Image로 한글 카드뉴스 이미지 생성
// 2. Cloudinary에 업로드 → 공개 URL 획득
// 3. Instagram Graph API로 자동 포스팅
// ═══════════════════════════════════════════════════════════════

import crypto from "crypto";

const GRAPH_API = "https://graph.facebook.com/v25.0";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

// ── Cloudinary 서명 ──
function generateSignature(params, apiSecret) {
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(signStr + apiSecret).digest("hex");
}

// ── Gemini로 카드뉴스 이미지 생성 ──
async function generateCardWithGemini(cardText, caption) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");

  const prompt = `스포츠 카드뉴스 이미지를 만들어줘.

디자인 요구사항:
- 크기: 1080x1080 정사각형 (인스타그램 피드용)
- 배경: 다크 그라디언트 (진한 남색~검정)
- 스타일: 프로 스포츠 분석 카드뉴스, 모던하고 깔끔한 디자인
- 브랜드: 상단에 "⚡ EdgeStats" 로고 텍스트 (민트색 #00d4aa)
- 하단: "@edgestats_ · Data-driven sports analysis" 작은 텍스트

메인 콘텐츠 (크게, 굵게, 가운데 정렬):
${cardText}

서브 텍스트 (작게, 회색):
${caption ? caption.substring(0, 100) : ""}

디자인 참고: 숫자와 통계는 크게, 팀명은 볼드체로, 전체적으로 프로 스포츠 방송 그래픽 느낌으로.
한글 텍스트를 정확하게 렌더링해주세요.`;

  const res = await fetch(`${GEMINI_API}/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        responseMimeType: "text/plain",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API 오류 (${res.status}): ${err?.error?.message || "Unknown"}`);
  }

  const data = await res.json();

  // 이미지 데이터 추출
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith("image/"));

  if (!imagePart) {
    throw new Error("Gemini가 이미지를 생성하지 못했습니다.");
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}

// ── Cloudinary에 이미지 업로드 ──
async function uploadToCloudinary(imageBase64, mimeType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary 환경변수가 설정되지 않았습니다.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `edgestats/card_${timestamp}`;

  const params = {
    public_id: publicId,
    timestamp: timestamp.toString(),
  };
  const signature = generateSignature(params, apiSecret);

  const dataUri = `data:${mimeType};base64,${imageBase64}`;

  const formData = new URLSearchParams();
  formData.append("file", dataUri);
  formData.append("public_id", publicId);
  formData.append("timestamp", params.timestamp);
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

// ── Instagram 포스팅 ──
async function postToInstagram(imageUrl, caption) {
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;

  if (!accessToken || !igUserId) {
    throw new Error("IG_ACCESS_TOKEN 또는 IG_USER_ID가 설정되지 않았습니다.");
  }

  // 1단계: 미디어 컨테이너 생성
  const createRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken,
    }),
  });

  const createData = await createRes.json();
  if (createData.error) {
    throw new Error(`IG 미디어 생성 실패: ${createData.error.message}`);
  }

  const containerId = createData.id;

  // 컨테이너 상태 확인 (최대 30초 대기)
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
    throw new Error("IG 미디어 처리 중 오류 발생");
  }

  // 2단계: 미디어 발행
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
    throw new Error(`IG 발행 실패: ${publishData.error.message}`);
  }

  return publishData.id;
}

// ═══════════════════════════════════════════════════════════════
// Vercel Handler
// ═══════════════════════════════════════════════════════════════
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

    let finalImageUrl = image_url; // 직접 URL이 있으면 사용

    if (!finalImageUrl) {
      // ── Gemini로 카드뉴스 생성 → Cloudinary 업로드 ──
      const geminiImage = await generateCardWithGemini(
        card_text || caption.substring(0, 80),
        caption
      );
      finalImageUrl = await uploadToCloudinary(geminiImage.base64, geminiImage.mimeType);
    }

    // ── Instagram 포스팅 ──
    const mediaId = await postToInstagram(finalImageUrl, caption);

    return res.status(200).json({
      success: true,
      media_id: mediaId,
      image_url: finalImageUrl,
      message: "카드뉴스 생성 + 인스타그램 포스팅 완료!",
      url: "https://www.instagram.com/edgestats_/",
    });

  } catch (error) {
    console.error("Instagram posting error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
