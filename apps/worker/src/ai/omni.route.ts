export class OmniRouteAI {
  /**
   * Explains a specific technical problem and recommends a fix.
   */
  static async explainDmarcFailure(policy: string | null): Promise<string> {
    if (!policy) {
      return "Your domain is vulnerable to spoofing. You must publish a TXT record at _dmarc.yourdomain.com with the value 'v=DMARC1; p=quarantine;' to protect your sender reputation.";
    }
    if (policy === 'none') {
      return "Your DMARC policy is set to 'none', meaning ISPs will not reject forged emails. Update your policy to 'p=quarantine' to instruct ISPs to send spoofed emails to the spam folder, protecting your core deliverability.";
    }
    return "Your DMARC policy is properly configured.";
  }

  /**
   * Simulates the async payload AI review before dispatch.
   */
  static async analyzeEmailPayload(subject: string, bodyText: string): Promise<{ spamScore: number; flags: string[] }> {
    const flags: string[] = [];
    let score = 0;

    const bodyLower = bodyText.toLowerCase();
    
    // Very basic heuristic simulation of what the OpenAI layer will do
    if (bodyLower.includes("crypto") || bodyLower.includes("bitcoin")) {
      flags.push("Contains high-risk financial keywords.");
      score += 40;
    }
    if (subject === subject.toUpperCase() && subject.length > 5) {
      flags.push("Subject line is ALL CAPS, which is heavily penalized by Gmail.");
      score += 20;
    }
    if (bodyLower.includes("click here") || bodyLower.includes("act now")) {
      flags.push("Contains aggressive marketing Call-to-Actions often flagged by Outlook.");
      score += 15;
    }

    return { spamScore: Math.min(100, score), flags };
  }
}
