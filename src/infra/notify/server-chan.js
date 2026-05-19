export function createServerChanNotifier({ sendKey, fetchImpl = fetch }) {
  return {
    async notify({ title, desp }) {
      if (!sendKey) {
        return { sent: false };
      }

      const body = new URLSearchParams({ title, desp });
      const response = await fetchImpl(`https://sctapi.ftqq.com/${sendKey}.send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`ServerChan 通知失败 - ${response.status}`);
      }

      return { sent: true };
    },
  };
}
