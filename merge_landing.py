"""Merge landing page ke index.html portal — satu URL, CTA scroll ke pencarian.
Database tidak tersentuh (landing = HTML statis)."""
import re

LAND = "/home/adminicc/.hermes/webui/attachments/9a81b8893654/LP-ICC_LSP_Portal.html"
INDEX = "/home/adminicc/workspace/ICC-LSP-Portal/index.html"

land = open(LAND, encoding="utf-8").read()

# 1) Extract CSS
css = re.search(r"<style>(.*?)</style>", land, re.S).group(1)

# 2) Transform CSS: scope semua ke #landing
#    :root{...} -> #landing{...}
css = re.sub(r":root\{", "#landing{", css, count=1)
#    hapus rule global body/html murni (ganti jadi no-op)
css = re.sub(r"(?m)^body\{[^}]*\}\s*", "", css)
css = re.sub(r"(?m)^html\{[^}]*\}\s*", "", css)
#    prefix semua .class selector -> #landing .class (hindari nilai CSS seperti 1.5rem)
css = re.sub(r"(?<![\w\d.-])\.(-?[\w-]+)", r"#landing .\1", css)
#    hapus double-space artifacts
css = re.sub(r"#landing #landing", "#landing", css)

# 3) Extract body inner HTML (dari skip-link sampai </footer>)
m = re.search(r"<a class=\"skip-link\".*?</footer>", land, re.S)
body_html = m.group(0)

# 4) Ganti semua CTA eksternal -> #cari (scroll ke pencarian portal)
body_html = body_html.replace("https://icc-lsp-portal.vercel.app", "#cari")

# 5) Bungkus landing + tambah section header kecil
landing_html = '<div id="landing">\n' + body_html + '\n</div>\n'

# 6) Sisipkan ke index.html
idx = open(INDEX, encoding="utf-8").read()
#    a) CSS landing append ke <style> portal
idx = idx.replace("</style>", css + "\n</style>", 1)
#    b) HTML landing sebelum portal header
idx = idx.replace('<body>\n\n<header class="header">',
                  '<body>\n\n' + landing_html + '\n<header class="header">', 1)
#    c) id="cari" di search-section agar anchor scroll mengarah ke sini
idx = idx.replace('<div class="search-section">', '<div class="search-section" id="cari">', 1)

open(INDEX, "w", encoding="utf-8").write(idx)
print("Merged OK")
print("CSS len:", len(css), "| landing HTML len:", len(landing_html))
