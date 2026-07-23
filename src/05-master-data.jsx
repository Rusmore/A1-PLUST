const BRANCHES = [
  {
    "code": "ST",
    "name": "Starkson Paper And Plastic Corporation",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D1",
    "name": "Disney 1",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D2",
    "name": "Disney 2",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D3",
    "name": "Disney 3",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D8",
    "name": "Disney 8",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D5",
    "name": "Disney 5",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D6",
    "name": "Disney 6",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D7",
    "name": "Disney 7",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "D9",
    "name": "Disney 9",
    "company": "Starkson Paper and Plastic Corporation"
  },
  {
    "code": "A1+",
    "name": "A1+ Paper And Plastic Inc.",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "EURASIA",
    "name": "Eurasia",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "HASBRO",
    "name": "Hasbro",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "SITIO",
    "name": "Sitio",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "MATTEL",
    "name": "Mattel",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "PERULANDIA",
    "name": "Perulandia",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "WARNER",
    "name": "Warner",
    "company": "A1+ Paper and Plastic Inc."
  },
  {
    "code": "HAMFI(HO)",
    "name": "Happy Alliance Mono Film, Inc.",
    "company": "Happy Alliance Mono Film, Inc."
  },
  {
    "code": "STINDUSTRY",
    "name": "Starkson Industries Inc.",
    "company": "Starkson Industries Inc."
  },
  {
    "code": "RG",
    "name": "RG and Co.",
    "company": "RG and Co."
  }
];

const COMPANIES = [
  "A1+ Paper and Plastic Inc.",
  "Starkson Paper and Plastic Corporation",
  "Happy Alliance Mono Film, Inc.",
  "Starkson Industries Inc.",
  "RG and Co."
];

/* The four operating petty-cash plants used for plant-scoped access control,
   per-plant dashboards, and the plant selector shown inside each module. */
const PLANTS = [
  { key: "MNL", code: "A1+", label: "Manila", custodian: "Maureen Felix" },
  { key: "WARNER", code: "WARNER", label: "Warner", custodian: "Angelita Bayani" },
  { key: "DISNEY", code: "D1", label: "Disney", custodian: "Pura Barloso" },
  { key: "RG", code: "RG", label: "RG and Co.", custodian: "Pura Barloso" },
];
const PLANT_CODES = PLANTS.map((p) => p.code);
const plantLabel = (code) => (PLANTS.find((p) => p.code === code) || {}).label || code;
/* Resolve a user's allowed plant list ("ALL" -> every plant code). */
const resolvePlants = (plants) => (plants === "ALL" || !plants) ? PLANT_CODES.slice() : plants.filter((c) => PLANT_CODES.includes(c));

const SUBACCOUNTS = [
  {
    "code": "000-00000",
    "desc": "Default"
  },
  {
    "code": "000-00001",
    "desc": "General Management"
  },
  {
    "code": "000-00002",
    "desc": "Creatives"
  },
  {
    "code": "000-00003",
    "desc": "Sales and Accounts Management"
  },
  {
    "code": "000-00004",
    "desc": "Production"
  },
  {
    "code": "000-00005",
    "desc": "RM Warehouse and Logistics"
  },
  {
    "code": "000-00006",
    "desc": "FG Warehouse and Logistics"
  },
  {
    "code": "000-00007",
    "desc": "Engineering"
  },
  {
    "code": "000-00008",
    "desc": "Motorpool"
  },
  {
    "code": "000-00009",
    "desc": "Accounting and Finance"
  },
  {
    "code": "000-00010",
    "desc": "Human Resources"
  },
  {
    "code": "000-00011",
    "desc": "Information Technology"
  },
  {
    "code": "000-00012",
    "desc": "Procurement"
  },
  {
    "code": "000-00013",
    "desc": "PPIC"
  },
  {
    "code": "000-00014",
    "desc": "Special Projects"
  },
  {
    "code": "000-00015",
    "desc": "Quality Assurance"
  },
  {
    "code": "000-00016",
    "desc": "Research & Development"
  },
  {
    "code": "000-00017",
    "desc": "Business Development"
  },
  {
    "code": "000-00018",
    "desc": "Farm"
  },
  {
    "code": "000-00019",
    "desc": "China Accounts"
  },
  {
    "code": "000-00020",
    "desc": "China Human Resources & Admin"
  },
  {
    "code": "000-00021",
    "desc": "China Enginering"
  },
  {
    "code": "000-00022",
    "desc": "China Quality Assurance"
  },
  {
    "code": "000-00023",
    "desc": "China Hand Sample"
  },
  {
    "code": "000-00024",
    "desc": "China Supply Chain Department"
  },
  {
    "code": "000-00025",
    "desc": "China Accounting and Finance"
  },
  {
    "code": "000-00026",
    "desc": "China Creatives"
  },
  {
    "code": "000-00027",
    "desc": "China Logistics and Shipment"
  },
  {
    "code": "000-00028",
    "desc": "DISNEY 3 Manufacturing"
  },
  {
    "code": "000-0002D",
    "desc": "Warehouse/Logistics"
  },
  {
    "code": "000-00030",
    "desc": "Research & Development"
  },
  {
    "code": "000-00031",
    "desc": "Engineering"
  },
  {
    "code": "000-00032",
    "desc": "Procurement"
  },
  {
    "code": "000-00033",
    "desc": "DISNEY 6 Manufacturing"
  },
  {
    "code": "000-00034",
    "desc": "WARNER Manufacturing"
  },
  {
    "code": "000-00040",
    "desc": "SITIO Accounting & Finance"
  },
  {
    "code": "000-00041",
    "desc": "DISNEY 6 Accounting & Finance"
  },
  {
    "code": "000-00050",
    "desc": "WARNER IT"
  },
  {
    "code": "000-00051",
    "desc": "HASBRO IT"
  },
  {
    "code": "000-00052",
    "desc": "DISNEY 1 IT"
  },
  {
    "code": "000-00053",
    "desc": "DISNEY 5 IT"
  },
  {
    "code": "000-00060",
    "desc": "HASBRO Human Resources"
  },
  {
    "code": "000-00061",
    "desc": "DISNEY 1 Human Resources"
  },
  {
    "code": "000-00070",
    "desc": "Creatives"
  },
  {
    "code": "000-00080",
    "desc": "Special Projects"
  },
  {
    "code": "000-0014E",
    "desc": "PERULANDIA Engineering"
  },
  {
    "code": "000-0014Q",
    "desc": "PERULANDIA Quality Assurance"
  },
  {
    "code": "000-0016E",
    "desc": "DISNEY 3 Engineering"
  },
  {
    "code": "000-0016P",
    "desc": "DISNEY 3 PPIC"
  },
  {
    "code": "000-0016Q",
    "desc": "DISNEY 3 Quality Assurance"
  },
  {
    "code": "000-0017E",
    "desc": "DISNEY 5 Engineering"
  },
  {
    "code": "000-0017P",
    "desc": "DISNEY 5 PPIC"
  },
  {
    "code": "000-0017Q",
    "desc": "DISNEY 5 Quality Assurance"
  },
  {
    "code": "000-0017R",
    "desc": "DISNEY 5 Research & Development"
  },
  {
    "code": "000-0018E",
    "desc": "DISNEY 6 Engineering"
  },
  {
    "code": "000-0018P",
    "desc": "DISNEY 6 PPIC"
  },
  {
    "code": "000-0018Q",
    "desc": "DISNEY 6 Quality Assurance"
  },
  {
    "code": "000-0018R",
    "desc": "DISNEY 6 Research & Development"
  },
  {
    "code": "000-0019E",
    "desc": "DISNEY 8 Engineering"
  },
  {
    "code": "000-0019P",
    "desc": "DISNEY 8 PPIC"
  },
  {
    "code": "000-0019Q",
    "desc": "DISNEY 8 Quality Assurance"
  },
  {
    "code": "000-0019R",
    "desc": "DISNEY 8 Research & Development"
  },
  {
    "code": "000-0019W",
    "desc": "DISNEY 8 Warehouse/Logistics"
  },
  {
    "code": "000-0020",
    "desc": "HASBRO Mat Prep"
  },
  {
    "code": "000-0020E",
    "desc": "HASBRO Engineering"
  },
  {
    "code": "000-0020P",
    "desc": "HASBRO PPIC"
  },
  {
    "code": "000-0020Q",
    "desc": "HASBRO Quality Assurance"
  },
  {
    "code": "000-0020R",
    "desc": "HASBRO Research & Development"
  },
  {
    "code": "000-0020W",
    "desc": "HASBRO Warehouse/Logistics"
  },
  {
    "code": "000-0021E",
    "desc": "SITIO Engineering"
  },
  {
    "code": "000-0021P",
    "desc": "SITIO PPIC"
  },
  {
    "code": "000-0021Q",
    "desc": "SITIO Quality Assurance"
  },
  {
    "code": "000-0021R",
    "desc": "SITIO Research & Development"
  },
  {
    "code": "000-0021W",
    "desc": "SITIO Warehouse/Logistics"
  },
  {
    "code": "000-0022E",
    "desc": "MATTEL Engineering"
  },
  {
    "code": "000-0022P",
    "desc": "MATTEL PPIC"
  },
  {
    "code": "000-0022Q",
    "desc": "MATTEL Quality Assurance"
  },
  {
    "code": "000-0022R",
    "desc": "MATTEL Research & Development"
  },
  {
    "code": "000-0022W",
    "desc": "MATTEL Warehouse/Logistics"
  },
  {
    "code": "000-0023A",
    "desc": "DISNEY 1 Engineering"
  },
  {
    "code": "000-0023B",
    "desc": "DISNEY 1 PPIC"
  },
  {
    "code": "000-0023C",
    "desc": "DISNEY 1 Quality Assurance"
  },
  {
    "code": "000-0023D",
    "desc": "DISNEY 1 Research & Development"
  },
  {
    "code": "000-0023E",
    "desc": "DISNEY 1 Warehouse/Logistics"
  },
  {
    "code": "000-0024E",
    "desc": "DISNEY 2 Engineering"
  },
  {
    "code": "000-0024P",
    "desc": "DISNEY 2 PPIC"
  },
  {
    "code": "000-0024Q",
    "desc": "DISNEY 2 Quality Assurance"
  },
  {
    "code": "000-0024R",
    "desc": "DISNEY 2 Research & Development"
  },
  {
    "code": "000-0024W",
    "desc": "DISNEY 2 Warehouse/Logistics"
  },
  {
    "code": "000-0026E",
    "desc": "DISNEY 7 Engineering"
  },
  {
    "code": "000-0026P",
    "desc": "DISNEY 7 PPIC"
  },
  {
    "code": "000-0026Q",
    "desc": "DISNEY 7 Quality Assurance"
  },
  {
    "code": "000-0026R",
    "desc": "DISNEY 7 Research & Development"
  },
  {
    "code": "000-0026W",
    "desc": "DISNEY 7 Warehouse/Logistics"
  },
  {
    "code": "000-0027E",
    "desc": "HAMFI Engineering"
  },
  {
    "code": "000-0027P",
    "desc": "HAMFI PPIC"
  },
  {
    "code": "000-0027Q",
    "desc": "HAMFI Quality Assurance"
  },
  {
    "code": "000-0027R",
    "desc": "HAMFI Research & Development"
  },
  {
    "code": "000-0027S",
    "desc": "HAMFI Sales"
  },
  {
    "code": "000-0027W",
    "desc": "HAMFI Warehouse/Logistics"
  },
  {
    "code": "000-0028A",
    "desc": "WARNER Accounting"
  },
  {
    "code": "000-0028E",
    "desc": "WARNER Engineering"
  },
  {
    "code": "000-0028H",
    "desc": "WARNER Human Resources"
  },
  {
    "code": "000-0028P",
    "desc": "WARNER PPIC"
  },
  {
    "code": "000-0028Q",
    "desc": "WARNER Quality Assurance"
  },
  {
    "code": "000-0028R",
    "desc": "WARNER Research & Development"
  },
  {
    "code": "000-0028S",
    "desc": "WARNER Sales and Accounts Management"
  },
  {
    "code": "000-0028W",
    "desc": "WARNER Warehouse/Logistics"
  },
  {
    "code": "000-0040",
    "desc": ""
  },
  {
    "code": "000-FXD",
    "desc": ""
  },
  {
    "code": "001-00000",
    "desc": ""
  },
  {
    "code": "001-C0010",
    "desc": "China Accounts"
  },
  {
    "code": "001-C0020",
    "desc": "China Human Resources & Admin"
  },
  {
    "code": "001-C0030",
    "desc": "China Engineering"
  },
  {
    "code": "001-C0040",
    "desc": "China Quality Assurance"
  },
  {
    "code": "001-C0050",
    "desc": "China Handsample Team"
  },
  {
    "code": "001-C0060",
    "desc": "China Supply Chain Department"
  },
  {
    "code": "001-C0070",
    "desc": "China Accounting and Finance"
  },
  {
    "code": "001-C0080",
    "desc": "China Creatives"
  },
  {
    "code": "001-C0090",
    "desc": "China Logistics and Shipment"
  },
  {
    "code": "002-00000",
    "desc": ""
  },
  {
    "code": "002-FLEXF",
    "desc": "Flexible Films"
  },
  {
    "code": "002-FLEXP",
    "desc": "Flexible Packaging"
  },
  {
    "code": "002-PCKGE",
    "desc": "Packaging"
  },
  {
    "code": "002-PREMI",
    "desc": "Premium"
  },
  {
    "code": "003-00000",
    "desc": ""
  },
  {
    "code": "004-00000",
    "desc": ""
  },
  {
    "code": "641-0030",
    "desc": ""
  },
  {
    "code": "641-0150",
    "desc": ""
  },
  {
    "code": "641-0190",
    "desc": ""
  },
  {
    "code": "641-0340",
    "desc": ""
  },
  {
    "code": "CH -INA",
    "desc": ""
  },
  {
    "code": "CHI-NA",
    "desc": ""
  },
  {
    "code": "DEL-FIXED",
    "desc": "DELIVERY FIXED RATE"
  },
  {
    "code": "DIS-NEY",
    "desc": ""
  },
  {
    "code": "DIS-NEY 3",
    "desc": ""
  },
  {
    "code": "HAS-BRO",
    "desc": ""
  },
  {
    "code": "PER-U",
    "desc": ""
  },
  {
    "code": "SEC-AGEN",
    "desc": "Security Agency Payroll"
  },
  {
    "code": "TOP-MAN",
    "desc": ""
  },
  {
    "code": "TOP-MANA",
    "desc": ""
  },
  {
    "code": "WAR-NER",
    "desc": ""
  }
];

/* Tax categories mirror Acumatica's Tax Category master file. Used in the
   Liquidation worksheet and exported straight into the "Tax Category" column. */
const TAX_CATEGORIES = [
  { code: "CHN VAT8", desc: "CHN_VAT8%" },
  { code: "CHTX", desc: "CHINA TAXES" },
  { code: "LCBROKER", desc: "Landed Cost Brokerage - WC140" },
  { code: "LCBROKERVAT", desc: "Landed Cost Brokerage - WC140 and VAT" },
  { code: "LCMATERIAL", desc: "LANDED COST MATERIALS" },
  { code: "LCSHIPPING5WT", desc: "LANDED COST SHIPPPING - 5% WT AND VAT" },
  { code: "LCSTORAGE", desc: "Landed Cost Storage - VAT and WT" },
  { code: "LCTRUCKING", desc: "Landed Cost Trucking WC160" },
  { code: "LCVATEXSS", desc: "Landed Cost VAT – Exempt Services" },
  { code: "LCWHARFAGE", desc: "Landed Cost Wharfage/Arrastre WC160" },
  { code: "VATCE", desc: "VAT- Capital Goods Exceeding 1M" },
  { code: "VATEX", desc: "VAT – Exempt Goods" },
  { code: "VATEXC", desc: "Vat Excluded" },
  { code: "VATEXSS", desc: "VAT – Exempt Services" },
  { code: "VATGD", desc: "VAT – Vatable Goods" },
  { code: "VATIM", desc: "VAT – Importation" },
  { code: "VATNC", desc: "VAT- Capital Goods not Exceeding 1M" },
  { code: "VATSG", desc: "VAT – Sale to Government" },
  { code: "VATSS", desc: "VAT – Vatable Services" },
  { code: "VATWH", desc: "VAT - Withholding Tax Holiday" },
  { code: "VATXX", desc: "VAT - Exempt Transaction" },
  { code: "VATZR", desc: "VAT – Zero Rated" },
  { code: "WC860", desc: "Income payment of manufacturers & direct importers of fuels" },
];

const taxCategoryLabel = (code) => {
  if (!code) return "—";
  const t = TAX_CATEGORIES.find((x) => x.code === code);
  return t ? `${t.code} — ${t.desc}` : code;
};

/* ============================= USER ROLES ============================= */

/* Each role only sees the nav tabs relevant to it. Plant-level data access is
   controlled separately (per user) so a custodian only sees their own plants. */
const ROLES = {
  "Accounting": { label: "Accounting Department", tabs: ["dashboard", "requests", "disbursements", "liquidation", "replenishment", "history", "report", "aging", "audit", "masterdata", "users", "settings"] },
  "Finance":    { label: "Finance Department",    tabs: ["dashboard", "requests", "disbursements", "liquidation", "replenishment", "history", "report", "aging", "audit", "masterdata"] },
  "Custodian":  { label: "Custodian",             tabs: ["dashboard", "requests", "disbursements", "liquidation", "replenishment", "history", "report", "aging"] },
};
const ROLE_NAMES = Object.keys(ROLES);

/* Decide a signed-in user's role, admin status and plant scope from the config
   in index.html (window.PCP_USERS). Accounting is the full super-admin. In
   local (no-auth) mode the operator is treated as Accounting super-admin so the
   tool stays fully usable offline. */
function resolveUserAccess(email) {
  if (!email) return { role: "Accounting", isAdmin: true, plants: "ALL", name: "Administrator" };
  const users = window.PCP_USERS || {};
  const admins = (window.PCP_ADMIN_EMAILS || []).map((s) => String(s).toLowerCase());
  const e = String(email).toLowerCase();
  const username = e.split("@")[0];
  const u = users[e] || users[username];
  if (u) {
    const role = ROLES[u.role] ? u.role : "Custodian";
    const isAdmin = role === "Accounting" || admins.includes(e) || admins.includes(username);
    return { role, isAdmin, plants: u.plants || "ALL", name: u.name || email };
  }
  if (admins.includes(e) || admins.includes(username)) return { role: "Accounting", isAdmin: true, plants: "ALL", name: email };
  const fb = (window.PCP_DEFAULT_ROLE && ROLES[window.PCP_DEFAULT_ROLE]) ? window.PCP_DEFAULT_ROLE : "Custodian";
  return { role: fb, isAdmin: false, plants: [], name: email };
}

/* Build the notification feed derived from current state — approvals awaiting
   action, overdue/pending liquidations, and completed replenishments. */
function buildNotifications(requests, disbursements, liquidations, replenishments) {
  const out = [];
  requests.forEach((r) => {
    if (r.status === "Pending") out.push({ id: "n-req-" + r.id, type: "approval", icon: "clip", title: "Approval required", text: `${r.requestNo} · ${r.employee} · ${peso(r.amount)}`, date: r.date });
    if (r.status === "Approved") out.push({ id: "n-appr-" + r.id, type: "approved", icon: "check", title: "Request approved — ready to release", text: `${r.requestNo} · ${r.employee}`, date: r.date });
    if (r.status === "Rejected") out.push({ id: "n-rej-" + r.id, type: "rejected", icon: "x", title: "Request rejected", text: `${r.requestNo} · ${r.employee}`, date: r.date });
  });
  disbursements.forEach((d) => {
    const status = liqStatusFor(d, liquidations);
    if (status === "Fully Liquidated") return;
    const ageDays = Math.floor((Date.now() - new Date((d.date || todayISO()) + "T00:00:00").getTime()) / 86400000);
    if (ageDays >= 15) out.push({ id: "n-over-" + d.id, type: "overdue", icon: "alert", title: "Liquidation overdue", text: `${d.voucherNo} · ${d.employee} · ${ageDays} days outstanding`, date: d.date });
    else out.push({ id: "n-liq-" + d.id, type: "liquidation", icon: "sheet", title: "Liquidation due", text: `${d.voucherNo} · ${d.employee} · ${peso(d.amount)}`, date: d.date });
  });
  (replenishments || []).forEach((r) => {
    if (r.status === "Completed") out.push({ id: "n-rep-" + r.id, type: "replenished", icon: "refresh", title: "Replenishment completed", text: `${r.replenishmentNo} · ${peso(r.amount)}`, date: r.date });
    else out.push({ id: "n-repp-" + r.id, type: "replenish-pending", icon: "refresh", title: "Replenishment pending", text: `${r.replenishmentNo} · ${peso(r.amount)}`, date: r.date });
  });
  return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

const EXPENSE_CATEGORIES = [
  "DL 13th month pay",
  "DL Contracted Support Services",
  "DL Employee's Benefit",
  "DL Govt Mandatory",
  "DL Retirement benefit",
  "DL Salaries and Wages",
  "DL Service Fee",
  "FOH - Indirect Salaries & Wages",
  "FOH - Manufacturing",
  "FOH Arrastre Fees",
  "FOH Brokerage Fees",
  "FOH Communication, Light & Water",
  "FOH Delivery Expense",
  "FOH Delivery Expense-Transpo",
  "FOH Demurrage",
  "FOH Depreciation - Bldg. Equipment",
  "FOH Depreciation - Building",
  "FOH Depreciation - Delivery Truck",
  "FOH Depreciation - Machineries",
  "FOH Depreciation - Motorcycle Services",
  "FOH Depreciation - Prod Equipment",
  "FOH Distribution Charge",
  "FOH Duties & Taxes",
  "FOH Freight In Charges",
  "FOH Handling Fees",
  "FOH Insurance",
  "FOH Licensing Fee",
  "FOH Miscellaneous",
  "FOH Oil & Gasoline",
  "FOH Other Charges",
  "FOH Production Tools",
  "FOH Rental",
  "FOH Rep & Main. - Bldg. Equipment",
  "FOH Rep & Main. - Building",
  "FOH Rep & Main. - Delivery Truck",
  "FOH Rep & Main. - Fire Truck",
  "FOH Rep & Main. - Inventory Discrepancy",
  "FOH Rep & Main. - Machineries",
  "FOH Rep & Main. - Motorcycle Services",
  "FOH Rep & Main. - Prod Equipment",
  "FOH Sec. Serv.-Agency Fee",
  "FOH Security services",
  "FOH Service Fee & Premium Bond",
  "FOH Storage Fees",
  "FOH Surcharges",
  "FOH Testing Fee",
  "FOH Toll Fee",
  "FOH Trucking",
  "FOH Wharfage Fee",
  "OE - Feeds",
  "OE 13th month pay",
  "OE Advertising and Promotion",
  "OE Audit Fee",
  "OE Bank Service Charges",
  "OE Commission Expense",
  "OE Communication, Light & Water",
  "OE Contracted Support Services",
  "OE Courier Services",
  "OE Depreciation - Building",
  "OE Depreciation - Company Car",
  "OE Depreciation - Furniture & Fixtures",
  "OE Depreciation - Land Improvement",
  "OE Depreciation - Office Equipment",
  "OE Depreciation - Residential & Leisure",
  "OE Depreciation - Software Licenses",
  "OE Documentary Stamp Tax",
  "OE Documentation, Registration",
  "OE Dues, Subscription and List",
  "OE Employee's Benefit",
  "OE Facilitation Fee",
  "OE Govt Mandatory",
  "OE Insurance",
  "OE Interest Expense",
  "OE Inventory Loss",
  "OE Inventory Obsolescence",
  "OE Janitorial Expense",
  "OE Legal fees",
  "OE Meal Allowance",
  "OE Miscellaneous",
  "OE OJT Allowance",
  "OE Office Supplies",
  "OE Oil & Gasoline",
  "OE Other Charges",
  "OE Penalties/Impounding/Towing Fees",
  "OE Printing, Supplies & Office",
  "OE Product Licensing/Patent Fee",
  "OE Professional Fees",
  "OE Provision for  Income Tax",
  "OE Rental",
  "OE Rep. & Main - Building",
  "OE Rep. & Main - Company Car",
  "OE Rep. & Main - Land Improvement",
  "OE Rep. & Main - Office Equipment",
  "OE Rep. & Main - Residential & Leisure",
  "OE Representation and Entertai",
  "OE Retirement Pay",
  "OE Salaries and wages",
  "OE Samples",
  "OE Scholar Allowance",
  "OE Scholar Tuition",
  "OE Security Services-Agency Fe",
  "OE Security services",
  "OE Seminars and Training Fee",
  "OE Separation Pay",
  "OE Service Fee",
  "OE Service and Other Charges",
  "OE Software Licenses",
  "OE Taxes and Licenses",
  "OE Testing Fee",
  "OE Toll Fee",
  "OE Transaction Loss",
  "OE Transportation and travel"
];

const EXPENSE_CATEGORY_ACCOUNTS = {
  "DL 13th month pay": "51110120",
  "DL Contracted Support Services": "51110160",
  "DL Employee's Benefit": "51110130",
  "DL Govt Mandatory": "51110140",
  "DL Retirement benefit": "51110150",
  "DL Salaries and Wages": "51110110",
  "DL Service Fee": "51110165",
  "FOH Handling Fees": "52110050",
  "FOH - Indirect Salaries & Wages": "51110168",
  "FOH - Manufacturing": "51110169",
  "FOH Arrastre Fees": "52110060",
  "FOH Brokerage Fees": "52110030",
  "FOH Communication, Light & Water": "51110350",
  "FOH Delivery Expense": "51110420",
  "FOH Delivery Expense-Transpo": "51110400",
  "FOH Demurrage": "52110090",
  "FOH Depreciation - Bldg. Equipment": "51110260",
  "FOH Depreciation - Building": "51110250",
  "FOH Depreciation - Delivery Truck": "51110290",
  "FOH Depreciation - Machineries": "51110280",
  "FOH Depreciation - Motorcycle Services": "51110300",
  "FOH Depreciation - Prod Equipment": "51110270",
  "FOH Distribution Charge": "52110110",
  "FOH Duties & Taxes": "52110100",
  "FOH Freight In Charges": "52110020",
  "FOH Insurance": "51110320",
  "FOH Licensing Fee": "51110380",
  "FOH Miscellaneous": "51110390",
  "FOH Oil & Gasoline": "51110310",
  "FOH Other Charges": "52110130",
  "FOH Production Tools": "51110240",
  "FOH Rental": "51110360",
  "FOH Rep & Main. - Bldg. Equipment": "51110180",
  "FOH Rep & Main. - Building": "51110170",
  "FOH Rep & Main. - Delivery Truck": "51110210",
  "FOH Rep & Main. - Fire Truck": "51110220",
  "FOH Rep & Main. - Inventory Discrepancy": "51110231",
  "FOH Rep & Main. - Machineries": "51110200",
  "FOH Rep & Main. - Motorcycle Services": "51110230",
  "FOH Rep & Main. - Prod Equipment": "51110190",
  "FOH Sec. Serv.-Agency Fee": "51110340",
  "FOH Security services": "51110330",
  "FOH Service Fee & Premium Bond": "52110010",
  "FOH Storage Fees": "52110040",
  "FOH Surcharges": "52110070",
  "FOH Testing Fee": "51110370",
  "FOH Toll Fee": "51110315",
  "FOH Trucking": "52110080",
  "FOH Wharfage Fee": "52110120",
  "OE - Feeds": "64110553",
  "OE 13th month pay": "64110020",
  "OE Advertising and Promotion": "64110220",
  "OE Audit Fee": "64110300",
  "OE Bank Service Charges": "64110270",
  "OE Commission Expense": "64110090",
  "OE Communication, Light & Water": "64110180",
  "OE Contracted Support Services": "64110120",
  "OE Courier Services": "64110570",
  "OE Depreciation - Building": "64110440",
  "OE Depreciation - Company Car": "64110460",
  "OE Depreciation - Furniture & Fixtures": "64110480",
  "OE Depreciation - Land Improvement": "64110430",
  "OE Depreciation - Office Equipment": "64110470",
  "OE Depreciation - Residential & Leisure": "64110450",
  "OE Depreciation - Software Licenses": "64110485",
  "OE Documentary Stamp Tax": "64110585",
  "OE Documentation, Registration": "64110240",
  "OE Dues, Subscription and List": "64110230",
  "OE Employee's Benefit": "64110030",
  "OE Facilitation Fee": "64110310",
  "OE Govt Mandatory": "64110040",
  "OE Insurance": "64110330",
  "OE Interest Expense": "64110210",
  "OE Inventory Loss": "64110360",
  "OE Inventory Obsolescence": "64110350",
  "OE Janitorial Expense": "64110370",
  "OE Legal fees": "64110080",
  "OE Meal Allowance": "64110060",
  "OE Miscellaneous": "64110280",
  "OE Office Supplies": "64110140",
  "OE Oil & Gasoline": "64110170",
  "OE OJT Allowance": "64110015",
  "OE Other Charges": "64110340",
  "OE Penalties/Impounding/Towing Fees": "64110580",
  "OE Printing, Supplies & Office": "64110150",
  "OE Product Licensing/Patent Fee": "64110500",
  "OE Professional Fees": "64110070",
  "OE Provision for  Income Tax": "64110520",
  "OE Rental": "64110290",
  "OE Rep. & Main - Building": "64110390",
  "OE Rep. & Main - Company Car": "64110410",
  "OE Rep. & Main - Land Improvement": "64110380",
  "OE Rep. & Main - Office Equipment": "64110420",
  "OE Rep. & Main - Residential & Leisure": "64110400",
  "OE Representation and Entertai": "64110250",
  "OE Retirement Pay": "64110055",
  "OE Salaries and wages": "64110010",
  "OE Samples": "64110321",
  "OE Scholar Allowance": "64110551",
  "OE Scholar Tuition": "64110552",
  "OE Security services": "64110100",
  "OE Security Services-Agency Fe": "64110110",
  "OE Seminars and Training Fee": "64110260",
  "OE Separation Pay": "64110050",
  "OE Service and Other Charges": "64110510",
  "OE Service Fee": "64110130",
  "OE Software Licenses": "64110490",
  "OE Taxes and Licenses": "64110190",
  "OE Testing Fee": "64110320",
  "OE Toll Fee": "64110175",
  "OE Transaction Loss": "64110200",
  "OE Transportation and travel": "64110160",
};

function accountForCategory(category) {
  return EXPENSE_CATEGORY_ACCOUNTS[category] || "";
}

