export const feeds = [
  { url: "https://thegrio.com/feed/", category: "diaspora", source_name: "The Grio", bias: "independent" },
  { url: "https://www.blackenterprise.com/feed/", category: "finance", source_name: "Black Enterprise", bias: "corporate" },
  { url: "https://www.essence.com/feed/", category: "culture", source_name: "Essence", bias: "corporate" },
  { url: "https://www.theroot.com/rss", category: "diaspora", source_name: "The Root", bias: "corporate" },
  // Disabled 2026-09-27: https://afro.com/feed/ redirects to
  // https://www.afro.com/feed/ and returns 403. Restore when that endpoint works.
  // { url: "https://afro.com/feed/", category: "diaspora", source_name: "AFRO News", bias: "independent" },
  { url: "https://blackhealthmatters.com/feed/", category: "health", source_name: "Black Health Matters", bias: "independent" },
  { url: "https://blackdoctor.org/feed/", category: "health", source_name: "BlackDoctor.org", bias: "independent" },
  // Disabled 2026-09-27: https://www.minorityhealth.hhs.gov/rss/ redirects to
  // https://minorityhealth.hhs.gov/rss/ and returns 404. Restore when that endpoint works.
  // { url: "https://www.minorityhealth.hhs.gov/rss/", category: "health", source_name: "HHS Minority Health", bias: "state-adjacent" },
  { url: "https://www.jamaicaobserver.com/feed/", category: "global", source_name: "Jamaica Observer", bias: "corporate" },
  { url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", category: "global", source_name: "AllAfrica", bias: "independent" },
  { url: "https://www.africanews.com/feed/", category: "global", source_name: "Africa News", bias: "state-adjacent" },
  { url: "https://www.premiumtimesng.com/feed", category: "global", source_name: "Premium Times Nigeria", bias: "investigative" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", category: "global", source_name: "Al Jazeera", bias: "state-adjacent" },
  { url: "https://www.france24.com/en/rss", category: "global", source_name: "France 24", bias: "state-adjacent" },
  { url: "https://www.democracynow.org/democracynow.rss", category: "politics", source_name: "Democracy Now!", bias: "independent" },
  { url: "https://theintercept.com/feed/?lang=en", category: "politics", source_name: "The Intercept", bias: "investigative" },
  { url: "https://feeds.propublica.org/propublica/main", category: "politics", source_name: "ProPublica", bias: "investigative" },
  { url: "https://thesource.com/feed/", category: "music", source_name: "The Source", bias: "corporate" },
  { url: "https://allhiphop.com/feed/", category: "music", source_name: "AllHipHop", bias: "independent" },
  { url: "https://hiphopdx.com/rss/news.xml", category: "music", source_name: "HipHopDX", bias: "independent" },
  { url: "https://blacksportsonline.com/feed/", category: "sports", source_name: "Black Sports Online", bias: "independent" },
  { url: "https://andscape.com/feed/", category: "sports", source_name: "Andscape", bias: "corporate" },
  { url: "https://defendernetwork.com/category/sports/feed/", category: "sports", source_name: "Defender Network", bias: "independent" },
  // Justice feeds (verified 2026-09-28: HTTP 200, RSS/Atom). Marshall Project (403),
  // NAACP (404) and Colorlines (404, defunct) were rejected.
  { url: "https://innocenceproject.org/feed/", category: "justice", source_name: "Innocence Project", bias: "independent" },
  { url: "https://www.aclu.org/news/feed", category: "justice", source_name: "ACLU", bias: "advocacy" },
  { url: "https://truthout.org/feed/", category: "justice", source_name: "Truthout", bias: "independent" }
];
