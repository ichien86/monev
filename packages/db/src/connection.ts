import mongoose, { type Connection } from "mongoose";

/**
 * Dua koneksi terpisah secara sengaja (lihat DDT Section 2):
 * - `core`      : simonev_core — satu-satunya tempat penulisan (SIMONEV Ops).
 * - `readmodel` : simonev_readmodel — hanya dibaca oleh SIMONEV Eksekutif,
 *                 hanya ditulis oleh worker sinkronisasi (lihat DDT Section 6.3).
 *
 * Pola cache-di-global ini standar untuk Mongoose + Next.js: mencegah
 * pembuatan koneksi baru setiap kali modul di-reload saat development.
 */

type ConnectionCache = {
  core?: { conn: Connection | null; promise: Promise<Connection> | null };
  readmodel?: { conn: Connection | null; promise: Promise<Connection> | null };
};

declare global {
  // eslint-disable-next-line no-var
  var __simonevMongoCache: ConnectionCache | undefined;
}

const cache: ConnectionCache = global.__simonevMongoCache ?? {};
if (!global.__simonevMongoCache) global.__simonevMongoCache = cache;

async function connectTo(uriEnvVar: string, cacheKey: "core" | "readmodel"): Promise<Connection> {
  const uri = process.env[uriEnvVar];
  if (!uri) {
    throw new Error(
      `[@simonev/db] Environment variable ${uriEnvVar} belum diset. Cek .env.local (lihat .env.example di root repo).`
    );
  }

  if (!cache[cacheKey]) cache[cacheKey] = { conn: null, promise: null };
  const slot = cache[cacheKey]!;

  if (slot.conn) return slot.conn;

  if (!slot.promise) {
    slot.promise = mongoose
      .createConnection(uri, {
        // maxPoolSize kecil cukup untuk skala 200 concurrent users (PRD NFR Section 6)
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 8000,
      })
      .asPromise();
  }

  slot.conn = await slot.promise;
  return slot.conn;
}

/** Koneksi ke simonev_core — dipakai seluruh model transaksional di SIMONEV Ops. */
export function connectCore(): Promise<Connection> {
  return connectTo("MONGODB_URI_CORE", "core");
}

/** Koneksi ke simonev_readmodel — dipakai model baca-saja di SIMONEV Eksekutif
 *  dan ditulis oleh worker sinkronisasi (lihat models/ReadmodelSnapshot.ts). */
export function connectReadmodel(): Promise<Connection> {
  return connectTo("MONGODB_URI_READMODEL", "readmodel");
}
