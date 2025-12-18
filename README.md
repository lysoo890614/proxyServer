# LLM 프록시 서버

LLM 서버로의 요청을 프록시하는 간단한 Node.js 서버입니다. SSE(Server-Sent Events) 스트리밍과 일반 HTTP 응답을 모두 지원합니다.

## 기능

- ✅ 모든 HTTP 메서드 지원 (GET, POST, PUT, DELETE 등)
- ✅ SSE 스트리밍 응답 지원
- ✅ 일반 JSON/텍스트 응답 지원
- ✅ 요청/응답 헤더 그대로 전달
- ✅ CORS 지원 (브라우저 요청)
- ✅ Health check 엔드포인트 (`/health`)
- ✅ 간단한 설정

## 설치

```bash
npm install
```

## 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
LLM_SERVER_URL=http://your-llm-server.com
PORT=3000
HOST=0.0.0.0
```

## 실행

```bash
# 프로덕션
npm start

# 개발 (자동 재시작)
npm run dev
```

서버는 기본적으로 `http://0.0.0.0:3000`에서 실행됩니다.

## Health Check

프록시 서버의 상태를 확인할 수 있는 엔드포인트가 제공됩니다:

```bash
curl http://your-proxy-server.com:3000/health
```

응답 예시:
```json
{
  "status": "ok",
  "service": "llm-proxy-server",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

이 엔드포인트는 LLM 서버로 프록시되지 않으며, 프록시 서버 자체의 상태만 확인합니다.

## 사용 예시

프록시 서버가 `http://your-proxy-server.com:3000`에서 실행 중이고, LLM 서버가 `http://your-llm-server.com`인 경우:

```bash
# 일반 요청
curl http://your-proxy-server.com:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# SSE 스트리밍 요청
curl http://your-proxy-server.com:3000/api/stream \
  -H "Accept: text/event-stream"
```

브라우저에서 사용:

```javascript
// SSE 스트리밍
const eventSource = new EventSource('http://your-proxy-server.com:3000/api/stream');
eventSource.onmessage = (event) => {
  console.log(event.data);
};

// 일반 요청
fetch('http://your-proxy-server.com:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' })
});
```

## AWS EC2 배포

1. **EC2 인스턴스 생성**
   - Ubuntu 또는 Amazon Linux 2
   - 보안 그룹: 인바운드 포트 3000 (또는 원하는 포트) 허용

2. **Elastic IP 할당 및 연결**
   - EC2 콘솔에서 Elastic IP 생성
   - 인스턴스에 연결
   - 이 IP를 LLM 서버 방화벽에 등록

3. **Node.js 설치**
   ```bash
   # Ubuntu
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Amazon Linux 2
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   ```

4. **프로젝트 배포**
   ```bash
   git clone <your-repo>
   cd proxyServer
   npm install
   cp env.example .env
   # .env 파일 수정 (LLM_SERVER_URL 설정)
   ```

5. **PM2로 프로세스 관리 (선택사항)**
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name llm-proxy
   pm2 save
   pm2 startup  # 시스템 재시작 시 자동 시작
   ```

6. **방화벽 설정**
   ```bash
   # Ubuntu
   sudo ufw allow 3000/tcp

   # Amazon Linux 2
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```

## 주의사항

- LLM 서버의 방화벽에 EC2의 Elastic IP를 등록해야 합니다
- 프로덕션 환경에서는 CORS origin을 특정 도메인으로 제한하는 것을 권장합니다
- HTTPS를 사용하려면 Nginx나 CloudFront를 앞에 두는 것을 고려하세요

