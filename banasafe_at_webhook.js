/**
 * BanaSafe — Africa's Talking USSD Bridge
 * Node.js / Express webhook handler
 *
 * Africa's Talking sends USSD requests as POST with:
 *   - sessionId, phoneNumber, networkCode, serviceCode, text
 *
 * "text" accumulates all inputs separated by "*"
 * e.g. after 3 steps: "1*2*1"
 *
 * Deploy on: Railway, Render, Heroku, or any Node host
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const {
  RAPIDPRO_URL,
  RAPIDPRO_TOKEN,
  RAPIDPRO_FLOW_UUID,
  PORT = 3001,
} = process.env;

// ─── USSD RESPONSE HELPERS ─────────────────────────────────────────────────────
// Africa's Talking expects plain text responses prefixed with:
//   "CON " → continue session (show next menu)
//   "END " → end session (final message)

const CON = (text) => `CON ${text}`;
const END = (text) => `END ${text}`;

// ─── HEALTH CHECK (keeps UptimeRobot + Render happy) ──────────────────────────
app.get("/", (req, res) => {
  res.status(200).send("BanaSafe USSD service is running.");
});

// ─── MAIN USSD HANDLER ─────────────────────────────────────────────────────────
app.post("/ussd", async (req, res) => {
  const { sessionId, phoneNumber, text } = req.body;

  // Africa's Talking sends accumulated input as "1*2*3"
  // Split into steps array; empty string means session just started
  const steps = text === "" ? [] : text.split("*");

  res.set("Content-Type", "text/plain");

  try {
    const response = await buildResponse(steps, sessionId, phoneNumber);
    res.send(response);
  } catch (err) {
    console.error("USSD handler error:", err);
    res.send(END("Service temporarily unavailable. Please try again.\nChildline: 116 | Police: 999"));
  }
});

// ─── FLOW BUILDER ──────────────────────────────────────────────────────────────
async function buildResponse(steps, sessionId, phoneNumber) {
  const len = steps.length;

  // STEP 0 — Language select
  if (len === 0) {
    return CON(
      "Welcome to BanaSafe\nTatô go BanaSafe\n\n1. English\n2. Setswana"
    );
  }

  const lang = steps[0] === "2" ? "st" : "en";
  const EN = lang === "en";

  // STEP 1 — Main menu
  if (len === 1) {
    return CON(mainMenu(EN));
  }

  const menuChoice = steps[1];

  // Exit
  if (menuChoice === "4") {
    return END(EN ? "Thank you. Stay safe." : "Ke a leboga. Nna o babalesegile.");
  }

  // Resources — terminal screen (no further input needed)
  if (menuChoice === "3") {
    return END(resources(EN));
  }

  const reportType = menuChoice === "1" ? "GBV" : "Child Abuse";

  // STEP 2 — Incident type
  if (len === 2) {
    return CON(incidentType(EN, reportType));
  }

  const incidentChoice = steps[2];

  // Back to main menu
  const backOption = reportType === "GBV" ? "5" : "6";
  if (incidentChoice === backOption) {
    return CON(mainMenu(EN));
  }

  // STEP 3 — Location
  if (len === 3) {
    return CON(location(EN));
  }

  // STEP 4 — Victim status
  if (len === 4) {
    return CON(victimStatus(EN));
  }

  // STEP 5 — Urgency
  if (len === 5) {
    return CON(urgency(EN));
  }

  // STEP 6 — Confirmation (end session)
  if (len === 6) {
    const refId = generateRefId();

    // Push report to RapidPro asynchronously
    pushToRapidPro({
      refId,
      lang,
      reportType,
      incidentType: incidentChoice,
      location: steps[3],
      victimStatus: steps[4],
      urgency: steps[5],
    }).catch(console.error);

    return END(confirmation(EN, refId));
  }

  // Fallback — restart
  return CON("Welcome to BanaSafe\nTatô go BanaSafe\n\n1. English\n2. Setswana");
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
    ? "Help & Resources\n\nChildline: 116 (free 24/7)\nBONELA: 3953222\nPolice: 999\nLifeline BW: 3911290"
    : "Thuso le Metsotso\n\nChildline: 116 (mahala 24/7)\nBONELA: 3953222\nMapodisi: 999\nLifeline BW: 3911290";
}

function confirmation(en, refId) {
  return en
    ? `Report submitted.\nRef: ${refId}\n\nYou are safe.\nChildline: 116\nPolice: 999\n\nThank you for speaking up.`
    : `Pegelo e romilwe.\nNomoro: ${refId}\n\nO babalesegile.\nChildline: 116\nMapodisi: 999\n\nKe a leboga go bua.`;
}

// ─── RAPIDPRO PUSH ─────────────────────────────────────────────────────────────
async function pushToRapidPro(session) {
  if (!RAPIDPRO_URL || !RAPIDPRO_TOKEN || !RAPIDPRO_FLOW_UUID) {
    console.warn("RapidPro env vars not set — skipping push");
    return;
  }

  await axios.post(
    `${RAPIDPRO_URL}/api/v2/flow_starts.json`,
    {
      flow: RAPIDPRO_FLOW_UUID,
      urns: ["tel:anonymous"],
      extra: {
        ref_id: session.refId,
        lang: session.lang,
        report_type: session.reportType,
        incident_type: session.incidentType,
        location: session.location,
        victim_status: session.victimStatus,
        urgency: session.urgency,
        timestamp: new Date().toISOString(),
      },
    },
    {
      headers: {
        Authorization: `Token ${RAPIDPRO_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  console.log(`Report ${session.refId} pushed to RapidPro`);
}

// ─── UTILITY ───────────────────────────────────────────────────────────────────
function generateRefId() {
  return "BS-" + Math.floor(100000 + Math.random() * 900000);
}

// ─── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`BanaSafe AT USSD bridge running on port ${PORT}`)
);
