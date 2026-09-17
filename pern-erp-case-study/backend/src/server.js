require('dotenv').config();

const app = require('./app');

// Fail fast on missing configuration instead of serving broken requests.
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
const missing = requiredEnv.filter(function (key) {
  return !process.env[key];
});
if (missing.length > 0) {
  console.error('FATAL: missing required environment variables: ' + missing.join(', '));
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const port = Number(process.env.PORT) || 5000;

app.listen(port, function () {
  console.log('StockFlow ERP API listening on port ' + port);
});

