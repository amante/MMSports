#!/usr/bin/env python3
import sys, os, re, argparse

def read(p):
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()

def write(p, s):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)

def inject(html_text, rel_site_js):
    html = html_text
    if 'id="site-navbar"' not in html:
        html = re.sub(r"<body([^>]*)>", r"<body\1>\n  <div id=\"site-navbar\"></div>", html, count=1, flags=re.IGNORECASE)
    if 'id="site-footer"' not in html:
        html = re.sub(r"</body>", r"  <div id=\"site-footer\"></div>\n</body>", html, count=1, flags=re.IGNORECASE)
    if 'site.js' not in html:
        html = html.replace("</body>", f'  <script src="{rel_site_js}"></script>\n  <script>window.Site && window.Site.auto();</script>\n</body>')
    else:
        html = re.sub(r'<script\s+src="/assets/site\.js"></script>', f'<script src="{rel_site_js}"></script>', html, flags=re.IGNORECASE)
        if "Site.auto()" not in html:
            html = html.replace("</body>", '  <script>window.Site && window.Site.auto();</script>\n</body>')
    return html

def main():
    ap = argparse.ArgumentParser(description="Inject navbar/footer and correct site.js path for NFLSimulator")
    ap.add_argument("--repo-root", required=True, help="Path to MMSports repo root")
    ap.add_argument("--nfl-path", default="WebSites/NFLSimulator/index.html", help="Path to NFLSimulator index.html relative to repo root")
    args = ap.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    nfl_index = os.path.join(repo_root, args.nfl_path)

    if not os.path.exists(nfl_index):
        print(f"[inject] index.html not found at {nfl_index}", file=sys.stderr)
        sys.exit(2)

    rel_site_js = os.path.relpath(os.path.join(repo_root, "assets", "site.js"), os.path.dirname(nfl_index)).replace("\\", "/")
    html = read(nfl_index)
    out = inject(html, rel_site_js)
    write(nfl_index, out)
    print("[inject] Updated", nfl_index, "→ site.js:", rel_site_js)

if __name__ == "__main__":
    main()
