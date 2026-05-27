const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, TableOfContents,
  LevelFormat,
} = require("docx");
const fs = require("fs");

const BLUE      = "1F4E79";
const MID_BLUE  = "2E75B6";
const LIGHT_BG  = "EBF3FB";
const WARN_BG   = "FFF3CD";
const WARN_BDR  = "FFC107";
const CODE_BG   = "F4F4F4";
const GREY_TEXT = "595959";
const WHITE     = "FFFFFF";
const BLACK     = "000000";

const PAGE_W    = 12240;
const PAGE_H    = 15840;
const MARGIN    = 1440;
const CONTENT_W = 9360;

const cellBdr = (c = "CCCCCC") => ({ top: {style:BorderStyle.SINGLE,size:1,color:c}, bottom:{style:BorderStyle.SINGLE,size:1,color:c}, left:{style:BorderStyle.SINGLE,size:1,color:c}, right:{style:BorderStyle.SINGLE,size:1,color:c} });
const noBdr   = { top:{style:BorderStyle.NONE,size:0,color:"auto"}, bottom:{style:BorderStyle.NONE,size:0,color:"auto"}, left:{style:BorderStyle.NONE,size:0,color:"auto"}, right:{style:BorderStyle.NONE,size:0,color:"auto"} };

const sp  = (b=0,a=0) => ({ spacing:{before:b,after:a} });
const run = (text, opts={}) => new TextRun({text,...opts});
const para= (children, opts={}) => new Paragraph({children:Array.isArray(children)?children:[children],...opts});
const h1  = t => new Paragraph({heading:HeadingLevel.HEADING_1, children:[run(t)]});
const h2  = t => new Paragraph({heading:HeadingLevel.HEADING_2, children:[run(t)]});
const spacer = (pts=120) => new Paragraph({children:[],...sp(pts,0)});
const rule = () => new Paragraph({ border:{bottom:{style:BorderStyle.SINGLE,size:6,color:MID_BLUE,space:1}}, ...sp(0,120), children:[] });

const bullet  = (children, level=0) => new Paragraph({ numbering:{reference:"bullets",level}, children:Array.isArray(children)?children:[run(children)], ...sp(0,60) });
const numbered= (children, ref="steps") => new Paragraph({ numbering:{reference:ref,level:0}, children:Array.isArray(children)?children:[run(children)], ...sp(0,80) });
const checkbox= text => new Paragraph({ numbering:{reference:"checks",level:0}, children:[run(text)], ...sp(0,60) });

const codeBlock = lines => new Table({
  width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[CONTENT_W],
  rows:[new TableRow({children:[new TableCell({
    borders:cellBdr("BBBBBB"), width:{size:CONTENT_W,type:WidthType.DXA},
    shading:{fill:CODE_BG,type:ShadingType.CLEAR}, margins:{top:120,bottom:120,left:200,right:200},
    children: lines.map(l=>new Paragraph({children:[run(l,{font:"Courier New",size:18,color:"1E1E1E"})], ...sp(0,20)})),
  })]})]
});

const infoBox = (lines, fill=LIGHT_BG, bdrColor=MID_BLUE) => new Table({
  width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[CONTENT_W],
  rows:[new TableRow({children:[new TableCell({
    borders:{top:{style:BorderStyle.SINGLE,size:4,color:bdrColor},bottom:{style:BorderStyle.SINGLE,size:4,color:bdrColor},left:{style:BorderStyle.THICK,size:12,color:bdrColor},right:{style:BorderStyle.SINGLE,size:4,color:bdrColor}},
    width:{size:CONTENT_W,type:WidthType.DXA}, shading:{fill,type:ShadingType.CLEAR}, margins:{top:100,bottom:100,left:180,right:180},
    children: lines.map(l=>new Paragraph({children:[run(l,{size:20,color:BLACK})], ...sp(0,40)})),
  })]})]
});

const headerRow = (cols) => new TableRow({ tableHeader:true, children: cols.map(([t,w]) => new TableCell({ borders:cellBdr(MID_BLUE), width:{size:w,type:WidthType.DXA}, shading:{fill:BLUE,type:ShadingType.CLEAR}, margins:{top:80,bottom:80,left:120,right:120}, children:[para(run(t,{bold:true,color:WHITE,size:20}))] })) });
const dataRow  = (cols, stripe) => new TableRow({ children: cols.map(([t,w]) => new TableCell({ borders:cellBdr(), width:{size:w,type:WidthType.DXA}, shading:{fill:stripe?"F0F6FC":WHITE,type:ShadingType.CLEAR}, margins:{top:80,bottom:80,left:120,right:120}, children:[para(run(t,{size:20}))] })) });

// ── Title page ──────────────────────────────────────────────────────────────
const titlePage = [
  spacer(2880),
  new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[CONTENT_W], rows:[new TableRow({children:[new TableCell({
    borders:noBdr, width:{size:CONTENT_W,type:WidthType.DXA}, shading:{fill:BLUE,type:ShadingType.CLEAR}, margins:{top:400,bottom:400,left:400,right:400}, verticalAlign:VerticalAlign.CENTER,
    children:[
      new Paragraph({alignment:AlignmentType.CENTER, children:[run("AI Marketing Agent System",{bold:true,size:52,color:WHITE,font:"Arial"})], ...sp(0,120)}),
      new Paragraph({alignment:AlignmentType.CENTER, children:[run("Setup & Security Guide",{size:36,color:"C9D9EC",font:"Arial"})]}),
    ],
  })]})] }),
  spacer(480),
  new Paragraph({alignment:AlignmentType.CENTER, children:[run("hosting.com",{bold:true,size:28,color:BLUE,font:"Arial"})], ...sp(0,80)}),
  new Paragraph({alignment:AlignmentType.CENTER, children:[run("Prepared by: Daphne Monro",{size:22,color:GREY_TEXT,font:"Arial"})], ...sp(0,60)}),
  new Paragraph({alignment:AlignmentType.CENTER, children:[run("Date: May 2026",{size:22,color:GREY_TEXT,font:"Arial"})], ...sp(0,60)}),
  new Paragraph({alignment:AlignmentType.CENTER, children:[run("Internal Use Only — Confidential",{size:18,color:"999999",font:"Arial",italics:true})]}),
  new Paragraph({children:[new PageBreak()]}),
];

// ── TOC ─────────────────────────────────────────────────────────────────────
const tocSection = [
  h1("Contents"),
  new TableOfContents("Contents",{hyperlink:true,headingStyleRange:"1-3"}),
  new Paragraph({children:[new PageBreak()]}),
];

// ── Executive Summary ────────────────────────────────────────────────────────
const execSummary = [
  h1("Executive Summary"), rule(),
  para(run("This document describes three AI-powered marketing agent scripts deployed by the hosting.com Website & Content team. These scripts use the Anthropic Claude API to automate daily KPI briefings, weekly marketing operations planning, and SEO auditing — tasks that would otherwise require hours of manual analysis. The agents operate entirely on-demand from a local machine, make only outbound HTTPS calls to two trusted endpoints (api.anthropic.com and sheets.googleapis.com), process no customer personal data, and store all outputs locally. This guide covers the one-time setup steps required to run the agents and documents the security controls in place, structured as a checklist for sign-off."), {...sp(0,200)}),
  h2("What the agents do"),
  new Table({
    width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[2600,3400,3360],
    rows:[
      headerRow([["Agent",2600],["What it does",3400],["Runtime",3360]]),
      dataRow([["Daily Briefing",2600],["Morning KPI snapshot: MRR, CAC, ROAS, organic conversion vs. targets. Flags blockers and top priority for the day.",3400],["~2 minutes",3360]],false),
      dataRow([["Marketing Ops Hub",2600],["Weekly planning pipeline: 6 specialised agents cover content, CRO, affiliate, operations and board reporting — synthesised into a unified priority list.",3400],["~15 minutes",3360]],true),
      dataRow([["SEO Agent System",2600],["On-demand SEO audit: technical audit + content gap analysis + 90-day roadmap, saved as a JSON report.",3400],["~10 minutes",3360]],false),
    ]
  }),
  spacer(200),
  new Paragraph({children:[new PageBreak()]}),
];

// ── Prerequisites ────────────────────────────────────────────────────────────
const prerequisites = [
  h1("1. Prerequisites"), rule(),
  para(run("The following must be in place before running setup:"), sp(0,120)),
  bullet([run("Node.js ",{bold:true}), run("v18 or higher — download from nodejs.org")]),
  bullet([run("Anthropic API key ",{bold:true}), run("— obtain from console.anthropic.com")]),
  bullet([run("Google account ",{bold:true}), run("with access to the hosting.com marketing Google Sheet")]),
  bullet([run("Terminal / command-line access ",{bold:true}), run("on the machine that will run the scripts")]),
  bullet([run("Git ",{bold:true}), run("(optional, recommended for version control)")]),
  spacer(200),
];

// ── Installation ─────────────────────────────────────────────────────────────
const installation = [
  h1("2. Installation"), rule(),
  h2("2.1  Install Node.js dependencies"),
  para(run("Open a terminal, navigate to the scripts folder, and run:"), sp(0,100)),
  codeBlock(["cd ~/Claude/files","npm install"]),
  spacer(80),
  para(run("This installs two packages: @anthropic-ai/sdk (the Claude API client) and googleapis (Google Sheets access).",{size:20,color:GREY_TEXT}), sp(80,200)),
  h2("2.2  Set the Anthropic API key"),
  para(run("The API key must be set as an environment variable — never stored in a file."), sp(0,100)),
  para([run("macOS / Linux:",{bold:true,size:20})], sp(0,60)),
  codeBlock(["export ANTHROPIC_API_KEY=your_key_here","","# To persist across sessions, add to ~/.zshrc:","echo 'export ANTHROPIC_API_KEY=your_key_here' >> ~/.zshrc"]),
  spacer(80),
  para([run("Windows:",{bold:true,size:20})], sp(80,60)),
  codeBlock(["set ANTHROPIC_API_KEY=your_key_here"]),
  spacer(200),
];

// ── Google Sheets ─────────────────────────────────────────────────────────────
const googleSetup = [
  h1("3. Google Sheets Integration (one-time)"), rule(),
  para(run("This is a one-time setup that takes approximately five minutes."), sp(0,160)),
  h2("3.1  Enable the Google Sheets API"),
  numbered("Go to console.cloud.google.com and sign in with your Google account."),
  numbered("Create a new project (or select an existing one) from the top navigation bar."),
  numbered('Use the search bar to find "Google Sheets API" and click Enable.'),
  spacer(160),
  h2("3.2  Create a service account"),
  numbered("In the left menu go to IAM & Admin then Service Accounts."),
  numbered('Click Create Service Account. Name it "hosting-agents". Click Done.'),
  numbered("Click the new service account, go to the Keys tab."),
  numbered("Click Add Key, Create new key, JSON. A credentials file downloads automatically."),
  numbered([run("Save that file as ",{size:22}), run("credentials.json",{bold:true,font:"Courier New",size:20}), run(" inside the ",{size:22}), run("~/Claude/files/",{bold:true,font:"Courier New",size:20}), run(" folder.",{size:22})]),
  spacer(60),
  infoBox(["  Security note: credentials.json contains a private key. Treat it like a password.","  Do not email it, commit it to Git, or upload it to cloud storage."],WARN_BG,WARN_BDR),
  spacer(160),
  h2("3.3  Share the Google Sheet with the service account"),
  numbered("Open the hosting.com marketing Google Sheet."),
  numbered('Click Share. Paste the service account email (ends in .iam.gserviceaccount.com, found in credentials.json under "client_email"). Set to Viewer.'),
  spacer(160),
  h2("3.4  Configure the sheet mapping"),
  numbered([run("Open ",{size:22}), run("sheet-config.json",{bold:true,font:"Courier New",size:20}), run(" in a text editor. The spreadsheet ID is already filled in.",{size:22})]),
  numbered("Verify that each tab name in the config matches your actual tab names. Update any that differ."),
  numbered("Update cell references (e.g. B2, B3) to match where your values appear in each tab."),
  spacer(200),
];

// ── Running the agents ───────────────────────────────────────────────────────
const runningAgents = [
  h1("4. Running the Agents"), rule(),
  para(run("Always sync your Google Sheet data first, then run the agent of your choice."), sp(0,160)),
  h2("4.1  Sync data from Google Sheets"),
  codeBlock(["node sync-sheet.js"]),
  para(run("Reads your sheet and writes data.json. Run this before each agent session.",{size:20,color:GREY_TEXT}), sp(80,200)),
  h2("4.2  Daily briefing (recommended: every morning)"),
  codeBlock(["node daily-briefing.js","","# Deep-dive on a specific area:","node daily-briefing.js --detailed --focus=cro","node daily-briefing.js --detailed --focus=seo"]),
  spacer(200),
  h2("4.3  Weekly marketing ops pipeline (recommended: Monday mornings)"),
  codeBlock(["node hosting-marketing-ops-hub.js"]),
  para(run("Runs six agents in sequence (~15 minutes). Saves a full JSON report to the working directory.",{size:20,color:GREY_TEXT}), sp(80,200)),
  h2("4.4  SEO audit (run on demand)"),
  codeBlock(["node hosting-seo-agent-system.js"]),
  spacer(200),
  h2("4.5  Recommended daily workflow"),
  new Table({
    width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[2200,7160],
    rows:[
      headerRow([["When",2200],["Command",7160]]),
      dataRow([["Every morning","node sync-sheet.js && node daily-briefing.js"]].map(([w,c])=>[w===c?w:w,w===c?7160:2200]),false)[0] ? dataRow([["Every morning",2200],["node sync-sheet.js && node daily-briefing.js",7160]],false) : null,
    ].filter(Boolean)
  }),
  spacer(200),
  new Paragraph({children:[new PageBreak()]}),
];

// Build running agents table separately for clarity
const workflowTable = new Table({
  width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[2200,7160],
  rows:[
    headerRow([["When",2200],["Command",7160]]),
    dataRow([["Every morning",2200],["node sync-sheet.js && node daily-briefing.js",7160]],false),
    dataRow([["Monday weekly",2200],["node sync-sheet.js && node hosting-marketing-ops-hub.js",7160]],true),
    dataRow([["On demand",2200],["node sync-sheet.js && node hosting-seo-agent-system.js",7160]],false),
  ]
});

const runningAgentsFinal = [
  h1("4. Running the Agents"), rule(),
  para(run("Always sync your Google Sheet data first, then run the agent of your choice."), sp(0,160)),
  h2("4.1  Sync data from Google Sheets"),
  codeBlock(["node sync-sheet.js"]),
  para(run("Reads your sheet and writes data.json. Run this before each agent session.",{size:20,color:GREY_TEXT}), sp(80,200)),
  h2("4.2  Daily briefing"),
  codeBlock(["node daily-briefing.js","","# Deep-dive on a specific area:","node daily-briefing.js --detailed --focus=cro","node daily-briefing.js --detailed --focus=seo"]),
  spacer(200),
  h2("4.3  Weekly marketing ops pipeline"),
  codeBlock(["node hosting-marketing-ops-hub.js"]),
  para(run("Runs six agents (~15 minutes). Saves a JSON report to the working directory.",{size:20,color:GREY_TEXT}), sp(80,200)),
  h2("4.4  SEO audit"),
  codeBlock(["node hosting-seo-agent-system.js"]),
  spacer(200),
  h2("4.5  Recommended workflow"),
  workflowTable,
  spacer(200),
  new Paragraph({children:[new PageBreak()]}),
];

// ── Security checklist ───────────────────────────────────────────────────────
const security = [
  h1("5. Security Checklist"), rule(),
  para(run("The items below represent the security controls in place for this system. Tick each item once verified before the agents are used in production."), sp(0,80)),
  infoBox(["  All items should be checked and signed off by the relevant approver before go-live."],LIGHT_BG,MID_BLUE),
  spacer(160),
  h2("5.1  API key security"),
  checkbox("ANTHROPIC_API_KEY is stored as an environment variable only — never written into any script or config file."),
  checkbox("credentials.json and any .env files are listed in .gitignore and have never been committed to version control."),
  checkbox("Procedure documented: if the API key is accidentally exposed, it will be revoked at console.anthropic.com and a new key issued immediately."),
  checkbox("Anthropic API usage is monitored monthly at console.anthropic.com/usage to detect unexpected activity."),
  spacer(160),
  h2("5.2  Google credentials security"),
  checkbox("credentials.json is stored only on the machine running the scripts — not in cloud storage, email, or Slack."),
  checkbox("File permissions on credentials.json are set to owner-read-only (chmod 600 on macOS/Linux)."),
  checkbox("The Google service account has Viewer-only (read-only) access to the marketing sheet — it cannot modify data."),
  checkbox("Procedure documented: credentials.json will be regenerated and old key revoked when any team member with access leaves."),
  checkbox("The Google service account key is scheduled for annual rotation."),
  spacer(160),
  h2("5.3  Data handling"),
  checkbox("Confirmed: scripts process only internal marketing KPIs (MRR, CAC, LTV, ROAS, conversion rates). No customer personal data is included."),
  checkbox("Confirmed: Anthropic does not train models on data submitted via the API. Enterprise data privacy applies."),
  checkbox("All agent output reports (JSON files) are saved locally only and not automatically shared externally."),
  spacer(160),
  h2("5.4  Network and access"),
  checkbox("Confirmed: scripts make outbound HTTPS calls only — to api.anthropic.com and sheets.googleapis.com."),
  checkbox("Confirmed: no inbound network ports are opened and no persistent server or daemon is running."),
  checkbox("Confirmed: scripts are run on-demand by an authorised user only."),
  spacer(160),
  h2("5.5  Ongoing hygiene"),
  checkbox("A reminder is in place to rotate the Google service account key annually or upon team changes."),
  checkbox("Google Sheet sharing permissions are reviewed quarterly."),
  checkbox("npm dependencies are reviewed and updated quarterly (npm audit)."),
  spacer(200),
  new Table({
    width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[Math.floor(CONTENT_W/2),Math.ceil(CONTENT_W/2)],
    rows:[new TableRow({children:[
      new TableCell({ borders:noBdr, width:{size:Math.floor(CONTENT_W/2),type:WidthType.DXA}, margins:{top:80,bottom:80,left:0,right:120}, children:[
        para(run("Approved by",{bold:true,size:20})),
        para(run("Name: ___________________________",{size:20}), sp(80,40)),
        para(run("Signature: ______________________",{size:20}), sp(0,40)),
        para(run("Date: ___________________________",{size:20})),
      ]}),
      new TableCell({ borders:noBdr, width:{size:Math.ceil(CONTENT_W/2),type:WidthType.DXA}, margins:{top:80,bottom:80,left:120,right:0}, children:[
        para(run("Prepared by",{bold:true,size:20})),
        para(run("Name: Daphne Monro",{size:20}), sp(80,40)),
        para(run("Title: Head of Website & Content",{size:20}), sp(0,40)),
        para(run("Date: May 2026",{size:20})),
      ]}),
    ]})]
  }),
  spacer(200),
  new Paragraph({children:[new PageBreak()]}),
];

// ── File reference ───────────────────────────────────────────────────────────
const fileRef = [
  h1("6. File Reference"), rule(),
  new Table({
    width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:[3200,6160],
    rows:[
      headerRow([["File",3200],["Purpose",6160]]),
      ...[
        ["daily-briefing.js",          "Morning KPI briefing agent"],
        ["hosting-marketing-ops-hub.js","6-agent weekly planning pipeline"],
        ["hosting-seo-agent-system.js", "SEO audit agent system"],
        ["sync-sheet.js",               "Syncs Google Sheet to data.json"],
        ["data.json",                   "Live KPI data used by all agents (auto-updated by sync-sheet.js)"],
        ["sheet-config.json",           "Maps Google Sheet tabs and cells to data.json fields"],
        ["credentials.json",            "Google service account key — KEEP SECURE, never commit to Git"],
        ["package.json",                "Node.js dependency manifest"],
      ].map(([file,purpose],i) => dataRow([[file,3200],[purpose,6160]],i%2===1)),
    ]
  }),
  spacer(240),
];

// ── Assemble doc ─────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: { config: [
    { reference:"bullets", levels:[
      { level:0, format:LevelFormat.BULLET, text:"•", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:720,hanging:360}}} },
      { level:1, format:LevelFormat.BULLET, text:"◦", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:1080,hanging:360}}} },
    ]},
    { reference:"steps", levels:[
      { level:0, format:LevelFormat.DECIMAL, text:"%1.", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:720,hanging:360}}} },
    ]},
    { reference:"checks", levels:[
      { level:0, format:LevelFormat.BULLET, text:"☐", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:720,hanging:360}}} },
    ]},
  ]},
  styles: {
    default: { document: { run: { font:"Arial", size:22, color:BLACK } } },
    paragraphStyles: [
      { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true, run:{size:36,bold:true,color:BLUE,font:"Arial"}, paragraph:{spacing:{before:360,after:120},outlineLevel:0} },
      { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true, run:{size:26,bold:true,color:MID_BLUE,font:"Arial"}, paragraph:{spacing:{before:280,after:100},outlineLevel:1} },
      { id:"Heading3", name:"Heading 3", basedOn:"Normal", next:"Normal", quickFormat:true, run:{size:22,bold:true,color:GREY_TEXT,font:"Arial"}, paragraph:{spacing:{before:200,after:80},outlineLevel:2} },
    ],
  },
  sections:[{
    properties:{ page:{ size:{width:PAGE_W,height:PAGE_H}, margin:{top:MARGIN,right:MARGIN,bottom:MARGIN,left:MARGIN} } },
    headers:{ default: new Header({ children:[
      new Paragraph({ border:{bottom:{style:BorderStyle.SINGLE,size:4,color:MID_BLUE,space:1}}, children:[
        run("AI Marketing Agent System — Setup & Security Guide  |  hosting.com  |  Confidential",{size:18,color:GREY_TEXT,font:"Arial"}),
      ]}),
    ]})},
    footers:{ default: new Footer({ children:[
      new Paragraph({ border:{top:{style:BorderStyle.SINGLE,size:4,color:MID_BLUE,space:1}}, alignment:AlignmentType.RIGHT, children:[
        run("Page ",{size:18,color:GREY_TEXT,font:"Arial"}),
        new TextRun({children:[PageNumber.CURRENT],size:18,color:GREY_TEXT,font:"Arial"}),
        run(" of ",{size:18,color:GREY_TEXT,font:"Arial"}),
        new TextRun({children:[PageNumber.TOTAL_PAGES],size:18,color:GREY_TEXT,font:"Arial"}),
      ]}),
    ]})},
    children:[
      ...titlePage,
      ...tocSection,
      ...execSummary,
      ...prerequisites,
      ...installation,
      ...googleSetup,
      ...runningAgentsFinal,
      ...security,
      ...fileRef,
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/Users/daphnemonro/Claude/files/Agent-Setup-Security-Guide.docx", buf);
  console.log("Done: Agent-Setup-Security-Guide.docx");
});
