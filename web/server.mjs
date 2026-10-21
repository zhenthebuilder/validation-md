// A tiny demo page for previews: `npm start`, then open http://localhost:$PORT.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 3000);
const page = new URL('./index.html', import.meta.url);

createServer(async (_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(page));
}).listen(port, '0.0.0.0', () => {
  console.log(`validation-md demo on http://localhost:${port}`);
});
