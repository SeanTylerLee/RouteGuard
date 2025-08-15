/* ============================================================
   Permit Checker -- 48 Contiguous States (data-driven)
   - v1 ships with Oklahoma thresholds filled.
   - All other states are stubbed (status: "noData") so the app
     works now and you can plug in each state later.
   ============================================================ */

/* ---------- Helpers ---------- */

// list of 48 contiguous states (no AK, HI)
const STATES_48 = [
  "AL","AZ","AR","CA","CO","CT","DE","FL","GA","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

// convert feet + inches to inches
function toInches(ft, inch) {
  const f = Number(ft||0), i = Number(inch||0);
  return Math.max(0, (isFinite(f)?f:0) * 12 + (isFinite(i)?i:0));
}

// format inches back to ft'in"
function fmtInches(inches) {
  const ft = Math.floor(inches/12);
  const inch = Math.round(inches % 12);
  return `${ft}′ ${inch}″`;
}

// read numeric input safely
function readNumber(id){
  const el = document.getElementById(id);
  const val = Number(el.value);
  return isFinite(val) ? val : 0;
}

/* ---------- Data Model ----------

Each state rule can include:
- legal_max.widthIn / heightIn / lengthIn (in inches)
- legal_max.grossLbs
- escort: { width: {two:[ranges], multi:[ranges]}, length:{...}, height:{...} }
  Each range -> {overIn: <inches>, escorts: "1F+1R" or "1F", flags:true/false, notes:"..."}
- highPole: { requiredOverHeightIn: <inches>, notes:"..." }
- travel: string (notes)
- sources: [links]
If a state is not yet loaded, use { status: "noData" }

IMPORTANT: Fill with verified thresholds when ready.
For now, OK uses common baseline thresholds; verify before production.
---------------------------------- */

const STATE_RULES = {
  // ===== Oklahoma (OK) -- placeholder baseline, verify before prod =====
  "OK": {
    status: "ok",
    legal_max: {
      widthIn: 8*12 + 6,      // 8'6"
      heightIn: 14*12 + 0,     // 13'6"
      lengthIn: 80*12,        // 65' overall (baseline; configurations vary -- verify)
      grossLbs: 80000
    },
    // Simple escort logic (illustrative; refine with real OK tables)
    escort: {
      width: {
        two: [
          { overIn: 12*12, escorts: "1F+1R", flags: true, notes: "Very wide on 2-lane." },
          { overIn: 10*12, escorts: "1F",    flags: true, notes: "" }
        ],
        multi: [
          { overIn: 12*12, escorts: "1F+1R", flags: true, notes: "" },
          { overIn: 12*12 - 6, escorts: "1F", flags: true, notes: "" }
        ]
      },
      length: {
        two: [
          { overIn: 85*12, escorts: "1R", flags: false, notes: "" }
        ],
        multi: [
          { overIn: 95*12, escorts: "1R", flags: false, notes: "" }
        ]
      },
      height: {
        two: [
          { overIn: 15*12, escorts: "1F (high-pole)", flags: true, notes: "" }
        ],
        multi: [
          { overIn: 15*12, escorts: "1F (high-pole)", flags: true, notes: "" }
        ]
      }
    },
    highPole: {
      requiredOverHeightIn: 15*12, // 15' (illustrative; verify)
      notes: "High-pole recommended/required for extreme height and route checks."
    },
    travel: "Daylight only when escorted or extreme dimensions; check curfews for metro areas.",
    sources: ["https://www.ok.gov/"] // replace with specific permit manual page when ready
  },

  // ===== Stubs for the remaining states (ready to fill) =====
  ...Object.fromEntries(
    STATES_48
      .filter(s => s !== "OK")
      .map(s => [s, { status: "noData" }])
  )
};

/* ---------- UI Setup ---------- */
const statesSelect = document.getElementById("states");
const roadTypeEl = document.getElementById("roadType");
const checkBtn = document.getElementById("checkBtn");
const resultsCard = document.getElementById("resultsCard");
const resultsTableWrap = document.getElementById("resultsTableWrap");

// Populate states list
(function fillStates(){
  STATES_48.forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = code;
    statesSelect.appendChild(opt);
  });
  // Preselect OK to mirror your current data
  const okIndex = STATES_48.indexOf("OK");
  if (okIndex >= 0) statesSelect.selectedIndex = okIndex;
})();

/* ---------- Core Logic ---------- */

function needsPermitForState(stateCode, dims) {
  const rules = STATE_RULES[stateCode];
  if (!rules || rules.status !== "ok") return { status: "noData" };

  const lm = rules.legal_max;
  const overWidth = dims.widthIn > lm.widthIn;
  const overHeight = dims.heightIn > lm.heightIn;
  const overLength = dims.lengthIn > lm.lengthIn;
  const overWeight = dims.grossLbs > lm.grossLbs;

  const permit = !!(overWidth || overHeight || overLength || overWeight);

  // Escort/high pole suggestion
  const rt = dims.roadType; // 'two' | 'multi'
  const escortBits = [];

  // Width-based escort
  for (const r of (rules.escort?.width?.[rt] || [])) {
    if (dims.widthIn > r.overIn) {
      escortBits.push(`${r.escorts}${r.flags ? " + flags" : ""}${r.notes ? ` -- ${r.notes}` : ""}`);
      break;
    }
  }
  // Length-based escort
  for (const r of (rules.escort?.length?.[rt] || [])) {
    if (dims.lengthIn > r.overIn) {
      escortBits.push(`${r.escorts}${r.flags ? " + flags" : ""}${r.notes ? ` -- ${r.notes}` : ""}`);
      break;
    }
  }
  // Height-based escort
  for (const r of (rules.escort?.height?.[rt] || [])) {
    if (dims.heightIn > r.overIn) {
      escortBits.push(`${r.escorts}${r.flags ? " + flags" : ""}${r.notes ? ` -- ${r.notes}` : ""}`);
      break;
    }
  }

  // High pole
  let highPole = "Not indicated";
  if (rules.highPole?.requiredOverHeightIn != null) {
    highPole = (dims.heightIn > rules.highPole.requiredOverHeightIn)
      ? "Yes (high-pole advised/required)"
      : "No";
    if (rules.highPole.notes) highPole += ` -- ${rules.highPole.notes}`;
  }

  return {
    status: "ok",
    permit,
    over: { overWidth, overHeight, overLength, overWeight },
    escort: escortBits.length ? escortBits.join("; ") : "None indicated by current table",
    highPole,
    travel: rules.travel || "--",
    legal_max: lm,
    sources: rules.sources || []
  };
}

function renderResults(rows){
  // Build a table
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>State</th>
        <th>Permit needed?</th>
        <th>Why</th>
        <th>Escort / Pilot</th>
        <th>High-pole</th>
        <th>Travel notes</th>
        <th class="code">Legal baseline</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  rows.forEach(r => {
    const tr = document.createElement("tr");
    const why = [];
    if (r.status === "noData") {
      tr.innerHTML = `
        <td>${r.state}</td>
        <td><span class="pill info">Data not loaded yet</span></td>
        <td class="small">Add this state’s thresholds in <span class="code">STATE_RULES</span></td>
        <td class="small">--</td>
        <td class="small">--</td>
        <td class="small">--</td>
        <td class="small">--</td>
      `;
      tbody.appendChild(tr);
      return;
    }

    const pillClass = r.permit ? "bad" : "ok";
    const pillText  = r.permit ? "YES -- permit likely" : "NO -- within legal";

    if (r.over.overWidth)  why.push("Over width");
    if (r.over.overHeight) why.push("Over height");
    if (r.over.overLength) why.push("Over length");
    if (r.over.overWeight) why.push("Over weight");

    const legal =
      `W ${fmtInches(r.legal_max.widthIn)}, H ${fmtInches(r.legal_max.heightIn)}, ` +
      `L ${fmtInches(r.legal_max.lengthIn)}, G ${r.legal_max.grossLbs.toLocaleString()} lbs`;

    tr.innerHTML = `
      <td>${r.state}</td>
      <td><span class="pill ${pillClass}">${pillText}</span></td>
      <td>${why.length ? why.join(", ") : "--"}</td>
      <td>${r.escort}</td>
      <td>${r.highPole}</td>
      <td>${r.travel}</td>
      <td class="code small">${legal}</td>
    `;
    tbody.appendChild(tr);
  });

  resultsTableWrap.innerHTML = "";
  resultsTableWrap.appendChild(table);
  resultsCard.classList.remove("hidden");
}

/* ---------- Wire up button ---------- */
checkBtn.addEventListener("click", () => {
  const widthIn  = toInches(readNumber("widthFt"),  readNumber("widthIn"));
  const heightIn = toInches(readNumber("heightFt"), readNumber("heightIn"));
  const lengthIn = toInches(readNumber("lengthFt"), readNumber("lengthIn"));
  const grossLbs = readNumber("grossLbs");
  const roadType = roadTypeEl.value; // 'two' | 'multi'

  // selected states
  const sel = Array.from(statesSelect.selectedOptions).map(o => o.value);
  if (sel.length === 0) {
    // If nothing selected, default to OK for convenience
    sel.push("OK");
  }

  const dims = { widthIn, heightIn, lengthIn, grossLbs, roadType };

  const rows = sel.map(stateCode => {
    const res = needsPermitForState(stateCode, dims);
    return { state: stateCode, ...res };
  });

  renderResults(rows);
});

/* ---------- Dev convenience: fill sample ---------- */
/* Uncomment to prefill a common oversize example
document.getElementById("widthFt").value = 10;
document.getElementById("widthIn").value = 0;
document.getElementById("heightFt").value = 14;
document.getElementById("heightIn").value = 0;
document.getElementById("lengthFt").value = 80;
document.getElementById("lengthIn").value = 0;
document.getElementById("grossLbs").value = 90000;
*/