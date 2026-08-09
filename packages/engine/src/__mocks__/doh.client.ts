/**
 * Canonical DoHClient mock factory — P0-01 contract step 4.
 *
 * Builds a mock DoH client whose `resolve()` returns predetermined DNS answers
 * filtered by query type (and optionally by name) or throws a configured error.
 * All scanner tests share this factory so the answer-set convention lives in
 * one place and no test makes a real network call.
 */

export type DoHAnswer = {
  type: 'A' | 'TXT' | 'MX';
  /** Optional name filter — when set the answer only matches this exact query name. */
  name?: string;
  data: string;
};

export interface MockDoHClient {
  resolve(domain: string, type: 'A' | 'TXT' | 'MX'): Promise<Array<{ data: string }>>;
  query(domain: string, type: string): Promise<unknown>;
  /** Reconfigure the answer set for subsequent resolve() calls. */
  setAnswers(answers: DoHAnswer[]): void;
  /** Make resolve() throw/reject with the given error (null clears it). */
  setError(error: Error | null): void;
}

export function createMockDoH(answers: DoHAnswer[] = []): MockDoHClient {
  let currentAnswers = answers;
  let currentError: Error | null = null;

  const resolve = async (domain: string, type: 'A' | 'TXT' | 'MX'): Promise<Array<{ data: string }>> => {
    if (currentError) throw currentError;
    return currentAnswers
      .filter((a) => a.type === type && (!a.name || a.name === domain))
      .map((a) => ({ data: a.data }));
  };

  return {
    resolve,
    query: async () => ({}),
    setAnswers: (next) => { currentAnswers = next; },
    setError: (err) => { currentError = err; },
  };
}
