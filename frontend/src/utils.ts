export function formatTime(dateInput?: Date | string): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
