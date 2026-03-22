// Vercel 서버리스 함수: /api/chat
// Claude API를 호출하여 프론트엔드에 답변을 반환합니다.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL_NAME = "claude-haiku-4-5-20251001";

// 시스템 프롬프트 (기존 내용 그대로 유지)
const SYSTEM_PROMPT = `너는 대전전민고등학교 교무업무 챗봇이야. 아래 학교 업무 규정을 참고해서 교직원의 질문에 친절하고 정확하게 답변해. 규정에 없는 내용은 "해당 내용은 규정에 명시되어 있지 않습니다. 교무실에 직접 문의해주세요."라고 안내해. 답변은 간결하게 핵심만 말해줘.

【복무 결재 라인】

교사 외출: 본인 → 소속부장
교사 지참/조퇴/근무지내출장: 본인 → 소속부장 → 교감
교사 근무지외출장: 본인 → 소속부장 → 교감 → 교장
부장 외출/지참/조퇴/근무지내출장: 본인 → 교감
부장 근무지외출장: 본인 → 교감 → 교장
시간외근무: 본인 → 소속부장 → 교감
자녀돌봄/육아시간: 본인 → 교무운영부장 → 교감 → 교장 (※ 당일 4시간 이상 반드시 근무)
제41조 연수: 본인 → 연구부장 → 교감
EVPN(원격업무): 본인 → 과학정보부장 → 교감
각종 휴가·병가·연가: 사전에 교감·교장 구두 상의 후 복무 등록 → 교무운영부장 → 교감 → 교장

【수업 결강 처리】

교감, 학년부장, 일과계에 전화·문자로 사전 연락 필수
동아리·방과후 수업 있으면 해당 담당교사에게도 전달
보강 수당: 시간당 15,000원 (창체 제외)
결·보강 원칙: 개인이 수업교체 → 동일교과교사 → 당일 수업 적은 담임 → 비교과 순

【시간외 근무 신청 (나이스)】

평일: 나이스 → 시간외근무(휴일 체크 안함) → 16:00 이후 시간 지정 → 사유 작성 → 승인 요청 (1시간 공제 후 최대 4시간)
공휴일: 시간외근무(휴일 체크함) → 시간 지정 (1시간 공제 없음, 최대 4시간)
결재라인: 본인 → 소속부장 → 교감

【시간외 근무 퇴근 처리】

당직실(본동 1층) 입력기에서 퇴근모드(F2) 확인
ID: 개인번호 G10 제외 7자리 입력 → 비밀번호란에 다시 7자리 입력
주말·공휴일에는 출근모드도 반드시 처리

【예산 사용 결재】

50만원 이하: 본인 → 소속부장 → 행정실장(협조) → 교감
50만원 초과: 본인 → 소속부장 → 행정실장(협조) → 교감 → 교장
인터넷 주문 시: 품의결재 후 행정과정(김경중T)에게 안내 (장바구니 캡처 첨부)

【가정통신문 결재】

본인 → 담당부서부장 → 교무운영부장(협조) → 교감 → 교장
반드시 "직인생략" 표시, 학교 홈페이지 탑재 (리로스쿨 자동 탑재)

【회의 일정】

학년부장회의: 매주 목요일 15:10, 교장실
전체부장회의: 매주 금요일 2교시, 교장실
교직원회의: 매월 공동체의 날(금요일), 한솔공동체실(1층)

【출결 처리 기준】

나이스 지각 기준: 08:10
결과: 수업 시간 10분 초과 불참
미인정결석: ~2일 유선연락 / 3~6일 가정방문·학년부장·교감 보고 / 연속 7일 이상 교육감 보고
출결확인서 제출: 출석 당일부터 5일 이내
교무학적담당: 최지혜T / 상담교사: 전주영T

【학교 기본 정보】

대표전화: 870-0114 / FAX: 382-0254
주소: 대전광역시 유성구 전민로 63
학교번호: 고28 (16145)
리로스쿨 문자: 단문 12원 / 장문 36원 / 앱 0원
시교육청 인편 제출: 매주 목요일 (전날까지 인쇄실 성열창T에게 제출, 목요일 12시 마감)`;

module.exports = async (req, res) => {
  // CORS 헤더 추가
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // preflight 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server configuration error: ANTHROPIC_API_KEY is not set" });
  }

  try {
    const { conversation } = req.body || {};

    if (!Array.isArray(conversation)) {
      return res.status(400).json({ error: "Invalid payload: 'conversation' must be an array" });
    }

    const messages = conversation.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: [
        {
          type: "text",
          text: typeof m.content === "string" ? m.content : String(m.content ?? "")
        }
      ]
    }));

    const payload = {
      model: MODEL_NAME,
      max_tokens: 1024,
      temperature: 0.6,
      system: SYSTEM_PROMPT,
      messages
    };

    const apiResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => "");
      return res.status(apiResponse.status).json({
        error: "Anthropic API error",
        details: errorText
      });
    }

    const data = await apiResponse.json();

    let replyText = "";
    if (Array.isArray(data.content)) {
      replyText = data.content
        .filter((block) => block && block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n")
        .trim();
    } else if (data.content && typeof data.content === "string") {
      replyText = data.content;
    }

    if (!replyText) {
      replyText = "(응답을 해석할 수 없습니다. Claude API 응답 형식을 확인해 주세요.)";
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err && err.message ? err.message : String(err)
    });
  }
};

