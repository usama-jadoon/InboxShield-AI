import { EngineOrchestrator } from './core/orchestrator';
import { EngineReport, ScannerResult, BaseScanner } from './core/types';

// Built-in Scanners
import { DnsScanner } from './scanners/dns.scanner';
import { SpfScanner } from './scanners/spf.scanner';
import { DkimScanner } from './scanners/dkim.scanner';
import { DmarcScanner } from './scanners/dmarc.scanner';
import { MxScanner } from './scanners/mx.scanner';
import { TlsScanner } from './scanners/tls.scanner';
import { BlacklistScanner } from './scanners/blacklist.scanner';

// AI Providers
import { AiProvider, AiRecommendation } from './ai/provider';
import { HeuristicAiProvider } from './ai/heuristic.provider';

// Report Layer
import { ReportBuilder } from './report/builder';
import { ReportModel, PresentationSection } from './report/types';

export {
  EngineOrchestrator,
  DnsScanner,
  SpfScanner,
  DkimScanner,
  DmarcScanner,
  MxScanner,
  TlsScanner,
  BlacklistScanner,
  HeuristicAiProvider,
  ReportBuilder
};

export type { 
  EngineReport, 
  ScannerResult, 
  BaseScanner, 
  AiProvider, 
  AiRecommendation,
  ReportModel,
  PresentationSection
};
