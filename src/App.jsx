import { useState, useEffect, useRef } from "react";

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

const T = {
  bg: "#0a0e13", surface: "#111820", surface2: "#1a2230",
  border: "#1e2a3a", borderLight: "#2a3a4e",
  text: "#e4e8ee", muted: "#8a94a4", dim: "#505a6a",
  accent: "#00d4aa", accentDim: "#00d4aa18",
  red: "#ff4757", redDim: "#ff475718",
  blue: "#3b82f6", blueDim: "#3b82f618",
  gold: "#f59e0b", goldDim: "#f59e0b18",
  green: "#10b981", mlb: "#e11d48", mlbDim: "#e11d4818",
};

const font = "'Outfit', 'Pretendard', sans-serif";
const mono = "'IBM Plex Mono', monospace";

const SPORTS = [
  { id: "soccer", label: "⚽ 축구", leagues: ["EPL", "라리가", "K리그", "챔피언스리그", "분데스리가", "국가대표"] },
  { id: "baseball", label: "⚾ 야구", leagues: ["MLB", "KBO", "NPB"] },
  { id: "basketball", label: "🏀 농구", leagues: ["NBA", "KBL"] },
  { id: "football", label: "🏈 미식축구", leagues: ["NFL", "NCAA"] },
  { id: "mma", label: "🥊 격투기", leagues: ["UFC", "ONE"] },
  { id: "etc", label: "🎯 기타", leagues: ["테니스", "골프", "F1", "e스포츠"] },
];

const ANALYSIS_TYPES = [
  { id: "preview", label: "📋 프리뷰", desc: "경기 전 분석·예측", icon: "📋" },
  { id: "review", label: "📊 리뷰", desc: "경기 후 하이라이트·분석", icon: "📊" },
  { id: "stats", label: "📈 통계 심층", desc: "선수·팀 데이터 분석", icon: "📈" },
  { id: "shorts", label: "🎬 쇼츠 대본", desc: "60초 숏폼 스크립트", icon: "🎬" },
  { id: "column", label: "✍️ 칼럼", desc: "시사·논평·에세이", icon: "✍️" },
];

async function callClaude(messages, system, maxTokens = 2000, model = SONNET) {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const localKey = localStorage.getItem("dy_sports_api_key") || "";
  const apiKey = envKey || localKey;
  if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.\n설정 탭에서 직접 입력하거나\nVercel 환경변수(VITE_ANTHROPIC_API_KEY)를 추가 후 Redeploy 하세요.");
  
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, tools: [{ type: "web_search_20250305", name: "web_search" }] }),
    });
  } catch (networkErr) {
    throw new Error(`네트워크 오류: ${networkErr.message}\n\n인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요.\n\nAPI Key 소스: ${envKey ? "환경변수" : localKey ? "설정탭" : "없음"}`);
  }
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    throw new Error(`API 오류 (${res.status}): ${errMsg}`);
  }
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

// 이미지 포함 Claude API 호출
async function callClaudeWithImage(imageBase64, imageType, textPrompt, system, maxTokens = 4000, model = SONNET) {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const localKey = localStorage.getItem("dy_sports_api_key") || "";
  const apiKey = envKey || localKey;
  if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.");

  const messages = [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: imageType, data: imageBase64 } },
      { type: "text", text: textPrompt },
    ],
  }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`API 오류 (${res.status}): ${err?.error?.message || `HTTP ${res.status}`}`);
  }
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

function Chip({ children, active, onClick, color = T.accent }) {
  return (<button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontFamily: font, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? color : T.border}`, background: active ? `${color}18` : "transparent", color: active ? color : T.muted, transition: "all 0.15s" }}>{children}</button>);
}
function Btn({ children, onClick, disabled, color = T.accent, full, small }) {
  return (<button onClick={onClick} disabled={disabled} style={{ padding: small ? "8px 14px" : "12px 20px", borderRadius: 8, fontSize: small ? 11 : 13, fontFamily: font, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", border: "none", width: full ? "100%" : "auto", background: disabled ? T.surface2 : color, color: disabled ? T.dim : "#000", opacity: disabled ? 0.5 : 1, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{children}</button>);
}

// X 자동 포스팅 함수
async function postToX(tweets, hashtags) {
  const res = await fetch("/api/post-x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tweets, hashtags }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "X 포스팅 실패");
  return data;
}

// X 포스팅 버튼 컴포넌트
function PostToXBtn({ tweets, hashtags }) {
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [result, setResult] = useState(null);

  const handlePost = async () => {
    if (!tweets?.length) return;
    if (!confirm(`X에 ${tweets.length}개 트윗 스레드를 포스팅할까요?`)) return;
    setStatus("loading");
    try {
      const data = await postToX(tweets, hashtags);
      setStatus("success");
      setResult(data);
      setTimeout(() => setStatus("idle"), 5000);
    } catch (e) {
      setStatus("error");
      setResult({ error: e.message });
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const colors = {
    idle: { bg: `${T.text}18`, border: `${T.text}44`, text: T.text },
    loading: { bg: `${T.blue}18`, border: `${T.blue}44`, text: T.blue },
    success: { bg: `${T.green}18`, border: `${T.green}44`, text: T.green },
    error: { bg: `${T.red}18`, border: `${T.red}44`, text: T.red },
  };
  const c = colors[status];

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={handlePost} disabled={status === "loading"} style={{
        width: "100%", padding: "10px 0", borderRadius: 8, fontSize: 12,
        fontFamily: font, fontWeight: 700, cursor: status === "loading" ? "not-allowed" : "pointer",
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        {status === "idle" && <>𝕏 X에 바로 포스팅</>}
        {status === "loading" && <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> 포스팅 중...</>}
        {status === "success" && <>✅ 포스팅 완료!</>}
        {status === "error" && <>❌ 실패 — 탭하여 재시도</>}
      </button>
      {status === "success" && result?.thread_url && (
        <a href={result.thread_url} target="_blank" rel="noopener noreferrer" style={{
          display: "block", textAlign: "center", fontSize: 11, color: T.accent,
          marginTop: 6, fontFamily: mono,
        }}>🔗 스레드 확인하기 →</a>
      )}
      {status === "error" && result?.error && (
        <div style={{ fontSize: 10, color: T.red, marginTop: 4, textAlign: "center" }}>{result.error}</div>
      )}
    </div>
  );
}

// 네이버 블로그 포스팅 버튼 컴포넌트
function PostToNaverBtn({ title, body, tags }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  const getNaverToken = () => localStorage.getItem("naver_access_token") || "";

  const handleLogin = () => {
    window.location.href = "/api/naver-login";
  };

  const handlePost = async () => {
    const token = getNaverToken();
    if (!token) {
      if (confirm("네이버 로그인이 필요합니다. 로그인 하시겠습니까?")) {
        handleLogin();
      }
      return;
    }
    if (!confirm("네이버 블로그에 글을 게시할까요?")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/post-naver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, contents: body, tags, accessToken: token }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "포스팅 실패");
      setStatus("success");
      setResult(data);
      setTimeout(() => setStatus("idle"), 5000);
    } catch (e) {
      setStatus("error");
      setResult({ error: e.message });
      // 토큰 만료 시 재로그인 안내
      if (e.message.includes("401") || e.message.includes("token")) {
        localStorage.removeItem("naver_access_token");
      }
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const naverGreen = "#03C75A";
  const colors = {
    idle: { bg: `${naverGreen}18`, border: `${naverGreen}44`, text: naverGreen },
    loading: { bg: `${T.blue}18`, border: `${T.blue}44`, text: T.blue },
    success: { bg: `${T.green}18`, border: `${T.green}44`, text: T.green },
    error: { bg: `${T.red}18`, border: `${T.red}44`, text: T.red },
  };
  const c = colors[status];

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={handlePost} disabled={status === "loading"} style={{
        width: "100%", padding: "10px 0", borderRadius: 8, fontSize: 12,
        fontFamily: font, fontWeight: 700, cursor: status === "loading" ? "not-allowed" : "pointer",
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        {status === "idle" && <>📝 네이버 블로그에 바로 포스팅</>}
        {status === "loading" && <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> 포스팅 중...</>}
        {status === "success" && <>✅ 포스팅 완료!</>}
        {status === "error" && <>❌ 실패 — 탭하여 재시도</>}
      </button>
      {status === "success" && result?.url && (
        <a href={result.url} target="_blank" rel="noopener noreferrer" style={{
          display: "block", textAlign: "center", fontSize: 11, color: T.accent, marginTop: 6, fontFamily: mono,
        }}>🔗 블로그 글 확인하기 →</a>
      )}
      {status === "error" && result?.error && (
        <div style={{ fontSize: 10, color: T.red, marginTop: 4, textAlign: "center" }}>{result.error}</div>
      )}
      {!getNaverToken() && status === "idle" && (
        <div onClick={handleLogin} style={{
          fontSize: 10, color: T.muted, marginTop: 6, textAlign: "center", cursor: "pointer",
          textDecoration: "underline",
        }}>🔑 네이버 로그인이 필요합니다 (클릭)</div>
      )}
    </div>
  );
}

// 인스타그램 포스팅 버튼 (이미지 파일 업로드 → Cloudinary → IG 포스팅)
function PostToInstagramBtn({ caption, hashtags, cardText }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const igFileRef = useRef(null);

  const fullCaption = `${caption || ""}${hashtags?.length ? "\n\n" + hashtags.map(h => `#${h.replace(/^#/,"")}`).join(" ") : ""}`;

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!imageFile) {
      alert("카드뉴스 이미지를 선택해주세요.\n\n1. gemini.google.com에서 카드뉴스 생성\n2. 이미지 다운로드\n3. 여기서 파일 선택");
      return;
    }
    if (!confirm("인스타그램에 포스팅할까요?")) return;
    setStatus("loading");
    try {
      // 이미지를 base64로 변환 → 서버로 전송
      const base64 = imagePreview.split(",")[1];
      const mimeType = imageFile.type || "image/png";

      const res = await fetch("/api/post-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: fullCaption,
          card_text: cardText || "",
          image_base64: base64,
          image_type: mimeType,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "포스팅 실패");
      setStatus("success");
      setResult(data);
      setTimeout(() => setStatus("idle"), 5000);
    } catch (e) {
      setStatus("error");
      setResult({ error: e.message });
      setTimeout(() => setStatus("idle"), 8000);
    }
  };

  const igPink = "#E1306C";
  const colors = {
    idle: { bg: `${igPink}18`, border: `${igPink}44`, text: igPink },
    loading: { bg: `${T.blue}18`, border: `${T.blue}44`, text: T.blue },
    success: { bg: `${T.green}18`, border: `${T.green}44`, text: T.green },
    error: { bg: `${T.red}18`, border: `${T.red}44`, text: T.red },
  };
  const c = colors[status];

  return (
    <div style={{ marginTop: 8 }}>
      <input ref={igFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} style={{ display: "none" }} />

      {/* 이미지 선택 */}
      <button onClick={() => igFileRef.current?.click()} style={{
        width: "100%", padding: "10px", borderRadius: 8, fontSize: 11, marginBottom: 6,
        fontFamily: font, fontWeight: 600, cursor: "pointer",
        border: `1.5px dashed ${imagePreview ? igPink : T.border}`,
        background: imagePreview ? `${igPink}10` : "transparent",
        color: imagePreview ? igPink : T.dim,
      }}>{imagePreview ? "📷 다른 이미지 선택" : "📷 카드뉴스 이미지 선택 (재미나이에서 다운로드한 파일)"}</button>

      {imagePreview && (
        <div style={{ marginBottom: 6, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
          <img src={imagePreview} alt="card" style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
        </div>
      )}

      <button onClick={handlePost} disabled={status === "loading" || !imageFile} style={{
        width: "100%", padding: "10px 0", borderRadius: 8, fontSize: 12,
        fontFamily: font, fontWeight: 700,
        cursor: (status === "loading" || !imageFile) ? "not-allowed" : "pointer",
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        opacity: !imageFile && status === "idle" ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        {status === "idle" && <>📸 Cloudinary 업로드 + 인스타 포스팅</>}
        {status === "loading" && <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> 업로드 → 포스팅 중...</>}
        {status === "success" && <>✅ 포스팅 완료!</>}
        {status === "error" && <>❌ 실패 — 탭하여 재시도</>}
      </button>
      {status === "success" && result?.url && (
        <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", fontSize: 11, color: T.accent, marginTop: 6, fontFamily: mono }}>🔗 인스타그램 확인하기 →</a>
      )}
      {status === "error" && result?.error && (
        <div style={{ fontSize: 10, color: T.red, marginTop: 4, textAlign: "center" }}>{result.error}</div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (<div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>{children}</div>);
}

// 객체를 안전하게 문자열로 변환 (React 렌더링용)
function safeStr(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // 배열이면 join
    if (Array.isArray(val)) return val.join(", ");
    // 객체면 key:value 나열
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(" / ");
  }
  return String(val);
}
function CopyBtn({ text, label = "복사" }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (<button onClick={copy} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, fontFamily: mono, color: copied ? T.green : T.muted, cursor: "pointer" }}>{copied ? "✓ 복사됨" : `📋 ${label}`}</button>);
}
function TagList({ tags }) {
  if (!tags?.length) return null;
  return (<div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{tags.map((t, i) => (<span key={i} style={{ fontSize: 10, fontFamily: mono, padding: "3px 8px", borderRadius: 4, background: T.surface2, color: T.blue }}>#{t}</span>))}</div>);
}
function ChannelCard({ icon, label, color, expanded, onToggle, copyText, children }) {
  return (
    <div style={{ marginBottom: 8, borderRadius: 10, overflow: "hidden", border: `1px solid ${expanded ? color + "44" : T.border}`, transition: "border-color 0.2s" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", background: expanded ? `${color}0a` : T.surface, transition: "background 0.15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: expanded ? color : T.text }}>{label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {expanded && <CopyBtn text={copyText} label="전체 복사" />}
          <span style={{ fontSize: 14, color: T.dim, transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>→</span>
        </div>
      </div>
      {expanded && <div style={{ padding: "14px 16px", background: T.surface }}>{children}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1: 🇰🇷 MLB 한국인 데일리 리포트
// ══════════════════════════════════════════════════════════════

function MLBKoreanTab({ onSave }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [customDate, setCustomDate] = useState("");

  const todayStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const SYSTEM = `당신은 MLB 전문 스포츠 기자이자 SNS 콘텐츠 크리에이터입니다.

**임무:** 현재 MLB 25인 로스터(또는 26인 확장 로스터)에 등록된 한국인 선수들의 최신 경기 성적을 웹 검색으로 조사하고, 3개 채널(유튜브 쇼츠, 인스타그램, X/트위터)용 포스팅을 한 번에 생성합니다.

**현재 MLB 활동 한국인 선수 (2025시즌 기준):**
- 김혜성 (미네소타 트윈스)
- 이정후 (샌프란시스코 자이언츠)
- 배지환 (세인트루이스 카디널스 또는 현재 소속팀)
- 김하성 (현재 소속팀 확인)
- 송성문 (현재 소속팀 확인)

**제외 선수 (MLB에서 뛰고 있지 않음):**
- 류현진 (KBO 복귀) — 절대 포함하지 마세요
- 김광현 (KBO 복귀) — 절대 포함하지 마세요
- 김도영 (KBO 소속) — 절대 포함하지 마세요

웹 검색 시 위 제외 선수가 나오면 무시하세요. MLB 로스터에 없는 선수는 포함하지 마세요.

**날짜/시간 규칙:**
- MLB 경기 날짜는 반드시 **미국 동부시간(ET)** 기준으로 표시하세요
- date 필드에 "(ET)" 표기를 추가하세요 (예: "2026년 5월 12일 (ET)")
- 한국시간과 미국시간이 다르므로 혼동하지 마세요

**반드시 웹 검색으로 확인할 것:**
1. 지정된 날짜의 MLB 경기에 출전한 한국인 선수 탐색 (위 목록 기준)
2. 각 선수의 당일 성적 (타율, 안타, 홈런, 타점, 투구이닝, 삼진, 자책점 등)
3. 시즌 누적 성적
4. 팀 경기 결과 (스코어)

**출력 형식 — 반드시 아래 JSON만 출력. 설명 문장 금지:**

\`\`\`json
{
  "date": "날짜 (ET)",
  "players": [
    {
      "name": "선수명",
      "team": "팀명",
      "position": "포지션",
      "game_result": "팀 승패 스코어",
      "today_stats": "당일 성적 요약",
      "season_stats": "시즌 누적 지표",
      "highlight": "하이라이트 한줄"
    }
  ],
  "no_game_players": ["경기 없는 선수명"],
  "youtube_shorts": {
    "title": "제목 15자 내외",
    "hook": "첫 3초 훅",
    "script": "60초 TTS 대본",
    "hashtags": ["태그1", "태그2"],
    "thumbnail_concept": "썸네일 컨셉"
  },
  "instagram": {
    "caption": "캡션 300자 이모지 포함",
    "hashtags": ["태그1", "태그2"],
    "card_text": "카드뉴스 메인 50자"
  },
  "x_thread": {
    "tweets": ["트윗1", "트윗2", "트윗3"],
    "hashtags": ["태그1", "태그2"]
  },
  "summary": "한줄 총평"
}
\`\`\`

한국어. 성적 좋으면 축하, 부진하면 응원 톤.

⚠️ 중요: 반드시 \`\`\`json 으로 시작하는 JSON 코드블록만 출력하세요. JSON 앞뒤에 설명, 인사말, 분석 텍스트를 절대 넣지 마세요. 오직 JSON만 출력하세요.`;

  const generate = async () => {
    setLoading(true); setResult(null); setExpandedChannel(null);
    try {
      // ── 1단계: MLB Stats API로 정확한 데이터 수집 ──
      const dateParam = customDate
        ? (() => {
            const m = customDate.match(/(\d{1,2})월\s*(\d{1,2})일?/);
            if (m) { const yr = new Date().getFullYear(); return `${yr}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; }
            return customDate;
          })()
        : new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString().split("T")[0]; // 한국시간 기준 전날 미국 날짜

      const mlbRes = await fetch(`/api/mlb-stats?date=${dateParam}`);
      const mlbData = await mlbRes.json();

      if (!mlbData.success) throw new Error(mlbData.error || "MLB 데이터 수집 실패");

      // ── 2단계: 수집된 데이터를 AI에게 전달 → 3채널 콘텐츠 생성 ──
      const playerDataText = mlbData.players.length > 0
        ? mlbData.players.map(p =>
            `[${p.name}] ${p.team} / ${p.position}\n경기결과: ${p.game_result}\n당일성적: ${p.today_stats}\n시즌성적: ${p.season_stats}`
          ).join("\n\n")
        : "오늘 출전한 한국인 선수가 없습니다.";

      const noGameText = mlbData.no_game_players.length > 0
        ? `경기 없는 선수: ${mlbData.no_game_players.join(", ")}`
        : "";

      const CONTENT_SYSTEM = `당신은 스포츠 SNS 콘텐츠 크리에이터입니다.
아래 제공된 MLB 한국인 선수 실제 경기 데이터를 바탕으로 3채널 포스팅을 생성하세요.
데이터는 MLB 공식 API에서 가져온 정확한 수치입니다. 절대 수치를 변경하거나 지어내지 마세요.

⚠️ 반드시 \`\`\`json 코드블록만 출력하세요. 설명 텍스트 금지.

\`\`\`json
{
  "date": "${dateParam} (ET)",
  "players": [선수별 { name, team, position, game_result, today_stats, season_stats, highlight } 배열],
  "no_game_players": [${JSON.stringify(mlbData.no_game_players)}],
  "youtube_shorts": { "title": "15자", "hook": "첫3초", "script": "60초TTS대본", "hashtags": [], "thumbnail_concept": "" },
  "instagram": { "caption": "300자이모지", "hashtags": [], "card_text": "50자" },
  "x_thread": { "tweets": ["280자이내트윗1","트윗2","트윗3"], "hashtags": [] },
  "summary": "한줄총평"
}
\`\`\`
한국어. 성적 좋으면 축하, 부진하면 응원.`;

      const raw = await callClaude(
        [{ role: "user", content: `MLB 한국인 선수 ${dateParam}(ET) 경기 데이터입니다. 이 데이터를 바탕으로 3채널 콘텐츠를 만들어주세요.

=== 선수별 성적 (MLB 공식 데이터) ===
${playerDataText}

${noGameText}

위 수치를 정확히 사용해서 유튜브 쇼츠 대본, 인스타그램, X 스레드를 생성해주세요.` }],
        CONTENT_SYSTEM, 4000, SONNET
      );

      let parsed;
      try {
        const codeBlock = raw.match(/```json\s*([\s\S]*?)```/);
        if (codeBlock) { parsed = JSON.parse(codeBlock[1].trim()); }
        else { const f = raw.indexOf("{"), l = raw.lastIndexOf("}"); parsed = (f !== -1 && l > f) ? JSON.parse(raw.substring(f, l + 1)) : { raw, parseError: true }; }
      } catch { parsed = { raw, parseError: true }; }

      // MLB API 원본 데이터도 저장
      if (parsed && !parsed.parseError) {
        parsed._mlbApiData = { date: dateParam, players: mlbData.players, no_game_players: mlbData.no_game_players };
      }

      setResult(parsed);
      const entry = { id: Date.now(), type: "mlb_korean", date: new Date().toISOString(), data: parsed };
      const history = JSON.parse(localStorage.getItem("dy_sports_history") || "[]");
      history.unshift(entry);
      if (history.length > 50) history.pop();
      localStorage.setItem("dy_sports_history", JSON.stringify(history));
      if (onSave) onSave();
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  const toggle = (ch) => setExpandedChannel(expandedChannel === ch ? null : ch);

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Header */}
      <div style={{ padding: 18, background: T.surface, borderRadius: 12, border: `1px solid ${T.mlb}30`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>🇰🇷</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>MLB 한국인 데일리 리포트</div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: mono }}>{todayStr}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>
          한국인 선수 전원의 당일 성적 자동 수집 → 유튜브 쇼츠 · 인스타그램 · X 스레드 3채널 포스팅 한 번에 생성
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input type="text" value={customDate} onChange={e => setCustomDate(e.target.value)} placeholder="날짜 지정 (예: 5월 12일, 비우면 오늘)" style={{ flex: 1, padding: "9px 12px", borderRadius: 6, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none" }} />
        </div>
        <Btn onClick={generate} disabled={loading} color={T.mlb} full>
          {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚾</span> 선수 성적 수집 중...</> : <>⚾ 오늘의 리포트 생성</>}
        </Btn>
      </div>

      {result?.error && <div style={{ padding: 14, background: T.redDim, borderRadius: 10, border: `1px solid ${T.red}33`, fontSize: 12, color: T.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>❌ {result.error}</div>}

      {result?.parseError && (
        <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><SectionLabel>RAW RESULT</SectionLabel><CopyBtn text={result.raw} /></div>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.9, fontFamily: font, whiteSpace: "pre-wrap" }}>{result.raw}</div>
        </div>
      )}

      {result && !result.error && !result.parseError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {result.summary && <div style={{ padding: "12px 16px", background: T.accentDim, borderRadius: 8, border: `1px solid ${T.accent}25`, fontSize: 13, fontWeight: 600, color: T.accent }}>💬 {safeStr(result.summary)}</div>}

          {result.players?.length > 0 && (
            <div>
              <SectionLabel>선수별 성적 · {result.players.length}명</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {result.players.map((p, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{safeStr(p.name)}</span>
                      <span style={{ fontSize: 9, fontFamily: mono, padding: "2px 7px", borderRadius: 4, background: T.blueDim, color: T.blue }}>{safeStr(p.team)}</span>
                      <span style={{ fontSize: 9, fontFamily: mono, padding: "2px 7px", borderRadius: 4, background: T.surface2, color: T.dim }}>{safeStr(p.position)}</span>
                    </div>
                    {p.game_result && <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>🏟️ {safeStr(p.game_result)}</div>}
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4 }}>📊 {safeStr(p.today_stats)}</div>
                    {p.season_stats && <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>📈 시즌: {safeStr(p.season_stats)}</div>}
                    {p.highlight && <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, padding: "4px 8px", background: T.goldDim, borderRadius: 4, display: "inline-block" }}>⭐ {safeStr(p.highlight)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.no_game_players?.length > 0 && <div style={{ padding: "10px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 11, color: T.dim }}>🚫 오늘 경기 없음: {result.no_game_players.join(", ")}</div>}

          {/* 3 Channel Postings */}
          <div style={{ marginTop: 4 }}>
            <SectionLabel>3채널 포스팅</SectionLabel>

            {result.youtube_shorts && (
              <ChannelCard icon="▶️" label="YouTube Shorts" color={T.red} expanded={expandedChannel === "yt"} onToggle={() => toggle("yt")}
                copyText={`${result.youtube_shorts.title}\n\n${result.youtube_shorts.script}\n\n${(result.youtube_shorts.hashtags || []).map(h => `#${h}`).join(" ")}`}>
                <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>TITLE</div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{result.youtube_shorts.title}</div></div>
                <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>HOOK</div><div style={{ fontSize: 13, color: T.gold, fontWeight: 600, padding: "8px 12px", background: T.goldDim, borderRadius: 6 }}>{result.youtube_shorts.hook}</div></div>
                <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>SCRIPT (60초)</div><div style={{ fontSize: 12, color: T.text, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{result.youtube_shorts.script}</div></div>
                {result.youtube_shorts.thumbnail_concept && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>THUMBNAIL</div><div style={{ fontSize: 11, color: T.muted }}>{result.youtube_shorts.thumbnail_concept}</div></div>}
                <TagList tags={result.youtube_shorts.hashtags} />
              </ChannelCard>
            )}

            {result.instagram && (
              <ChannelCard icon="📸" label="Instagram" color="#E1306C" expanded={expandedChannel === "ig"} onToggle={() => toggle("ig")}
                copyText={`${result.instagram.caption}\n\n${(result.instagram.hashtags || []).map(h => `#${h}`).join(" ")}`}>
                {result.instagram.card_text && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CARD TEXT</div><div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: 14, background: T.surface2, borderRadius: 8, textAlign: "center", lineHeight: 1.5 }}>{result.instagram.card_text}</div></div>}
                <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CAPTION</div><div style={{ fontSize: 12, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.instagram.caption}</div></div>
                <TagList tags={result.instagram.hashtags} />
                <PostToInstagramBtn caption={result.instagram.caption} hashtags={result.instagram.hashtags} cardText={result.instagram.card_text} />
              </ChannelCard>
            )}

            {result.x_thread && (
              <ChannelCard icon="𝕏" label="X Thread" color={T.text} expanded={expandedChannel === "x"} onToggle={() => toggle("x")}
                copyText={(result.x_thread.tweets || []).map((t, i) => `${i + 1}/${result.x_thread.tweets.length} ${t}`).join("\n\n")}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 8 }}>THREAD · {result.x_thread.tweets?.length}트윗</div>
                  {(result.x_thread.tweets || []).map((tweet, i) => (
                    <div key={i} style={{ padding: "10px 14px", marginBottom: 6, background: T.surface2, borderRadius: 8, borderLeft: `3px solid ${i === 0 ? T.accent : T.border}` }}>
                      <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, marginBottom: 4 }}>{i + 1}/{result.x_thread.tweets.length}</div>
                      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7 }}>{tweet}</div>
                    </div>
                  ))}
                </div>
                <TagList tags={result.x_thread.hashtags} />
                <PostToXBtn tweets={result.x_thread.tweets} hashtags={result.x_thread.hashtags} />
              </ChannelCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2: ⚡ 분석
// ══════════════════════════════════════════════════════════════

function AnalysisTab({ onSave, preset }) {
  // preset이 있으면 종목/리그 고정, 없으면 자유 선택
  const fixedSport = preset?.sport || null;
  const fixedLeagues = preset?.leagues || null;
  const [sport, setSport] = useState(fixedSport || "soccer");
  const [league, setLeague] = useState("");
  const [matchInfo, setMatchInfo] = useState("");
  const [analysisType, setAnalysisType] = useState("preview");
  const [extra, setExtra] = useState("");
  const [channels, setChannels] = useState({ blog: true, x: false, ig: false });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const sel = fixedSport ? { id: fixedSport, label: SPORTS.find(s => s.id === fixedSport)?.label || fixedSport, leagues: fixedLeagues || SPORTS.find(s => s.id === fixedSport)?.leagues || [] } : SPORTS.find(s => s.id === sport);

  const toggleChannel = (ch) => setChannels(prev => ({ ...prev, [ch]: !prev[ch] }));
  const selectedCount = Object.values(channels).filter(Boolean).length;

  const channelLabels = { blog: "📝 네이버 블로그", x: "𝕏 X 스레드", ig: "📸 인스타그램" };
  const channelColors = { blog: "#03C75A", x: T.text, ig: "#E1306C" };

  const buildSystemPrompt = () => {
    const parts = [];
    parts.push(`당신은 전문 스포츠 분석가이자 SNS 콘텐츠 크리에이터입니다.

**임무:** 주어진 스포츠 경기/주제를 웹 검색으로 조사하고, 선택된 채널용 콘텐츠를 생성합니다.

**분석 유형별 톤:**
- 프리뷰: 경기 전 전술 분석, 예측, 관전 포인트
- 리뷰: 경기 후 하이라이트, MOM, 핵심 통계
- 통계 심층: 데이터 기반 인사이트, 비교 분석
- 쇼츠 대본: 60초 숏폼 스크립트 (TTS용 구어체)
- 칼럼: 논평, 시사 에세이

**반드시 웹 검색으로 최신 정보를 확인한 후 작성하세요.**

⚠️ 반드시 \\\`\\\`\\\`json 코드블록만 출력하세요. 설명 텍스트 금지.

\\\`\\\`\\\`json
{
  "title": "콘텐츠 제목 (문자열)",
  "summary": "한줄 총평 (문자열)"`);

    if (channels.blog) {
      parts.push(`,
  "naver_blog": {
    "title": "블로그 제목 SEO 최적화 (문자열)",
    "body": "블로그 본문 1500-2500자, 소제목 ■ 기호, 줄바꿈은 \\\\n (문자열)",
    "tags": ["태그1", "태그2"],
    "thumbnail_concept": "대표 이미지 컨셉 (문자열)"
  }`);
    }
    if (channels.x) {
      parts.push(`,
  "x_thread": {
    "tweets": ["트윗1 280자이내 (문자열)", "트윗2", "트윗3"],
    "hashtags": ["태그1", "태그2"]
  }`);
    }
    if (channels.ig) {
      parts.push(`,
  "instagram": {
    "caption": "캡션 300자 이모지 포함 (문자열)",
    "hashtags": ["태그1", "태그2"],
    "card_text": "카드뉴스 메인 50자 (문자열)"
  }`);
    }

    parts.push(`
}
\\\`\\\`\\\`

한국어 작성. 모든 값은 반드시 문자열(string)로. 객체 금지.`);

    return parts.join("");
  };

  const typeLabels = { preview: "프리뷰", review: "리뷰", stats: "통계 심층", shorts: "쇼츠 대본", column: "칼럼" };

  const generate = async () => {
    if (!matchInfo.trim() || selectedCount === 0) return;
    setLoading(true); setResult(null); setExpandedChannel(null);
    try {
      const chNames = Object.entries(channels).filter(([,v]) => v).map(([k]) => channelLabels[k]).join(" + ");
      const prompt = `종목: ${sel?.label || sport}
리그: ${league || "미지정"}
경기/주제: ${matchInfo}
분석 유형: ${typeLabels[analysisType]}
생성 채널: ${chNames}
${extra ? `추가 요청: ${extra}` : ""}

위 정보를 바탕으로 웹 검색 후 콘텐츠를 생성해주세요.`;

      const raw = await callClaude(
        [{ role: "user", content: prompt }],
        buildSystemPrompt(), 4000, analysisType === "shorts" ? HAIKU : SONNET
      );

      let parsed;
      try {
        const codeBlock = raw.match(/```json\s*([\s\S]*?)```/);
        if (codeBlock) { parsed = JSON.parse(codeBlock[1].trim()); }
        else { const f = raw.indexOf("{"), l = raw.lastIndexOf("}"); parsed = (f !== -1 && l > f) ? JSON.parse(raw.substring(f, l + 1)) : { raw, parseError: true }; }
      } catch { parsed = { raw, parseError: true }; }

      setResult(parsed);

      const entry = { id: Date.now(), type: "analysis_3ch", sport, league, matchInfo, analysisType, channels, data: parsed, date: new Date().toISOString() };
      const h = JSON.parse(localStorage.getItem("dy_sports_history") || "[]");
      h.unshift(entry);
      if (h.length > 50) h.pop();
      localStorage.setItem("dy_sports_history", JSON.stringify(h));
      if (onSave) onSave();
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  const toggle = (ch) => setExpandedChannel(expandedChannel === ch ? null : ch);

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Sport - preset이 없을 때만 표시 */}
      {!fixedSport && <div style={{ marginBottom: 16 }}><SectionLabel>SPORT</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{SPORTS.map(s => <Chip key={s.id} active={sport === s.id} onClick={() => { setSport(s.id); setLeague(""); }}>{s.label}</Chip>)}</div></div>}
      {/* League */}
      {sel && sel.leagues.length > 0 && !fixedSport && <div style={{ marginBottom: 16 }}><SectionLabel>LEAGUE</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{sel.leagues.map(l => <Chip key={l} active={league === l} onClick={() => setLeague(league === l ? "" : l)} color={T.blue}>{l}</Chip>)}</div></div>}
      {/* League - preset이 있고 리그가 여러개면 선택 가능 */}
      {fixedSport && fixedLeagues && fixedLeagues.length > 1 && <div style={{ marginBottom: 16 }}><SectionLabel>LEAGUE</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{fixedLeagues.map(l => <Chip key={l} active={league === l} onClick={() => setLeague(league === l ? "" : l)} color={T.blue}>{l}</Chip>)}</div></div>}
      {/* Type */}
      <div style={{ marginBottom: 16 }}><SectionLabel>TYPE</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ANALYSIS_TYPES.map(a => <Chip key={a.id} active={analysisType === a.id} onClick={() => setAnalysisType(a.id)} color={T.gold}>{a.icon} {a.label.replace(/^.+ /,"")}</Chip>)}</div></div>
      {/* Match */}
      <div style={{ marginBottom: 12 }}><SectionLabel>MATCH / TOPIC</SectionLabel><input value={matchInfo} onChange={e => setMatchInfo(e.target.value)} placeholder="예: 맨시티 vs 아스널, 손흥민 시즌 분석" style={{ width: "100%", padding: "12px 14px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: font, outline: "none" }} /></div>
      {/* Extra */}
      <div style={{ marginBottom: 16 }}><SectionLabel>EXTRA</SectionLabel><textarea value={extra} onChange={e => setExtra(e.target.value)} placeholder="추가 요청..." rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none", resize: "none" }} /></div>

      {/* Channel Select */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>CHANNEL (선택)</SectionLabel>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(channelLabels).map(([k, label]) => (
            <button key={k} onClick={() => toggleChannel(k)} style={{
              flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 11,
              fontFamily: font, fontWeight: 600, cursor: "pointer",
              border: `1.5px solid ${channels[k] ? channelColors[k] : T.border}`,
              background: channels[k] ? `${channelColors[k]}15` : "transparent",
              color: channels[k] ? channelColors[k] : T.dim,
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>
        {selectedCount === 0 && <div style={{ fontSize: 10, color: T.red, marginTop: 6 }}>최소 1개 채널을 선택하세요</div>}
      </div>

      <Btn onClick={generate} disabled={loading || !matchInfo.trim() || selectedCount === 0} full>
        {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚡</span> 콘텐츠 생성 중...</> : <>⚡ {selectedCount}채널 분석 생성</>}
      </Btn>

      {/* Error */}
      {result?.error && <div style={{ marginTop: 12, padding: 14, background: T.redDim, borderRadius: 10, border: `1px solid ${T.red}33`, fontSize: 12, color: T.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>❌ {result.error}</div>}

      {/* Raw fallback */}
      {result?.parseError && (
        <div style={{ marginTop: 12, padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><SectionLabel>RAW RESULT</SectionLabel><CopyBtn text={result.raw} /></div>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.9, fontFamily: font, whiteSpace: "pre-wrap" }}>{result.raw}</div>
        </div>
      )}

      {/* Structured Result */}
      {result && !result.error && !result.parseError && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {result.title && <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{safeStr(result.title)}</div>}
          {result.summary && <div style={{ padding: "12px 16px", background: T.accentDim, borderRadius: 8, border: `1px solid ${T.accent}25`, fontSize: 13, fontWeight: 600, color: T.accent }}>💬 {safeStr(result.summary)}</div>}

          <SectionLabel>채널별 포스팅</SectionLabel>

          {/* Naver Blog */}
          {result.naver_blog && (
            <ChannelCard icon="📝" label="네이버 블로그" color="#03C75A" expanded={expandedChannel === "blog"} onToggle={() => toggle("blog")}
              copyText={`${safeStr(result.naver_blog.title)}\n\n${safeStr(result.naver_blog.body)}\n\n${(result.naver_blog.tags || []).map(h => `#${h}`).join(" ")}`}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>TITLE (SEO)</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{safeStr(result.naver_blog.title)}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>BODY</div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 2, whiteSpace: "pre-wrap", padding: "14px", background: T.surface2, borderRadius: 8, maxHeight: 400, overflowY: "auto" }}>{safeStr(result.naver_blog.body)}</div>
              </div>
              {result.naver_blog.thumbnail_concept && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>THUMBNAIL</div><div style={{ fontSize: 11, color: T.muted }}>{safeStr(result.naver_blog.thumbnail_concept)}</div></div>}
              <TagList tags={result.naver_blog.tags} />
            </ChannelCard>
          )}

          {/* X Thread */}
          {result.x_thread && (
            <ChannelCard icon="𝕏" label="X Thread" color={T.text} expanded={expandedChannel === "x"} onToggle={() => toggle("x")}
              copyText={(result.x_thread.tweets || []).map((t, i) => `${i + 1}/${result.x_thread.tweets.length} ${safeStr(t)}`).join("\n\n")}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 8 }}>THREAD · {result.x_thread.tweets?.length}트윗</div>
                {(result.x_thread.tweets || []).map((tweet, i) => (
                  <div key={i} style={{ padding: "10px 14px", marginBottom: 6, background: T.surface2, borderRadius: 8, borderLeft: `3px solid ${i === 0 ? T.accent : T.border}` }}>
                    <div style={{ fontSize: 9, color: T.dim, fontFamily: mono, marginBottom: 4 }}>{i + 1}/{result.x_thread.tweets.length}</div>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7 }}>{safeStr(tweet)}</div>
                  </div>
                ))}
              </div>
              <TagList tags={result.x_thread.hashtags} />
              <PostToXBtn tweets={result.x_thread.tweets} hashtags={result.x_thread.hashtags} />
            </ChannelCard>
          )}

          {/* Instagram */}
          {result.instagram && (
            <ChannelCard icon="📸" label="Instagram" color="#E1306C" expanded={expandedChannel === "ig"} onToggle={() => toggle("ig")}
              copyText={`${safeStr(result.instagram.caption)}\n\n${(result.instagram.hashtags || []).map(h => `#${h}`).join(" ")}`}>
              {result.instagram.card_text && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CARD TEXT</div><div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: 14, background: T.surface2, borderRadius: 8, textAlign: "center", lineHeight: 1.5 }}>{safeStr(result.instagram.card_text)}</div></div>}
              <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CAPTION</div><div style={{ fontSize: 12, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{safeStr(result.instagram.caption)}</div></div>
              <TagList tags={result.instagram.hashtags} />
              <PostToInstagramBtn caption={safeStr(result.instagram.caption)} hashtags={result.instagram.hashtags} cardText={safeStr(result.instagram.card_text)} />
            </ChannelCard>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// KBO 직접 입력 탭 — 경기 결과를 직접 입력 → AI 콘텐츠 생성
// ══════════════════════════════════════════════════════════════

const KBO_TEAMS = ["KT", "LG", "SSG", "삼성", "두산", "KIA", "한화", "NC", "롯데", "키움"];

function KBOTab({ onSave }) {
  const [homeTeam, setHomeTeam] = useState("키움");
  const [awayTeam, setAwayTeam] = useState("한화");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [stadium, setStadium] = useState("");
  const [keyPlayers, setKeyPlayers] = useState("");
  const [extra, setExtra] = useState("");
  const [analysisType, setAnalysisType] = useState("review");
  const [channels, setChannels] = useState({ blog: true, x: false, ig: false });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState(null);
  // 이미지 업로드 관련
  const [imagePreview, setImagePreview] = useState(null);
  const [imageData, setImageData] = useState(null); // { base64, type }
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);

  const toggleChannel = (ch) => setChannels(prev => ({ ...prev, [ch]: !prev[ch] }));
  const selectedCount = Object.values(channels).filter(Boolean).length;
  const channelLabels = { blog: "📝 블로그", x: "𝕏 X", ig: "📸 인스타" };
  const channelColors = { blog: "#03C75A", x: T.text, ig: "#E1306C" };

  // 이미지 업로드 핸들러
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const type = file.type || "image/jpeg";
      setImageData({ base64, type });
    };
    reader.readAsDataURL(file);
  };

  // 이미지에서 경기 데이터 자동 추출
  const extractFromImage = async () => {
    if (!imageData) return;
    setExtracting(true);
    try {
      const extractPrompt = `이 이미지는 KBO 야구 경기 정보가 포함된 스크린샷입니다.
이미지에서 다음 정보를 추출해서 JSON으로 응답해주세요:

\`\`\`json
{
  "away_team": "원정팀명",
  "home_team": "홈팀명",
  "away_score": "원정팀 점수 (없으면 빈문자열)",
  "home_score": "홈팀 점수 (없으면 빈문자열)",
  "date": "경기 날짜",
  "stadium": "구장명 (없으면 빈문자열)",
  "key_info": "선발투수, 주요타자 성적, 팀 순위, 최근 전적 등 모든 핵심 데이터를 한 문장으로",
  "is_preview": true/false
}
\`\`\`

이미지에서 보이는 모든 통계 데이터를 key_info에 최대한 상세히 포함하세요.
선발투수 이름과 성적, 키플레이어 타율/홈런, 팀 순위와 승패 기록, 최근 경기 결과 등.`;

      const raw = await callClaudeWithImage(
        imageData.base64, imageData.type, extractPrompt,
        "이미지에서 KBO 야구 경기 데이터를 정확히 추출하세요. 반드시 JSON만 출력.", 1000, SONNET
      );

      let parsed;
      try {
        const cb = raw.match(/```json\s*([\s\S]*?)```/);
        if (cb) { parsed = JSON.parse(cb[1].trim()); }
        else { const f = raw.indexOf("{"), l = raw.lastIndexOf("}"); parsed = (f !== -1 && l > f) ? JSON.parse(raw.substring(f, l + 1)) : null; }
      } catch { parsed = null; }

      if (parsed) {
        // 추출된 데이터로 폼 자동 채우기
        if (parsed.away_team) {
          const matchedAway = KBO_TEAMS.find(t => parsed.away_team.includes(t));
          if (matchedAway) setAwayTeam(matchedAway);
        }
        if (parsed.home_team) {
          const matchedHome = KBO_TEAMS.find(t => parsed.home_team.includes(t));
          if (matchedHome) setHomeTeam(matchedHome);
        }
        if (parsed.away_score) setAwayScore(parsed.away_score);
        if (parsed.home_score) setHomeScore(parsed.home_score);
        if (parsed.date) setGameDate(parsed.date);
        if (parsed.stadium) setStadium(parsed.stadium);
        if (parsed.key_info) setKeyPlayers(parsed.key_info);
        if (parsed.is_preview) setAnalysisType("preview");
        else if (parsed.away_score && parsed.home_score) setAnalysisType("review");
        alert("✅ 이미지에서 데이터 추출 완료! 내용을 확인 후 생성 버튼을 눌러주세요.");
      } else {
        alert("❌ 이미지 분석 실패. 수동으로 입력해주세요.");
      }
    } catch (e) {
      alert(`❌ 이미지 분석 오류: ${e.message}`);
    }
    setExtracting(false);
  };

  const buildSystem = () => {
    let s = `당신은 KBO 전문 스포츠 분석가이자 SNS 콘텐츠 크리에이터입니다.

**최우선 규칙: 사용자가 제공한 데이터(팀명, 스코어, 선수 성적, 최근 전적, 순위 등)는 절대적으로 정확한 팩트입니다.**
- 사용자 데이터와 웹 검색 결과가 충돌하면 → 반드시 사용자 데이터를 사용하세요.
- 사용자가 제공하지 않은 정보만 웹 검색으로 보충하세요.
- 사용자가 제공한 스코어, 승패, 순위, 전적을 절대 변경하거나 다른 값으로 대체하지 마세요.
- 웹 검색에서 사용자 데이터와 다른 정보가 나오면 무시하세요.

⚠️ 반드시 \`\`\`json 코드블록만 출력. 설명 텍스트 금지. 모든 값은 문자열.

\`\`\`json
{
  "title": "콘텐츠 제목 (문자열)",
  "summary": "한줄 총평 (문자열)"`;
    if (channels.blog) s += `,
  "naver_blog": { "title": "SEO 제목 (문자열)", "body": "본문 1500-2500자 (문자열)", "tags": ["태그"], "thumbnail_concept": "썸네일 (문자열)" }`;
    if (channels.x) s += `,
  "x_thread": { "tweets": ["트윗1 280자 (문자열)", "트윗2", "트윗3"], "hashtags": ["태그"] }`;
    if (channels.ig) s += `,
  "instagram": { "caption": "캡션 300자 (문자열)", "hashtags": ["태그"], "card_text": "카드 50자 (문자열)" }`;
    s += `
}
\`\`\`
한국어. 야구팬 관점 흥미로운 톤.`;
    return s;
  };

  const typeLabels = { preview: "프리뷰", review: "리뷰", stats: "통계 심층", shorts: "쇼츠 대본", column: "칼럼" };

  const generate = async () => {
    if (selectedCount === 0) return;
    setLoading(true); setResult(null); setExpandedChannel(null);
    try {
      const dateStr = gameDate || new Date().toLocaleDateString("ko-KR");
      const matchTitle = `${awayTeam} vs ${homeTeam}`;
      const scoreInfo = (homeScore && awayScore) ? `최종 스코어: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam} (${Number(homeScore) > Number(awayScore) ? homeTeam + " 승" : Number(awayScore) > Number(homeScore) ? awayTeam + " 승" : "무승부"})` : "스코어 미입력 (프리뷰)";

      const prompt = `KBO 경기 정보 (아래 데이터는 확인된 팩트입니다. 절대 변경하지 마세요):
날짜: ${dateStr}
경기: ${matchTitle}
${stadium ? `구장: ${stadium}` : ""}
${scoreInfo}
${keyPlayers ? `주요 선수/이벤트/전적: ${keyPlayers}` : ""}
분석 유형: ${typeLabels[analysisType]}
${extra ? `추가: ${extra}` : ""}

⚠️ 위에 제공된 데이터(스코어, 선수 성적, 승패, 순위, 전적)가 웹 검색 결과와 다르면 위 데이터를 사용하세요.
위 데이터에 없는 배경 정보만 웹 검색으로 보충하세요.`;

      // KBO는 사용자 입력 데이터 우선이므로 웹 검색 없이 호출
      const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
      const localKey = localStorage.getItem("dy_sports_api_key") || "";
      const apiKey = envKey || localKey;
      if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.");
      
      const kboModel = analysisType === "shorts" ? HAIKU : SONNET;
      const kboRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: kboModel, max_tokens: 4000, system: buildSystem(), messages: [{ role: "user", content: prompt }] }),
      });
      if (!kboRes.ok) { const err = await kboRes.json().catch(() => ({})); throw new Error(err?.error?.message || `API ${kboRes.status}`); }
      const kboData = await kboRes.json();
      const raw = kboData.content.filter(b => b.type === "text").map(b => b.text).join("\n");

      let parsed;
      try {
        const cb = raw.match(/```json\s*([\s\S]*?)```/);
        if (cb) { parsed = JSON.parse(cb[1].trim()); }
        else { const f = raw.indexOf("{"), l = raw.lastIndexOf("}"); parsed = (f !== -1 && l > f) ? JSON.parse(raw.substring(f, l + 1)) : { raw, parseError: true }; }
      } catch { parsed = { raw, parseError: true }; }

      setResult(parsed);
      const entry = { id: Date.now(), type: "kbo_input", sport: "baseball", league: "KBO", matchInfo: matchTitle, analysisType, channels, data: parsed, date: new Date().toISOString() };
      const h = JSON.parse(localStorage.getItem("dy_sports_history") || "[]");
      h.unshift(entry); if (h.length > 50) h.pop();
      localStorage.setItem("dy_sports_history", JSON.stringify(h));
      if (onSave) onSave();
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  const toggle = (ch) => setExpandedChannel(expandedChannel === ch ? null : ch);

  return (
    <div style={{ padding: "16px 0" }}>
      {/* 이미지 업로드 */}
      <div style={{ marginBottom: 16, padding: "14px 16px", background: T.surface, borderRadius: 12, border: `1px solid ${T.gold}30` }}>
        <SectionLabel>📸 이미지로 자동 입력</SectionLabel>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 10, lineHeight: 1.6 }}>
          네이버 스포츠 등의 경기 정보 스크린샷을 올리면 AI가 자동으로 데이터를 추출합니다.
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => fileInputRef.current?.click()} style={{
            flex: 1, padding: "10px", borderRadius: 8, fontSize: 12,
            fontFamily: font, fontWeight: 600, cursor: "pointer",
            border: `1.5px dashed ${imagePreview ? T.accent : T.border}`,
            background: imagePreview ? T.accentDim : "transparent",
            color: imagePreview ? T.accent : T.muted,
          }}>{imagePreview ? "📷 다른 이미지 선택" : "📷 스크린샷 업로드"}</button>
          {imagePreview && (
            <button onClick={extractFromImage} disabled={extracting} style={{
              flex: 1, padding: "10px", borderRadius: 8, fontSize: 12,
              fontFamily: font, fontWeight: 700, cursor: extracting ? "not-allowed" : "pointer",
              border: "none", background: T.gold, color: "#000",
              opacity: extracting ? 0.6 : 1,
            }}>{extracting ? "🔍 분석 중..." : "🔍 자동 추출"}</button>
          )}
        </div>
        {imagePreview && (
          <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
            <img src={imagePreview} alt="uploaded" style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
          </div>
        )}
      </div>

      {/* 팀 선택 */}
      <div style={{ marginBottom: 14 }}>
        <SectionLabel>MATCH</SectionLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.dim, marginBottom: 4 }}>원정</div>
            <select value={awayTeam} onChange={e => setAwayTeam(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: font }}>
              {KBO_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.dim, paddingTop: 16 }}>vs</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.dim, marginBottom: 4 }}>홈</div>
            <select value={homeTeam} onChange={e => setHomeTeam(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: font }}>
              {KBO_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 스코어 */}
      <div style={{ marginBottom: 14 }}>
        <SectionLabel>SCORE (리뷰 시 입력)</SectionLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder={awayTeam} style={{ flex: 1, padding: "10px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 18, fontFamily: mono, textAlign: "center", outline: "none" }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: T.dim }}>:</span>
          <input value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder={homeTeam} style={{ flex: 1, padding: "10px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 18, fontFamily: mono, textAlign: "center", outline: "none" }} />
        </div>
      </div>

      {/* 날짜/구장 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><SectionLabel>DATE</SectionLabel><input value={gameDate} onChange={e => setGameDate(e.target.value)} placeholder="5월 14일" style={{ width: "100%", padding: "9px 12px", borderRadius: 6, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none" }} /></div>
        <div style={{ flex: 1 }}><SectionLabel>STADIUM</SectionLabel><input value={stadium} onChange={e => setStadium(e.target.value)} placeholder="고척스카이돔" style={{ width: "100%", padding: "9px 12px", borderRadius: 6, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none" }} /></div>
      </div>

      {/* 주요 선수/이벤트 */}
      <div style={{ marginBottom: 14 }}><SectionLabel>KEY PLAYERS / EVENTS</SectionLabel><textarea value={keyPlayers} onChange={e => setKeyPlayers(e.target.value)} placeholder="예: 박정훈 데뷔 첫 선발승, 노시환 3안타..." rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none", resize: "none" }} /></div>

      {/* 분석 유형 */}
      <div style={{ marginBottom: 14 }}><SectionLabel>TYPE</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ANALYSIS_TYPES.map(a => <Chip key={a.id} active={analysisType === a.id} onClick={() => setAnalysisType(a.id)} color={T.gold}>{a.icon} {a.label.replace(/^.+ /,"")}</Chip>)}</div></div>

      {/* 추가 요청 */}
      <div style={{ marginBottom: 14 }}><SectionLabel>EXTRA</SectionLabel><textarea value={extra} onChange={e => setExtra(e.target.value)} placeholder="추가 요청..." rows={1} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none", resize: "none" }} /></div>

      {/* 채널 선택 */}
      <div style={{ marginBottom: 14 }}>
        <SectionLabel>CHANNEL</SectionLabel>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(channelLabels).map(([k, label]) => (
            <button key={k} onClick={() => toggleChannel(k)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 11, fontFamily: font, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${channels[k] ? channelColors[k] : T.border}`, background: channels[k] ? `${channelColors[k]}15` : "transparent", color: channels[k] ? channelColors[k] : T.dim }}>{label}</button>
          ))}
        </div>
      </div>

      <Btn onClick={generate} disabled={loading || selectedCount === 0} full>
        {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚾</span> 생성 중...</> : <>⚾ {selectedCount}채널 KBO 분석 생성</>}
      </Btn>

      {/* Results - 동일한 결과 렌더링 */}
      {result?.error && <div style={{ marginTop: 12, padding: 14, background: T.redDim, borderRadius: 10, border: `1px solid ${T.red}33`, fontSize: 12, color: T.red, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>❌ {result.error}</div>}
      {result?.parseError && <div style={{ marginTop: 12, padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><SectionLabel>RAW</SectionLabel><CopyBtn text={result.raw} /></div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{result.raw}</div></div>}
      {result && !result.error && !result.parseError && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {result.title && <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{safeStr(result.title)}</div>}
          {result.summary && <div style={{ padding: "12px 16px", background: T.accentDim, borderRadius: 8, border: `1px solid ${T.accent}25`, fontSize: 13, fontWeight: 600, color: T.accent }}>💬 {safeStr(result.summary)}</div>}
          <SectionLabel>채널별 포스팅</SectionLabel>
          {result.naver_blog && <ChannelCard icon="📝" label="네이버 블로그" color="#03C75A" expanded={expandedChannel === "blog"} onToggle={() => toggle("blog")} copyText={`${safeStr(result.naver_blog.title)}\n\n${safeStr(result.naver_blog.body)}\n\n${(result.naver_blog.tags||[]).map(h=>`#${h}`).join(" ")}`}><div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>TITLE</div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{safeStr(result.naver_blog.title)}</div></div><div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>BODY</div><div style={{ fontSize: 13, color: T.text, lineHeight: 2, whiteSpace: "pre-wrap", padding: 14, background: T.surface2, borderRadius: 8, maxHeight: 400, overflowY: "auto" }}>{safeStr(result.naver_blog.body)}</div></div><TagList tags={result.naver_blog.tags} /></ChannelCard>}
          {result.x_thread && <ChannelCard icon="𝕏" label="X Thread" color={T.text} expanded={expandedChannel === "x"} onToggle={() => toggle("x")} copyText={(result.x_thread.tweets||[]).map((t,i)=>`${i+1}/${result.x_thread.tweets.length} ${safeStr(t)}`).join("\n\n")}><div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 8 }}>THREAD · {result.x_thread.tweets?.length}트윗</div>{(result.x_thread.tweets||[]).map((tweet,i)=>(<div key={i} style={{ padding: "10px 14px", marginBottom: 6, background: T.surface2, borderRadius: 8, borderLeft: `3px solid ${i===0?T.accent:T.border}` }}><div style={{ fontSize: 9, color: T.dim, fontFamily: mono, marginBottom: 4 }}>{i+1}/{result.x_thread.tweets.length}</div><div style={{ fontSize: 12, color: T.text, lineHeight: 1.7 }}>{safeStr(tweet)}</div></div>))}</div><TagList tags={result.x_thread.hashtags} /><PostToXBtn tweets={result.x_thread.tweets} hashtags={result.x_thread.hashtags} /></ChannelCard>}
          {result.instagram && <ChannelCard icon="📸" label="Instagram" color="#E1306C" expanded={expandedChannel === "ig"} onToggle={() => toggle("ig")} copyText={`${safeStr(result.instagram.caption)}\n\n${(result.instagram.hashtags||[]).map(h=>`#${h}`).join(" ")}`}>{result.instagram.card_text && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CARD TEXT</div><div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: 14, background: T.surface2, borderRadius: 8, textAlign: "center" }}>{safeStr(result.instagram.card_text)}</div></div>}<div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CAPTION</div><div style={{ fontSize: 12, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{safeStr(result.instagram.caption)}</div></div><TagList tags={result.instagram.hashtags} /><PostToInstagramBtn caption={safeStr(result.instagram.caption)} hashtags={result.instagram.hashtags} cardText={safeStr(result.instagram.card_text)} /></ChannelCard>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3: 히스토리
// ══════════════════════════════════════════════════════════════

function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => { setHistory(JSON.parse(localStorage.getItem("dy_sports_history") || "[]")); }, []);
  const remove = (id) => { const u = history.filter(h => h.id !== id); setHistory(u); localStorage.setItem("dy_sports_history", JSON.stringify(u)); if (selected?.id === id) setSelected(null); };
  if (selected) {
    const isMLB = selected.type === "mlb_korean";
    const is3ch = selected.type === "analysis_3ch";
    const title = isMLB ? "🇰🇷 MLB 한국인 데일리" : is3ch ? `⚡ ${selected.matchInfo}` : selected.matchInfo;
    const body = (isMLB || is3ch) ? JSON.stringify(selected.data, null, 2) : selected.result;
    return (<div style={{ padding: "16px 0" }}><button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontFamily: font, cursor: "pointer", marginBottom: 16, padding: 0 }}>← 목록</button><div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</div><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 16 }}>{new Date(selected.date).toLocaleString("ko-KR")}</div><CopyBtn text={body} /><div style={{ fontSize: 13, color: T.text, lineHeight: 1.9, fontFamily: font, whiteSpace: "pre-wrap", marginTop: 12 }}>{body}</div></div></div>);
  }
  return (
    <div style={{ padding: "16px 0" }}><SectionLabel>HISTORY · {history.length}건</SectionLabel>
      {history.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: T.dim, fontSize: 13 }}>기록 없음</div> : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{history.map(h => { const isMLB = h.type === "mlb_korean"; const is3ch = h.type === "analysis_3ch"; return (<div key={h.id} onClick={() => setSelected(h)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer" }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 9, fontFamily: mono, color: isMLB ? T.mlb : is3ch ? T.gold : T.accent, marginBottom: 4 }}>{isMLB ? "🇰🇷 MLB" : is3ch ? "⚡ 3CH" : SPORTS.find(s => s.id === h.sport)?.label?.slice(0,2)}</div><div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isMLB ? "한국인 데일리 리포트" : h.matchInfo}</div><div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginTop: 2 }}>{new Date(h.date).toLocaleDateString("ko-KR")}</div></div><button onClick={e => { e.stopPropagation(); remove(h.id); }} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 14, padding: "4px 8px" }}>×</button></div>); })}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 4: 설정
// ══════════════════════════════════════════════════════════════

function SettingsTab() {
  const [key, setKey] = useState(localStorage.getItem("dy_sports_api_key") || "");
  const [saved, setSaved] = useState(false);
  const save = () => { localStorage.setItem("dy_sports_api_key", key); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div style={{ padding: "16px 0" }}><SectionLabel>SETTINGS</SectionLabel>
      <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>API Key</div>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 10 }}>Vercel 환경변수 설정 시 불필요</div>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..." style={{ width: "100%", padding: "10px 12px", borderRadius: 6, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: mono, outline: "none", marginBottom: 8 }} />
        <Btn onClick={save} color={saved ? T.green : T.accent} small>{saved ? "✓ 저장됨" : "저장"}</Btn>
      </div>
      <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>데이터 관리</div>
        <button onClick={() => { if (confirm("모든 기록 삭제?")) { localStorage.removeItem("dy_sports_history"); alert("삭제 완료"); } }} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 11, fontFamily: font, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.red}33`, background: T.redDim, color: T.red }}>히스토리 전체 삭제</button>
      </div>
      <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>네이버 블로그 연동</div>
        {localStorage.getItem("naver_access_token") ? (
          <div>
            <div style={{ fontSize: 11, color: "#03C75A", marginBottom: 8 }}>✅ 네이버 로그인됨</div>
            <button onClick={() => { localStorage.removeItem("naver_access_token"); localStorage.removeItem("naver_refresh_token"); alert("로그아웃 완료"); }} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 11, fontFamily: font, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.border}`, background: T.surface2, color: T.muted }}>로그아웃</button>
          </div>
        ) : (
          <button onClick={() => { window.location.href = "/api/naver-login"; }} style={{ padding: "10px 16px", borderRadius: 8, fontSize: 12, fontFamily: font, fontWeight: 700, cursor: "pointer", border: "none", background: "#03C75A", color: "#fff" }}>네이버 로그인</button>
        )}
      </div>
      <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>앱 정보</div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 2, fontFamily: mono }}>
          <div><span style={{ color: T.dim }}>앱:</span> EdgeStats v3.3</div>
          <div><span style={{ color: T.dim }}>브랜드:</span> DoubleY Space</div>
          <div><span style={{ color: T.dim }}>모델:</span> Sonnet 4.6 / Haiku 4.5</div>
          <div><span style={{ color: T.dim }}>탭:</span> 🇰🇷MLB / ⚾KBO / 🏀NBA / 🏈NFL / ⚽축구</div>
          <div><span style={{ color: T.dim }}>채널:</span> 블로그 + X + 인스타 선택</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
*{box-sizing:border-box}
`;

export default function App() {
  const [tab, setTab] = useState("mlb");
  const [, forceUpdate] = useState(0);
  const tabs = [
    { id: "mlb", label: "🇰🇷 MLB" },
    { id: "kbo", label: "⚾ KBO" },
    { id: "nba", label: "🏀 NBA" },
    { id: "nfl", label: "🏈 NFL" },
    { id: "football", label: "⚽ 축구" },
    { id: "history", label: "📂" },
    { id: "settings", label: "⚙️" },
  ];

  // 네이버 OAuth 콜백 토큰 저장
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const naverToken = params.get("naver_token");
    const naverError = params.get("naver_error");
    if (naverToken) {
      localStorage.setItem("naver_access_token", naverToken);
      const naverRefresh = params.get("naver_refresh");
      if (naverRefresh) localStorage.setItem("naver_refresh_token", naverRefresh);
      window.history.replaceState({}, "", "/");
      alert("✅ 네이버 로그인 완료! 이제 블로그 포스팅이 가능합니다.");
    }
    if (naverError) {
      window.history.replaceState({}, "", "/");
      alert(`❌ 네이버 로그인 실패: ${naverError}`);
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: font, color: T.text, maxWidth: 520, margin: "0 auto" }}>
      <style>{CSS}</style>
      <div style={{ padding: "16px 20px 0", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}><span style={{ color: T.accent }}>⚡</span> EdgeStats</div><div style={{ fontSize: 10, fontFamily: mono, color: T.dim, marginTop: 2 }}>v2.3 | DoubleY Space</div></div>
          <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, textAlign: "right" }}>{new Date().toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}</div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0", fontSize: t.label.length > 3 ? 11 : 12, fontFamily: font, fontWeight: 600, cursor: "pointer", background: "none", border: "none", color: tab === t.id ? T.accent : T.dim, borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`, transition: "all 0.15s" }}>{t.label}</button>))}</div>
      </div>
      <div style={{ padding: "0 20px 40px", animation: "fadeUp 0.3s ease" }}>
        {tab === "mlb" && <MLBKoreanTab onSave={() => forceUpdate(n => n + 1)} />}
        {tab === "kbo" && <KBOTab onSave={() => forceUpdate(n => n + 1)} />}
        {tab === "nba" && <AnalysisTab key="nba" onSave={() => forceUpdate(n => n + 1)} preset={{ sport: "basketball", leagues: ["NBA"] }} />}
        {tab === "nfl" && <AnalysisTab key="nfl" onSave={() => forceUpdate(n => n + 1)} preset={{ sport: "football", leagues: ["NFL"] }} />}
        {tab === "football" && <AnalysisTab key="football" onSave={() => forceUpdate(n => n + 1)} preset={{ sport: "soccer", leagues: ["EPL", "라리가", "K리그", "챔피언스리그", "분데스리가", "국가대표"] }} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
