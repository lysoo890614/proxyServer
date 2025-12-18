import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

// CORS 설정 (브라우저 요청 지원)
await fastify.register(cors, {
  origin: true, // 모든 origin 허용 (프로덕션에서는 특정 origin으로 제한)
  credentials: true,
});

// LLM 서버 URL (환경변수에서 가져오거나 기본값)
const LLM_SERVER_URL = process.env.LLM_SERVER_URL || 'http://localhost:8000';

// Health check 엔드포인트 (LLM 서버로 프록시되지 않음)
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'llm-proxy-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// 모든 경로에 대한 프록시 핸들러
fastify.all('/*', async (request, reply) => {
  const { method, url, headers, body } = request;
  
  // 원본 요청 경로와 쿼리 파라미터 유지
  const targetUrl = `${LLM_SERVER_URL}${url}`;
  
  // 요청 헤더 복사 (host 헤더는 제외)
  const proxyHeaders = { ...headers };
  delete proxyHeaders.host;
  delete proxyHeaders['content-length']; // content-length는 자동 계산
  
  // 요청 body 처리
  let requestBody = undefined;
  if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
    const contentType = headers['content-type'] || '';
    // 이미 파싱된 객체면 JSON으로, 아니면 원본 그대로
    if (contentType.includes('application/json') && typeof body === 'object') {
      requestBody = JSON.stringify(body);
    } else if (typeof body === 'string') {
      requestBody = body;
    } else if (Buffer.isBuffer(body)) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
    }
  }
  
  try {
    // LLM 서버로 요청 전달
    const response = await fetch(targetUrl, {
      method,
      headers: proxyHeaders,
      body: requestBody,
    });

    // 응답 헤더 복사
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      // CORS 관련 헤더는 이미 @fastify/cors가 처리하므로 제외
      if (!key.toLowerCase().startsWith('access-control-')) {
        responseHeaders[key] = value;
      }
    });

    // SSE (Server-Sent Events) 응답 처리
    const contentType = response.headers.get('content-type') || '';
    const acceptHeader = headers['accept'] || '';
    const isSSE = contentType.includes('text/event-stream') || 
                  acceptHeader.includes('text/event-stream');
    
    if (isSSE) {
      // 스트리밍 응답
      reply.raw.writeHead(response.status, {
        ...responseHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // 스트림을 그대로 클라이언트에 전달
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);
        }
        reply.raw.end();
      } catch (streamError) {
        fastify.log.error({ err: streamError }, 'Streaming error');
        if (!reply.raw.headersSent) {
          reply.code(500).send({ error: 'Streaming failed' });
        } else {
          reply.raw.end();
        }
      }
      return reply;
    }

    // 일반 응답 (JSON 등)
    const responseBody = await response.text();
    
    // 응답 본문이 있으면 파싱 시도 (JSON인 경우)
    let parsedBody = responseBody;
    try {
      if (responseHeaders['content-type']?.includes('application/json')) {
        parsedBody = JSON.parse(responseBody);
      }
    } catch (e) {
      // 파싱 실패하면 원본 텍스트 사용
    }

    reply
      .code(response.status)
      .headers(responseHeaders)
      .send(parsedBody);

  } catch (error) {
    fastify.log.error({ err: error }, 'Proxy error');
    reply.code(500).send({ 
      error: 'Proxy request failed',
      message: error.message 
    });
  }
});

// 서버 시작
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`Proxy server listening on ${host}:${port}`);
    fastify.log.info(`Proxying to LLM server: ${LLM_SERVER_URL}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

