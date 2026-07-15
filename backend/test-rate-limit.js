const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const makeRequest = (i) => {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Request ${i}: Status Code ${res.statusCode}`);
        console.log(`Response: ${data}`);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error(`Request ${i} error: ${error.message}`);
      resolve();
    });

    req.write(JSON.stringify({ email: 'test@test.com', password: 'pwd' }));
    req.end();
  });
};

const runTests = async () => {
  console.log('Testing authLimiter (max 5 requests per 15 mins)...');
  for (let i = 1; i <= 6; i++) {
    await makeRequest(i);
  }
};

runTests();
