// ═══════════════════════════════════════════════════════════════
// MLB Stats API - 한국인 선수 당일 성적 수집
// Vercel Serverless Function (무료, 인증 불필요)
// ═══════════════════════════════════════════════════════════════

const MLB_API = "https://statsapi.mlb.com/api/v1";

// 현재 MLB 활동 한국인 선수 목록 (이름 + MLB ID)
// ID는 MLB Stats API에서 고유 식별자
const KOREAN_PLAYERS = [
  { name: "김혜성", nameEn: "Ha-Seong Kim", id: 673490, team: "LA Dodgers" },
  { name: "이정후", nameEn: "Jung Hoo Lee", id: 808982, team: "SF Giants" },
  { name: "김하성", nameEn: "Ha-Seong Kim", id: 673490, team: "TBD" },
  { name: "배지환", nameEn: "Ji-Hwan Bae", id: 678225, team: "TBD" },
  { name: "송성문", nameEn: "Seong-mun Song", id: 0, team: "TBD" },
];

// MLB Player ID 조회 (이름으로 검색)
async function searchPlayer(name) {
  try {
    const res = await fetch(`${MLB_API}/people/search?names=${encodeURIComponent(name)}&sportIds=1&activeStatus=Y`);
    if (!res.ok) return null;
    const data = await res.json();
    const people = data?.people || [];
    return people.length > 0 ? people[0] : null;
  } catch { return null; }
}

// 특정 날짜 스케줄 가져오기
async function getSchedule(date) {
  const res = await fetch(`${MLB_API}/schedule?date=${date}&sportId=1&hydrate=team,linescore,probablePitcher`);
  if (!res.ok) throw new Error(`MLB Schedule API: ${res.status}`);
  const data = await res.json();
  return data?.dates?.[0]?.games || [];
}

// 박스스코어에서 특정 선수 성적 추출
async function getPlayerGameStats(gamePk, playerId) {
  try {
    const res = await fetch(`${MLB_API}/game/${gamePk}/boxscore`);
    if (!res.ok) return null;
    const data = await res.json();

    // away 팀과 home 팀 모두 검색
    for (const side of ["away", "home"]) {
      const players = data?.teams?.[side]?.players || {};
      const key = `ID${playerId}`;
      const player = players[key];
      if (player) {
        const batting = player?.stats?.batting || {};
        const pitching = player?.stats?.pitching || {};
        const teamName = data?.teams?.[side]?.team?.name || "";
        const otherSide = side === "away" ? "home" : "away";
        const oppTeam = data?.teams?.[otherSide]?.team?.name || "";

        // 팀 스코어
        const teamScore = data?.teams?.[side]?.teamStats?.batting?.runs ?? "?";
        const oppScore = data?.teams?.[otherSide]?.teamStats?.batting?.runs ?? "?";
        const isWin = Number(teamScore) > Number(oppScore);

        return {
          found: true,
          side,
          teamName,
          oppTeam,
          teamScore,
          oppScore,
          isWin,
          position: player?.position?.abbreviation || player?.allPositions?.[0]?.abbreviation || "",
          battingOrder: player?.battingOrder || "",
          batting: Object.keys(batting).length > 0 ? {
            atBats: batting.atBats ?? 0,
            hits: batting.hits ?? 0,
            runs: batting.runs ?? 0,
            rbi: batting.rbi ?? 0,
            homeRuns: batting.homeRuns ?? 0,
            strikeOuts: batting.strikeOuts ?? 0,
            baseOnBalls: batting.baseOnBalls ?? 0,
            avg: batting.avg || "",
            obp: batting.obp || "",
            ops: batting.ops || "",
            stolenBases: batting.stolenBases ?? 0,
          } : null,
          pitching: Object.keys(pitching).length > 0 ? {
            inningsPitched: pitching.inningsPitched || "0",
            hits: pitching.hits ?? 0,
            runs: pitching.runs ?? 0,
            earnedRuns: pitching.earnedRuns ?? 0,
            strikeOuts: pitching.strikeOuts ?? 0,
            baseOnBalls: pitching.baseOnBalls ?? 0,
            homeRuns: pitching.homeRuns ?? 0,
            era: pitching.era || "",
            pitchesThrown: pitching.numberOfPitches ?? 0,
          } : null,
        };
      }
    }
    return null;
  } catch { return null; }
}

// 선수 시즌 성적 조회
async function getSeasonStats(playerId) {
  try {
    const year = new Date().getFullYear();
    const res = await fetch(`${MLB_API}/people/${playerId}/stats?stats=season&season=${year}&group=hitting,pitching`);
    if (!res.ok) return null;
    const data = await res.json();
    const stats = {};
    for (const split of (data?.stats || [])) {
      const type = split?.group?.displayName; // "hitting" or "pitching"
      const s = split?.splits?.[0]?.stat;
      if (s && type) stats[type] = s;
    }
    return Object.keys(stats).length > 0 ? stats : null;
  } catch { return null; }
}

// 한국인 선수 ID 확정 (최초 1회 검색)
async function resolvePlayerIds() {
  const resolved = [];
  const searchNames = [
    { nameKo: "김혜성", search: "Hye-seong Kim", fallbackId: 662730 },
    { nameKo: "이정후", search: "Jung Hoo Lee", fallbackId: 808982 },
    { nameKo: "김하성", search: "Ha-Seong Kim", fallbackId: 673490 },
    { nameKo: "배지환", search: "Ji-Hwan Bae", fallbackId: 678225 },
    { nameKo: "송성문", search: "Seong-mun Song", fallbackId: 0 },
  ];

  for (const p of searchNames) {
    const found = await searchPlayer(p.search);
    resolved.push({
      nameKo: p.nameKo,
      nameEn: found?.fullName || p.search,
      id: found?.id || p.fallbackId,
      team: found?.currentTeam?.name || "Unknown",
      active: found?.active ?? false,
    });
  }
  return resolved;
}

// ═══════════════════════════════════════════════════════════════
// Vercel Handler
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];

    // 1. 해당 날짜 전체 경기 스케줄
    const games = await getSchedule(date);

    // 2. 한국인 선수 ID 목록 (하드코딩 + 검색 보완)
    const koreanPlayerIds = [
      { nameKo: "김혜성", id: 662730 },
      { nameKo: "이정후", id: 808982 },
      { nameKo: "김하성", id: 673490 },
      { nameKo: "배지환", id: 678225 },
      { nameKo: "송성문", id: 710810 },
    ];

    // 3. 각 경기에서 한국인 선수 성적 추출
    const playerResults = [];
    const noGamePlayers = [];

    for (const player of koreanPlayerIds) {
      let found = false;

      for (const game of games) {
        const stats = await getPlayerGameStats(game.gamePk, player.id);
        if (stats?.found) {
          found = true;

          // 시즌 성적도 가져오기
          const seasonStats = await getSeasonStats(player.id);

          // 타자 성적 포맷
          let todayLine = "";
          if (stats.batting) {
            const b = stats.batting;
            todayLine = `${b.atBats}타수 ${b.hits}안타 ${b.homeRuns}홈런 ${b.rbi}타점 ${b.runs}득점 ${b.baseOnBalls}볼넷 ${b.strikeOuts}삼진`;
            if (b.stolenBases > 0) todayLine += ` ${b.stolenBases}도루`;
          }
          // 투수 성적 포맷
          if (stats.pitching) {
            const p = stats.pitching;
            todayLine += `${todayLine ? " / 투수: " : ""}${p.inningsPitched}이닝 ${p.hits}피안타 ${p.earnedRuns}자책 ${p.strikeOuts}탈삼진 ${p.baseOnBalls}볼넷 (${p.pitchesThrown}구)`;
          }

          // 시즌 성적 포맷
          let seasonLine = "";
          if (seasonStats?.hitting) {
            const s = seasonStats.hitting;
            seasonLine = `타율 ${s.avg} OBP ${s.obp} OPS ${s.ops} ${s.gamesPlayed}경기 ${s.hits}안타 ${s.homeRuns}홈런 ${s.rbi}타점`;
          }
          if (seasonStats?.pitching) {
            const s = seasonStats.pitching;
            seasonLine += `${seasonLine ? " / " : ""}ERA ${s.era} ${s.gamesPlayed}경기 ${s.inningsPitched}이닝 ${s.strikeOuts}K`;
          }

          playerResults.push({
            name: player.nameKo,
            team: stats.teamName,
            position: stats.position,
            game_result: `${stats.teamName} ${stats.teamScore} - ${stats.oppScore} ${stats.oppTeam} (${stats.isWin ? "승" : "패"})`,
            today_stats: todayLine || "출전 기록 없음",
            season_stats: seasonLine || "시즌 데이터 없음",
            batting_raw: stats.batting,
            pitching_raw: stats.pitching,
          });
          break; // 해당 선수 찾았으면 다음 선수로
        }
      }

      if (!found) {
        noGamePlayers.push(player.nameKo);
      }
    }

    return res.status(200).json({
      success: true,
      date,
      total_games: games.length,
      players: playerResults,
      no_game_players: noGamePlayers,
      games_summary: games.map(g => ({
        gamePk: g.gamePk,
        away: g.teams?.away?.team?.name,
        home: g.teams?.home?.team?.name,
        awayScore: g.teams?.away?.score ?? "?",
        homeScore: g.teams?.home?.score ?? "?",
        status: g.status?.detailedState,
      })),
    });

  } catch (error) {
    console.error("MLB API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
