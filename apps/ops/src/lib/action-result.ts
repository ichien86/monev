/**
 * Tipe hasil generik untuk seluruh Server Action di SIMONEV Ops.
 * Diletakkan netral (bukan di dalam folder modul F-01/F-10/dst.) supaya
 * batas antar modul tetap terjaga secara logis (lihat DDT Section 11) —
 * modul lain tidak perlu saling impor demi satu tipe generik.
 */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
