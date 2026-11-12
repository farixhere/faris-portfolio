#!/usr/bin/env python3
"""Refresh the crawler-readable snapshot of the site's database content.

The live site renders FAQ / projects / skills / posts with JavaScript from Supabase.
Many AI crawlers do not run JavaScript, so they would only see "Loading…".
This script reads the same PUBLIC tables (anon key, read-only) and rewrites two marked
blocks in index.html:
  <!-- seo-ld:begin --> … <!-- seo-ld:end -->     JSON-LD (Person, ProfilePage, FAQPage, projects)
  <!-- seo-facts:begin --> … <!-- seo-facts:end --> plain HTML (h2/h3/p/ul) in a hidden container
Usage:  python3 scripts/build_seo.py            (fetch from Supabase)
        python3 scripts/build_seo.py --json f   (use a saved {"faq":[…],"projects":[…],…} file)
Re-run after editing content in the admin, commit index.html, push. Nothing is written to the database.
"""
import json, re, sys, html, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
SITE = "https://farixhere.github.io/faris-portfolio/"
TABLES = {
    "profile":  "profile?select=name,bio,github,instagram,linkedin&id=eq.1",
    "faq":      "faq?select=question,answer&order=sort_order",
    "projects": "projects?select=title,category,status,description,technologies,live_url,github_url&order=sort_order",
    "skills":   "skills?select=name,label&order=sort_order",
    "posts":    "posts?select=title,excerpt,published_at&published=eq.true&order=published_at.desc",
}

def fetch():
    js = (ROOT / "js/data.js").read_text()
    url = re.search(r"SUPABASE_URL\s*=\s*'([^']+)'", js).group(1)
    key = re.search(r"SUPABASE_KEY\s*=\s*'([^']+)'", js).group(1)
    out = {}
    for k, q in TABLES.items():
        req = urllib.request.Request(f"{url}/rest/v1/{q}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
        out[k] = json.load(urllib.request.urlopen(req, timeout=20))
    return out

def e(s): return html.escape(str(s or ""), quote=True)

def build(d):
    prof = (d.get("profile") or [{}])
    prof = prof[0] if isinstance(prof, list) and prof else (prof if isinstance(prof, dict) else {})
    name = prof.get("name") or "Faris"
    same = [u for u in (prof.get("github"), prof.get("instagram"), prof.get("linkedin")) if u]
    faq, projects, skills, posts = (d.get(k) or [] for k in ("faq", "projects", "skills", "posts"))
    knows = [s["name"] for s in skills if s.get("name")]

    person = {"@type": "Person", "@id": SITE + "#faris", "name": name, "alternateName": "farixhere", "url": SITE,
              "description": prof.get("bio") or "", "jobTitle": "Student", "sameAs": same}
    if knows: person["knowsAbout"] = knows
    graph = [
        {"@type": "WebSite", "@id": SITE + "#website", "url": SITE, "name": f"{name} (farixhere) — portfolio", "inLanguage": "en", "publisher": {"@id": SITE + "#faris"}},
        {"@type": "ProfilePage", "@id": SITE + "#profile", "url": SITE, "name": f"{name} (farixhere) — student, exploring what’s possible",
         "isPartOf": {"@id": SITE + "#website"}, "mainEntity": person},
    ]
    if projects:
        items = []
        for i, p in enumerate(projects, 1):
            w = {"@type": "CreativeWork", "name": p.get("title"), "description": p.get("description"), "creator": {"@id": SITE + "#faris"}}
            if p.get("technologies"): w["keywords"] = ", ".join(p["technologies"])
            if p.get("live_url"): w["url"] = p["live_url"]
            if p.get("github_url"): w["sameAs"] = [p["github_url"]]
            items.append({"@type": "ListItem", "position": i, "item": w})
        graph.append({"@type": "ItemList", "name": f"Projects by {name}", "itemListElement": items})
    if faq:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q["question"],
                      "acceptedAnswer": {"@type": "Answer", "text": q["answer"]}} for q in faq]})
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2).replace("</", "<\\/")

    f = [f'<h2>About {e(name)} (farixhere)</h2>', f'<p>{e(prof.get("bio"))}</p>']
    if same: f.append("<ul>" + "".join(f'<li><a href="{e(u)}">{e(u)}</a></li>' for u in same) + "</ul>")
    if projects:
        f.append("<h2>Projects</h2>")
        for p in projects:
            f.append(f'<h3>{e(p.get("title"))}</h3><p>{e(p.get("description"))}</p><ul>')
            if p.get("category") or p.get("status"): f.append(f'<li>Type: {e(p.get("category"))} · Status: {e(p.get("status"))}</li>')
            if p.get("technologies"): f.append(f'<li>Built with: {e(", ".join(p["technologies"]))}</li>')
            if p.get("live_url"): f.append(f'<li><a href="{e(p["live_url"])}">Live project</a></li>')
            if p.get("github_url"): f.append(f'<li><a href="{e(p["github_url"])}">Source code</a></li>')
            f.append("</ul>")
    if skills:
        f.append("<h2>Skills and tools</h2><ul>" + "".join(f'<li>{e(s.get("name"))} — {e(s.get("label"))}</li>' for s in skills) + "</ul>")
    if posts:
        f.append("<h2>Notes</h2><ul>" + "".join(f'<li>{e(p.get("title"))} — {e(p.get("excerpt"))}</li>' for p in posts) + "</ul>")
    if faq:
        f.append("<h2>Frequently asked questions</h2>")
        for q in faq: f.append(f'<h3>{e(q["question"])}</h3><p>{e(q["answer"])}</p>')
    return ld, "\n".join(f)

def main():
    d = json.load(open(sys.argv[sys.argv.index("--json") + 1])) if "--json" in sys.argv else fetch()
    ld, facts = build(d)
    s = INDEX.read_text()
    for tag, body in (("seo-ld", f'<script type="application/ld+json">\n{ld}\n</script>'),
                      ("seo-facts", f'<div id="static-facts" hidden>\n{facts}\n</div>')):
        pat = re.compile(rf"<!-- {tag}:begin -->.*?<!-- {tag}:end -->", re.S)
        assert pat.search(s), f"missing {tag} markers in index.html"
        s = pat.sub(lambda m: f"<!-- {tag}:begin -->\n{body}\n<!-- {tag}:end -->", s)
    INDEX.write_text(s)
    print("updated index.html:", {k: len(v) for k, v in d.items() if isinstance(v, list)})

if __name__ == "__main__": main()
