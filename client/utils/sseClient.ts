import { Platform } from 'react-native';
import EventSource from 'react-native-sse';

/**
 * 统一 SSE 客户端
 *
 * 为什么 Web 端不用 react-native-sse：
 * Web 环境下该库走 XHR，请求经 Metro 代理转发时 SSE 响应会被缓冲成
 * 一次性交付——流式期间收不到任何事件，文字/语音时序全部错乱。
 * Web 端改用标准 fetch + ReadableStream 逐块解析；原生端保持 react-native-sse。
 */

export type SseOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type SseHandlers = {
  onMessage: (data: string | null) => void;
  onError: (event: unknown) => void;
};

/** 返回停止函数（关闭连接） */
export function connectSse(
  url: string,
  options: SseOptions,
  handlers: SseHandlers,
): () => void {
  // —— 原生端（iOS / Android）：react-native-sse —— //
  if (Platform.OS !== 'web') {
    const es = new EventSource(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
    } as never);

    es.addEventListener('message', (event: { data: string | null }) => {
      handlers.onMessage(event.data);
    });
    es.addEventListener('error', (event: unknown) => {
      handlers.onError(event);
    });

    return () => es.close();
  }

  // —— Web 端：fetch + ReadableStream —— //
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        handlers.onError({ status: res.status, message: res.statusText });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按空行切分 SSE 事件块
        let idx = buffer.indexOf('\n\n');
        while (idx >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const dataLines = raw
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());

          if (dataLines.length > 0) {
            handlers.onMessage(dataLines.join('\n'));
          }
          idx = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        handlers.onError(err);
      }
    }
  })();

  return () => controller.abort();
}
