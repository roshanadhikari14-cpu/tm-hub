// UPRIO parent PTM plan: 3 A4 pages (where the student stands, mistakes with photos, the month's plan).
// Generated from plans/ptm-december-2026/gen.js by make-template.js. Edit the design there, then regenerate.
const baseCss = "\n  :root {\n    --blue: #008cff;\n    --blue-d: #0a63c9;\n    --teal: #00bfba;\n    --green: #12b76a;\n    --green-l: #00e500;\n    --ink: #0f1b2d;\n    --ink-2: #44546a;\n    --ink-3: #7a8799;\n    --line: #e3e9f1;\n    --soft: #f4f8fc;\n    --blue-bg: #eaf4ff;\n    --teal-bg: #e6faf9;\n    --green-bg: #e8f8ef;\n    --amber: #b54708;\n    --amber-bg: #fff4e5;\n    --red: #c4321f;\n    --red-bg: #fdeceb;\n  }\n  @page { size: A4; margin: 0; }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; padding: 0; background: #e9eef4; }\n  body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); font-size: 10.6pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  .page { width: 210mm; height: 297mm; margin: 10mm auto; background: #fff; position: relative; overflow: hidden; padding: 13mm 15mm 13mm; display: flex; flex-direction: column; }\n  @media print { html, body { background: #fff; } .page { margin: 0; page-break-after: always; break-after: page; } .page:last-child { page-break-after: auto; break-after: auto; } }\n  .page::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: linear-gradient(90deg, var(--blue), var(--teal) 60%, var(--green-l)); }\n  h1, h2, h3, h4 { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; margin: 0; letter-spacing: -0.2px; }\n  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }\n  .logo svg { width: 34mm; height: auto; display: block; }\n  .eyebrow { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 8pt; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: var(--blue); }\n  h1 { font-size: 24pt; font-weight: 800; line-height: 1.1; margin-top: 2mm; }\n  h1 .hl { color: var(--blue); }\n  .who { margin-top: 2.5mm; color: var(--ink-2); font-size: 10pt; }\n  .who b { color: var(--ink); }\n  .pagehead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6mm; }\n  .pagehead h2 { font-size: 17pt; font-weight: 800; }\n  .pagehead .logo svg { width: 24mm; }\n  h2.sec { font-size: 12.5pt; font-weight: 800; margin: 4.5mm 0 2.5mm; display: flex; align-items: center; gap: 2.5mm; }\n  h2.sec .n { width: 6.5mm; height: 6.5mm; border-radius: 2mm; background: var(--blue); color: #fff; font-size: 9pt; display: inline-grid; place-items: center; }\n  h2.sec small { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 8.6pt; color: var(--ink-3); margin-left: auto; }\n\n  /* Hero message */\n  .hero { margin-top: 5mm; border-radius: 4mm; background: linear-gradient(120deg, var(--blue-bg), var(--teal-bg)); border: 1px solid #d5e8fb; padding: 4mm 5.5mm; display: grid; grid-template-columns: 1fr auto; gap: 6mm; align-items: center; }\n  .hero p { margin: 0; font-size: 10.4pt; color: var(--ink); line-height: 1.5; }\n  .hero p b { color: var(--blue-d); }\n  .hero .big { text-align: center; padding-left: 6mm; border-left: 1px solid #c9def5; }\n  .hero .big b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 26pt; font-weight: 800; color: var(--green); line-height: 1; }\n  .hero .big span { font-size: 7.8pt; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.6px; }\n\n  /* Stat cards */\n  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }\n  .stat { border: 1px solid var(--line); border-radius: 3mm; padding: 3mm 3.5mm; background: #fff; }\n  .stat b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 16pt; font-weight: 800; line-height: 1.1; }\n  .stat span { display: block; font-size: 8.4pt; color: var(--ink-2); margin-top: 0.6mm; }\n  .stat i { display: inline-block; margin-top: 1.6mm; font-style: normal; font-size: 7.4pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 10mm; }\n  .ok { background: var(--green-bg); color: #087443; }\n  .warn { background: var(--amber-bg); color: var(--amber); }\n  .mid { background: var(--blue-bg); color: var(--blue-d); }\n\n  /* Subject table */\n  table.subj { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 8.9pt; }\n  table.subj th { background: var(--soft); text-align: left; font-size: 7.6pt; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-2); padding: 1.8mm 3mm; font-weight: 700; }\n  table.subj td { padding: 1.7mm 3mm; border-top: 1px solid var(--line); vertical-align: middle; }\n  table.subj td.pc { font-family: 'Plus Jakarta Sans'; font-weight: 800; font-size: 11pt; white-space: nowrap; }\n  .bar { height: 2mm; border-radius: 2mm; background: #edf1f6; overflow: hidden; width: 26mm; display: inline-block; vertical-align: middle; margin-right: 2mm; }\n  .bar > span { display: block; height: 100%; border-radius: 2mm; }\n  .tag { display: inline-block; font-size: 7.4pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 10mm; white-space: nowrap; }\n  .subj-name { font-weight: 600; }\n  .subj-name small { display: block; color: var(--ink-3); font-weight: 500; font-size: 8pt; }\n\n  /* Two columns */\n  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }\n  .box { border-radius: 3mm; padding: 3.5mm 4.5mm; border: 1px solid var(--line); }\n  .box h4 { font-size: 10pt; margin-bottom: 2mm; display: flex; align-items: center; gap: 2mm; }\n  .box ul { margin: 0; padding-left: 4.5mm; }\n  .box li { margin: 1mm 0; }\n  .box.good { background: #f3fbf6; border-color: #cdeedb; }\n  .box.focus { background: #fff9f0; border-color: #f5dfbd; }\n\n  /* Goals */\n  .goals { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }\n  .goal { display: grid; grid-template-columns: 8mm 1fr; gap: 3mm; align-items: start; border: 1px solid var(--line); border-radius: 3mm; padding: 2.6mm 3.2mm; }\n  .goal .ic { width: 8mm; height: 8mm; border-radius: 2.4mm; display: grid; place-items: center; font-size: 11pt; }\n  .goal b { display: block; font-size: 9.8pt; }\n  .goal span { display: block; font-size: 8.6pt; color: var(--ink-2); margin-top: 0.5mm; }\n  .goal .from { font-size: 8pt; color: var(--ink-3); margin-top: 1mm; }\n  .goal .from em { font-style: normal; font-weight: 700; color: var(--blue-d); }\n\n  /* Subject plans (page 2) */\n  .plan { border-radius: 3.5mm; border: 1px solid var(--line); overflow: hidden; margin-bottom: 4mm; }\n  .plan-head { display: flex; align-items: center; gap: 3mm; padding: 3mm 4.5mm; color: #fff; }\n  .plan-head h3 { font-size: 12.5pt; font-weight: 800; }\n  .plan-head span { margin-left: auto; font-size: 8.4pt; opacity: 0.92; font-weight: 600; }\n  .plan.maths .plan-head { background: linear-gradient(90deg, var(--blue), #2aa3ff); }\n  .plan.science .plan-head { background: linear-gradient(90deg, #00a8a3, var(--teal)); }\n  .plan.basics .plan-head { background: linear-gradient(90deg, #0f9f58, #22c26b); }\n  .plan-body { display: grid; grid-template-columns: 1.1fr 1fr; gap: 0; }\n  .plan-body > div { padding: 3.5mm 4.5mm; }\n  .plan-body > div + div { border-left: 1px solid var(--line); background: var(--soft); }\n  .plan-body h4 { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.6px; color: var(--ink-3); margin-bottom: 2mm; font-weight: 800; }\n  .step { display: grid; grid-template-columns: 5.5mm 1fr; gap: 2.5mm; margin-bottom: 2.4mm; }\n  .step .k { width: 5.5mm; height: 5.5mm; border-radius: 50%; display: grid; place-items: center; font-size: 7.6pt; font-weight: 800; color: #fff; margin-top: 0.4mm; }\n  .maths .k { background: var(--blue); }\n  .science .k { background: var(--teal); }\n  .basics .k { background: var(--green); }\n  .step b { display: block; font-size: 9.6pt; }\n  .step span { display: block; font-size: 8.6pt; color: var(--ink-2); }\n  .why li { font-size: 8.8pt; margin: 1.2mm 0; color: var(--ink-2); }\n  .why li b { color: var(--ink); }\n  .why { margin: 0; padding-left: 4mm; }\n  .target { margin-top: 2.5mm; font-size: 8.6pt; background: #fff; border: 1px dashed #b8d8f8; border-radius: 2.4mm; padding: 2mm 3mm; color: var(--ink-2); }\n  .target b { color: var(--blue-d); }\n  .science .target { border-color: #a9e6e3; }\n  .science .target b { color: #00837f; }\n  .basics .target { border-color: #b9e7cd; }\n  .basics .target b { color: #087443; }\n\n  /* Calendar (page 3) */\n  .weeks { display: grid; gap: 2.2mm; }\n  .week { display: grid; grid-template-columns: 27mm 1fr 1fr 1fr; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; }\n  .week > div { padding: 2.1mm 3mm; font-size: 8.6pt; }\n  .week .wk { background: var(--soft); }\n  .week .wk b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 10.2pt; font-weight: 800; }\n  .week .wk span { font-size: 8pt; color: var(--ink-3); }\n  .week .c { border-left: 1px solid var(--line); }\n  .week .c small { display: block; font-size: 7.2pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 0.6mm; }\n  .c.m small { color: var(--blue); }\n  .c.s small { color: #00a8a3; }\n  .c.b small { color: var(--green); }\n  .weekhead { display: grid; grid-template-columns: 27mm 1fr 1fr 1fr; font-size: 7.6pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--ink-3); padding: 0 3mm 0.8mm; }\n  .weekhead span:nth-child(2) { color: var(--blue); } .weekhead span:nth-child(3) { color: #00a8a3; } .weekhead span:nth-child(4) { color: var(--green); }\n  .milestone { display: inline-block; margin-top: 1mm; font-size: 7.4pt; font-weight: 700; padding: 0.4mm 2mm; border-radius: 10mm; background: var(--blue-bg); color: var(--blue-d); }\n\n  .help { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }\n  .help .box { padding: 2.6mm 3.2mm; }\n  .help .box b { display: block; font-size: 9.4pt; margin-bottom: 0.8mm; }\n  .help .box span { font-size: 8.5pt; color: var(--ink-2); }\n  .help .ic { font-size: 11pt; display: block; margin-bottom: 0.6mm; }\n\n  .checkins { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }\n  .chk { border-radius: 3mm; background: linear-gradient(135deg, var(--blue-bg), var(--teal-bg)); padding: 3mm 3.5mm; }\n  .chk small { font-size: 7.4pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--blue-d); }\n  .chk b { display: block; font-size: 9.6pt; margin-top: 0.6mm; }\n  .chk span { font-size: 8.4pt; color: var(--ink-2); }\n\n  .cycle { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; }\n  .cy { position: relative; border-radius: 3mm; padding: 2.4mm 2.6mm; background: linear-gradient(160deg, var(--blue-bg), var(--teal-bg)); border: 1px solid #d5e8fb; }\n  .cy .ci { display: block; font-size: 13pt; margin-bottom: 1mm; }\n  .cy b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 10pt; font-weight: 800; color: var(--blue-d); }\n  .cy span:last-child { display: block; font-size: 8.2pt; color: var(--ink-2); margin-top: 0.5mm; line-height: 1.35; }\n  .cy + .cy::before { content: '›'; position: absolute; left: -2.4mm; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--teal); font-size: 12pt; }\n  .foot { margin-top: auto; padding-top: 3mm; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 7.8pt; color: var(--ink-3); }\n  .note { font-size: 8pt; color: var(--ink-3); margin-top: 2.5mm; }\n";
const logo = "<svg viewBox=\"0 0 77 19\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<g>\n<g>\n<path d=\"M67.4222 0.5C61.3527 0.5 58.1084 4.33693 58.1084 9.5C58.1084 15.0816 61.8411 18.5 67.4222 18.5C73.0032 18.5 76.7359 15.0816 76.7359 9.5C76.7359 3.91837 73.2128 0.5 67.4222 0.5ZM67.4222 15.081C64.0731 15.081 62.12 13.0232 62.12 9.49941C62.12 5.97566 64.0737 3.91777 67.4222 3.91777C70.7707 3.91777 72.6894 5.94073 72.6894 9.49941C72.6894 13.0581 70.7707 15.081 67.4222 15.081Z\" fill=\"#010101\"/>\n<path d=\"M56.1178 0.778748H52.0713V18.2205H56.1178V0.778748Z\" fill=\"#010101\"/>\n<path d=\"M46.3506 12.8833L46.2925 12.7839C48.6654 11.6377 49.6647 9.1956 49.6647 7.09272C49.6647 3.18593 46.9438 0.778748 43.037 0.778748H35.3975V18.2205H39.444V13.4416H42.41L43.246 14.872C44.7462 17.4532 46.1066 18.465 49.5599 18.465H49.6647V15.2207C47.9206 15.0809 47.1883 14.3137 46.3506 12.8833Z\" fill=\"#010101\"/>\n<path d=\"M27.4602 0.778687H19.0801V18.2204H23.1266V13.4416H27.4602C30.8786 13.4416 33.8358 11.4879 33.8358 7.09266C33.8008 3.39486 31.1574 0.778687 27.4602 0.778687Z\" fill=\"#010101\"/>\n<path d=\"M8.23273 18.4993C13.4651 18.4993 16.4305 15.4995 16.4305 10.5111V0.778748H12.384V10.5111C12.384 13.3718 11.0585 15.0809 8.23273 15.0809C5.58163 15.0809 4.04651 13.4416 4.04651 10.5111V0.778748H0V10.5111C0 15.4995 3.06966 18.4993 8.23273 18.4993Z\" fill=\"#010101\"/>\n</g>\n<path d=\"M43.3673 9.98729H38.5879L40.9223 7.09227L38.5879 4.2316H43.3673L45.6662 7.09227L43.3673 9.98729Z\" fill=\"#00E500\"/>\n<path d=\"M31.1299 9.98729H35.3996L37.3852 7.09227L35.3996 4.2316H31.1299V9.98729Z\" fill=\"#00BFBA\"/>\n<path d=\"M28.5097 4.23157H23.1992V9.98726H28.5097V4.23157Z\" fill=\"#008CFF\"/>\n</g>\n</svg>";
const extraCss = `
  .p3 { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 9.6pt; }
  .p3 th { background: var(--soft); text-align: left; font-size: 7.8pt; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-2); padding: 2mm 3.5mm; font-weight: 700; }
  .p3 td { padding: 2.4mm 4mm; border-top: 1px solid var(--line); vertical-align: top; }
  .p3 ul { margin: 0; padding-left: 4.2mm; }
  .p3 li { margin: 0.6mm 0; line-height: 1.4; color: var(--ink); }
  .p3-area { white-space: nowrap; }
  .p3-area .ic { display: inline-grid; place-items: center; width: 7mm; height: 7mm; border-radius: 2mm; margin-right: 2mm; vertical-align: middle; font-size: 10.5pt; }
  .p3-area b { font-size: 11pt; vertical-align: middle; }
  .p3-aim { background: #f6fbf8; color: #0c5d36; font-size: 10pt; line-height: 1.45; }
  .p3-aim em { font-style: normal; font-weight: 700; color: #087443; }
  .p3-flow { margin: 3.4mm 0 1mm; font-size: 9.6pt; color: var(--ink-2); background: var(--blue-bg); border-radius: 2.4mm; padding: 2mm 3.5mm; }
  .p3-flow b { color: var(--blue-d); }
  .p3-two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .p3-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2mm; font-size: 8.8pt; line-height: 1.38; color: var(--ink-2); }
  .p3-list li { border: 1px solid var(--line); border-radius: 2.6mm; padding: 2.1mm 3mm 2.1mm 8mm; position: relative; }
  .p3-list li b { color: var(--ink); }
  .p3-list.check li::before { content: '✓'; position: absolute; left: 3mm; top: 1.6mm; color: var(--green); font-weight: 800; }
  .p3-list.when li { padding-left: 3mm; }
  .p3-list.when li span { display: block; font-size: 7.4pt; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: var(--blue-d); }
  .page { padding: 12mm 14mm 12mm; }
  .hero { margin-top: 4mm; padding: 3.2mm 5mm; }
  .hero p { font-size: 9.7pt; line-height: 1.45; }
  .hero .big b { font-size: 22pt; }
  h2.sec { margin: 3.6mm 0 2mm; font-size: 12pt; }
  .stat { padding: 2.3mm 3mm; }
  .stat b { font-size: 14.5pt; }
  .stat span { font-size: 8pt; }
  table.subj td { padding: 1.35mm 3mm; }
  table.subj td.pc { font-size: 10pt; }
  .two .box { padding: 2.6mm 4mm; }
  .two .box h4 { margin-bottom: 1.2mm; }
  .two .box li { margin: 0.5mm 0; font-size: 9pt; }
  .talk { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1.2mm 5mm; border: 1px solid #d5e8fb; border-radius: 3mm; padding: 2.4mm 4mm; background: #fbfdff; }
  .talk h4 { grid-column: 1 / -1; font-size: 9.6pt; color: var(--blue-d); margin: 0 0 0.5mm; }
  .talk div { font-size: 8.6pt; display: flex; gap: 2mm; align-items: flex-start; color: var(--ink); }
  .talk div b.n { flex: 0 0 4.6mm; height: 4.6mm; border-radius: 50%; background: var(--blue); color: #fff; font-size: 7pt; display: grid; place-items: center; margin-top: 0.3mm; }
  .intro { font-size: 9.6pt; color: var(--ink-2); background: var(--amber-bg); border: 1px solid #f5dfbd; border-radius: 3mm; padding: 2.6mm 4mm; margin-bottom: 3.5mm; }
  .intro b { color: var(--ink); }
  .mist { display: grid; gap: 3mm; }
  .mist.n4 { grid-template-columns: 1fr 1fr; }
  .mist.n6 { grid-template-columns: 1fr 1fr 1fr; gap: 2.6mm; }
  .mist.n6 .mc { grid-template-rows: 38mm auto; }
  .mist.n6 .mc .ph img { max-height: 38mm; }
  .mist.n6 .mc .tx { padding: 2mm 2.6mm; font-size: 7.8pt; gap: 1mm; }
  .mist.n6 .mc .tx h5 { font-size: 8.4pt; flex-direction: column; align-items: flex-start; gap: 0.8mm; }
  .mist.n6 .mc .tx .ok-ans { padding: 1mm 2mm; }
  .chsum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .chsum > div { border: 1px solid var(--line); border-radius: 3mm; padding: 2.4mm 3mm; background: var(--soft); }
  .chsum b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 11pt; font-weight: 800; line-height: 1.2; }
  .chsum span { font-size: 7.8pt; color: var(--ink-3); }
  .chips2 { display: flex; flex-wrap: wrap; gap: 1.6mm; margin: 1.6mm 0; }
  .chips2 .chip { font-size: 7.6pt; font-weight: 700; padding: 0.6mm 2.2mm; border-radius: 10mm; background: var(--blue-bg); color: var(--blue-d); }
  .chrows { display: grid; gap: 1.6mm; margin-top: 3mm; }
  .chr { display: grid; grid-template-columns: 52mm 14mm 14mm 1fr; align-items: center; gap: 2mm; border: 1px solid var(--line); border-left: 1.2mm solid var(--blue); border-radius: 2.4mm; padding: 1.5mm 3mm; font-size: 8pt; }
  .chr.sci { border-left-color: var(--teal); }
  .chr b { font-size: 8.6pt; } .chr small { color: var(--ink-3); font-size: 7pt; text-transform: uppercase; font-weight: 800; } .chr .chp2 { font-family: 'Plus Jakarta Sans'; font-weight: 800; font-size: 10pt; } .chr em { font-style: normal; color: var(--ink-2); }
  .chg2 { column-count: 2; column-gap: 3mm; margin-top: 3.5mm; }
  .chg2 .chc { break-inside: avoid; margin-bottom: 3mm; }
  .chc { border: 1px solid var(--line); border-left: 1.2mm solid var(--blue); border-radius: 3mm; padding: 2.8mm 3.4mm; background: #fff; }
  .chc.sci { border-left-color: var(--teal); }
  .chh { display: flex; justify-content: space-between; gap: 2mm; }
  .chh small { font-size: 7pt; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: var(--ink-3); }
  .chh h5 { margin: 0.4mm 0 0; font-size: 10pt; font-family: 'Plus Jakarta Sans'; line-height: 1.2; }
  .chh em { font-style: normal; font-size: 7.6pt; color: var(--ink-3); }
  .chp { text-align: right; font-family: 'Plus Jakarta Sans'; font-size: 16pt; font-weight: 800; line-height: 1; white-space: nowrap; }
  .chp span { display: block; font-family: 'Inter'; font-size: 6.8pt; font-weight: 600; color: var(--ink-3); margin-top: 0.6mm; }
  .chs { margin: 1.6mm 0 0; font-size: 8.2pt; color: var(--ink-2); font-weight: 600; }
  .spark { display: flex; gap: 1.6mm; align-items: flex-end; height: 12mm; margin: 5mm 0 5.5mm; }
  .spark span { flex: 1; height: 100%; position: relative; display: flex; align-items: flex-end; }
  .spark i { display: block; width: 100%; border-radius: 0.8mm 0.8mm 0 0; }
  .spark b { position: absolute; top: -3mm; left: 0; right: 0; text-align: center; font-size: 6.6pt; color: var(--ink-2); }
  .spark em { position: absolute; bottom: -3.6mm; left: -1mm; right: -1mm; text-align: center; font-style: normal; font-size: 6pt; color: var(--ink-3); white-space: nowrap; }
  .chl { margin: 1.4mm 0 0; font-size: 8pt; color: var(--ink); line-height: 1.4; }
  .chg { margin: 1.2mm 0 0; font-size: 7.8pt; line-height: 1.35; padding: 1mm 2mm; border-radius: 1.6mm; }
  .chg.ok { background: var(--green-bg); color: #087443; } .chg.warn { background: var(--amber-bg); color: var(--amber); } .chg.miss { background: var(--red-bg); color: var(--red); }
  .chg2.n6 { column-gap: 2.4mm; margin-top: 2.4mm; } .chg2.n6 .chc { margin-bottom: 2.4mm; } .chg2.n6 .chg { margin-top: 0.8mm; padding: 0.6mm 1.8mm; } .chg2.n6 .chl { margin-top: 1mm; } .chg2.n6 .chs { margin-top: 0.8mm; }
  .chc:has(+ .chc) { }
  .chg2.n6 .chc { padding: 2.2mm 3mm; } .chg2.n6 .spark { height: 9mm; margin: 4.4mm 0 5mm; } .chg2.n6 .chh h5 { font-size: 9.2pt; } .chg2.n6 .chp { font-size: 14pt; } .chg2.n6 .chl, .chg2.n6 .chg { font-size: 7.4pt; }
  .ins { display: grid; grid-template-columns: 1fr 1fr; gap: 3.2mm; margin-top: 3mm; }
  .icard { border: 1px solid var(--line); border-radius: 3mm; padding: 3mm 3.8mm; background: #fff; border-left: 1.2mm solid var(--blue); }
  .icard.sci { border-left-color: var(--teal); } .icard.hab { border-left-color: #f0a23b; } .icard.bas { border-left-color: var(--green); } .icard.pri { border-left-color: #c4321f; } .icard.oth { border-left-color: var(--ink-3); }
  .icard h4 { font-size: 9.8pt; margin-bottom: 1.6mm; }
  .icard ul { margin: 0; padding-left: 4mm; font-size: 8.9pt; color: var(--ink-2); line-height: 1.45; }
  .icard li { margin: 1mm 0; } .icard b { color: var(--ink); }
  .ins.roomy { gap: 3.4mm; margin-top: 4mm; } .ins.roomy .icard { padding: 3.6mm 4.2mm; } .ins.roomy .icard h4 { font-size: 10.6pt; margin-bottom: 2.4mm; } .ins.roomy .icard ul { font-size: 9.6pt; } .ins.roomy .icard li { margin: 1.6mm 0; }
  .ins.tight .icard { padding: 2.2mm 3mm; } .ins.tight .icard ul { font-size: 8.2pt; }
  .subjs { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
  .sbox { border-radius: 3mm; padding: 2.4mm 3.6mm; border: 1px solid var(--line); background: #fff; }
  .sbox h4 { margin: 0 0 0.8mm; font-size: 9.4pt; }
  .sbox p { margin: 0; font-size: 8.4pt; line-height: 1.4; color: var(--ink-2); }
  .sbox.maths { background: #f3f9ff; border-color: #d5e8fb; } .sbox.sci { background: #f2fbf6; border-color: #cdeedb; }
  .mist.n3 { grid-template-columns: 1fr; }
  .mc { border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; display: grid; background: #fff; }
  .mist.n4 .mc { grid-template-rows: 35mm auto; }
  .mist.n3 .mc { grid-template-columns: 78mm 1fr; min-height: 44mm; }
  .mc .ph { background: #f1f3f7; display: grid; place-items: center; overflow: hidden; }
  .mc .ph img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .mist.n3 .mc .ph img { max-height: 52mm; }
  .mist.n4 .mc .ph img { max-height: 35mm; }
  .mc .tx { padding: 2.6mm 3.4mm; font-size: 8.7pt; color: var(--ink-2); display: grid; gap: 1.4mm; align-content: start; }
  .mc .tx h5 { margin: 0; font-family: 'Plus Jakarta Sans'; font-size: 9.4pt; color: var(--ink); display: flex; justify-content: space-between; gap: 2mm; align-items: center; }
  .mc .tx .lbl { font-size: 7pt; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: var(--ink-3); display: block; }
  .mc .tx .ok-ans { background: var(--green-bg); color: #0c5d36; border-radius: 2mm; padding: 1.4mm 2.4mm; }
  .mc .tx .ok-ans b { color: #087443; }
  .dt2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .dt-col h3 { font-size: 11pt; font-weight: 800; margin: 0 0 1.6mm; display: flex; align-items: baseline; gap: 2mm; }
  .dt-col h3 small { font-family: 'Inter'; font-weight: 500; font-size: 7.6pt; color: var(--ink-3); margin-left: auto; }
  table.dt { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 8.4pt; table-layout: fixed; }
  table.dt td { padding: 1.3mm 2mm; border-top: 1px solid var(--line); vertical-align: middle; }
  table.dt tr:first-child td { border-top: 0; }
  .dn { font-weight: 600; line-height: 1.25; width: 44%; }
  .ds { white-space: nowrap; width: 26%; } .ds b { font-family: 'Plus Jakarta Sans'; font-weight: 800; margin-left: 1mm; }
  .dash { color: var(--ink-3); }
  .dg { text-align: right; width: 30%; }
  table.dt .tag { font-size: 6.8pt; padding: 0.4mm 1.6mm; }
  .tag.grey { background: #eef0f6; color: #5b6478; }
  .eng { display: grid; gap: 1.6mm; }
  .er { display: grid; grid-template-columns: 28mm 1fr 16mm 52mm; gap: 3mm; align-items: center; font-size: 8.6pt; }
  .el { font-weight: 700; } .eb { height: 2.6mm; background: #e8ecf3; border-radius: 1.3mm; overflow: hidden; } .eb i { display: block; height: 100%; border-radius: 1.3mm; }
  .ev { font-family: 'Plus Jakarta Sans'; font-weight: 800; text-align: right; } .en { color: var(--ink-3); font-size: 7.8pt; }
  .prio { display: grid; gap: 1.4mm; font-size: 8.6pt; } .prio div { display: grid; grid-template-columns: 30mm 1fr; gap: 3mm; } .prio b { color: var(--ink); } .prio span { color: var(--ink-2); }
  .also { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .also .box { padding: 3mm 3.6mm; }
  .also .box h4 { font-size: 9.6pt; margin-bottom: 1.6mm; }
  .also ul { margin: 0; padding-left: 4.4mm; font-size: 8.7pt; color: var(--ink-2); }
  .also li { margin: 0.8mm 0; }
  .also p { margin: 0; font-size: 8.7pt; color: var(--ink-2); line-height: 1.45; }
  .chips { display: flex; flex-wrap: wrap; gap: 1.6mm; margin-top: 2mm; }
  .chips span { font-size: 8pt; font-weight: 700; padding: 0.8mm 2.6mm; border-radius: 10mm; background: var(--green-bg); color: #087443; }
  .exam { margin: 0 0 3.5mm; border-radius: 3mm; padding: 2.8mm 4mm; background: linear-gradient(90deg, #fff1e0, #fff8ef); border: 1px solid #f5d2a6; font-size: 9.4pt; color: #8a4300; font-weight: 600; }
  .cycle { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; }
  .cy { position: relative; border-radius: 3mm; padding: 2.4mm 2.6mm; background: linear-gradient(160deg, var(--blue-bg), var(--teal-bg)); border: 1px solid #d5e8fb; }
  .cy .ci { display: block; font-size: 12pt; margin-bottom: 0.8mm; }
  .cy b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 9.8pt; font-weight: 800; color: var(--blue-d); }
  .cy span:last-child { display: block; font-size: 8pt; color: var(--ink-2); margin-top: 0.5mm; line-height: 1.35; }
  .cy + .cy::before { content: '›'; position: absolute; left: -2.4mm; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--teal); font-size: 12pt; }
  .help .box { padding: 2.6mm 3.2mm; }
  .help .ic { font-size: 11pt; display: block; margin-bottom: 0.6mm; }
`;

const bar = (v, cls) => {
  if (v == null) return '<span style="color:var(--ink-3)">—</span>';
  const color = cls === 'ok' ? 'var(--green)' : cls === 'warn' ? '#f0a23b' : 'var(--blue)';
  return `<span class="bar"><span style="width:${Math.max(4, Math.min(100, v))}%;background:${color}"></span></span>${v}%`;
};
const hasCh = (s) => !!(s.chapters && s.chapters.list && s.chapters.list.length && s.chapters.total > 0);
const foot = (s, n) => `<div class="foot"><span>UPRIO · Personal Learning Plan · ${s.month}</span><span>${s.name} · Grade ${s.grade} · Page ${n === 2.5 ? 3 : hasCh(s) && n >= 3 ? n + 1 : n} of ${hasCh(s) ? 5 : 4}</span></div>`;
const head = (eyebrow, h) => `<div class="pagehead"><div><div class="eyebrow">${eyebrow}</div><h2>${h}</h2></div><div class="logo">${logo}</div></div>`;

function page1(s) {
  return `<section class="page">
  <div class="top">
    <div>
      <div class="eyebrow">Personal Learning Plan · ${s.month}</div>
      <h1>${s.first}’s <span class="hl">${s.monthName}</span> Plan</h1>
      <div class="who"><b>${s.name}</b> · Grade ${s.grade} · ${s.school}<br>Tutor Manager: <b>${s.tm}</b></div>
    </div>
    <div class="logo">${logo}</div>
  </div>
  <div class="hero"><p>${s.hero}</p><div class="big"><b>${s.big[0]}</b><span>${s.big[1]}</span></div></div>
  <div class="talk"><h4>💬 What we will discuss today</h4>${s.talk.map((t, i) => `<div><b class="n">${i + 1}</b><span>${t}</span></div>`).join('')}</div>
  <h2 class="sec"><span class="n">1</span>Where ${s.first} stands today <small>UPRIO reports${s.period ? ', ' + s.period : ''}</small></h2>
  <div class="stats">${s.stats.map(([v, l, c, t]) => `<div class="stat"><b>${v}</b><span>${l}</span><i class="${c}">${t}</i></div>`).join('')}</div>
  <h2 class="sec"><span class="n">2</span>${s.examLine ? 'Upcoming exam chapters' : 'Subject snapshot'} ${s.examLine ? `<small>${s.examLine}</small>` : ''}</h2>
  <table class="subj"><thead><tr><th>Subject · Chapter</th><th>Score</th><th>What it means</th></tr></thead><tbody>
    ${s.snapshot.map(([n, sub, v, c, tag, m]) => `<tr><td class="subj-name">${n}<small>${sub}</small></td><td class="pc">${bar(v, c)}</td><td><span class="tag ${c}">${tag}</span> ${m}</td></tr>`).join('')}
  </tbody></table>
  <div class="two" style="margin-top:3.5mm">
    <div class="box good"><h4>⭐ ${s.first}’s strengths</h4><ul>${s.strengths.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    <div class="box focus"><h4>🎯 What we will work on</h4><ul>${s.workOn.map((x) => `<li>${x}</li>`).join('')}</ul></div>
  </div>
  ${foot(s, 1)}
</section>`;
}

// When few or no notebook photos are available, fill the page with analysis of the student's reports
function insights(s) {
  const d = s.detail || {};
  const k = s.mistakes.length;
  if (k >= 4) return '';
  const rows = d.rows || {};
  const weak = (sub) => (rows[sub] || []).filter((c) => c.pct != null && c.pct < 85).sort((a, b) => a.pct - b.pct).slice(0, 3);
  const open = (sub) => (rows[sub] || []).filter((c) => c.pct == null).slice(0, 3);
  const li = (a) => a.map((x) => '<li>' + x + '</li>').join('');
  const chap = (sub) => {
    const w = weak(sub).map((c) => '<b>' + c.name + '</b> is at ' + c.pct + '% (' + c.tag.toLowerCase() + ')');
    const o = open(sub);
    if (o.length) w.push('No result yet for <b>' + o.map((c) => c.name).join(', ') + '</b>; a quick check test will show where it stands');
    return w;
  };
  const cards = [];
  const mm = chap('Maths');
  cards.push(['📐', 'Maths: what the reports show', mm.length ? mm : ['Chapter results look healthy. We will keep them above 90% with short revision tests.'], 'maths']);
  const ss = chap('Science');
  if (s.writing) ss.push(s.writing);
  cards.push(['🔬', 'Science: what the reports show', ss.length ? ss : ['Chapter results look healthy. We will keep practising full-marks answers.'], 'sci']);
  const eng = (d.eng || []).filter((e) => e.pct != null && e.pct < 85).map((e) => '<b>' + e.label + ' ' + e.value + '</b>: ' + e.note);
  (d.missed || []).forEach((x) => eng.push('Missed session: ' + x));
  cards.push(['⏱️', 'Habits and routine', eng.length ? eng : ['Attendance, punctuality and practice are on track. The aim is to keep this rhythm.'], 'hab']);
  if (d.basics && d.basics.length) cards.push(['🧱', 'Basic skills to rebuild', d.basics.slice(0, 3), 'bas']);
  else {
    const g = s.goals || {};
    const nx = ['maths', 'science'].filter((x) => g[x]).map((x) => '<b>' + (x === 'maths' ? 'Maths' : 'Science') + ':</b> ' + g[x][0].slice(0, 2).join('; '));
    if (nx.length) cards.push(['🧱', 'How we will close the gaps', nx, 'bas']);
  }
  const pr = d.prio || {};
  const pl = [];
  if (pr.revise && pr.revise.length) pl.push('<b>Revise first:</b> ' + pr.revise.slice(0, 3).join('; '));
  if (pr.test && pr.test.length) pl.push('<b>Take a check test:</b> ' + pr.test.slice(0, 3).join('; '));
  if (pr.now && pr.now.length) pl.push('<b>Being taught now:</b> ' + pr.now.slice(0, 3).join('; '));
  (s.workOn || []).forEach((x) => { if (pl.length < 4) pl.push(x); });
  cards.push(['🎯', 'Priorities before the exam', pl.length ? pl : ['Keep to the school chapter plan and revise weekly.'], 'pri']);
  const al = (s.alsoNoticed || []).concat(d.noticed || []).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  cards.push(['🔎', 'Also noticed in the reports', al.length ? al : ['Nothing else stands out this month.'], 'oth']);
  const n = k >= 3 ? 2 : 6;
  return '<div class="ins' + (k >= 3 ? ' tight' : k === 0 ? ' roomy' : '') + '">' + cards.slice(0, n).map(([ic, h, a, c]) => '<div class="icard ' + c + '"><h4>' + ic + ' ' + h + '</h4><ul>' + li(a) + '</ul></div>').join('') + '</div>';
}

const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Chapter-by-chapter analysis of the Lighthouse chapter reports (this month and last month)
function pageChapters(s) {
  if (!hasCh(s)) return '';
  const C = s.chapters;
  const col = (p) => (p >= 85 ? 'var(--green)' : p >= 60 ? 'var(--blue)' : '#f0a23b');
  const sum = [
    [C.total + ' chapter report' + (C.total === 1 ? '' : 's'), (C.notes && C.notes.length ? 'for upcoming-exam chapters' : 'analysed (this and last month)')],
    C.avg != null ? [C.avg + '%', 'average chapter mastery'] : null,
    C.best ? [esc(C.best.name), 'strongest · ' + C.best.pct + '%'] : null,
    C.up ? [esc(C.up.name), 'most improved · +' + C.up.v + '%'] : C.low ? [esc(C.low.name), 'needs most work · ' + C.low.pct + '%'] : null,
  ].filter(Boolean);
  const card = (c) => {
    const spark = c.steps.length > 1 ? '<div class="spark">' + c.steps.map((x) => '<span title="' + esc(x.label) + '"><i style="height:' + Math.max(8, x.pct) + '%;background:' + col(x.pct) + '"></i><b>' + x.pct + '%</b><em>' + esc(x.date || x.label) + '</em></span>').join('') + '</div>' : '';
    const stat = c.sci ? esc(c.sci.blocks || '') : (c.mastered != null ? c.mastered + ' of ' + c.taught + ' question types mastered' : '');
    const chips = c.sci ? [c.sci.aligned != null ? 'Marks aligned ' + c.sci.aligned + '%' : '', c.sci.structured != null ? 'Structured ' + c.sci.structured + '%' : ''].filter(Boolean).map((x) => '<span class="chip">' + x + '</span>').join('') : '';
    return '<div class="chc ' + (c.subject === 'Science' ? 'sci' : 'mat') + '"><div class="chh"><div><small>' + c.subject + ' · ' + esc(c.when) + (c.exam ? ' · in upcoming exam' : '') + '</small><h5>' + esc(c.name) + '</h5><em>' + esc(c.range) + '</em></div>' +
      (c.pct != null ? '<div class="chp" style="color:' + col(c.pct) + '">' + c.pct + '%<span>' + (c.was != null ? 'now · was ' + c.was + '%' : 'mastery' + (c.improvement ? ' · +' + c.improvement + '%' : '')) + '</span></div>' : '') + '</div>' +
      (stat ? '<p class="chs">' + stat + '</p>' : '') + spark + (chips ? '<div class="chips2">' + chips + '</div>' : '') +
      (c.line ? '<p class="chl">' + esc(c.line) + '</p>' : '') +
      (c.fixed.length ? '<p class="chg ok"><b>Now clear:</b> ' + c.fixed.map(esc).join('; ') + '</p>' : '') +
      (c.gaps.length ? '<p class="chg warn"><b>To work on:</b> ' + c.gaps.map(esc).join('; ') + (c.gapMore ? ' +' + c.gapMore + ' more' : '') + '</p>' : '') +
      (c.missed.length ? '<p class="chg miss"><b>Missed:</b> ' + c.missed.map(esc).join('; ') + '</p>' : '') + '</div>';
  };
  const ex = (C.notes || []).map((n) => '<span class="chip">' + esc(n) + '</span>').join('') + (C.exams || []).map((e) => '<span class="chip">' + esc(e.subject) + ' ' + esc(e.exam) + (e.taught != null ? ': ' + Math.round(e.taught) + '% taught' : '') + (e.evaluated != null ? ', ' + Math.round(e.evaluated) + '% evaluated' : '') + '</span>').join('');
  return `<section class="page">
  ${head(C.notes && C.notes.length ? 'Aligned to the upcoming exam' : 'From the chapter reports', 'Exam chapters, one by one')}
  <div class="chsum">${sum.map(([b, l]) => '<div><b>' + b + '</b><span>' + l + '</span></div>').join('')}</div>
  ${ex ? '<div class="chips2" style="margin:2mm 0 0">' + ex + '</div>' : ''}
  <div class="chg2 n${C.list.filter((c) => !c.placeholder).length > 4 ? 6 : 4}">${C.list.filter((c) => !c.placeholder).map(card).join('')}</div>
  ${C.list.some((c) => c.placeholder) ? '<div class="chrows">' + C.list.filter((c) => c.placeholder).map((c) => '<div class="chr ' + (c.subject === 'Science' ? 'sci' : 'mat') + '"><b>' + esc(c.name) + '</b><small>' + c.subject + '</small>' + (c.pct != null ? '<span class="chp2" style="color:' + col(c.pct) + '">' + c.pct + '%</span>' : '<span class="chp2">—</span>') + '<em>' + esc(c.line) + '</em></div>').join('') + '</div>' : ''}
  <p class="note">${C.hidden ? C.hidden + ' other chapter report' + (C.hidden === 1 ? ' is' : 's are') + ' not part of the upcoming exam and ' + (C.hidden === 1 ? 'is' : 'are') + ' left out. ' : ''}Based on ${s.first}’s UPRIO chapter reports: the bars show chapter mastery after the evaluation and each improvement class.${C.missed ? ' Missed sessions are shown so we can plan them again.' : ''}</p>
  ${foot(s, 2.5)}
</section>`;
}

function page2(s) {
  const n = s.mistakes.length >= 5 ? 'n6' : s.mistakes.length >= 4 ? 'n4' : 'n3';
  const sj = s.subjects;
  return `<section class="page">
  ${head('From ' + s.first + '’s own notebook', 'Small mistakes we spotted')}
  ${sj ? `<div class="subjs"><div class="sbox maths"><h4>📐 Maths in short</h4><p>${sj.maths}</p></div><div class="sbox sci"><h4>🔬 Science in short</h4><p>${sj.science}</p></div></div>` : ''}
  <div class="mist ${n}">${s.mistakes
    .map(
      (m) => `<div class="mc"><div class="ph"><img src="${m.img}" alt=""></div><div class="tx">
      <h5>${m.title}<span class="tag warn">${m.tag}</span></h5>
      <div><span class="lbl">What happened</span>${m.what}</div>
      <div class="ok-ans"><span class="lbl" style="color:#087443">The correct way</span>${m.right}</div>
    </div></div>`
    )
    .join('')}</div>
  ${insights(s)}
  <p class="note">${s.mistakes.length ? `Photos are from ${s.first}’s UPRIO evaluation classes; the red marks were added by our evaluators.` : `No notebook photos were available this cycle, so this page is based on ${s.first}’s UPRIO Monthly Learning Report and evaluation results.`}</p>
  ${foot(s, 3)}
</section>`;
}

// Page 2: this month in detail, from the Monthly Learning Report (chapters of the upcoming exam only)
const tagCls = (t) => (/Strong/.test(t) ? 'ok' : /Polish|Building|progress/i.test(t) ? 'mid' : /Revise/.test(t) ? 'warn' : 'grey');
function pageDetail(s) {
  const d = s.detail;
  const rowsOf = (sub, icon) => {
    const list = (d && d.rows && d.rows[sub]) || [];
    return `<div class="dt-col"><h3>${icon} ${sub} <small>${list.length} chapter${list.length === 1 ? '' : 's'}</small></h3>${
      list.length
        ? `<table class="dt"><tbody>${list
            .map((c) => `<tr><td class="dn">${c.name}</td><td class="ds">${c.pct == null ? '<span class="dash">—</span>' : `<span class="bar" style="width:12mm"><span style="width:${Math.max(4, c.pct)}%;background:${c.pct >= 90 ? 'var(--green)' : c.pct >= 75 ? 'var(--blue)' : '#f0a23b'}"></span></span><b>${c.pct}%</b>`}</td><td class="dg"><span class="tag ${tagCls(c.tag)}">${c.tag}</span></td></tr>`)
            .join('')}</tbody></table>`
        : '<p class="note">No chapter results in the monthly report yet.</p>'
    }</div>`;
  };
  const prog = d && d.progress && d.progress.length
    ? `<div class="box good"><h4>📈 Progress this month</h4><ul>${d.progress.map((p) => `<li><b>${p.chapter}</b> (${p.subject}): <b>${p.from}% → ${p.to}%</b> in ${p.classes} improvement class${p.classes === 1 ? '' : 'es'}</li>`).join('')}</ul></div>`
    : `<div class="box good"><h4>📈 Progress this month</h4><p>No improvement-class journeys to report for these chapters this month.</p></div>`;
  const extra = [
  ].join('');
  const noticed = d && d.noticed && d.noticed.length ? d.noticed.map((x) => `<li>${x}</li>`).join('') : '<li>Nothing else stands out this month.</li>';
  return `<section class="page">
  ${head('Monthly Learning Report · ' + ((d && d.cycle) || s.month), 'This month in detail')}
  <div class="intro" style="margin-bottom:3mm">Taken from ${s.first}’s Monthly Learning Report. Only the chapters of the upcoming exam are shown${s.examLine ? ': <b>' + s.examLine + '</b>' : ''}.</div>
  <div class="dt2">${rowsOf('Maths', '📐')}${rowsOf('Science', '🔬')}</div>
  ${d && d.eng && d.eng.length ? `<h2 class="sec" style="margin-top:4mm"><span class="n">2</span>How the month went <small>${d.cycle}</small></h2><div class="eng">${d.eng.map((e) => `<div class="er"><span class="el">${e.label}</span><span class="eb"><i style="width:${Math.max(3, Math.min(100, e.pct))}%;background:${e.pct >= 90 ? 'var(--green)' : e.pct >= 75 ? 'var(--blue)' : '#f0a23b'}"></i></span><b class="ev">${e.value}</b><span class="en">${e.note}</span></div>`).join('')}</div>` : ''}
  <div class="two" style="margin-top:3.5mm">${prog}<div class="box focus"><h4>🔎 Also noticed this month</h4><ul>${noticed}${extra}</ul>${d && d.basics && d.basics.length ? `<div class="chips" style="margin-top:1.6mm">${d.basics.slice(0, 3).map((b) => `<span>${b}</span>`).join('')}</div>` : ''}</div></div>
  ${d && d.prio && (d.prio.revise.length || d.prio.test.length || d.prio.now.length) ? `<div class="box focus" style="margin-top:3.5mm"><h4>🎯 Before ${s.examLine ? s.examLine.split(' · ')[0] : 'the exam'}: what to do first</h4><div class="prio">${[['Revise first', d.prio.revise], ['Full test still pending', d.prio.test], ['Being taught now', d.prio.now]].filter(([, l]) => l.length).map(([h, l]) => `<div><b>${h}</b><span>${l.join(' · ')}</span></div>`).join('')}</div></div>` : ''}
  ${foot(s, 2)}
</section>`;
}

// Page 3, point-wise: one plan table (what we will do + target), then two short lists.
// Goals may be [text, aim] (text is split into points) or [[point, point], aim].
const toPoints = (x) =>
  Array.isArray(x)
    ? x
    : String(x)
        .split(/\.\s+(?=[A-Z“"])|;\s+|,\s+then\s+|,\s+and then\s+/)
        .map((p) => p.trim().replace(/\.$/, ''))
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
const aimText = (a) => String(a).replace(/^Aim:\s*/i, '');
const li2 = (a) => a.map((x) => `<li><b>${x.lead}</b> ${x.body}</li>`).join('');
function supportBlock(s) {
  const sp = s.support;
  const home = sp && sp.home && sp.home.length ? sp.home : [
    { lead: 'Practice sheets on time.', body: 'A gentle daily reminder to finish and submit each sheet.' },
    { lead: '15 minutes a day.', body: 'A short, regular slot works better than long weekend sessions.' },
    { lead: 'Encourage and appreciate.', body: `A few minutes talking about what ${s.first} learnt in class keeps motivation high.` },
  ];
  const up = sp && sp.uprio && sp.uprio.length ? sp.uprio : [];
  const upd = `<li><span>After each chapter</span>Evaluation result, shared with you.</li><li><span>Mid-${s.monthName}</span>A quick update call with ${s.tm.split(' ')[0]}.</li><li><span>Early ${s.nextMonthName}</span>Monthly Learning Report and the plan for ${s.nextMonthName}.</li>`;
  return `<div class="p3-two">
    <div>
      <h2 class="sec"><span class="n">2</span>Support we need from home</h2>
      <ul class="p3-list check">${li2(home)}</ul>
    </div>
    <div>
      <h2 class="sec"><span class="n">3</span>${up.length ? 'Support from UPRIO' : 'How we will keep you updated'}</h2>
      <ul class="p3-list ${up.length ? 'check' : 'when'}">${up.length ? li2(up) : upd}</ul>
    </div>
  </div>`;
}
function page3(s) {
  const g = s.goals;
  const row = (ic, bg, t, [txt, aim]) => `<tr>
      <td class="p3-area"><span class="ic" style="background:${bg}">${ic}</span><b>${t}</b></td>
      <td><ul>${toPoints(txt).map((p) => `<li>${p}</li>`).join('')}</ul></td>
      <td class="p3-aim">${aimText(aim)}</td></tr>`;
  return `<section class="page">
  ${head('How ' + s.monthName + ' will work', 'Our plan for the month')}
  ${s.exam ? `<div class="exam">📅 ${s.exam}</div>` : ''}
  <h2 class="sec" style="margin-top:0"><span class="n">1</span>Our ${s.monthName} plan for ${s.first}</h2>
  <table class="p3"><thead><tr><th style="width:30mm">Area</th><th>What we will do</th><th style="width:52mm">Target by month-end</th></tr></thead><tbody>
    ${row('📐', 'var(--blue-bg)', 'Maths', g.maths)}
    ${row('🔬', 'var(--teal-bg)', 'Science', g.science)}
    ${row('🧱', 'var(--green-bg)', 'Basics', g.basics)}
    ${row('📝', 'var(--amber-bg)', 'Habits', g.habits)}
  </tbody></table>
  <p class="p3-flow">Every chapter follows the same steps: <b>Teach</b> → <b>Practice</b> → <b>Evaluate</b> → <b>Improve</b> the gaps → <b>Elevate</b> with advanced practice.</p>
  ${supportBlock(s)}
  <p class="note" style="margin-top:3mm"><b style="color:var(--ink-2)">Looking ahead:</b> this month builds the base for the ${s.annual}.</p>
  ${foot(s, 4)}
</section>`;
}


function html(s) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${s.name} · Learning Plan · UPRIO</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${baseCss}${extraCss}</style></head><body>${page1(s)}${pageDetail(s)}${pageChapters(s)}${page2(s)}${page3(s)}</body></html>`;
}
module.exports = { html };
