interface TokenEntry {
  timestamp: number;
  tokens: number;
}

interface AudioSecondsEntry {
  timestamp: number;
  seconds: number;
}

interface RateLimitState {
  requests: number[];
  tokens?: TokenEntry[];
  audioSeconds?: AudioSecondsEntry[];
}

interface RateLimits {
  rpm: number;
  rpd: number;
  tpm?: number;
  tpd?: number;
  ash?: number;
  asd?: number;
}

const whisperState: RateLimitState = {
  requests: [],
  audioSeconds: [],
};

const llmState: RateLimitState = {
  requests: [],
  tokens: [],
};

const whisperLimits: RateLimits = {
  rpm: 20,
  rpd: 2000,
  ash: 7200,
  asd: 28800,
};

const llmLimits: RateLimits = {
  rpm: 30,
  rpd: 1000,
  tpm: 12000,
  tpd: 100000,
};

function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60000);
}

function getCurrentHour(): number {
  return Math.floor(Date.now() / 3600000);
}

function getCurrentDay(): number {
  return Math.floor(Date.now() / 86400000);
}

function cleanupOldEntries(state: RateLimitState, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  state.requests = state.requests.filter((timestamp) => timestamp > cutoff);
  if (state.tokens) {
    state.tokens = state.tokens.filter((entry) => entry.timestamp > cutoff);
  }
  if (state.audioSeconds) {
    state.audioSeconds = state.audioSeconds.filter(
      (entry) => entry.timestamp > cutoff
    );
  }
}

function checkWhisperLimits(audioSeconds: number): {
  allowed: boolean;
  waitMs?: number;
  reason?: string;
} {
  const now = Date.now();
  const currentMinute = getCurrentMinute();
  const currentHour = getCurrentHour();
  const currentDay = getCurrentDay();

  cleanupOldEntries(whisperState, 86400000);

  const requestsThisMinute = whisperState.requests.filter(
    (timestamp) => Math.floor(timestamp / 60000) === currentMinute
  ).length;

  const requestsToday = whisperState.requests.filter(
    (timestamp) => Math.floor(timestamp / 86400000) === currentDay
  ).length;

  const audioSecondsThisHour =
    whisperState.audioSeconds
      ?.filter((entry) => Math.floor(entry.timestamp / 3600000) === currentHour)
      .reduce((sum, entry) => sum + entry.seconds, 0) || 0;

  const audioSecondsToday =
    whisperState.audioSeconds
      ?.filter((entry) => Math.floor(entry.timestamp / 86400000) === currentDay)
      .reduce((sum, entry) => sum + entry.seconds, 0) || 0;

  if (requestsThisMinute >= whisperLimits.rpm) {
    const nextMinute = (currentMinute + 1) * 60000;
    return {
      allowed: false,
      waitMs: nextMinute - now,
      reason: `RPM limit exceeded: ${requestsThisMinute}/${whisperLimits.rpm}`,
    };
  }

  if (requestsToday >= whisperLimits.rpd) {
    return {
      allowed: false,
      reason: `RPD limit exceeded: ${requestsToday}/${whisperLimits.rpd}`,
    };
  }

  if (audioSecondsThisHour + audioSeconds > whisperLimits.ash!) {
    const nextHour = (currentHour + 1) * 3600000;
    return {
      allowed: false,
      waitMs: nextHour - now,
      reason: `ASH limit exceeded: ${audioSecondsThisHour + audioSeconds}/${
        whisperLimits.ash
      }`,
    };
  }

  if (audioSecondsToday + audioSeconds > whisperLimits.asd!) {
    return {
      allowed: false,
      reason: `ASD limit exceeded: ${audioSecondsToday + audioSeconds}/${
        whisperLimits.asd
      }`,
    };
  }

  const usagePercent = Math.max(
    (requestsThisMinute / whisperLimits.rpm) * 100,
    (requestsToday / whisperLimits.rpd) * 100,
    ((audioSecondsThisHour + audioSeconds) / whisperLimits.ash!) * 100,
    ((audioSecondsToday + audioSeconds) / whisperLimits.asd!) * 100
  );

  if (usagePercent > 80) {
    console.warn(
      `⚠️  Whisper rate limit warning: ${usagePercent.toFixed(
        1
      )}% of limits used`
    );
  }

  return { allowed: true };
}

function checkLLMLimits(estimatedTokens: number): {
  allowed: boolean;
  waitMs?: number;
  reason?: string;
} {
  const now = Date.now();
  const currentMinute = getCurrentMinute();
  const currentDay = getCurrentDay();

  cleanupOldEntries(llmState, 86400000);

  const requestsThisMinute = llmState.requests.filter(
    (timestamp) => Math.floor(timestamp / 60000) === currentMinute
  ).length;

  const requestsToday = llmState.requests.filter(
    (timestamp) => Math.floor(timestamp / 86400000) === currentDay
  ).length;

  const tokensThisMinute =
    llmState.tokens
      ?.filter((entry) => Math.floor(entry.timestamp / 60000) === currentMinute)
      .reduce((sum, entry) => sum + entry.tokens, 0) || 0;

  const tokensToday =
    llmState.tokens
      ?.filter((entry) => Math.floor(entry.timestamp / 86400000) === currentDay)
      .reduce((sum, entry) => sum + entry.tokens, 0) || 0;

  if (requestsThisMinute >= llmLimits.rpm!) {
    const nextMinute = (currentMinute + 1) * 60000;
    return {
      allowed: false,
      waitMs: nextMinute - now,
      reason: `RPM limit exceeded: ${requestsThisMinute}/${llmLimits.rpm}`,
    };
  }

  if (requestsToday >= llmLimits.rpd!) {
    return {
      allowed: false,
      reason: `RPD limit exceeded: ${requestsToday}/${llmLimits.rpd}`,
    };
  }

  if (tokensThisMinute + estimatedTokens > llmLimits.tpm!) {
    const nextMinute = (currentMinute + 1) * 60000;
    return {
      allowed: false,
      waitMs: nextMinute - now,
      reason: `TPM limit exceeded: ${tokensThisMinute + estimatedTokens}/${
        llmLimits.tpm
      }`,
    };
  }

  if (tokensToday + estimatedTokens > llmLimits.tpd!) {
    return {
      allowed: false,
      reason: `TPD limit exceeded: ${tokensToday + estimatedTokens}/${
        llmLimits.tpd
      }`,
    };
  }

  const usagePercent = Math.max(
    (requestsThisMinute / llmLimits.rpm!) * 100,
    (requestsToday / llmLimits.rpd!) * 100,
    ((tokensThisMinute + estimatedTokens) / llmLimits.tpm!) * 100,
    ((tokensToday + estimatedTokens) / llmLimits.tpd!) * 100
  );

  if (usagePercent > 80) {
    console.warn(
      `⚠️  LLM rate limit warning: ${usagePercent.toFixed(1)}% of limits used`
    );
  }

  return { allowed: true };
}

async function checkAndWaitWhisper(audioSeconds: number): Promise<void> {
  const check = checkWhisperLimits(audioSeconds);
  if (!check.allowed) {
    if (check.waitMs) {
      console.log(
        `⏳ Rate limit reached. Waiting ${Math.ceil(
          check.waitMs / 1000
        )} seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, check.waitMs));
      const recheck = checkWhisperLimits(audioSeconds);
      if (!recheck.allowed) {
        throw new Error(
          `Whisper rate limit exceeded: ${check.reason || "Unknown reason"}`
        );
      }
    } else {
      throw new Error(
        `Whisper rate limit exceeded: ${check.reason || "Unknown reason"}`
      );
    }
  }
}

async function checkAndWaitLLM(estimatedTokens: number): Promise<void> {
  const check = checkLLMLimits(estimatedTokens);
  if (!check.allowed) {
    if (check.waitMs) {
      console.log(
        `⏳ Rate limit reached. Waiting ${Math.ceil(
          check.waitMs / 1000
        )} seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, check.waitMs));
      const recheck = checkLLMLimits(estimatedTokens);
      if (!recheck.allowed) {
        throw new Error(
          `LLM rate limit exceeded: ${check.reason || "Unknown reason"}`
        );
      }
    } else {
      throw new Error(
        `LLM rate limit exceeded: ${check.reason || "Unknown reason"}`
      );
    }
  }
}

function recordWhisperRequest(audioSeconds: number): void {
  const now = Date.now();
  whisperState.requests.push(now);
  if (!whisperState.audioSeconds) {
    whisperState.audioSeconds = [];
  }
  whisperState.audioSeconds.push({ timestamp: now, seconds: audioSeconds });
}

function recordLLMRequest(tokens: number): void {
  const now = Date.now();
  llmState.requests.push(now);
  if (!llmState.tokens) {
    llmState.tokens = [];
  }
  llmState.tokens.push({ timestamp: now, tokens });
}

function getMaxTokensPerRequest(): number {
  const currentMinute = getCurrentMinute();
  cleanupOldEntries(llmState, 60000);

  const tokensThisMinute =
    llmState.tokens
      ?.filter((entry) => Math.floor(entry.timestamp / 60000) === currentMinute)
      .reduce((sum, entry) => sum + entry.tokens, 0) || 0;

  const availableTokens = Math.max(0, llmLimits.tpm! - tokensThisMinute);
  return availableTokens;
}

export const rateLimiter = {
  checkAndWaitWhisper,
  checkAndWaitLLM,
  recordWhisperRequest,
  recordLLMRequest,
  getMaxTokensPerRequest,
};
