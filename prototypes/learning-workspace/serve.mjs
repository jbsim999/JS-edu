import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const host = "127.0.0.1";
const port = 4178;
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/glossary-data.mjs", ["glossary-data.mjs", "text/javascript; charset=utf-8"]],
]);

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url, `http://${host}:${port}`).pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }
  const file = files.get(pathname);
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Preview file could not be read");
  }
});

server.on("error", error => {
  console.error(error.code === "EADDRINUSE"
    ? `${host}:${port} 포트를 사용 중입니다. 기존 미리보기 프로세스를 확인해 주세요.`
    : `미리보기 서버 시작 실패: ${error.code ?? error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`JavaScript-edu 화면 시안: http://${host}:${port}/`);
  console.log("종료: Ctrl+C. 로컬 전용이며 학습 실행기는 연결하지 않습니다.");
});
