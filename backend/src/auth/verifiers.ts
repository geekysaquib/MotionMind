export interface TokenVerifier {
  /** Returns the user id for a valid access token, or null. */
  verify(token: string): Promise<string | null>;
}

/** Local demo mode only: accepts "dev:<user-id>" tokens. */
export class DevTokenVerifier implements TokenVerifier {
  async verify(token: string) {
    return token.startsWith('dev:') && token.length > 4 ? token.slice(4) : null;
  }
}

/** Tries each verifier in turn. Memory mode accepts both real sessions and the browser demo's dev tokens. */
export class AnyVerifier implements TokenVerifier {
  constructor(private readonly verifiers: TokenVerifier[]) {}
  async verify(token: string) {
    for (const v of this.verifiers) {
      const id = await v.verify(token);
      if (id) return id;
    }
    return null;
  }
}
