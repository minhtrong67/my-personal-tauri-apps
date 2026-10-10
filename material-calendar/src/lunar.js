// Vietnamese lunar calendar (UTC+7), based on Hồ Ngọc Đức's astronomical algorithm.
const TZ = 7;
const INT = Math.floor;

function jd(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let j = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (j < 2299161) j = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return j;
}

function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let J = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  J += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mp = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C += -0.4068 * Math.sin(Mp * dr) + 0.0161 * Math.sin(dr * 2 * Mp) - 0.0004 * Math.sin(dr * 3 * Mp);
  C += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mp)) - 0.0074 * Math.sin(dr * (M - Mp)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C += -0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mp)) + 0.001 * Math.sin(dr * (2 * F - Mp)) + 0.0005 * Math.sin(dr * (2 * Mp + M));
  const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return J + C - dt;
}

function sunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= Math.PI * 2 * INT(L / (Math.PI * 2));
  return L;
}
const sunSector = (day) => INT((sunLongitude(day - 0.5 - TZ / 24) / Math.PI) * 6);
const newMoonDay = (k) => INT(newMoon(k) + 0.5 + TZ / 24);

function month11(yy) {
  const off = jd(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = newMoonDay(k);
  if (sunSector(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}

function leapOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0, i = 1, arc = sunSector(newMoonDay(k + i));
  do { last = arc; i++; arc = sunSector(newMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}

const memo = new Map();
/** Convert a local Date to { d, m, y, leap } (lunar day, month, year, is-leap-month). */
export function lunar(date) {
  const dd = date.getDate(), mm = date.getMonth() + 1, yy = date.getFullYear();
  const key = yy * 10000 + mm * 100 + dd;
  if (memo.has(key)) return memo.get(key);
  const day = jd(dd, mm, yy);
  const k = INT((day - 2415021.076998695) / 29.530588853);
  let start = newMoonDay(k + 1);
  if (start > day) start = newMoonDay(k);
  let a11 = month11(yy), b11 = a11, ly;
  if (a11 >= start) { ly = yy; a11 = month11(yy - 1); } else { ly = yy + 1; b11 = month11(yy + 1); }
  const diff = INT((start - a11) / 29);
  let lm = diff + 11, leap = 0;
  if (b11 - a11 > 365) {
    const lo = leapOffset(a11);
    if (diff >= lo) { lm = diff + 10; if (diff === lo) leap = 1; }
  }
  if (lm > 12) lm -= 12;
  if (lm >= 11 && diff < 4) ly -= 1;
  const r = { d: day - start + 1, m: lm, y: ly, leap: !!leap };
  memo.set(key, r);
  return r;
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const canChi = (y) => `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`;
