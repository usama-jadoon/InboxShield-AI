/**
 * @file V1-10: Real PDF export via @react-pdf/renderer.
 *
 * Renders the immutable ReportModel evidence snapshot into a real PDF
 * document. No stubs, no fake bytes — `renderToBuffer` produces a genuine
 * `%PDF-` file. Pure rendering: the caller (API route) owns auth, DB reads,
 * and response headers.
 */
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ReportModel, PresentationSection } from '@inboxshield/engine';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 20,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreLabel: {
    color: '#6b7280',
  },
  scoreValue: {
    fontWeight: 'bold',
  },
  item: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  itemStatus: {
    width: 70,
    fontWeight: 'bold',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: 'bold',
  },
  itemDesc: {
    color: '#4b5563',
    marginTop: 1,
  },
  itemTech: {
    color: '#9ca3af',
    marginTop: 1,
  },
  rec: {
    marginBottom: 8,
  },
  recIssue: {
    fontWeight: 'bold',
  },
  recBody: {
    color: '#4b5563',
    marginTop: 1,
  },
});

function statusColor(statusLabel: PresentationSection['statusLabel']): string {
  switch (statusLabel) {
    case 'PASS':
      return '#059669';
    case 'FAIL':
      return '#e11d48';
    case 'WARNING':
      return '#d97706';
    default:
      return '#6b7280';
  }
}

function SectionList({ title, items }: { title: string; items: PresentationSection[] }) {
  return React.createElement(
    View,
    { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, title),
    items.map((item) =>
      React.createElement(
        View,
        { key: item.id, style: styles.item },
        React.createElement(
          Text,
          { style: [styles.itemStatus, { color: statusColor(item.statusLabel) }] },
          item.statusLabel,
        ),
        React.createElement(
          View,
          { style: styles.itemBody },
          React.createElement(Text, { style: styles.itemTitle }, item.title),
          React.createElement(Text, { style: styles.itemDesc }, item.description),
          item.technicalDetail
            ? React.createElement(Text, { style: styles.itemTech }, item.technicalDetail)
            : null,
        ),
      ),
    ),
  );
}

function Recommendations({ items }: { items: ReportModel['recommendations'] }) {
  return React.createElement(
    View,
    { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, 'Recommendations'),
    items.map((rec, i) =>
      React.createElement(
        View,
        { key: `${rec.issue}-${i}`, style: styles.rec },
        React.createElement(Text, { style: styles.recIssue }, rec.issue),
        React.createElement(Text, { style: styles.recBody }, rec.recommendation),
        rec.technicalDetails
          ? React.createElement(Text, { style: styles.recBody }, rec.technicalDetails)
          : null,
      ),
    ),
  );
}

/** The React element tree that becomes the PDF. Exported for testability. */
export function ReportPdfDocument({ report }: { report: ReportModel }) {
  return React.createElement(
    Document,
    { title: `InboxShield Report — ${report.metadata.domain}` },
    React.createElement(
      Page,
      { style: styles.page },
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.title }, `InboxShield Scan Report`),
        React.createElement(
          Text,
          { style: styles.subtitle },
          `Domain: ${report.metadata.domain}  ·  Generated: ${report.metadata.generatedAt}  ·  Version: ${report.metadata.version}`,
        ),
        React.createElement(
          View,
          { style: styles.scoreRow },
          React.createElement(Text, { style: styles.scoreLabel }, 'Global Score'),
          React.createElement(Text, { style: styles.scoreValue }, `${report.executiveSummary.score}/100`),
        ),
        React.createElement(
          View,
          { style: styles.scoreRow },
          React.createElement(Text, { style: styles.scoreLabel }, 'Risk Level'),
          React.createElement(Text, { style: styles.scoreValue }, report.executiveSummary.riskLevel),
        ),
        React.createElement(
          View,
          { style: styles.scoreRow },
          React.createElement(Text, { style: styles.scoreLabel }, 'Status'),
          React.createElement(Text, { style: styles.scoreValue }, report.executiveSummary.statusText),
        ),
        React.createElement(SectionList, { title: 'Authentication', items: report.authentication }),
        React.createElement(SectionList, { title: 'Infrastructure', items: report.infrastructure }),
        React.createElement(Recommendations, { items: report.recommendations }),
      ),
    ),
  );
}

/** Render a ReportModel to a real PDF buffer (starts with `%PDF-` magic bytes). */
export async function generateReportPdf(report: ReportModel): Promise<Buffer> {
  // The wrapper component is typed by its own props; the rendered tree is a
  // <Document> element, so narrow the element type for the renderer boundary.
  const element = React.createElement(ReportPdfDocument, { report });
  return renderToBuffer(element as React.ReactElement<DocumentProps>);
}
