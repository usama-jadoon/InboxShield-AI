import { 
  EngineOrchestrator, 
  DnsScanner, 
  SpfScanner, 
  DmarcScanner, 
  MxScanner, 
  TlsScanner, 
  BlacklistScanner 
} from '../src/index';

import { AiAnalyzerStub } from '../src/ai/analyzer';

async function testEngine() {
  const engine = new EngineOrchestrator();
  
  // Registering plugins seamlessly without touching the core
  engine.registerScanner(new DnsScanner());
  engine.registerScanner(new SpfScanner());
  engine.registerScanner(new DmarcScanner());
  engine.registerScanner(new MxScanner());
  engine.registerScanner(new TlsScanner());
  engine.registerScanner(new BlacklistScanner());

  console.log('--- Executing V1 Orchestrator against google.com ---');
  const report = await engine.analyzeDomain('google.com');
  
  console.log('\n--- Normalised Report Generated ---');
  console.log(`Global Score: ${report.globalScore}/100`);
  console.log(`Risk Level: ${report.riskLevel}`);
  
  console.log('\n--- Processing through AI Analyzer Layer ---');
  const recommendations = AiAnalyzerStub.analyze(report);
  
  if (recommendations.length > 0) {
    recommendations.forEach(rec => {
      console.log(`\n[ISSUE]: ${rec.issue}`);
      console.log(`[ACTION]: ${rec.recommendation}`);
      console.log(`[TECH]: ${rec.technicalDetails}`);
    });
  } else {
    console.log('\nNo recommendations generated. Architecture is solid.');
  }
}

testEngine();
