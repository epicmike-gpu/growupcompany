import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';

/**
 * 统一 SSE 客户端（Web / 原生共用同一套解析逻辑）
 *
 * - Web：全局 fetch + ReadableStream（Metro 代理下 XHR 类方案会被缓冲成一次性交付）
 * - 原生（iOS / Android / Expo Go）：expo/fetch（Expo 官方网络模块，SDK 52+，
 *   支持流式 response.body.getReader()）。
 *   之前的 react-native-sse 基于 XHR 封装，事件分发行为不可控（存在流式期间
 *   message 事件不触发 / 正常结束时额外触发 error 的隐患），已弃用。
 *
 * SSE 协议解析：按空行（\n\n）切分事件块，取 data: 行合并作为事件负载。
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

/** 返回停止函数（中断连接） */
export function connectSse(
  url: string,
  options: SseOptions,
  handlers: SseHandlers,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const doFetch = Platform.OS === 'web' ? fetch : expoFetch;
      const res = await doFetch(url, {
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
