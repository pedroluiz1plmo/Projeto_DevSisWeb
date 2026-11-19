
process.env.VERCEL = '1';

const { default: handleRequest } = await import('./app.js');
const { createServer } = await import('node:http');

const port = Number(process.env.PORT || 80);

createServer(handleRequest).listen(port, '0.0.0.0', () => {
  console.log(`API iniciada na porta ${port}`);
});
