"""Rebuild index.html: clean portal CSS + properly scoped landing CSS + 393c9f6 JS/body."""
import re, subprocess

REPO = "/home/adminicc/workspace/ICC-LSP-Portal"
LAND = "/home/adminicc/.hermes/webui/attachments/9a81b8893654/LP-ICC_LSP_Portal.html"
OUT = f"{REPO}/index.html"

def git_show(ref):
    r = subprocess.run(["git","show",ref], cwd=REPO, capture_output=True, text=True, check=True)
    return r.stdout

def scope_css(css_text):
    """Prefix .class selectors with #landing — ONLY in selector portion, never values."""
    parts = []
    i = 0; n = len(css_text)
    while i < n:
        brace = css_text.find("{", i)
        if brace < 0:
            parts.append(css_text[i:]); break
        sel = css_text[i:brace]
        depth = 1; j = brace + 1
        while j < n and depth:
            if css_text[j] == "{": depth += 1
            elif css_text[j] == "}": depth -= 1
            j += 1
        body = css_text[brace+1:j-1]
        s = sel.strip()
        if s.startswith("@media") or s.startswith("@supports"):
            parts.append(sel + "{" + scope_css(body) + "}")
        elif s.startswith("@"):  # keyframes, font-face, etc
            parts.append(sel + "{" + body + "}")
        else:
            # :root → #landing
            scoped = re.sub(r"(?<![\w-]):root\b", "#landing", sel)
            # .class → #landing .class (selector only)
            scoped = re.sub(r"(^|;|,|\s)\.([A-Za-z_][\w-]*)", r"\1#landing .\2", scoped)
            # bare element selectors (body, html, a, img, *) only if pure top-level
            # drop global body/html/* resets — portal has its own
            if re.match(r"^\s*(body|html|\*|a|img)(\s*,\s*(body|html|\*|a|img))*\s*$", scoped.strip()):
                i = j
                continue
            parts.append(scoped + "{" + body + "}")
        i = j
    return "".join(parts)

# --- sources ---
portal_clean = git_show("2f1b289:index.html")
portal_css = re.search(r"<style>(.*?)</style>", portal_clean, re.S).group(1)

land = open(LAND, encoding="utf-8").read()
land_css = re.search(r"<style>(.*?)</style>", land, re.S).group(1)
land_css_scoped = scope_css(land_css)

# body from 393c9f6 (landing + portal + fixed JS)
body_src = git_show("393c9f6:index.html")
# extract from <body> ... </html>
body_html = re.search(r"<body>(.*)</html>", body_src, re.S).group(1)

# ensure #cari on search-section
if 'id="cari"' not in body_html:
    body_html = body_html.replace('<div class="search-section">', '<div class="search-section" id="cari">', 1)

# CTA already #cari in 393c9f6 — verify
cta_count = body_html.count('href="#cari"')

# --- extra visual bridge CSS (portal-side, not scoped to landing) ---
bridge_css = """
/* ===== BRIDGE: landing → portal ===== */
#cari{scroll-margin-top:90px}
/* subtle top fade so portal header feels connected after landing */
.header{border-top:3px solid var(--accent)}
/* live pulse next to stats */
.live-badge{
  display:inline-flex;align-items:center;gap:6px;
  font-size:11px;font-weight:600;color:#dbeafe;
  background:rgba(255,255,255,.12);padding:4px 10px;border-radius:999px;
  margin-left:8px;letter-spacing:.02em;
}
.live-badge i{
  width:7px;height:7px;border-radius:50%;background:#22c55e;
  box-shadow:0 0 0 0 rgba(34,197,94,.6);
  animation:livePulse 1.6s ease-out infinite;
  display:inline-block;
}
@keyframes livePulse{
  0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}
  70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}
  100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}
}
/* search section elevated card feel after landing */
.search-section{position:relative;z-index:2}
.search-bar{
  background:#fff;border-radius:14px;padding:18px 20px;
  box-shadow:0 8px 28px rgba(0,75,135,.08),0 1px 3px rgba(0,0,0,.04);
  border:1px solid #e2e8f0;
}
/* focus ring when scrolled via CTA */
#cari:target .search-bar,
.search-bar.is-focus{
  box-shadow:0 0 0 3px rgba(244,121,32,.35),0 8px 28px rgba(0,75,135,.08);
  border-color:#F47920;
}
/* footer richer */
.footer{
  background:#0f2740;color:#cbd5e1;padding:28px 32px;margin-top:48px;
  font-size:13px;line-height:1.6;
}
.footer a{color:#93c5fd;text-decoration:none}
.footer a:hover{text-decoration:underline}
.footer-inner{max-width:1280px;margin:0 auto;display:flex;flex-wrap:wrap;gap:16px 32px;justify-content:space-between;align-items:center}
.footer-brand{font-weight:700;color:#fff}
.footer-meta{opacity:.8}
/* hide landing footer nav 'Masuk Portal' double feel — keep as is */
"""

# also fix portal search-bar CSS conflict: original already has .search-bar rules.
# bridge overrides are fine (later in cascade).

# Rebuild head from portal_clean, inject combined CSS
head = re.search(r"(<!DOCTYPE.*?<style>).*?(</style>.*?<body>)", portal_clean, re.S)
# title from landing better?
html = (
    portal_clean[:portal_clean.find("<style>")+7]
    + portal_css
    + "\n/* ===== LANDING (scoped) ===== */\n"
    + land_css_scoped
    + "\n/* ===== BRIDGE ===== */\n"
    + bridge_css
    + "</style>\n</head>\n<body>"
    + body_html
    + "\n</html>\n"
)

# inject live badge into portal header stats
html = html.replace(
    '<div class="header-stats" id="headerStats">',
    '<div class="header-stats" id="headerStats">'
    '<span class="live-badge" title="Data diperbarui berkala dari BNSP"><i></i>Data Live</span>',
    1,
)

# richer portal footer
html = html.replace(
    '<div class="footer">\n  Indonesian Certification Center (ICC) — Data LSP BNSP\n</div>',
    '''<div class="footer">
  <div class="footer-inner">
    <div><div class="footer-brand">Indonesian Certification Center (ICC)</div>
    <div class="footer-meta">Data LSP · Skema · Unit Kompetensi — sumber BNSP</div></div>
    <div class="footer-meta"><a href="#top">Ke atas</a> · <a href="#cari">Cari sekarang</a></div>
  </div>
</div>''',
    1,
)

# skip-link: landing points to #main which may not exist — point to #cari
html = html.replace('href="#main"', 'href="#cari"', 1)

# landing JS (reveal + counters) is inside landing body from 393c9f6 — good.
# But 393c9f6 may have landing JS after footer inside #landing — check.

open(OUT, "w", encoding="utf-8").write(html)

# verify
raw = open(OUT, encoding="utf-8").read()
js_blocks = re.findall(r"<script>(.*?)</script>", raw, re.S)
print("script blocks:", len(js_blocks))
for i, js in enumerate(js_blocks):
    print(f"  block{i} brace:", js.count("{")-js.count("}"), "paren:", js.count("(")-js.count(")"))
print("rgba #landing corrupt:", len(re.findall(r"rgba\([^)]*#landing", raw)))
print("transition #landing val:", len(re.findall(r"(?:transition|duration)[^;]*#landing", raw)))
print("data.json:", raw.count("data.json"))
print("buildData:", raw.count("function buildData"))
print("CTA #cari:", raw.count('href="#cari"'))
print("live-badge:", raw.count("live-badge"))
print("id=landing:", raw.count('id="landing"'))
print("id=cari:", raw.count('id="cari"'))
print("lines:", raw.count("\n"))
