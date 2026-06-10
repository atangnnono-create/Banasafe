/**
 * BanaSafe — Africa's Talking ↔ RapidPro USSD Bridge
 * Node.js / Express webhook handler
 *
 * Deploy on: Render, Railway, Heroku, or any Node host
 * Africa's Tal
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─── ENV VARIABLES (set in .env or Render dashboard) ──────────────────────────
const {
  RAPIDPRO_URL,       // e.g. https://your-rapidpro.example.com
  RAPIDPRO_TOKEN,     // RapidPro API token
  RAPIDPRO_FLOW_UUID, // UUID of your imported BanaSafe flow
  PORT = 3000,
} = process.env;

// ─── IN-MEMORY SESSION STORE (replace with Redis in production) ────────────────
const sessions = {};

/**
 * POST /ussd
 * Africa's Talking hits this endpoint for every USSD interaction.
 *
 * Africa's Talking USSD params:
 *   sessionId   — unique per USSD session
 *   phoneNumber — caller's number (e.g. +26771234567)
 *   networkCode — mobile network
 *   serviceCode — USSD shortcode (e.g. *123#)
 *   text        — all inputs joined by * (e.g. "1*2*3")
 */
app.post("/ussd", async (req, res) => {
  const { sessionId, phoneNumber, text } = req.body;

  // Africa's Talking sends all inputs as "1*2*3" — get the latest input
  const parts = (text || "").split("*");
  const userInput = parts[parts.length - 1].trim();

  // Initialise session on first contact
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      phone: phoneNumber,
      step: "lang_select",
      lang: null,
      reportType: null,
      incidentType: null,
      location: null,
      victimStatus: null,
      urgency: null,
      refId: generateRefId(),
    };
  }

  const session = sessions[sessionId];
  const { text: responseText, end } = handleStep(session, userInput);

  if (end) {
    // Push completed report to RapidPro
    await pushToRapidPro(session).catch(console.error);
    delete sessions[sessionId]; // Clean up session
  }

  // Africa's Talking response format:
  // "CON <text>" = continue session (show menu)
  // "END <text>" = end session (final message)
  const prefix = end ? "END" : "CON";
  res.set("Content-Type", "text/plain");
  res.send(`${prefix} ${responseText}`);
});

// ─── STEP HANDLER ──────────────────────────────────────────────────────────────
function handleStep(session, input) {
  const EN = session.lang === "en";

  switch (session.step) {

    case "lang_select":
      if (input === "1") { session.lang = "en"; session.step = "main_menu"; }
      else if (input === "2") { session.lang = "st"; session.step = "main_menu"; }
      else {
        return { text: "Welcome to BanaSafe\nTatô go BanaSafe\n\n1. English\n2. Setswana", end: false };
      }
      return { text: mainMenu(EN), end: false };

    case "main_menu":
      if (input === "1") { session.step = "incident_type"; session.reportType = "GBV"; }
      else if (input === "2") { session.step = "incident_type"; session.reportType = "Child Abuse"; }
      else if (input === "3") { session.step = "resources"; }
      else if (input === "4") { return { text: EN ? "Thank you. Stay safe." : "Ke a leboga. Nna o babalesegile.", end: true }; }
      else { return { text: mainMenu(EN), end: false }; }

      if (session.step === "resources") return { text: resources(EN), end: false };
      return { text: incidentType(EN, session.reportType), end: false };

    case "resources":
      session.step = "main_menu";
      return { text: mainMenu(EN), end: false };

    case "incident_type":
      if (input === "5" || input === "6") { session.step = "main_menu"; return { text: mainMenu(EN), end: false }; }
      session.incidentType = input;
      session.step = "location";
      return { text: location(EN), end: false };

    case "location":
      session.location = input;
      session.step = "victim_status";
      return { text: victimStatus(EN), end: false };

    case "victim_status":
      session.victimStatus = input;
      session.step = "urgency";
      return { text: urgency(EN), end: false };

    case "urgency":
      session.urgency = input;
      session.step = "done";
      return { text: confirmation(EN, session.refId), end: true };

    default:
      session.step = "lang_select";
      return { text: "Welcome to BanaSafe\nTatô go BanaSafe\n\n1. English\n2. Setswana", end: false };
  }
}

// ─── SCREEN TEXT HELPERS ───────────────────────────────────────────────────────
function mainMenu(en) {
  return en
    ? "BanaSafe — Safe Reporting\nYou are anonymous. We protect you.\n\n1. Report GBV incident\n2. Report child abuse\n3. Get help / resources\n4. Exit"
    : "BanaSafe — Go Bika ka Ponego\nO sa itsege. Re a go sireletsa.\n\n1. Bika tiragalo ya GBV\n2. Bika go hujwa ga ngwana\n3. Bona thuso / metsotso\n4. Tswa";
}

function incidentType(en, reportType) {
  if (reportType === "GBV") {
    return en
      ? "Report GBV Incident\nWhat type?\n\n1. Physical violence\n2. Sexual violence\n3. Emotional abuse\n4. Economic abuse\n5. Back"
      : "Bika Tiragalo ya GBV\nKe mofuta ofe?\n\n1. Tiragalo ya mmele\n2. Tiragalo ya thobalano\n3. Pitlagano ya maikutlo\n4. Pitlagano ya ikonomi\n5. Boela morago";
  }
  return en
    ? "Report Child Abuse\nWhat type?\n\n1. Physical\n2. Sexual\n3. Neglect\n4. Emotional\n5. Child labour\n6. Back"
    : "Bika go Hujwa ga Ngwana\nKe mofuta ofe?\n\n1. Mmele\n2. Thobalano\n3. Go solofelwa\n4. Maikutlo\n5. Tiro ya bana\n6. Boela morago";
}

function location(en) {
  return en
    ? "Where did this happen?\n\n1. Home\n2. School\n3. Workplace\n4. Public place\n5. Other"
    : "Go diragaletse kwa kae?\n\n1. Gae\n2. Sekoleng\n3. Tiro\n4. Setšhaba\n5. Mafelo a mangwe";
}

function victimStatus(en) {
  return en
    ? "Who needs help?\n\n1. I am the victim\n2. Reporting for someone else\n3. I am a witness"
    : "Ke mang yo o tlhokang thuso?\n\n1. Ke nna molaodisiwa\n2. Ke bika mo go mongwe\n3. Ke kaedi";
}

function urgency(en) {
  return en
    ? "Is this an emergency?\n\n1. Yes — danger right now\n2. No — already happened\n3. Not sure"
    : "A ke tshoganyetso?\n\n1. Ee — kotsi jaanong\n2. Nnyaa — e setse e diragile\n3. Ga ke itse";
}

function resources(en) {
  return en
    ? "Help & Resources\n\nChildline: 116 (free 24/7)\nBONELA: 3953222\nPolice: 999\nLifeline BW: 3911290\n\nReply any key to return."
    : "Thuso le Metsotso\n\nChildline: 116 (mahala 24/7)\nBONELA: 3953222\nMapodisi: 999\nLifeline BW: 3911290\n\nAraba go boela morago.";
}

function confirmation(en, refId) {
  return en
    ? `Your report has been submitted.\nRef: ${refId}\n\nYou are safe.\nChildline: 116\nPolice: 999\n\nThank you for speaking up.`
    : `Pegelo ya gago e romilwe.\nNomoro: ${refId}\n\nO babalesegile.\nChildline: 116\nMapodisi: 999\n\nKe a leboga go bua.`;
}

// ─── RAPIDPRO PUSH ─────────────────────────────────────────────────────────────
async function pushToRapidPro(session) {
  if (!RAPIDPRO_URL || !RAPIDPRO_TOKEN || !RAPIDPRO_FLOW_UUID) {
    console.warn("RapidPro env vars not set — skipping push");
    return;
  }

  const payload = {
    flow: RAPIDPRO_FLOW_UUID,
    urns: ["tel:anonymous"]