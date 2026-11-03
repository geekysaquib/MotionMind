import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface Sealed {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/** AES-256-GCM. The user id and provider are bound as associated data, so a row can't be swapped between users. */
export class KeyCipher {
  private readonly key: Buffer;

  constructor(secretBase64: string) {
    this.key = Buffer.from(secretBase64, 'base64');
    if (this.key.length !== 32) throw new Error('Encryption secret must be 32 bytes');
  }

  seal(plaintext: string, aad: string): Sealed {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
  }

  open(sealed: Sealed, aad: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(sealed.iv, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }
}

export function last4(key: string): string {
  return key.slice(-4);
}
