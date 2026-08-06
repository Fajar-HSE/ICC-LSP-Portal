"""Fix CSS scoping di index.html (393c9f6) — re-scope landing CSS selector-aware."""
import re

f = "/home/adminicc/workspace/ICC-LSP-Portal/index.html"
# restore 393c9f6 version
import subprocess
r = subprocess.run(["git","show","393c9f6:index.html"], capture_output=True, text=True, cwd="/home/adminicc/workspace/ICC-LSP-Portal")
open(f, "w", encoding="utf-8").write(r.stdout)

raw = open(f, encoding="utf-8").read()

# Extract raw CSS (between <style> and </style>)
css_match = re.search(r"<style>(.*?)</style>", raw, re.S)
css = css_match.group(1)

# Extract raw body landing HTML already injected (id=landing)
body_match = re.search(r'(<div id="landing">.*?</footer>\s*</div>)', raw, re.S)
landing_html = body_match.group(1)

# Re-scope CSS properly (selector-only prefix)
def scope_css(css_text):
    parts = []
    i = 0; n = len(css_text)
    while i < n:
        brace_pos = css_text.find("{", i)
        if brace_pos == -1:
            parts.append(css_text[i:]); break
        sel = css_text[i:brace_pos]
        depth = 1; j = brace_pos + 1
        while j < n and depth > 0:
            if css_text[j] == "{": depth += 1
            elif css_text[j] == "}": depth -= 1
            j += 1
        body = css_text[brace_pos+1:j-1]
        if sel.startswith("@media") or sel.startswith("@supports"):
            parts.append(sel + "{" + scope_css(body) + "}")
        elif sel.strip().startswith("@"):
            parts.append(sel + "{" + body + "}")
        else:
            scoped_sel = re.sub(r"(?<![\w-])\.(-?[\w-]+)", "#landing .\\1", sel)
            parts.append(scoped_sel + " {" + body + "}")
        i = j
    return "".join(parts)

scoped_css = scope_css(css)

# Rebuild: portal CSS stays (from 2f1b289 clean) but we need portal base CSS.
# The 393c9f6 <style> contains BOTH portal CSS (line 10-396) + corrupted landing CSS.
# Strategy: split at first '#landing' reference.
idx_landing = raw.find("#landing")
# find start of landing CSS block (the ':root{' that became '#landing{')
portal_css_end = raw.rfind("</style>")
# Actually, simpler: portal CSS = everything before first '#landing' scoped rule.
# Find first occurrence of '#landing' in CSS.
first_landing = raw.find("#landing")
# Portal CSS is from <style> start... but corrupted landing CSS is mixed in.
# Cleanest: re-extract portal CSS from 2f1b289, append fixed landing CSS.
import subprocess
r2 = subprocess.run(["git","show","2f1b289:index.html"], capture_output=True, text=True, cwd="/home/adminicc/workspace/ICC-LSP-Portal")
portal_raw = r2.stdout
portal_css = re.search(r"<style>(.*?)</style>", portal_raw, re.S).group(1)

# Rebuild full file
idx = raw
idx = re.sub(r"<style>.*?</style>", "<style>" + portal_css + "\n" + scoped_css + "\n</style>", idx, count=1, flags=re.S)
# Ensure landing HTML + #cari
idx = idx.replace('<div class="search-section">', '<div class="search-section" id="cari">', 1)

open(f, "w", encoding="utf-8").write(idx)
# verify
raw2 = open(f, encoding="utf-8").read()
print("rgba #landing corruption:", len(re.findall(r"rgba\([^)]*#landing", raw2)))
print("color:#landing:", len(re.findall(r"color:#landing", raw2)))
print("transition #landing val:", len(re.findall(r"#landing \.\d+s", raw2)))
print("portal CSS intact:", "var(--primary:" in raw2 and ".header {" in raw2)
print("data.json:", raw2.count("data.json"))
print("CTA #cari:", raw2.count('href="#cari"'))
