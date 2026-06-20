const https = require('https');
const data = JSON.stringify({
  model: 'deepseek-v4-flash-free',
  messages: [{role: 'user', content: 'test'}]
});
const endpoints = [
  'https://opencode.ai/api/v1/chat/completions',
  'https://api.opencode.ai/chat/completions',
  'https://opencode.ai/v1/chat/completions',
];
endpoints.forEach(url => {
  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-Bl6XyVgMkYD2tiDipzMnLr0OIqQCAgsV9qHz6q7CyskKB7RFWh5ROofIWzM7zMBV'
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Status', url, res.statusCode, body.substring(0, 100)));
  });
  req.on('error', console.error);
  req.write(data);
  req.end();
});
