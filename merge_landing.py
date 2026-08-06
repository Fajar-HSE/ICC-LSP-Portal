"""Merge landing page ke index.html portal — satu URL, CTA scroll ke #cari.
CSS scoped ke #landing via per-rule selector prefix (selector-only, value-safe)."""
import re

LAND = "/home/adminicc/.hermes/webui/attachments/9a81b8893654/LP-ICC_LSP_Portal.html"
INDEX = "/home/adminicc/workspace/ICC-LSP-Portal/index.html"

land = open(LAND, encoding="utf-8").read()
idx = open(INDEX, encoding="utf-8").read()

# 1) Extract CSS + JS + body inner HTML
css = re.search(r"<style>(.*?)</style>", land, re.S).group(1)

# 2) Prefix ONLY selectors (not values) — match up to '{'.
#    Pattern: selector group(s) followed by '{' → prefix class refs inside selectors.
#    Replace .cls / :hover / nth etc inside the selector portion before {.
def scope_selectors(css_text):
    out = []
    i = 0
    while i < len(css_text):
        # find next '{' (start of declaration block)
        brace = css_text.find("{", i)
        if brace == -1:
            # tidak ada lagi rule (media query dll) — append sisanya raw
            out.append(css_text[i:])
            break
        block = css_text[i:brace].rstrip()  # selector text
        # skip media queries / @-rules — prefix inner selectors separately
        if block.endswith("@media") or block.startswith("@import") or block.startswith("@font"):
            # leave @media wrapper, but will prefix inner selectors recursively
            out.append(css_text[i:brace+1])
            i = brace + 1
            continue
        # skip at-rule bodies (already captured opener) — find matching close
        # prefix .cls / #id / element inside selector
        scoped = re.sub(r"(?<![\w-])\.(-?[\w-]+)", "#landing .\\1", block)
        out.append(scoped + " {")
        # now find matching closing brace (declaration value may contain })
        depth = 1
        j = brace + 1
        while j < len(css_text) and depth > 0:
            if css_text[j] == "{": depth += 1
            elif css_text[j] == "}": depth -= 1
            j += 1
        out.append(css_text[brace+1:j])
        i = j
    return "".join(out)

# Apply scoping, with recursive media-query handling:
# Simpler approach: split top-level rules only.
def scope_css(css_text):
    # Walk character by character tracking brace depth.
    parts = []
    i = 0; n = len(css_text)
    while i < n:
        # At top of a rule (depth 0), find selector before '{'
        brace_pos = css_text.find("{", i)
        if brace_pos == -1:
            parts.append(css_text[i:]); break
        sel = css_text[i:brace_pos]
        # find balancing close
        depth = 1; j = brace_pos + 1
        while j < n and depth > 0:
            if css_text[j] == "{": depth += 1
            elif css_text[j] == "}": depth -= 1
            j += 1
        body = css_text[brace_pos+1:j-1]  # between { and }
        if sel.startswith("@media") or sel.startswith("@supports"):
            # recursively scope inner rules
            parts.append(sel + "{" + scope_css(body) + "}")
        elif sel.strip().startswith("@"):
            parts.append(sel + "{" + body + "}")  # @font-face, @keyframes — leave
        else:
            scoped_sel = re.sub(r"(?<![\w-])\.(-?[\w-]+)", "#landing .\\1", sel)
            parts.append(scoped_sel + " {" + body + "}")
        i = j
    return "".join(parts)

scoped_css = scope_css(css)

# 3) Extract body HTML (skip-link sampai </footer>)
m = re.search(r"<a class=\"skip-link\".*?</footer>", land, re.S)
landing_html = '<div id="landing">\n' + m.group(0) + '\n</div>\n'

# 4) Ganti CTA eksternal -> #cari (smooth scroll ke portal search)
landing_html = landing_html.replace("https://icc-lsp-portal.vercel.app", "#cari")

# 5) Inject ke index.html
idx = idx.replace("</style>", scoped_css + "\n</style>", 1)
idx = idx.replace('<body>\n\n', '<body>\n\n' + landing_html + '\n', 1)
idx = idx.replace('<div class="search-section">', '<div class="search-section" id="cari">', 1)

open(INDEX, "w", encoding="utf-8").write(idx)
print("CSS scoped len:", len(scoped_css), "| sample:", repr(scoped_css[500:560]))
print("body injected:", '<div id="landing">' in idx)
print("CTA -> #cari:", idx.count('href="#cari"'), "links")
