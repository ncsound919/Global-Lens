import db from "./db";

export async function syncSportsAPI() {
  const apiKey = process.env.SPORTS_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    console.log("No valid SPORTS_API_KEY found, skipping sports API sync.");
    return;
  }

  console.log("Syncing Sports via API-Sports...");
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
      headers: { 'x-apisports-key': apiKey }
    });
    
    if (!res.ok) {
      console.warn(`Sports API sync failed: ${res.status} ${res.statusText}`);
      return;
    }
    
    const data = await res.json();
    if (!data.response || !Array.isArray(data.response)) {
      console.warn("Invalid response format from Sports API");
      return;
    }
    
    let ingested = 0;
    
    const stmt = db.prepare('INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    // Slice to top 25 to avoid flooding
    const matches = data.response.slice(0, 25);

    for (const match of matches) {
      const fixture = match.fixture;
      const league = match.league;
      const teams = match.teams;
      const goals = match.goals;
      const status = fixture.status.long;
      const score = `${teams.home.name} ${goals.home ?? '-'} vs ${goals.away ?? '-'} ${teams.away.name}`;
      
      const title = `Live: ${score} (${league.name})`;
      const original_url = `https://www.api-sports.io/football/fixture/${fixture.id}`;
      const url_hash = `apisports-fixture-${fixture.id}`;
      const textDump = `Match Status: ${status}.
League: ${league.name} (${league.country})
${score}.
`;
      const imageUrl = league.logo || teams.home.logo || null;
      let pubDate = new Date(fixture.date).toISOString();

      const info = stmt.run(
        url_hash, 'sports', 'Live Match', title, original_url, imageUrl, textDump, pubDate
      );
      
      if (info.changes > 0) {
        ingested++;
      }
    }
    
    console.log(`Successfully ingested ${ingested} live sports events.`);
  } catch (error) {
    console.error("Error syncing sports API:", error);
  }
}
