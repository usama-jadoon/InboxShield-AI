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
} from '../src/index';

async function generateSampleReport(domain: string) {
  const engine = new EngineOrchestrator();
  
  engine.registerScanner(new DnsScanner());
  engine.registerScanner(new SpfScanner());
  engine.registerScanner(new DkimScanner());
  engine.registerScanner(new DmarcScanner());
  engine.registerScanner(new MxScanner());
  engine.registerScanner(new TlsScanner());
  engine.registerScanner(new BlacklistScanner());

  console.log(`\n=============================================`);
  console.log(`📡 ANALYZING TARGET: ${domain}`);
  console.log(`=============================================\n`);
  
  // Note: the execute signature of TLS scanner requires the MX record internally now,
  // but to adhere to the zero-coupled interface we altered `analyzeDomain` to pass target dynamically.
  // The Orchestrator doesn't natively chain MX -> TLS within the bounded Map structure without tight coupling.
  // Let's modify the orchestrator slightly locally to allow chaining if we strictly enforce the V1 decoupled rule we must
  // let the TLS scanner do its OWN mx lookup internally if a target isn't explicitly passed.
  
  const report = await engine.analyzeDomain(domain);
  
  console.log(`📊 OVERALL STATUS`);
  console.log(`Global Score: ${report.globalScore}/100`);
  console.log(`Risk Level:   ${report.riskLevel}`);
  
  console.log(`\n🔍 RAW FINDINGS (FLAGS ONLY)`);
  Object.values(report.scannerResults).forEach(res => {
     if (res.flags.length > 0) {
       console.log(`[${res.scannerId}] -> ${res.flags.join(', ')}`);
     }
  });

  console.log('\n🤖 AI RECOMMENDATIONS');
  const aiProvider = new HeuristicAiProvider();
  const recommendations = await aiProvider.analyze(report);
  
  if (recommendations.length > 0) {
    recommendations.forEach(rec => {
      console.log(`\n❌ ISSUE:  ${rec.issue}`);
      console.log(`💡 FIX:    ${rec.recommendation}`);
      console.log(`⚙️  TECH:   ${rec.technicalDetails}`);
    });
  } else {
    console.log('\n✅ No vulnerabilities found. Configuration is optimal.');
  }
}

async function runBatch() {
  const targets = [
    'gmail.com',
    'google.com',
    'outlook.com',
    'icloud.com',
    'proton.me'
  ];

  for (const t of targets) {
    await generateSampleReport(t);
  }
}

runBatch();
