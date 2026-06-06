import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 倒计时 Hook — 用于短信验证码发送按钮
 *
 * @param seconds 倒计时秒数，默认 60
 * @returns [countdown, start, reset]
 *   - countdown: 当前剩余秒数（0 表示未开始或已结束）
 *   - start: 开始倒计时
 *   - reset: 手动重置倒计时
 */
export function useCountdown(seconds = 60) {
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [seconds, clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setCountdown(0);
  }, [clearTimer]);

  // 组件卸载时清理定时器
  useEffect(() => clearTimer, [clearTimer]);

  return { countdown, start, reset } as const;
}
