import fetch from 'node-fetch';

async function run() {
  const categories = ['sports', 'global', 'health', 'music', 'politics'];
  let emptyCount = 0;
  let totalCount = 0;
  for (const c of categories) {
      const res = await fetch('http://localhost:3000/api/news?category=' + c);
      const json = await res.json();
      totalCount += json.articles?.length || 0;
      emptyCount += json.articles?.filter((x: any) => x.key_takeaways.length === 0).length || 0;
  }
  console.log({ emptyCount, totalCount });
}
run();
