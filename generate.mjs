import fs from 'node:fs';

const USERNAME = process.env.GH_USERNAME || 'vaibhav025';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const COLS = 34;
const ROWS = 7;
const MAX_TARGETS = 6;
const LOOP_DUR = 12; // seconds
const FLASH_COLOR = '#fff3a2';
const BULLET_COLOR = '#ffe08a';
const BLAST_COLOR = '#fb923c';
const PITCH = 18;
const CELL = 13;
const X0 = 65;
const Y0 = 105;
const W = 740;
const H = 305;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

if (!TOKEN) throw new Error('Set GH_TOKEN or GITHUB_TOKEN in your environment.');

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date weekday contributionCount contributionLevel color } }
      }
    }
  }
}`;
const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {Authorization: `Bearer ${TOKEN}`, 'Content-Type':'application/json', 'User-Agent': 'github-jet-heatmap'},
  body: JSON.stringify({query, variables:{login:USERNAME}}),
});
if (!response.ok) throw new Error(`GitHub HTTP ${response.status}: ${await response.text()}`);
const result = await response.json();
if (result.errors?.length) throw new Error(JSON.stringify(result.errors));
const cal = result.data?.user?.contributionsCollection?.contributionCalendar;
if (!cal) throw new Error(`Could not find contribution calendar for ${USERNAME}`);
const weeks = cal.weeks.slice(-COLS);
const days = weeks.flatMap((week, col) => week.contributionDays
  .map(d => ({...d, col, row: d.weekday, x: X0 + col*PITCH + CELL/2, y: Y0 + d.weekday*PITCH + CELL/2}))
  .filter(d => d.row >= 0 && d.row < ROWS));
const maxCount = Math.max(1, ...days.map(d => d.contributionCount));
const cells = days.map(d => `<rect x="${d.x-CELL/2}" y="${d.y-CELL/2}" width="${CELL}" height="${CELL}" rx="3" fill="${d.color}" stroke="#ffffff" stroke-opacity=".06"><title>${esc(d.date)}: ${d.contributionCount} contributions</title></rect>`).join('\n');

// Pick busiest unique days, then order them along the flight path.
const targets = [...days].filter(d => d.contributionCount > 0)
  .sort((a,b) => b.contributionCount-a.contributionCount || a.date.localeCompare(b.date))
  .slice(0, MAX_TARGETS)
  .sort((a,b) => a.x-b.x || a.y-b.y);

const startX = 20;
const endX = W-10;
const flightY = 56;
const flightDur = LOOP_DUR*0.76;
const jet = `<g transform="translate(0 ${flightY})">
 <g><animateTransform attributeName="transform" type="translate" values="${startX} 0;${endX} 0;${startX} 0" keyTimes="0;.76;1" dur="${LOOP_DUR}s" repeatCount="indefinite"/>
  <path d="M -30 -4 L -9 -9 L 7 -23 L 15 -22 L 9 -8 L 32 -3 L 39 0 L 32 3 L 9 8 L 15 22 L 7 23 L -9 9 L -30 4 L -24 0 Z" fill="#cbd5e1" stroke="#f8fafc" stroke-width="1.5" />
  <path d="M 4 -4 L 27 0 L 4 4 Z" fill="#38bdf8"/><path d="M-33 -3 L-51 0 L-33 3Z" fill="#fb923c" opacity=".85" />
 </g></g>`;
const impacts = targets.map((d,i) => {
  // Time for jet to cross the target's x coordinate, minus bullet travel time.
  const t = Math.max(.15, (d.x-startX)/(endX-startX)*flightDur-.26);
  const impactT = t + .26;
  const dx = d.x - (startX+(endX-startX)*(t/flightDur));
  return `<g>
   <circle r="3" fill="${BULLET_COLOR}" opacity="0">
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.002;.021;.025;1" begin="${t.toFixed(2)}s" dur="${LOOP_DUR}s" repeatCount="indefinite" />
    <animateMotion path="M ${d.x-dx} ${flightY+13} L ${d.x} ${d.y}" begin="${t.toFixed(2)}s" dur="${LOOP_DUR}s" keyPoints="0;1;1" keyTimes="0;${(.28/LOOP_DUR).toFixed(5)};1" calcMode="linear" repeatCount="indefinite" />
   </circle>
   <circle cx="${d.x}" cy="${d.y}" r="5" fill="${FLASH_COLOR}" opacity="0">
    <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.01;.034;1" begin="${impactT.toFixed(2)}s" dur="${LOOP_DUR}s" repeatCount="indefinite"/>
    <animate attributeName="r" values="5;14;2;2" keyTimes="0;.01;.034;1" begin="${impactT.toFixed(2)}s" dur="${LOOP_DUR}s" repeatCount="indefinite"/>
   </circle>
   <circle cx="${d.x}" cy="${d.y}" r="4" stroke="${BLAST_COLOR}" stroke-width="3" fill="none" opacity="0">
    <animate attributeName="opacity" values="0;.95;0;0" keyTimes="0;.01;.055;1" begin="${impactT.toFixed(2)}s" dur="${LOOP_DUR}s" repeatCount="indefinite"/>
    <animate attributeName="r" values="4;6;24;24" keyTimes="0;.01;.055;1" begin="${impactT.toFixed(2)}s" dur="${LOOP_DUR}s" repeatCount="indefinite"/>
   </circle>
  </g>`;
}).join('\n');
const months = weeks.map((w,i) => ({name:new Date(w.firstDay+'T12:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'}),x:X0+i*PITCH})).filter((w,i,a) => i===0 || w.name!==a[i-1].name).map(m=>`<text x="${m.x}" y="92" font-size="11" fill="#94a3b8">${m.name}</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Animated GitHub jet flying over real contribution heatmap for ${esc(USERNAME)}">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
 <rect width="${W}" height="${H}" rx="18" fill="url(#bg)"/>
 <text x="26" y="32" fill="#e2e8f0" font-size="17" font-family="Arial,sans-serif" font-weight="bold">✈ ${esc(USERNAME)} / contribution strike</text>
 <text x="${W-26}" y="32" text-anchor="end" fill="#67e8f9" font-size="11" font-family="Arial,sans-serif">${cal.totalContributions} contributions · last 34 weeks shown</text>
 <g font-family="Arial,sans-serif">${months}<text x="17" y="129" font-size="11" fill="#94a3b8">Mon</text><text x="17" y="165" font-size="11" fill="#94a3b8">Wed</text><text x="17" y="201" font-size="11" fill="#94a3b8">Fri</text></g>
 ${cells}
 <path d="M 12 ${flightY} H ${W-15}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4 8" opacity=".2"/>
 ${jet}
 ${impacts}
 <text x="26" y="${H-27}" fill="#94a3b8" font-size="11" font-family="Arial,sans-serif">Targets: ${targets.length} busiest days · Live GitHub contribution data</text>
 </svg>`;
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/github-jet.svg',svg);
console.log(`Generated dist/github-jet.svg for ${USERNAME} (${days.length} days, ${targets.length} targets).`);
