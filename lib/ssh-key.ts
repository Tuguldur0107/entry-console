// Харилцагч бүрд олгох SSH түлхүүр үүсгэх (core repo дээр read-only deploy key).
//
// Яагаад RSA вэ: Node-ийн `crypto` ed25519-ийг PKCS#8 PEM-ээр л гаргадаг бөгөөд
// OpenSSH түүнийг хувийн түлхүүр болгож уншдаггүй. RSA-г PKCS#1 PEM
// ("BEGIN RSA PRIVATE KEY") хэлбэрээр гаргахад OpenSSH шууд уншина — AWS .pem
// түлхүүртэй ижил формат. Нийтийн түлхүүрийг GitHub-д өгөхийн тулд OpenSSH-ийн
// `ssh-rsa <base64>` утсан форматад хөрвүүлнэ.
import { generateKeyPairSync, createPublicKey } from "node:crypto";

/** SSH утсан формат: 4 байт big-endian урт + өгөгдөл. */
function sshString(data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, data]);
}

/** SSH mpint: эерэг тоо — дээд бит асаалттай бол урд нь 0x00 нэмнэ. */
function sshMpint(base64url: string): Buffer {
  let raw = Buffer.from(base64url, "base64url");
  // Илүүдэл тэг байтуудыг хасна (0 бол нэг байт үлдээнэ)
  let start = 0;
  while (start < raw.length - 1 && raw[start] === 0) start++;
  raw = raw.subarray(start);
  if (raw.length > 0 && (raw[0] & 0x80) !== 0) raw = Buffer.concat([Buffer.from([0]), raw]);
  return sshString(raw);
}

export interface SshKeyPair {
  /** OpenSSH нэг мөр: `ssh-rsa AAAA... <comment>` — GitHub deploy key-д өгнө */
  publicKey: string;
  /** PKCS#1 PEM — харилцагчийн repo-ийн secret-д хийнэ */
  privateKey: string;
}

/** Шинэ RSA түлхүүрийн хос үүсгэнэ (deploy key + Actions secret-д). */
export function generateSshKeyPair(comment: string): SshKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const jwk = createPublicKey(publicKey).export({ format: "jwk" }) as { n: string; e: string };
  const wire = Buffer.concat([sshString(Buffer.from("ssh-rsa")), sshMpint(jwk.e), sshMpint(jwk.n)]);
  const safeComment = comment.replace(/[^\w.@-]+/g, "-");
  return {
    publicKey: `ssh-rsa ${wire.toString("base64")} ${safeComment}`,
    privateKey: privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`,
  };
}
