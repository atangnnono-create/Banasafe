# BanaSafe USSD Flow Logic
## Bilingual: English / Setswana

---

## Entry Point
**USSD Code:** `*123#` (placeholder — update with your Twilio number)

---

## SCREEN 1 — Language Selection
Welcome to BanaSafe
Tatô go BanaSafe

1. English
2. Setswana

---

## SCREEN 2A — Main Menu (English)
BanaSafe — Safe Reporting
You are anonymous. We protect you.

1. Report GBV incident
2. Report child abuse
3. Get help / resources
4. Exit

## SCREEN 2B — Main Menu (Setswana)
BanaSafe — Go Bolela ka Ponego
O sa itsege. Re a go sireletsa.

1. Bolela tiragalo ya GBV
2. Bolela kgokgontsho ya ngwana
3. Bona thuso / metsotso
4. Tswa

---

## SCREEN 3A — GBV Report (English)
Report GBV Incident
What type of incident?

1. Physical violence
2. Sexual violence
3. Emotional/psychological abuse
4. Economic abuse
5. Back

## SCREEN 3B — GBV Report (Setswana)
Bolela Tiragalo ya GBV
Ke mofuta ofe wa tiragalo?

1. Tiragalo ya mmele
2. Tiragalo ya thobalano
3. Pitlagano ya maikutlo
4. Pitlagano ya ikonomi
5. Boela morago

---

## SCREEN 4A — Location (English)
Where did this happen?

1. Home/Household
2. School
3. Workplace
4. Public place
5. Other

## SCREEN 4B — Location (Setswana)
Go diragaletse kwa kae?

1. Gae/Lapeng
2. Sekoleng
3. Mafelong a tiro
4. Lefelong la setšhaba
5. Mafelo a mangwe

---

## SCREEN 5A — Victim Status (English)
Who needs help?

1. I am the victim
2. Reporting for someone else
3. I am a witness

## SCREEN 5B — Victim Status (Setswana)
Ke mang yo o tlhokang thuso?

1. Ke nna molaodisiwa
2. Ke bolela mo go mongwe
3. Ke mosupi

---

## SCREEN 6A — Urgency (English)
Is this an emergency?

1. Yes — danger right now
2. No — incident already happened
3. Not sure

## SCREEN 6B — Urgency (Setswana)
A ke tshoganyetso?

1. Ee — kotsi jaanong
2. Nnyaa — tiragalo e setse e diragile
3. Ga ke itse

---

## SCREEN 7A — Confirmation (English)
Your report has been submitted.
Reference: [AUTO-ID]

You are safe. Help is available:
- Childline: 116
- BONELA: 3953222
- Police: 999

Thank you for speaking up.

## SCREEN 7B — Confirmation (Setswana)
Pegelo ya gago e romilwe.
Nomoro: [AUTO-ID]

O babalesegile. Thuso e teng:
- Childline: 116
- BONELA: 3953222
- Mapodisi: 999

Ke lebogela go bolela ga gago.

---

## SCREEN 8A — Child Abuse Report (English)
Report Child Abuse
What type of abuse?

1. Physical abuse
2. Sexual abuse
3. Neglect
4. Emotional abuse
5. Child labour
6. Back

## SCREEN 8B — Child Abuse Report (Setswana)
Bolela Kgokgontsho ya Ngwana
Ke mofuta ofe wa kgokgontsho?

1. Kgokgontsho ya mmele
2. Kgokgontsho ya thobalano
3. Go latlha ngwana
4. Kgokgontsho ya maikutlo
5. Go fa ngwana tiro tse di sa molekanang
6. Boela morago

---

## SCREEN 9A — Resources (English)
Help & Resources

1. Childline: 116 (free, 24/7)
2. BONELA: 3953222
3. Police Emergency: 999
4. Lifeline Botswana: 3911290
5. Back to menu

## SCREEN 9B — Resources (Setswana)
Thuso le Metsotso

1. Childline: 116 (mahala, 24/7)
2. BONELA: 3953222
3. Mapodisi: 999
4. Lifeline Botswana: 3911290
5. Boela menong

---

## Flow Notes
- All sessions are stateless and anonymous — no MSISDN stored
- Reference ID is time-based random token, not linked to caller
- Emergency flag (Screen 6, option 1) triggers priority queue in RapidPro
- All reports route to secure RapidPro contact + case log
