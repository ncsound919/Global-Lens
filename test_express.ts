import express from 'express';
const app = express();
app.get('/news/:id/backstory', (req, res) => {
  console.log("Matched!", req.params.id);
  res.send('ok');
});
app.use((req, res) => {
  console.log("Missed!", req.originalUrl);
  res.send('miss');
});
const server = app.listen(3002, async () => {
  const res = await fetch('http://localhost:3002/news/https%3A%2F%2Ftest.com%2F123/backstory');
  console.log(await res.text());
  server.close();
});
