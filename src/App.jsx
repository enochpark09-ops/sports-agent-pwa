import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

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
  green: "#10b981",
};

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

// ═══════════════════════════════════════════════════════════════
// API HELPER
// ═══════════════════════════════════════════════════════════════

async function callClaude(messages, system, maxTokens = 2000, model = SONNET) {
  const apiKey = localStorage.getItem("dy_sports_api_key") || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

const font = "'Outfit', 'Pretendard', sans-serif";
const mono = "'IBM Plex Mono', monospace";

function Chip({ children, active, onClick, color = T.accent }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 6, fontSize: 12,
      fontFamily: font, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${active ? color : T.border}`,
      background: active ? `${color}18` : "transparent",
      color: active ? color : T.muted,
      transition: "all 0.15s",
    }}>{children}</button>
  );
}

function Btn({ children, onClick, disabled, color = T.accent, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "12px 20px", borderRadius: 8, fontSize: 13,
      fontFamily: font, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      border: "none", width: full ? "100%" : "auto",
      background: disabled ? T.surface2 : color,
      color: disabled ? T.dim : "#000",
      opacity: disabled ? 0.5 : 1,
      transition: "all 0.15s",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>{children}</button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: 분석 생성
// ═══════════════════════════════════════════════════════════════

function AnalysisTab({ onSave }) {
  const [sport, setSport] = useState("soccer");
  const [league, setLeague] = useState("");
  const [matchInfo, setMatchInfo] = useState("");
  const [analysisType, setAnalysisType] = useState("preview");
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const resultRef = useRef(null);

  const selectedSport = SPORTS.find(s => s.id === sport);

  const SYSTEM_PROMPTS = {
    preview: `당신은 전문 스포츠 분석가입니다. 경기 프리뷰를 작성합니다.
반드시 웹 검색으로 최신 정보를 확인한 후 분석하세요.

구성:
1. 🔍 경기 개요 (날짜, 시간, 장소, 중요도)
2. 📊 양팀 최근 폼 (최근 5경기 성적, 주요 통계)
3. 🏥 부상/결장 정보
4. ⚔️ 전술 분석 (예상 포메이션, 키 매치업)
5. 🎯 승부 예측 (승/무/패 확률, 스코어 예측, 근거)
6. 💡 핵심 관전 포인트 3가지

한국어로 작성. 데이터 기반으로 분석하되, 읽기 쉽게 작성하세요.`,

    review: `당신은 전문 스포츠 분석가입니다. 경기 리뷰를 작성합니다.
반드시 웹 검색으로 경기 결과와 하이라이트를 확인하세요.

구성:
1. 📋 경기 결과 요약 (스코어, 득점자, 주요 장면)
2. ⭐ MOM (맨 오브 더 매치) 선정 & 이유
3. 📊 주요 통계 (점유율, 슈팅, 패스 성공률 등)
4. ⚔️ 전술 분석 (양팀 전술 평가)
5. 📈 시즌 임팩트 (순위 변동, 향후 전망)
6. 💬 한줄 총평

한국어로 작성.`,

    stats: `당신은 스포츠 데이터 분석 전문가입니다.
반드시 웹 검색으로 최신 통계를 확인하세요.

구성:
1. 📊 핵심 지표 대시보드 (테이블 형식)
2. 📈 트렌드 분석 (시즌 흐름, 상승/하락 추세)
3. 🔬 심층 비교 (리그 평균 대비, 동급 선수/팀 비교)
4. 🎯 강점/약점 분석
5. 💡 인사이트 3가지 (데이터에서 도출된 비직관적 발견)

한국어, 숫자와 데이터를 적극 활용하세요.`,

    shorts: `당신은 스포츠 숏폼 콘텐츠 작가입니다.
반드시 웹 검색으로 최신 정보를 확인하세요.

60초 분량의 유튜브 쇼츠 대본을 작성합니다:
1. 🎬 훅 (첫 3초 — 강렬한 질문이나 충격적 통계)
2. 📊 본론 (핵심 분석 3포인트, 각 15초)
3. 🎯 결론 (핵심 한줄 + 구독 유도)

추가 제공:
- 📌 제목 후보 3개 (클릭율 높은 스타일)
- #️⃣ 해시태그 10개
- 🖼️ 썸네일 컨셉 설명

한국어, TTS 낭독용으로 자연스럽게 작성.`,

    column: `당신은 스포츠 칼럼니스트입니다.
반드시 웹 검색으로 최신 이슈를 확인하세요.

구성:
1. 제목 (강렬하고 호기심 유발)
2. 도입 (이슈의 핵심을 2-3문장으로)
3. 본론 (논점 3개, 각각 데이터/사례 기반)
4. 결론 (필자의 관점 + 전망)

800-1200자 분량, 논평 톤, 한국어.`,
  };

  const generate = async () => {
    if (!matchInfo.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const prompt = `종목: ${selectedSport?.label || sport}
리그: ${league || "미지정"}
경기/주제: ${matchInfo}
${extra ? `추가 요청: ${extra}` : ""}

위 정보를 바탕으로 분석을 작성해주세요. 반드시 웹 검색으로 최신 데이터를 확인하세요.`;

      const res = await callClaude(
        [{ role: "user", content: prompt }],
        SYSTEM_PROMPTS[analysisType],
        3000,
        analysisType === "shorts" ? HAIKU : SONNET
      );
      setResult(res);

      // Auto-save
      const entry = {
        id: Date.now(),
        sport, league, matchInfo, analysisType, result: res,
        date: new Date().toISOString(),
      };
      const history = JSON.parse(localStorage.getItem("dy_sports_history") || "[]");
      history.unshift(entry);
      if (history.length > 50) history.pop();
      localStorage.setItem("dy_sports_history", JSON.stringify(history));
      if (onSave) onSave();

    } catch (e) {
      setResult(`❌ 오류: ${e.message}`);
    }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
  };

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Sport Selection */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 8 }}>SPORT</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SPORTS.map(s => (
            <Chip key={s.id} active={sport === s.id} onClick={() => { setSport(s.id); setLeague(""); }}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* League Selection */}
      {selectedSport && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 8 }}>LEAGUE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selectedSport.leagues.map(l => (
              <Chip key={l} active={league === l} onClick={() => setLeague(league === l ? "" : l)} color={T.blue}>
                {l}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Type */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 8 }}>ANALYSIS TYPE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ANALYSIS_TYPES.map(a => (
            <Chip key={a.id} active={analysisType === a.id} onClick={() => setAnalysisType(a.id)} color={T.gold}>
              {a.icon} {a.label.replace(/^.+ /, "")}
            </Chip>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.dim, marginTop: 6, fontFamily: font }}>
          {ANALYSIS_TYPES.find(a => a.id === analysisType)?.desc}
        </div>
      </div>

      {/* Match Info Input */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 8 }}>
          {analysisType === "stats" ? "분석 대상 (선수/팀)" : analysisType === "column" ? "칼럼 주제" : "경기 정보"}
        </div>
        <input
          value={matchInfo}
          onChange={e => setMatchInfo(e.target.value)}
          placeholder={
            analysisType === "preview" ? "예: 맨시티 vs 아스널 2026.05.15" :
            analysisType === "review" ? "예: 토트넘 vs 리버풀 어제 경기" :
            analysisType === "stats" ? "예: 손흥민 2025-26 시즌 분석" :
            analysisType === "shorts" ? "예: EPL 우승 경쟁 3파전 분석" :
            "예: K리그 외국인 선수 제도의 명과 암"
          }
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 8,
            background: T.surface2, border: `1px solid ${T.border}`,
            color: T.text, fontSize: 14, fontFamily: font,
            outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border}
        />
      </div>

      {/* Extra Request */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 8 }}>EXTRA (선택)</div>
        <textarea
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder="추가 요청사항 (예: 베팅 관점에서 분석, 특정 선수 중심으로)"
          rows={2}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8,
            background: T.surface2, border: `1px solid ${T.border}`,
            color: T.text, fontSize: 12, fontFamily: font,
            outline: "none", resize: "none",
          }}
        />
      </div>

      {/* Generate Button */}
      <Btn onClick={generate} disabled={loading || !matchInfo.trim()} full>
        {loading ? (
          <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚡</span> 분석 중...</>
        ) : (
          <>⚡ AI 분석 생성</>
        )}
      </Btn>

      {/* Result */}
      {result && (
        <div ref={resultRef} style={{
          marginTop: 20, padding: "20px",
          background: T.surface, borderRadius: 10,
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontFamily: mono, color: T.accent, letterSpacing: 1.5 }}>
              {ANALYSIS_TYPES.find(a => a.id === analysisType)?.icon} RESULT
            </span>
            <button onClick={copy} style={{
              background: "none", border: `1px solid ${T.border}`, borderRadius: 6,
              padding: "4px 10px", fontSize: 10, fontFamily: mono,
              color: T.muted, cursor: "pointer",
            }}>📋 복사</button>
          </div>
          <div style={{
            fontSize: 13, color: T.text, lineHeight: 1.9,
            fontFamily: font, whiteSpace: "pre-wrap",
          }}>{result}</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: 히스토리
// ═══════════════════════════════════════════════════════════════

function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem("dy_sports_history") || "[]"));
  }, []);

  const remove = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem("dy_sports_history", JSON.stringify(updated));
    if (selected?.id === id) setSelected(null);
  };

  if (selected) {
    return (
      <div style={{ padding: "16px 0" }}>
        <button onClick={() => setSelected(null)} style={{
          background: "none", border: "none", color: T.accent,
          fontSize: 12, fontFamily: font, cursor: "pointer",
          marginBottom: 16, padding: 0,
        }}>← 목록으로</button>

        <div style={{
          padding: 16, background: T.surface, borderRadius: 10,
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10, fontFamily: mono, padding: "2px 8px",
              borderRadius: 4, background: T.accentDim, color: T.accent,
            }}>{SPORTS.find(s => s.id === selected.sport)?.label || selected.sport}</span>
            {selected.league && <span style={{
              fontSize: 10, fontFamily: mono, padding: "2px 8px",
              borderRadius: 4, background: T.blueDim, color: T.blue,
            }}>{selected.league}</span>}
            <span style={{
              fontSize: 10, fontFamily: mono, padding: "2px 8px",
              borderRadius: 4, background: T.goldDim, color: T.gold,
            }}>{ANALYSIS_TYPES.find(a => a.id === selected.analysisType)?.label}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{selected.matchInfo}</div>
          <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginBottom: 16 }}>
            {new Date(selected.date).toLocaleString("ko-KR")}
          </div>
          <div style={{
            fontSize: 13, color: T.text, lineHeight: 1.9,
            fontFamily: font, whiteSpace: "pre-wrap",
          }}>{selected.result}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 12 }}>
        HISTORY · {history.length}건
      </div>
      {history.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", color: T.dim,
          fontSize: 13, fontFamily: font,
        }}>아직 분석 기록이 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {history.map((h, i) => (
            <div key={h.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", background: T.surface, borderRadius: 8,
              border: `1px solid ${T.border}`, cursor: "pointer",
              transition: "border-color 0.15s",
            }}
              onClick={() => setSelected(h)}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: mono, color: T.accent }}>
                    {SPORTS.find(s => s.id === h.sport)?.label?.slice(0, 2)}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: mono, color: T.gold }}>
                    {ANALYSIS_TYPES.find(a => a.id === h.analysisType)?.icon}
                  </span>
                  {h.league && <span style={{ fontSize: 9, fontFamily: mono, color: T.blue }}>{h.league}</span>}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: T.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{h.matchInfo}</div>
                <div style={{ fontSize: 10, color: T.dim, fontFamily: mono, marginTop: 2 }}>
                  {new Date(h.date).toLocaleDateString("ko-KR")}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); remove(h.id); }} style={{
                background: "none", border: "none", color: T.dim,
                cursor: "pointer", fontSize: 14, padding: "4px 8px",
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: 퀵 스코어 (실시간 스코어 조회)
// ═══════════════════════════════════════════════════════════════

function ScoreTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const quickQueries = [
    "오늘 EPL 경기 결과",
    "오늘 MLB 스코어",
    "오늘 KBO 경기 결과",
    "NBA 플레이오프 결과",
    "K리그 순위",
    "EPL 순위",
  ];

  const search = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const res = await callClaude(
        [{ role: "user", content: searchQuery }],
        `당신은 스포츠 속보 리포터입니다. 웹 검색으로 최신 스코어/결과를 확인하고 깔끔하게 정리해주세요.
결과를 표 형식으로 보기 좋게 정리하고, 주요 하이라이트를 간단히 덧붙이세요.
한국어로 작성.`,
        1500, HAIKU
      );
      setResult(res);
    } catch (e) {
      setResult(`❌ ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 12 }}>QUICK SCORE</div>

      {/* Quick Buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {quickQueries.map(q => (
          <button key={q} onClick={() => { setQuery(q); search(q); }} style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11,
            fontFamily: font, fontWeight: 500, cursor: "pointer",
            border: `1px solid ${T.border}`, background: T.surface,
            color: T.muted, transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >{q}</button>
        ))}
      </div>

      {/* Custom Query */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="스코어/결과 검색..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 8,
            background: T.surface2, border: `1px solid ${T.border}`,
            color: T.text, fontSize: 13, fontFamily: font, outline: "none",
          }}
        />
        <Btn onClick={() => search()} disabled={loading || !query.trim()}>
          {loading ? "..." : "검색"}
        </Btn>
      </div>

      {result && (
        <div style={{
          padding: 16, background: T.surface, borderRadius: 10,
          border: `1px solid ${T.border}`,
          fontSize: 13, color: T.text, lineHeight: 1.8,
          fontFamily: font, whiteSpace: "pre-wrap",
        }}>{result}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: 설정
// ═══════════════════════════════════════════════════════════════

function SettingsTab() {
  const [key, setKey] = useState(localStorage.getItem("dy_sports_api_key") || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem("dy_sports_api_key", key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearHistory = () => {
    if (confirm("모든 분석 기록을 삭제할까요?")) {
      localStorage.removeItem("dy_sports_history");
      alert("삭제 완료");
    }
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, letterSpacing: 1.5, marginBottom: 16 }}>SETTINGS</div>

      {/* API Key */}
      <div style={{
        padding: 16, background: T.surface, borderRadius: 10,
        border: `1px solid ${T.border}`, marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>API Key</div>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 10 }}>
          Vercel 환경변수로 설정하면 여기에 입력하지 않아도 됩니다.
        </div>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 6,
            background: T.surface2, border: `1px solid ${T.border}`,
            color: T.text, fontSize: 12, fontFamily: mono, outline: "none",
            marginBottom: 8,
          }}
        />
        <Btn onClick={save} color={saved ? T.green : T.accent}>
          {saved ? "✓ 저장됨" : "저장"}
        </Btn>
      </div>

      {/* Data Management */}
      <div style={{
        padding: 16, background: T.surface, borderRadius: 10,
        border: `1px solid ${T.border}`, marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>데이터 관리</div>
        <button onClick={clearHistory} style={{
          padding: "8px 14px", borderRadius: 6, fontSize: 11,
          fontFamily: font, fontWeight: 600, cursor: "pointer",
          border: `1px solid ${T.red}33`, background: T.redDim, color: T.red,
        }}>히스토리 전체 삭제</button>
      </div>

      {/* App Info */}
      <div style={{
        padding: 16, background: T.surface, borderRadius: 10,
        border: `1px solid ${T.border}`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>앱 정보</div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 2, fontFamily: mono }}>
          <div><span style={{ color: T.dim }}>앱:</span> Sports Analysis Agent v1.0</div>
          <div><span style={{ color: T.dim }}>브랜드:</span> DoubleY Space</div>
          <div><span style={{ color: T.dim }}>모델:</span> Sonnet (분석) / Haiku (쇼츠·스코어)</div>
          <div><span style={{ color: T.dim }}>종목:</span> 축구·야구·농구·미식축구·격투기·기타</div>
          <div><span style={{ color: T.dim }}>기능:</span> 프리뷰·리뷰·통계·쇼츠대본·칼럼·스코어</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
* { box-sizing: border-box; }
`;

export default function App() {
  const [tab, setTab] = useState("analysis");
  const [, forceUpdate] = useState(0);

  const tabs = [
    { id: "analysis", label: "⚡ 분석" },
    { id: "scores", label: "📡 스코어" },
    { id: "history", label: "📂 기록" },
    { id: "settings", label: "⚙️" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      fontFamily: font, color: T.text,
      maxWidth: 520, margin: "0 auto",
    }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{
        padding: "16px 20px 0",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
              <span style={{ color: T.accent }}>⚡</span> Sports AI
            </div>
            <div style={{ fontSize: 10, fontFamily: mono, color: T.dim, marginTop: 2 }}>
              v1.0 | DoubleY Space
            </div>
          </div>
          <div style={{
            fontSize: 10, fontFamily: mono, color: T.dim,
            textAlign: "right",
          }}>
            {new Date().toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 0", fontSize: 12,
              fontFamily: font, fontWeight: 600, cursor: "pointer",
              background: "none", border: "none",
              color: tab === t.id ? T.accent : T.dim,
              borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`,
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px 40px", animation: "fadeUp 0.3s ease" }}>
        {tab === "analysis" && <AnalysisTab onSave={() => forceUpdate(n => n + 1)} />}
        {tab === "scores" && <ScoreTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
