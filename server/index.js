import app from './app.js';

const port = process.env.PORT || 3002;

app.listen(port, () => {
  console.log(`Everhope API listening on http://localhost:${port}`);
});
