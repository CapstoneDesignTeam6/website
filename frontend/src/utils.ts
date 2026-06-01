import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export function formatTime(dateInput?: Date | string): string {
  const parsed = dateInput
    ? dayjs(dateInput)
    : dayjs();
  if (!parsed.isValid()) return '';
  return parsed.tz('Asia/Seoul').format('HH:mm');
}
