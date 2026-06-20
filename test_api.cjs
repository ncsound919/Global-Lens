const https = require('https');

const data = JSON.stringify({
  model: 'deepseek-v4-flash-free',
  messages: [{role: 'user', content: 'test'}]
});

const req = https.request('https://api.opencode.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-Bl6XyVgMkYD2tiDipzMnLr0OIqQCAgsV9qHz6q7CyskKB7RFWh5ROofIWzM7zMBV'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status opencode.ai:', res.statusCode, body.substring(0, 100)));
});
req.on('error', console.error);
req.write(data);
req.end();

const req2 = https.request('https://api.opencode.so/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-Bl6XyVgMkYD2tiDipzMnLr0OIqQCAgsV9qHz6q7CyskKB7RFWh5ROofIWzM7zMBV'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status opencode.so:', res.statusCode, body.substring(0, 100)));
});
req2.on('error', console.error);
req2.write(data);
req2.end();
