import { NextResponse } from 'next/server';
import { 
  EngineOrchestrator, 
  DnsScanner, 
  SpfScanner,
  DkimScanner, 
  DmarcScanner, 
  MxScanner, 
  TlsScanner, 
  BlacklistScanner,
  HeuristicAiProvider 
} from '@inboxshield/engine';

const orchestrator = new EngineOrchestrator();
orchestrator.registerScanner(new DnsScanner());
orchestrator.registerScanner(new SpfScanner());
orchestrator.registerScanner(new DkimScanner());
orchestrator.registerScanner(new DmarcScanner());
orchestrator.registerScanner(new MxScanner());
orchestrator.registerScanner(new TlsScanner());
orchestrator.registerScanner(new BlacklistScanner());

const aiProvider = new HeuristicAiProvider();

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const report = await orchestrator.analyzeDomain(domain);
    const recommendations = await aiProvider.analyze(report);

    return NextResponse.json({ report, recommendations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
