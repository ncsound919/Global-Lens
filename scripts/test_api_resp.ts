import express from 'express';
import { apiRouter } from '../api';
const app = express();
app.use('/api', apiRouter);
const server = app.listen(3004, async () => {
  const res = await fetch('http://localhost:3004/api/news?limit=1');
  const data = await res.json();
  const arr = data.articles[0].key_takeaways;
  console.log("Is array?", Array.isArray(arr));
  if (Array.isArray(arr)) {
    console.log("First item type:", typeof arr[0]);
    console.log("First item value:", arr[0]);
  }
  server.close();
});
