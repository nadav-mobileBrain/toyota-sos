import dayjs from 'dayjs';
import 'dayjs/locale/he';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(localizedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('he');

// Israel/Jerusalem timezone constant
export const ISRAEL_TZ = 'Asia/Jerusalem';

export const formatDate = (date: Date | string | dayjs.Dayjs): string => {
  return dayjs(date).format('DD/MM/YYYY');
};

export const formatDateTime = (date: Date | string | dayjs.Dayjs): string => {
  return dayjs(date).format('DD/MM/YYYY HH:mm');
};

export const formatTimeWindow = (
  start: Date | string | dayjs.Dayjs,
  end: Date | string | dayjs.Dayjs
): string => {
  const startFormatted = dayjs(start).format('DD/MM HH:mm');
  const endFormatted = dayjs(end).format('DD/MM HH:mm');
  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Normalize a date to Israel/Jerusalem timezone and return the start of day
 * This ensures consistent date comparisons regardless of server/client timezone
 */
export const normalizeToIsraelDate = (date: Date | string): Date => {
  return dayjs(date).tz(ISRAEL_TZ).startOf('day').toDate();
};

/**
 * Get the date string (YYYY-MM-DD) in Israel timezone
 */
export const getIsraelDateString = (date: Date | string): string => {
  return dayjs(date).tz(ISRAEL_TZ).format('YYYY-MM-DD');
};

export default dayjs;

