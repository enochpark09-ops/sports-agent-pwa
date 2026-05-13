import { useState, useEffect, useRef } from "react";

const SONNET = "claude-sonnet-4-20250514";
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
  { id: "soccer", label: "⚽ 축구", leagues: ["EPL", "라리가", "K리그", "챔피언스리그", "분데스리가"] },
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
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem("dy_sports_api_key") || "";
  if (!apiKey) throw new Error("API 키가 설정되지 않았습니다. 설정 탭에서 입력하거나 Vercel 환경변수(VITE_ANTHROPIC_API_KEY)를 추가하세요.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, tools: [{ type: "web_search_20250305", name: "web_search" }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API ${res.status}`);
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
function SectionLabel({ children }) {
  return (<div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>{children}</div>);
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

**임무:** MLB에서 활약 중인 한국인 선수들의 최신 경기 성적을 웹 검색으로 조사하고, 3개 채널(유튜브 쇼츠, 인스타그램, X/트위터)용 포스팅을 한 번에 생성합니다.

**반드시 웹 검색으로 확인할 것:**
1. 어제/오늘 MLB 경기에 출전한 한국인 선수 전원 탐색
2. 각 선수의 당일 성적 (타율, 안타, 홈런, 타점, 투구이닝, 삼진, 자책점 등)
3. 시즌 누적 성적
4. 팀 경기 결과 (스코어)

**출력 형식 — 반드시 아래 JSON만 출력. 설명 문장 금지:**

\`\`\`json
{
  "date": "날짜",
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

한국어. 성적 좋으면 축하, 부진하면 응원 톤.`;

  const generate = async () => {
    setLoading(true); setResult(null); setExpandedChannel(null);
    try {
      const dateQuery = customDate || "어제와 오늘";
      const raw = await callClaude(
        [{ role: "user", content: `${dateQuery} MLB 경기에서 한국인 선수들의 성적을 모두 검색해서 리포트를 만들어주세요. 현재 MLB에서 활약 중인 한국인 선수를 빠짐없이 검색해주세요. (김혜성, 이정후, 배지환, 김도영, 류현진, 김광현 등 전부) 반드시 웹 검색으로 최신 결과를 확인하세요.` }],
        SYSTEM, 4000, SONNET
      );
      let parsed;
      try {
        const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse((jsonMatch[1] || jsonMatch[0]).trim());
      } catch { parsed = { raw, parseError: true }; }
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

      {result?.error && <div style={{ padding: 14, background: T.redDim, borderRadius: 10, border: `1px solid ${T.red}33`, fontSize: 12, color: T.red }}>❌ {result.error}</div>}

      {result?.parseError && (
        <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><SectionLabel>RAW RESULT</SectionLabel><CopyBtn text={result.raw} /></div>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.9, fontFamily: font, whiteSpace: "pre-wrap" }}>{result.raw}</div>
        </div>
      )}

      {result && !result.error && !result.parseError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {result.summary && <div style={{ padding: "12px 16px", background: T.accentDim, borderRadius: 8, border: `1px solid ${T.accent}25`, fontSize: 13, fontWeight: 600, color: T.accent }}>💬 {result.summary}</div>}

          {result.players?.length > 0 && (
            <div>
              <SectionLabel>선수별 성적 · {result.players.length}명</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {result.players.map((p, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{p.name}</span>
                      <span style={{ fontSize: 9, fontFamily: mono, padding: "2px 7px", borderRadius: 4, background: T.blueDim, color: T.blue }}>{p.team}</span>
                      <span style={{ fontSize: 9, fontFamily: mono, padding: "2px 7px", borderRadius: 4, background: T.surface2, color: T.dim }}>{p.position}</span>
                    </div>
                    {p.game_result && <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>🏟️ {p.game_result}</div>}
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4 }}>📊 {p.today_stats}</div>
                    {p.season_stats && <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>📈 시즌: {p.season_stats}</div>}
                    {p.highlight && <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, padding: "4px 8px", background: T.goldDim, borderRadius: 4, display: "inline-block" }}>⭐ {p.highlight}</div>}
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

function AnalysisTab({ onSave }) {
  const [sport, setSport] = useState("soccer");
  const [league, setLeague] = useState("");
  const [matchInfo, setMatchInfo] = useState("");
  const [analysisType, setAnalysisType] = useState("preview");
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const sel = SPORTS.find(s => s.id === sport);

  const SYSTEM = `당신은 전문 스포츠 분석가이자 SNS 콘텐츠 크리에이터입니다.

**임무:** 주어진 스포츠 경기/주제를 웹 검색으로 조사하고, 3개 채널(네이버 블로그, X/트위터 스레드, 인스타그램)용 콘텐츠를 한 번에 생성합니다.

**분석 유형별 톤:**
- 프리뷰: 경기 전 전술 분석, 예측, 관전 포인트
- 리뷰: 경기 후 하이라이트, MOM, 핵심 통계
- 통계 심층: 데이터 기반 인사이트, 비교 분석
- 쇼츠 대본: 60초 숏폼 스크립트 (TTS용 구어체)
- 칼럼: 논평, 시사 에세이

**반드시 웹 검색으로 최신 정보를 확인한 후 작성하세요.**

**출력 형식 — 반드시 아래 JSON만 출력. 설명 문장 금지:**

\`\`\`json
{
  "title": "콘텐츠 제목",
  "sport": "종목",
  "league": "리그",
  "type": "분석유형",
  "naver_blog": {
    "title": "블로그 제목 (SEO 최적화, 검색 유입용)",
    "body": "블로그 본문 (1500-2500자, 소제목 포함, 네이버 블로그 스타일. 줄바꿈은 \\n으로. 이모지 적절히 활용. 소제목은 ■ 기호 사용)",
    "tags": ["태그1", "태그2", "태그3"],
    "thumbnail_concept": "대표 이미지 컨셉"
  },
  "x_thread": {
    "tweets": ["트윗1 (280자 이내)", "트윗2", "트윗3", "트윗4"],
    "hashtags": ["태그1", "태그2"]
  },
  "instagram": {
    "caption": "인스타그램 캡션 (이모지 포함, 300자 내외)",
    "hashtags": ["태그1", "태그2"],
    "card_text": "카드뉴스 메인 텍스트 (50자 이내)"
  },
  "summary": "한줄 총평"
}
\`\`\`

한국어로 작성. 팬 관점에서 흥미로운 톤. 각 채널별 최적화된 포맷으로.`;

  const typeLabels = { preview: "프리뷰", review: "리뷰", stats: "통계 심층", shorts: "쇼츠 대본", column: "칼럼" };

  const generate = async () => {
    if (!matchInfo.trim()) return;
    setLoading(true); setResult(null); setExpandedChannel(null);
    try {
      const prompt = `종목: ${sel?.label || sport}
리그: ${league || "미지정"}
경기/주제: ${matchInfo}
분석 유형: ${typeLabels[analysisType]}
${extra ? `추가 요청: ${extra}` : ""}

위 정보를 바탕으로 웹 검색 후 3채널 콘텐츠를 생성해주세요.`;

      const raw = await callClaude(
        [{ role: "user", content: prompt }],
        SYSTEM, 4000, analysisType === "shorts" ? HAIKU : SONNET
      );

      let parsed;
      try {
        const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse((jsonMatch[1] || jsonMatch[0]).trim());
      } catch { parsed = { raw, parseError: true }; }

      setResult(parsed);

      const entry = { id: Date.now(), type: "analysis_3ch", sport, league, matchInfo, analysisType, data: parsed, date: new Date().toISOString() };
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
      {/* Sport */}
      <div style={{ marginBottom: 16 }}><SectionLabel>SPORT</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{SPORTS.map(s => <Chip key={s.id} active={sport === s.id} onClick={() => { setSport(s.id); setLeague(""); }}>{s.label}</Chip>)}</div></div>
      {/* League */}
      {sel && <div style={{ marginBottom: 16 }}><SectionLabel>LEAGUE</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{sel.leagues.map(l => <Chip key={l} active={league === l} onClick={() => setLeague(league === l ? "" : l)} color={T.blue}>{l}</Chip>)}</div></div>}
      {/* Type */}
      <div style={{ marginBottom: 16 }}><SectionLabel>TYPE</SectionLabel><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ANALYSIS_TYPES.map(a => <Chip key={a.id} active={analysisType === a.id} onClick={() => setAnalysisType(a.id)} color={T.gold}>{a.icon} {a.label.replace(/^.+ /,"")}</Chip>)}</div></div>
      {/* Match */}
      <div style={{ marginBottom: 12 }}><SectionLabel>MATCH / TOPIC</SectionLabel><input value={matchInfo} onChange={e => setMatchInfo(e.target.value)} placeholder="예: 맨시티 vs 아스널, 손흥민 시즌 분석" style={{ width: "100%", padding: "12px 14px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: font, outline: "none" }} /></div>
      {/* Extra */}
      <div style={{ marginBottom: 16 }}><SectionLabel>EXTRA</SectionLabel><textarea value={extra} onChange={e => setExtra(e.target.value)} placeholder="추가 요청..." rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: font, outline: "none", resize: "none" }} /></div>
      {/* Generate */}
      <div style={{ padding: "10px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 12, fontSize: 11, color: T.muted }}>
        📢 3채널 동시 생성: <span style={{ color: "#03C75A", fontWeight: 700 }}>네이버 블로그</span> + <span style={{ fontWeight: 700, color: T.text }}>𝕏 스레드</span> + <span style={{ color: "#E1306C", fontWeight: 700 }}>인스타그램</span>
      </div>
      <Btn onClick={generate} disabled={loading || !matchInfo.trim()} full>{loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚡</span> 3채널 콘텐츠 생성 중...</> : <>⚡ 3채널 분석 생성</>}</Btn>

      {/* Error */}
      {result?.error && <div style={{ marginTop: 12, padding: 14, background: T.redDim, borderRadius: 10, border: `1px solid ${T.red}33`, fontSize: 12, color: T.red }}>❌ {result.error}</div>}

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
          {/* Title & Summary */}
          {result.title && <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{result.title}</div>}
          {result.summary && <div style={{ padding: "12px 16px", background: T.accentDim, borderRadius: 8, border: `1px solid ${T.accent}25`, fontSize: 13, fontWeight: 600, color: T.accent }}>💬 {result.summary}</div>}

          <SectionLabel>3채널 포스팅</SectionLabel>

          {/* Naver Blog */}
          {result.naver_blog && (
            <ChannelCard icon="📝" label="네이버 블로그" color="#03C75A" expanded={expandedChannel === "blog"} onToggle={() => toggle("blog")}
              copyText={`${result.naver_blog.title}\n\n${result.naver_blog.body}\n\n${(result.naver_blog.tags || []).map(h => `#${h}`).join(" ")}`}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>TITLE (SEO)</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{result.naver_blog.title}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>BODY</div>
                <div style={{
                  fontSize: 13, color: T.text, lineHeight: 2, whiteSpace: "pre-wrap",
                  padding: "14px", background: T.surface2, borderRadius: 8,
                  maxHeight: 400, overflowY: "auto",
                }}>{result.naver_blog.body}</div>
              </div>
              {result.naver_blog.thumbnail_concept && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>THUMBNAIL</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{result.naver_blog.thumbnail_concept}</div>
                </div>
              )}
              <TagList tags={result.naver_blog.tags} />
            </ChannelCard>
          )}

          {/* X Thread */}
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
            </ChannelCard>
          )}

          {/* Instagram */}
          {result.instagram && (
            <ChannelCard icon="📸" label="Instagram" color="#E1306C" expanded={expandedChannel === "ig"} onToggle={() => toggle("ig")}
              copyText={`${result.instagram.caption}\n\n${(result.instagram.hashtags || []).map(h => `#${h}`).join(" ")}`}>
              {result.instagram.card_text && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CARD TEXT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: 14, background: T.surface2, borderRadius: 8, textAlign: "center", lineHeight: 1.5 }}>{result.instagram.card_text}</div>
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 4 }}>CAPTION</div>
                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.instagram.caption}</div>
              </div>
              <TagList tags={result.instagram.hashtags} />
            </ChannelCard>
          )}
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
      <div style={{ padding: 16, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>앱 정보</div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 2, fontFamily: mono }}>
          <div><span style={{ color: T.dim }}>앱:</span> Sports AI Agent v1.3</div>
          <div><span style={{ color: T.dim }}>브랜드:</span> DoubleY Space</div>
          <div><span style={{ color: T.dim }}>모델:</span> Sonnet (분석·MLB) / Haiku (쇼츠)</div>
          <div><span style={{ color: T.dim }}>MLB:</span> 🇰🇷 유튜브 + X + 인스타 3채널</div>
          <div><span style={{ color: T.dim }}>분석:</span> ⚡ 네이버블로그 + X + 인스타 3채널</div>
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
  const tabs = [{ id: "mlb", label: "🇰🇷 MLB" }, { id: "analysis", label: "⚡ 분석" }, { id: "history", label: "📂" }, { id: "settings", label: "⚙️" }];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: font, color: T.text, maxWidth: 520, margin: "0 auto" }}>
      <style>{CSS}</style>
      <div style={{ padding: "16px 20px 0", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}><span style={{ color: T.accent }}>⚡</span> Sports AI</div><div style={{ fontSize: 10, fontFamily: mono, color: T.dim, marginTop: 2 }}>v1.3 | DoubleY Space</div></div>
          <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, textAlign: "right" }}>{new Date().toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}</div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0", fontSize: 12, fontFamily: font, fontWeight: 600, cursor: "pointer", background: "none", border: "none", color: tab === t.id ? T.accent : T.dim, borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`, transition: "all 0.15s" }}>{t.label}</button>))}</div>
      </div>
      <div style={{ padding: "0 20px 40px", animation: "fadeUp 0.3s ease" }}>
        {tab === "mlb" && <MLBKoreanTab onSave={() => forceUpdate(n => n + 1)} />}
        {tab === "analysis" && <AnalysisTab onSave={() => forceUpdate(n => n + 1)} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
