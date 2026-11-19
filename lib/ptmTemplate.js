// UPRIO parent PTM plan: 3 A4 pages (where the student stands, mistakes with photos, the month's plan).
// Generated from plans/ptm-december-2026/gen.js by make-template.js. Edit the design there, then regenerate.
const baseCss = "\n  :root {\n    --blue: #008cff;\n    --blue-d: #0a63c9;\n    --teal: #00bfba;\n    --green: #12b76a;\n    --green-l: #00e500;\n    --ink: #0f1b2d;\n    --ink-2: #44546a;\n    --ink-3: #7a8799;\n    --line: #e3e9f1;\n    --soft: #f4f8fc;\n    --blue-bg: #eaf4ff;\n    --teal-bg: #e6faf9;\n    --green-bg: #e8f8ef;\n    --amber: #b54708;\n    --amber-bg: #fff4e5;\n    --red: #c4321f;\n    --red-bg: #fdeceb;\n  }\n  @page { size: A4; margin: 0; }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; padding: 0; background: #e9eef4; }\n  body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); font-size: 10.6pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  .page { width: 210mm; height: 297mm; margin: 10mm auto; background: #fff; position: relative; overflow: hidden; padding: 13mm 15mm 13mm; display: flex; flex-direction: column; }\n  @media print { html, body { background: #fff; } .page { margin: 0; page-break-after: always; break-after: page; } .page:last-child { page-break-after: auto; break-after: auto; } }\n  .page::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: linear-gradient(90deg, var(--blue), var(--teal) 60%, var(--green-l)); }\n  h1, h2, h3, h4 { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; margin: 0; letter-spacing: -0.2px; }\n  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }\n  .logo svg { width: 34mm; height: auto; display: block; }\n  .eyebrow { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 8pt; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: var(--blue); }\n  h1 { font-size: 24pt; font-weight: 800; line-height: 1.1; margin-top: 2mm; }\n  h1 .hl { color: var(--blue); }\n  .who { margin-top: 2.5mm; color: var(--ink-2); font-size: 10pt; }\n  .who b { color: var(--ink); }\n  .pagehead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6mm; }\n  .pagehead h2 { font-size: 17pt; font-weight: 800; }\n  .pagehead .logo svg { width: 24mm; }\n  h2.sec { font-size: 12.5pt; font-weight: 800; margin: 4.5mm 0 2.5mm; display: flex; align-items: center; gap: 2.5mm; }\n  h2.sec .n { width: 6.5mm; height: 6.5mm; border-radius: 2mm; background: var(--blue); color: #fff; font-size: 9pt; display: inline-grid; place-items: center; }\n  h2.sec small { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 8.6pt; color: var(--ink-3); margin-left: auto; }\n\n  /* Hero message */\n  .hero { margin-top: 5mm; border-radius: 4mm; background: linear-gradient(120deg, var(--blue-bg), var(--teal-bg)); border: 1px solid #d5e8fb; padding: 4mm 5.5mm; display: grid; grid-template-columns: 1fr auto; gap: 6mm; align-items: center; }\n  .hero p { margin: 0; font-size: 10.4pt; color: var(--ink); line-height: 1.5; }\n  .hero p b { color: var(--blue-d); }\n  .hero .big { text-align: center; padding-left: 6mm; border-left: 1px solid #c9def5; }\n  .hero .big b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 26pt; font-weight: 800; color: var(--green); line-height: 1; }\n  .hero .big span { font-size: 7.8pt; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.6px; }\n\n  /* Stat cards */\n  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }\n  .stat { border: 1px solid var(--line); border-radius: 3mm; padding: 3mm 3.5mm; background: #fff; }\n  .stat b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 16pt; font-weight: 800; line-height: 1.1; }\n  .stat span { display: block; font-size: 8.4pt; color: var(--ink-2); margin-top: 0.6mm; }\n  .stat i { display: inline-block; margin-top: 1.6mm; font-style: normal; font-size: 7.4pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 10mm; }\n  .ok { background: var(--green-bg); color: #087443; }\n  .warn { background: var(--amber-bg); color: var(--amber); }\n  .mid { background: var(--blue-bg); color: var(--blue-d); }\n\n  /* Subject table */\n  table.subj { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 8.9pt; }\n  table.subj th { background: var(--soft); text-align: left; font-size: 7.6pt; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-2); padding: 1.8mm 3mm; font-weight: 700; }\n  table.subj td { padding: 1.7mm 3mm; border-top: 1px solid var(--line); vertical-align: middle; }\n  table.subj td.pc { font-family: 'Plus Jakarta Sans'; font-weight: 800; font-size: 11pt; white-space: nowrap; }\n  .bar { height: 2mm; border-radius: 2mm; background: #edf1f6; overflow: hidden; width: 26mm; display: inline-block; vertical-align: middle; margin-right: 2mm; }\n  .bar > span { display: block; height: 100%; border-radius: 2mm; }\n  .tag { display: inline-block; font-size: 7.4pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 10mm; white-space: nowrap; }\n  .subj-name { font-weight: 600; }\n  .subj-name small { display: block; color: var(--ink-3); font-weight: 500; font-size: 8pt; }\n\n  /* Two columns */\n  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }\n  .box { border-radius: 3mm; padding: 3.5mm 4.5mm; border: 1px solid var(--line); }\n  .box h4 { font-size: 10pt; margin-bottom: 2mm; display: flex; align-items: center; gap: 2mm; }\n  .box ul { margin: 0; padding-left: 4.5mm; }\n  .box li { margin: 1mm 0; }\n  .box.good { background: #f3fbf6; border-color: #cdeedb; }\n  .box.focus { background: #fff9f0; border-color: #f5dfbd; }\n\n  /* Goals */\n  .goals { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }\n  .goal { display: grid; grid-template-columns: 8mm 1fr; gap: 3mm; align-items: start; border: 1px solid var(--line); border-radius: 3mm; padding: 2.6mm 3.2mm; }\n  .goal .ic { width: 8mm; height: 8mm; border-radius: 2.4mm; display: grid; place-items: center; font-size: 11pt; }\n  .goal b { display: block; font-size: 9.8pt; }\n  .goal span { display: block; font-size: 8.6pt; color: var(--ink-2); margin-top: 0.5mm; }\n  .goal .from { font-size: 8pt; color: var(--ink-3); margin-top: 1mm; }\n  .goal .from em { font-style: normal; font-weight: 700; color: var(--blue-d); }\n\n  /* Subject plans (page 2) */\n  .plan { border-radius: 3.5mm; border: 1px solid var(--line); overflow: hidden; margin-bottom: 4mm; }\n  .plan-head { display: flex; align-items: center; gap: 3mm; padding: 3mm 4.5mm; color: #fff; }\n  .plan-head h3 { font-size: 12.5pt; font-weight: 800; }\n  .plan-head span { margin-left: auto; font-size: 8.4pt; opacity: 0.92; font-weight: 600; }\n  .plan.maths .plan-head { background: linear-gradient(90deg, var(--blue), #2aa3ff); }\n  .plan.science .plan-head { background: linear-gradient(90deg, #00a8a3, var(--teal)); }\n  .plan.basics .plan-head { background: linear-gradient(90deg, #0f9f58, #22c26b); }\n  .plan-body { display: grid; grid-template-columns: 1.1fr 1fr; gap: 0; }\n  .plan-body > div { padding: 3.5mm 4.5mm; }\n  .plan-body > div + div { border-left: 1px solid var(--line); background: var(--soft); }\n  .plan-body h4 { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.6px; color: var(--ink-3); margin-bottom: 2mm; font-weight: 800; }\n  .step { display: grid; grid-template-columns: 5.5mm 1fr; gap: 2.5mm; margin-bottom: 2.4mm; }\n  .step .k { width: 5.5mm; height: 5.5mm; border-radius: 50%; display: grid; place-items: center; font-size: 7.6pt; font-weight: 800; color: #fff; margin-top: 0.4mm; }\n  .maths .k { background: var(--blue); }\n  .science .k { background: var(--teal); }\n  .basics .k { background: var(--green); }\n  .step b { display: block; font-size: 9.6pt; }\n  .step span { display: block; font-size: 8.6pt; color: var(--ink-2); }\n  .why li { font-size: 8.8pt; margin: 1.2mm 0; color: var(--ink-2); }\n  .why li b { color: var(--ink); }\n  .why { margin: 0; padding-left: 4mm; }\n  .target { margin-top: 2.5mm; font-size: 8.6pt; background: #fff; border: 1px dashed #b8d8f8; border-radius: 2.4mm; padding: 2mm 3mm; color: var(--ink-2); }\n  .target b { color: var(--blue-d); }\n  .science .target { border-color: #a9e6e3; }\n  .science .target b { color: #00837f; }\n  .basics .target { border-color: #b9e7cd; }\n  .basics .target b { color: #087443; }\n\n  /* Calendar (page 3) */\n  .weeks { display: grid; gap: 2.2mm; }\n  .week { display: grid; grid-template-columns: 27mm 1fr 1fr 1fr; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; }\n  .week > div { padding: 2.1mm 3mm; font-size: 8.6pt; }\n  .week .wk { background: var(--soft); }\n  .week .wk b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 10.2pt; font-weight: 800; }\n  .week .wk span { font-size: 8pt; color: var(--ink-3); }\n  .week .c { border-left: 1px solid var(--line); }\n  .week .c small { display: block; font-size: 7.2pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 0.6mm; }\n  .c.m small { color: var(--blue); }\n  .c.s small { color: #00a8a3; }\n  .c.b small { color: var(--green); }\n  .weekhead { display: grid; grid-template-columns: 27mm 1fr 1fr 1fr; font-size: 7.6pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--ink-3); padding: 0 3mm 0.8mm; }\n  .weekhead span:nth-child(2) { color: var(--blue); } .weekhead span:nth-child(3) { color: #00a8a3; } .weekhead span:nth-child(4) { color: var(--green); }\n  .milestone { display: inline-block; margin-top: 1mm; font-size: 7.4pt; font-weight: 700; padding: 0.4mm 2mm; border-radius: 10mm; background: var(--blue-bg); color: var(--blue-d); }\n\n  .help { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }\n  .help .box { padding: 2.6mm 3.2mm; }\n  .help .box b { display: block; font-size: 9.4pt; margin-bottom: 0.8mm; }\n  .help .box span { font-size: 8.5pt; color: var(--ink-2); }\n  .help .ic { font-size: 11pt; display: block; margin-bottom: 0.6mm; }\n\n  .checkins { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }\n  .chk { border-radius: 3mm; background: linear-gradient(135deg, var(--blue-bg), var(--teal-bg)); padding: 3mm 3.5mm; }\n  .chk small { font-size: 7.4pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--blue-d); }\n  .chk b { display: block; font-size: 9.6pt; margin-top: 0.6mm; }\n  .chk span { font-size: 8.4pt; color: var(--ink-2); }\n\n  .cycle { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; }\n  .cy { position: relative; border-radius: 3mm; padding: 2.4mm 2.6mm; background: linear-gradient(160deg, var(--blue-bg), var(--teal-bg)); border: 1px solid #d5e8fb; }\n  .cy .ci { display: block; font-size: 13pt; margin-bottom: 1mm; }\n  .cy b { display: block; font-family: 'Plus Jakarta Sans'; font-size: 10pt; font-weight: 800; color: var(--blue-d); }\n  .cy span:last-child { display: block; font-size: 8.2pt; color: var(--ink-2); margin-top: 0.5mm; line-height: 1.35; }\n  .cy + .cy::before { content: '›'; position: absolute; left: -2.4mm; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--teal); font-size: 12pt; }\n  .foot { margin-top: auto; padding-top: 3mm; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 7.8pt; color: var(--ink-3); }\n  .note { font-size: 8pt; color: var(--ink-3); margin-top: 2.5mm; }\n";
const logo = "<svg viewBox=\"0 0 77 19\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<g>\n<g>\n<path d=\"M67.4222 0.5C61.3527 0.5 58.1084 4.33693 58.1084 9.5C58.1084 15.0816 61.8411 18.5 67.4222 18.5C73.0032 18.5 76.7359 15.0816 76.7359 9.5C76.7359 3.91837 73.2128 0.5 67.4222 0.5ZM67.4222 15.081C64.0731 15.081 62.12 13.0232 62.12 9.49941C62.12 5.97566 64.0737 3.91777 67.4222 3.91777C70.7707 3.91777 72.6894 5.94073 72.6894 9.49941C72.6894 13.0581 70.7707 15.081 67.4222 15.081Z\" fill=\"#010101\"/>\n<path d=\"M56.1178 0.778748H52.0713V18.2205H56.1178V0.778748Z\" fill=\"#010101\"/>\n<path d=\"M46.3506 12.8833L46.2925 12.7839C48.6654 11.6377 49.6647 9.1956 49.6647 7.09272C49.6647 3.18593 46.9438 0.778748 43.037 0.778748H35.3975V18.2205H39.444V13.4416H42.41L43.246 14.872C44.7462 17.4532 46.1066 18.465 49.5599 18.465H49.6647V15.2207C47.9206 15.0809 47.1883 14.3137 46.3506 12.8833Z\" fill=\"#010101\"/>\n<path d=\"M27.4602 0.778687H19.0801V18.2204H23.1266V13.4416H27.4602C30.8786 13.4416 33.8358 11.4879 33.8358 7.09266C33.8008 3.39486 31.1574 0.778687 27.4602 0.778687Z\" fill=\"#010101\"/>\n<path d=\"M8.23273 18.4993C13.4651 18.4993 16.4305 15.4995 16.4305 10.5111V0.778748H12.384V10.5111C12.384 13.3718 11.0585 15.0809 8.23273 15.0809C5.58163 15.0809 4.04651 13.4416 4.04651 10.5111V0.778748H0V10.5111C0 15.4995 3.06966 18.4993 8.23273 18.4993Z\" fill=\"#010101\"/>\n</g>\n<path d=\"M43.3673 9.98729H38.5879L40.9223 7.09227L38.5879 4.2316H43.3673L45.6662 7.09227L43.3673 9.98729Z\" fill=\"#00E500\"/>\n<path d=\"M31.1299 9.98729H35.3996L37.3852 7.09227L35.3996 4.2316H31.1299V9.98729Z\" fill=\"#00BFBA\"/>\n<path d=\"M28.5097 4.23157H23.1992V9.98726H28.5097V4.23157Z\" fill=\"#008CFF\"/>\n</g>\n</svg>";
const extraCss = `
  .p3 { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 10.4pt; }
  .p3 th { background: var(--soft); text-align: left; font-size: 7.8pt; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-2); padding: 2mm 3.5mm; font-weight: 700; }
  .p3 td { padding: 3.6mm 4mm; border-top: 1px solid var(--line); vertical-align: top; }
  .p3 ul { margin: 0; padding-left: 4.2mm; }
  .p3 li { margin: 1.1mm 0; line-height: 1.4; color: var(--ink); }
  .p3-area { white-space: nowrap; }
  .p3-area .ic { display: inline-grid; place-items: center; width: 7mm; height: 7mm; border-radius: 2mm; margin-right: 2mm; vertical-align: middle; font-size: 10.5pt; }
  .p3-area b { font-size: 11pt; vertical-align: middle; }
  .p3-aim { background: #f6fbf8; color: #0c5d36; font-size: 10pt; line-height: 1.45; }
  .p3-aim em { font-style: normal; font-weight: 700; color: #087443; }
  .p3-flow { margin: 3.4mm 0 1mm; font-size: 9.6pt; color: var(--ink-2); background: var(--blue-bg); border-radius: 2.4mm; padding: 2mm 3.5mm; }
  .p3-flow b { color: var(--blue-d); }
  .p3-two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .p3-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2.8mm; font-size: 10pt; line-height: 1.45; color: var(--ink-2); }
  .p3-list li { border: 1px solid var(--line); border-radius: 2.6mm; padding: 3mm 3.4mm 3mm 9mm; position: relative; }
  .p3-list li b { color: var(--ink); }
  .p3-list.check li::before { content: '✓'; position: absolute; left: 3mm; top: 2.1mm; color: var(--green); font-weight: 800; }
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
  const color = cls === 'ok' ? 'var(--green)' : cls === 'warn' ? '#f0a23b' : 'var(--blue)';
  return `<span class="bar"><span style="width:${Math.max(4, Math.min(100, v))}%;background:${color}"></span></span>${v}%`;
};
const foot = (s, n) => `<div class="foot"><span>UPRIO · Personal Learning Plan · ${s.month}</span><span>${s.name} · Grade ${s.grade} · Page ${n} of ${s.pageTotal || 3}</span></div>`;
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
  <h2 class="sec"><span class="n">2</span>Subject snapshot</h2>
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

function page2(s) {
  const n = s.mistakes.length >= 4 ? 'n4' : 'n3';
  return `<section class="page">
  ${head('From ' + s.first + '’s own notebook', 'Small mistakes we spotted')}
  <div class="intro">${s.mistakesIntro}</div>
  <div class="mist ${n}">${s.mistakes
    .map(
      (m) => `<div class="mc"><div class="ph"><img src="${m.img}" alt=""></div><div class="tx">
      <h5>${m.title}<span class="tag warn">${m.tag}</span></h5>
      <div><span class="lbl">What happened</span>${m.what}</div>
      <div class="ok-ans"><span class="lbl" style="color:#087443">The correct way</span>${m.right}</div>
    </div></div>`
    )
    .join('')}</div>
  <div class="also">
    <div class="box"><h4>🔎 Also noticed</h4><ul>${s.alsoNoticed.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    <div class="box"><h4>✍️ Writing &amp; basics</h4><p>${s.writing}</p><div class="chips">${s.basics.map((b) => `<span>${b}</span>`).join('')}</div></div>
  </div>
  <p class="note">Photos are from ${s.first}’s UPRIO evaluation classes; the red marks were added by our evaluators.</p>
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
  <div class="p3-two">
    <div>
      <h2 class="sec"><span class="n">2</span>How you can help at home</h2>
      <ul class="p3-list check">
        <li><b>Practice sheets on time.</b> A gentle daily reminder to finish and submit each sheet.</li>
        <li><b>15 minutes a day.</b> A short, regular slot works better than long weekend sessions.</li>
        <li><b>Encourage and appreciate.</b> A few minutes talking about what ${s.first} learnt in class keeps motivation high.</li>
      </ul>
    </div>
    <div>
      <h2 class="sec"><span class="n">3</span>How we will keep you updated</h2>
      <ul class="p3-list when">
        <li><span>After each chapter</span>Evaluation result, shared with you.</li>
        <li><span>Mid-${s.monthName}</span>A quick update call with ${s.tm.split(' ')[0]}.</li>
        <li><span>Early ${s.nextMonthName}</span>Monthly Learning Report and the plan for ${s.nextMonthName}.</li>
      </ul>
    </div>
  </div>
  <p class="note" style="margin-top:3mm"><b style="color:var(--ink-2)">Looking ahead:</b> this month builds the base for the ${s.annual}. Chapters follow the school syllabus and may shift if the school changes its pace.</p>
  ${foot(s, s.planPage || 3)}
</section>`;
}


// ---------- Chapter-wise progress: QCs covered, from Student Learning Progress ----------
const progressCss = `
  .pr2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .pr-col h3 { font-size: 11pt; font-weight: 800; margin: 0 0 1.6mm; display: flex; align-items: baseline; gap: 2mm; }
  .pr-col h3 small { font-family: 'Inter'; font-weight: 500; font-size: 7.4pt; color: var(--ink-3); margin-left: auto; text-align: right; }
  table.pr { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; font-size: 8pt; }
  table.pr th { background: var(--soft); font-size: 6.6pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); padding: 1mm 1.6mm; text-align: left; font-weight: 700; }
  table.pr td { padding: 1mm 1.6mm; border-top: 1px solid var(--line); vertical-align: middle; }
  table.pr { table-layout: fixed; }
  table.pr th:nth-child(1), table.pr td.pn { width: 38%; } table.pr th:nth-child(2) { width: 16%; } table.pr th:nth-child(3) { width: 17%; } table.pr th:nth-child(4) { width: 11%; } table.pr th:nth-child(5) { width: 18%; } table.pr th { white-space: nowrap; overflow: hidden; }
  .pn { font-weight: 600; line-height: 1.2; }
  .pn small { display: block; font-weight: 500; font-size: 6.4pt; color: var(--ink-3); }
  .pq { white-space: nowrap; font-size: 8pt; } .pq b { font-family: 'Plus Jakarta Sans'; font-weight: 800; }
  .ps { padding-left: 1mm; padding-right: 1mm; }
  .stack { display: flex; height: 2.4mm; border-radius: 1.2mm; overflow: hidden; background: #e8ecf3; }
  .stack i { display: block; height: 100%; }
  .stack .g, .pr-legend .g { background: var(--green); } .stack .y, .pr-legend .y { background: #f3c64a; }
  .stack .o, .pr-legend .o { background: #f0883b; } .stack .r, .pr-legend .r { background: #e0483a; } .stack .n { background: #b9c1d1; }
  .pp { font-family: 'Plus Jakarta Sans'; font-weight: 800; font-size: 8.4pt; text-align: right; }
  .pt { text-align: right; white-space: nowrap; }
  table.pr .tag { font-size: 6.4pt; padding: 0.4mm 1.5mm; }
  .tag.bad { background: #fdeceb; color: #b83223; }
  .pr-legend { display: flex; gap: 5mm; margin-top: 2.6mm; font-size: 7.4pt; color: var(--ink-3); }
  .pr-legend i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 0.8mm; margin-right: 1.4mm; vertical-align: -0.4mm; }
`;
const PER_PAGE = 15;
const prLevel = (c) => (c.pct >= 90 ? ['ok', 'Strong'] : c.pct >= 75 ? ['mid', 'Building'] : c.pct >= 50 ? ['warn', 'Revise'] : ['bad', 'Weak']);
const dmy = (iso) => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
function stackBar(c) {
  const seg = (n, cls) => (n ? `<i class="${cls}" style="width:${(100 * n) / c.qcs}%"></i>` : '');
  return `<span class="stack">${seg(c.green, 'g')}${seg(c.yellow, 'y')}${seg(c.orange, 'o')}${seg(c.red, 'r')}${seg(c.grey, 'n')}</span>`;
}
const STATE_TAG = { green1: ['ok', 'At target'], green2: ['ok', 'At target'], yellow: ['warn', 'Gaps open'], orange: ['warn', 'Target not met'], orange2: ['warn', 'Target not met'], red: ['bad', 'Attention'], grey: ['mid', 'Not rated'] };
const STATE_COL = { green1: 'g', green2: 'g', yellow: 'y', orange: 'o', orange2: 'o', red: 'r', grey: 'n' };
const prRows = (list) =>
  list
    .map((c) => {
      if (c.mode === 'eval') {
        const [lv, tg] = STATE_TAG[c.state] || ['mid', '—'];
        return `<tr><td class="pn">${c.chapter}<small>last ${dmy(c.last)}${c.gaps ? ' · ' + c.gaps + ' gap' + (c.gaps === 1 ? '' : 's') + ' open' : ''}</small></td><td class="pq"><b>${c.evals}</b> eval${c.evals === 1 ? '' : 's'}</td><td class="ps"><span class="stack"><i class="${STATE_COL[c.state] || 'n'}" style="width:100%"></i></span></td><td class="pp"></td><td class="pt"><span class="tag ${lv}">${tg}</span></td></tr>`;
      }
      const [lvl, tag] = prLevel(c);
      const open = c.qcs - c.green;
      return `<tr><td class="pn">${c.chapter}<small>${c.evals} eval${c.evals === 1 ? '' : 's'} · last ${dmy(c.last)}</small></td><td class="pq"><b>${c.green}</b>/${c.qcs}</td><td class="ps">${stackBar(c)}</td><td class="pp">${c.pct}%</td><td class="pt"><span class="tag ${lvl}">${open ? tag : 'All at target'}</span></td></tr>`;
    })
    .join('');
const chapterPageCount = (s) => (s.progress ? Math.max(Math.ceil(s.progress.Maths.length / PER_PAGE), Math.ceil(s.progress.Science.length / PER_PAGE), 1) : 0);
function chapterProgressPages(s) {
  const p = s.progress;
  if (!p) return [];
  const pages = Math.max(Math.ceil(p.Maths.length / PER_PAGE), Math.ceil(p.Science.length / PER_PAGE), 1);
  const tot = (sub) => p.totals[sub];
  const all = ['Maths', 'Science'].map(tot).filter((x) => x && x.mode !== 'eval');
  const evalOnly = ['Maths', 'Science'].map(tot).filter((x) => x && x.mode === 'eval');
  const qcs = all.reduce((n, x) => n + x.qcs, 0);
  const green = all.reduce((n, x) => n + x.green, 0);
  const out = [];
  for (let i = 0; i < pages; i++) {
    const col = (sub, icon) => {
      const list = p[sub].slice(i * PER_PAGE, (i + 1) * PER_PAGE);
      const t = tot(sub);
      if (!list.length) return '<div class="pr-col"></div>';
      return `<div class="pr-col"><h3>${icon} ${sub} <small>${t.mode === 'eval' ? `${t.chapters} chapters · ${t.green} at target · ${t.evals} evaluations` : `${t.chapters} chapters · ${t.green}/${t.qcs} QCs at target (${t.pct}%)`}</small></h3><table class="pr"><thead><tr><th>Chapter</th><th>${t.mode === 'eval' ? 'Evals' : 'QCs'}</th><th>${t.mode === 'eval' ? 'Latest' : ''}</th><th>${t.mode === 'eval' ? '' : '%'}</th><th></th></tr></thead><tbody>${prRows(list)}</tbody></table></div>`;
    };
    const weak = i === pages - 1 ? ['Maths', 'Science'].flatMap((sub) => p[sub].filter((c) => (c.mode === 'eval' ? !c.green : c.pct < 75)).map((c) => `${c.chapter} <em>(${sub}${c.mode === 'eval' ? ', ' + ((STATE_TAG[c.state] || [0, 'gaps open'])[1]).toLowerCase() : ', ' + c.pct + '%'})</em>`)) : null;
    out.push(`<section class="page">
  ${head('Student Learning Progress · since ' + dmy(p.since), 'Chapter-wise progress · QCs covered' + (pages > 1 ? ` (${i + 1}/${pages})` : ''))}
  ${i === 0 ? `<div class="intro" style="margin-bottom:2.5mm">Every chapter evaluated so far. ${qcs ? `<b>${green} of ${qcs} question categories (QCs)</b> are at target (<b>${Math.round((100 * green) / qcs)}%</b>). A QC counts as at target when ${s.first} has shown the concept in an evaluation or cleared the gap in a LIFT class.` : ''}${evalOnly.length ? ` Science is marked through answer-writing evaluations, so each chapter shows the result of its latest evaluation.` : ''}</div>` : ''}
  <div class="pr2">${col('Maths', '📐')}${col('Science', '🔬')}</div>
  <div class="pr-legend"><span><i class="g"></i>At target</span><span><i class="y"></i>Waiting for LIFT / catch-up</span><span><i class="o"></i>Target not met yet</span><span><i class="r"></i>Needs attention</span></div>
  ${weak ? `<div class="box focus" style="margin-top:3mm"><h4>🎯 Chapters to revisit first</h4><p style="margin:0;font-size:8.6pt;line-height:1.5;color:var(--ink-2)">${weak.length ? weak.join(' · ') : 'Every chapter evaluated so far is at target. Keep revising to hold it.'}</p></div>` : ''}
  ${foot(s, 3 + i)}
</section>`);
  }
  return out;
}

function bodyPages(s) {
  const n = chapterPageCount(s);
  s.pageTotal = 3 + n;
  s.planPage = 3 + n;
  const ch = chapterProgressPages(s);
  return page1(s) + page2(s) + ch.join('') + page3(s);
}
function html(s) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${s.name} · Learning Plan · UPRIO</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${baseCss}${extraCss}${progressCss}</style></head><body>${bodyPages(s)}</body></html>`;
}
module.exports = { html };
