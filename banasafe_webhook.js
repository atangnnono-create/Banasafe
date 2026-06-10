require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { MessagingResponse } = require("twilio").twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const {
  RAPIDPRO_URL,
  RAPIDPRO_TOKEN,
  RAPIDPRO_FLOW_UUID,
  PORT = 3000,
} = process.env;

const sessions = {};

app.post("/ussd", async (req, res) => {
  const { From, Body, CallSid } = req.body;
  const sessionId = CallSid || From;
  const userInput = (Body || "").trim();

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      phone: From,
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
  const { text, end } = handleStep(session, userInput);

  const twiml = new MessagingResponse();
  const msg = twiml.message();
  msg.body(text);

  if (end) {
    await pushToRapidPro(session).catch(console.error);
    delete sessions[sessionId];
  }

  res.type("text/xml").send(twiml.toString());
});

function handleStep(session, input) {
  const EN = session.lang === "en";

  switch (session.step) {
    case "lang_select":
      if (input === "1") { session.lang = "en"; session.step = "main_menu"; }
      else if (input === "2") { session.lang = "st"; session.step = "main_menu"; }
      else { return { text: "Welcome to BanaSafe\nTatô go BanaSafe\n\n1. English\n2. Setswana", end: false }; }
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

async function pushToRapidPro(session) {
  if (!RAPIDPRO_URL || !RAPIDPRO_TOKEN || !RAPIDPRO_FLOW_UUID) {
    console.warn("RapidPro env vars not set — skipping push");
    return;
  }
  const payload = {
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
  };
  await axios.post(`${RAPIDPRO_URL}/api/v2/flow_starts.json`, payload, {
    headers: {
      Authorization: `Token ${RAPIDPRO_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  console.log(`Report ${session.refId} pushed to RapidPro`);
}

function generateRefId() {
  return "BS-" + Math.floor(100000 + Math.random() * 900000);
}

app.listen(PORT, () => console.log(`BanaSafe USSD bridge running on port ${PORT}`));
