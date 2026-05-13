import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════
// X (Twitter) API v2 - Post Thread via Vercel Serverless Function
// OAuth 1.0a HMAC-SHA1 서명 직접 구현 (외부 의존성 없음)
// ═══════════════════════════════════════════════════════════════

const X_API_URL = "https://api.twitter.com/2/tweets";

// OAuth 1.0a 서명 생성
function createOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort().map(k => `${encodeRFC3986(k)}=${encodeRFC3986(params[k])}`).join("&");
  const baseString = `${method}&${encodeRFC3986(url)}&${encodeRFC3986(sortedParams)}`;
  const signingKey = `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function buildAuthHeader(consumerKey, token, signature, timestamp, nonce) {
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature: signature,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: "1.0",
  };
  const header = Object.keys(params).sort().map(k => `${encodeRFC3986(k)}="${encodeRFC3986(params[k])}"`).join(", ");
  return `OAuth ${header}`;
}

async function postTweet(text, replyToId = null) {
  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error("X API 키가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = createOAuthSignature("POST", X_API_URL, oauthParams, consumerSecret, accessTokenSecret);
  const authHeader = buildAuthHeader(consumerKey, accessToken, signature, timestamp, nonce);

  const body = { text };
  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }

  const res = await fetch(X_API_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.detail || data?.errors?.[0]?.message || JSON.stringify(data);
    throw new Error(`X API ${res.status}: ${errMsg}`);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════
// Vercel Serverless Handler
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tweets, hashtags } = req.body;

    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return res.status(400).json({ error: "tweets 배열이 필요합니다" });
    }

    const results = [];
    let previousTweetId = null;

    for (let i = 0; i < tweets.length; i++) {
      let text = tweets[i];

      // 마지막 트윗에 해시태그 추가
      if (i === tweets.length - 1 && hashtags?.length > 0) {
        const tags = hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ");
        if (text.length + tags.length + 2 <= 280) {
          text = `${text}\n\n${tags}`;
        }
      }

      // 280자 초과 시 자르기
      if (text.length > 280) {
        text = text.substring(0, 277) + "...";
      }

      const result = await postTweet(text, previousTweetId);
      previousTweetId = result.data?.id;

      results.push({
        index: i + 1,
        id: result.data?.id,
        text: text.substring(0, 50) + "...",
      });

      // Rate limit 대응: 트윗 사이 1초 대기
      if (i < tweets.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return res.status(200).json({
      success: true,
      thread_length: results.length,
      first_tweet_id: results[0]?.id,
      thread_url: results[0]?.id ? `https://x.com/sportsedgestats/status/${results[0].id}` : null,
      results,
    });

  } catch (error) {
    console.error("X posting error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
