import fetch from 'node-fetch';
fetch('https://theshadowleague.com/feed/')
  .then(res => console.log(res.status))
  .catch(err => console.log(err));
