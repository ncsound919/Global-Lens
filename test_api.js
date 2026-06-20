const https = require('https');

const req = https.request('https://api.opencode.so/v1/chat/completions', {
  method: 'POST',
}, (res) => {
  console.log('Status:', res.statusCode);
});
req.end();
