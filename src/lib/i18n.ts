export type Lang = "en" | "hi" | "hing";

const en = {
  auth: { signIn: "Sign in", signOut: "Sign out", email: "Email", password: "Password", title: "Sign in to MPLAD Sentinel", openMode: "No accounts are configured: anyone can edit. Set ADMIN_EMAIL and ADMIN_PASSWORD to enable accounts.", users: "Users", addUser: "Add user", name: "Name", role: "Role", audit: "Audit log", disable: "Disable", enable: "Enable", resetPw: "Reset password", create: "Create", active: "Active", disabled: "Disabled", last: "Last login" },
  name: "MPLAD Sentinel",
  tag: "Screening desk for MPLADS completed works",
  note: "Data is an unverified export of the official MPLADS dashboard. Indicators are screening signals for human review, not proof of fraud.",
  tabs: { overview: "Overview", works: "Works", members: "Members", cases: "Cases", method: "Data & method", admin: "Admin" },
  kpi: { works: "Completed works", amount: "Amount disbursed", flagged: "Works with indicators", photo: "With photo on record", states: "States / UTs", members: "Members with works" },
  charts: { monthly: "Disbursed per month", states: "Top states by amount", types: "Top work types by amount", severity: "Indicators by severity" },
  filters: { search: "Search code, description, member, authority…", allStates: "All states", allTypes: "All work types", allFy: "All years", allSev: "Any severity", flagged: "Flagged only", anyFlag: "Any indicator", anyPhoto: "Photo: any", photoYes: "Has photo", photoNo: "No photo", minAmt: "Min ₹", reset: "Reset", export: "Download CSV" },
  cols: { work: "Work", state: "State", member: "Member", date: "Completed", amount: "Amount", risk: "Risk", indicators: "Indicators" },
  members: { search: "Search member or constituency", name: "Member", works: "Works", disbursed: "Disbursed", allocated: "Allocation in export", photo: "Photo %", flagged: "Flagged", view: "View works" },
  detail: { why: "Why it is flagged", none: "No screening indicator fired for this work.", fields: "Official fields", status: "Review status", note: "Reviewer note", save: "Save note", open: "Open", reviewed: "Reviewed", dismissed: "Dismissed", history: "Status history", ask: "Ask AI about this work", close: "Close", saved: "Saved.", needLogin: "Sign in as a reviewer to change status or notes.", readOnly: "Your role is read-only." },
  chat: { title: "Ask the desk", hint: "English, Hindi or Hinglish. Answers use the database context.", send: "Send", placeholder: "e.g. Which work types look unusual?", clear: "Clear", newChat: "New chat", history: "History" },
  empty: "No works match these filters.",
  loading: "Loading…",
  prev: "Previous", next: "Next",
  cases: { title: "Reviewed and annotated works", none: "No case has been reviewed or annotated yet." },
};

type Copy = typeof en;

const hing: Copy = {
  auth: { signIn: "Sign in", signOut: "Sign out", email: "Email", password: "Password", title: "MPLAD Sentinel mein sign in karo", openMode: "Koi account configure nahi hai: koi bhi edit kar sakta hai. Accounts ke liye ADMIN_EMAIL aur ADMIN_PASSWORD set karo.", users: "Users", addUser: "User jodo", name: "Naam", role: "Role", audit: "Audit log", disable: "Disable", enable: "Enable", resetPw: "Password reset", create: "Banao", active: "Active", disabled: "Disabled", last: "Last login" },
  name: "MPLAD Sentinel",
  tag: "MPLADS ke completed works ki screening desk",
  note: "Data official MPLADS dashboard ka unverified export hai. Indicators sirf screening ke liye hain, fraud ka proof nahi.",
  tabs: { overview: "Overview", works: "Works", members: "Members", cases: "Cases", method: "Data aur method", admin: "Admin" },
  kpi: { works: "Completed works", amount: "Disbursed amount", flagged: "Indicator wale works", photo: "Photo record wale", states: "State / UT", members: "Works wale members" },
  charts: { monthly: "Mahine ke hisaab se disbursed", states: "Top states (amount)", types: "Top work types (amount)", severity: "Severity ke hisaab se indicators" },
  filters: { search: "Code, description, member, authority search karo…", allStates: "Sab states", allTypes: "Sab work types", allFy: "Sab saal", allSev: "Koi bhi severity", flagged: "Sirf flagged", anyFlag: "Koi bhi indicator", anyPhoto: "Photo: koi bhi", photoYes: "Photo hai", photoNo: "Photo nahi", minAmt: "Min ₹", reset: "Reset", export: "CSV download" },
  cols: { work: "Work", state: "State", member: "Member", date: "Completed", amount: "Amount", risk: "Risk", indicators: "Indicators" },
  members: { search: "Member ya constituency search karo", name: "Member", works: "Works", disbursed: "Disbursed", allocated: "Export mein allocation", photo: "Photo %", flagged: "Flagged", view: "Works dekho" },
  detail: { why: "Flag kyun hua", none: "Is work par koi screening indicator nahi laga.", fields: "Official fields", status: "Review status", note: "Reviewer note", save: "Note save karo", open: "Open", reviewed: "Reviewed", dismissed: "Dismissed", history: "Status history", ask: "Is work ke baare mein AI se poochho", close: "Band karo", saved: "Save ho gaya.", needLogin: "Status ya note badalne ke liye reviewer ke roop mein sign in karo.", readOnly: "Aapka role read-only hai." },
  chat: { title: "Desk se poochho", hint: "English, Hindi ya Hinglish. Jawab database context se aate hain.", send: "Bhejo", placeholder: "jaise: kaunse work types unusual lag rahe hain?", clear: "Clear", newChat: "Naya chat", history: "History" },
  empty: "In filters se koi work match nahi hua.",
  loading: "Load ho raha hai…",
  prev: "Pichla", next: "Agla",
  cases: { title: "Reviewed aur annotated works", none: "Abhi koi case review ya annotate nahi hua." },
};

const hi: Copy = {
  auth: { signIn: "साइन इन", signOut: "साइन आउट", email: "ईमेल", password: "पासवर्ड", title: "MPLAD Sentinel में साइन इन करें", openMode: "कोई खाता कॉन्फ़िगर नहीं है: कोई भी संपादन कर सकता है। खाते चालू करने के लिए ADMIN_EMAIL और ADMIN_PASSWORD सेट करें।", users: "उपयोगकर्ता", addUser: "उपयोगकर्ता जोड़ें", name: "नाम", role: "भूमिका", audit: "ऑडिट लॉग", disable: "निष्क्रिय करें", enable: "सक्रिय करें", resetPw: "पासवर्ड रीसेट", create: "बनाएँ", active: "सक्रिय", disabled: "निष्क्रिय", last: "अंतिम लॉगिन" },
  name: "एमपीलैड सेंटिनल",
  tag: "एमपीलैड्स पूर्ण कार्यों की स्क्रीनिंग डेस्क",
  note: "डेटा आधिकारिक एमपीलैड्स डैशबोर्ड का असत्यापित निर्यात है। संकेतक केवल जाँच हेतु हैं, धोखाधड़ी का प्रमाण नहीं।",
  tabs: { overview: "सारांश", works: "कार्य", members: "सांसद", cases: "केस", method: "डेटा व पद्धति", admin: "एडमिन" },
  kpi: { works: "पूर्ण कार्य", amount: "वितरित राशि", flagged: "संकेतक वाले कार्य", photo: "फ़ोटो दर्ज", states: "राज्य / केंद्रशासित", members: "कार्य वाले सांसद" },
  charts: { monthly: "मासिक वितरित राशि", states: "राशि के अनुसार शीर्ष राज्य", types: "राशि के अनुसार शीर्ष कार्य प्रकार", severity: "गंभीरता के अनुसार संकेतक" },
  filters: { search: "कोड, विवरण, सांसद, प्राधिकरण खोजें…", allStates: "सभी राज्य", allTypes: "सभी कार्य प्रकार", allFy: "सभी वर्ष", allSev: "कोई भी गंभीरता", flagged: "केवल चिह्नित", anyFlag: "कोई भी संकेतक", anyPhoto: "फ़ोटो: कोई भी", photoYes: "फ़ोटो है", photoNo: "फ़ोटो नहीं", minAmt: "न्यूनतम ₹", reset: "रीसेट", export: "CSV डाउनलोड" },
  cols: { work: "कार्य", state: "राज्य", member: "सांसद", date: "पूर्ण तिथि", amount: "राशि", risk: "जोखिम", indicators: "संकेतक" },
  members: { search: "सांसद या निर्वाचन क्षेत्र खोजें", name: "सांसद", works: "कार्य", disbursed: "वितरित", allocated: "निर्यात में आवंटन", photo: "फ़ोटो %", flagged: "चिह्नित", view: "कार्य देखें" },
  detail: { why: "चिह्नित क्यों हुआ", none: "इस कार्य पर कोई स्क्रीनिंग संकेतक नहीं लगा।", fields: "आधिकारिक फ़ील्ड", status: "समीक्षा स्थिति", note: "समीक्षक टिप्पणी", save: "टिप्पणी सहेजें", open: "खुला", reviewed: "समीक्षित", dismissed: "खारिज", history: "स्थिति इतिहास", ask: "इस कार्य के बारे में AI से पूछें", close: "बंद करें", saved: "सहेज लिया।", needLogin: "स्थिति या टिप्पणी बदलने के लिए समीक्षक के रूप में साइन इन करें।", readOnly: "आपकी भूमिका केवल पढ़ने की है।" },
  chat: { title: "डेस्क से पूछें", hint: "अंग्रेज़ी, हिंदी या हिंग्लिश। उत्तर डेटाबेस संदर्भ पर आधारित हैं।", send: "भेजें", placeholder: "जैसे: कौन से कार्य प्रकार असामान्य लगते हैं?", clear: "साफ़", newChat: "नई चैट", history: "इतिहास" },
  empty: "इन फ़िल्टरों से कोई कार्य नहीं मिला।",
  loading: "लोड हो रहा है…",
  prev: "पिछला", next: "अगला",
  cases: { title: "समीक्षित और टिप्पणी किए गए कार्य", none: "अभी कोई केस समीक्षित या टिप्पणी वाला नहीं है।" },
};

export const COPY: Record<Lang, Copy> = { en, hi, hing };
export type { Copy };

export const FLAG_LABEL: Record<string, string> = {
  AMOUNT_OUTLIER: "Amount outlier",
  POSSIBLE_DUPLICATE: "Possible duplicate",
  SAME_DAY_BATCH: "Same-day batch",
  HIGH_VALUE_NO_PHOTO: "High value, no photo",
  MISSING_AMOUNT: "Amount missing",
  MISSING_DESCRIPTION: "Description missing",
  DATE_INTEGRITY: "Date inconsistent",
};
