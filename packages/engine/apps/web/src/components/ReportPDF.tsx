import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { ReportModel } from '@inboxshield/engine';

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica' },
  header: { marginBottom: 30, borderBottom: '1pt solid #eaeaea', paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 8 },
  scoreBox: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 8, marginBottom: 30, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' },
  scoreTitle: { fontSize: 14, color: '#333' },
  scoreValue: { fontSize: 32, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginTop: 20, marginBottom: 15 },
  card: { border: '1pt solid #eaeaea', borderRadius: 6, padding: 15, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 12, fontWeight: 'bold', color: '#111' },
  badgeContent: { fontSize: 10, fontWeight: 'bold' },
  description: { fontSize: 11, color: '#444', lineHeight: 1.4 },
  techRow: { marginTop: 8, backgroundColor: '#f1f5f9', padding: 8, borderRadius: 4 },
  techText: { fontSize: 9, fontFamily: 'Courier', color: '#334155' }
});

const getBadgeColor = (status: string) => {
  switch(status) {
    case 'PASS': return '#10b981'; // emerald
    case 'FAIL': return '#f43f5e'; // rose
    case 'WARNING': return '#f59e0b'; // amber
    default: return '#64748b'; // neutral
  }
};

interface ReportPDFProps {
  model: ReportModel;
}

export const ReportPDF = ({ model }: ReportPDFProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Deliverability Audit: {model.metadata.domain}</Text>
          <Text style={styles.subtitle}>Generated on {new Date(model.metadata.generatedAt).toLocaleString()} • InboxShield AI Core (v{model.metadata.version})</Text>
        </View>

        <View style={styles.scoreBox}>
          <View>
            <Text style={styles.scoreTitle}>Global Health Score</Text>
            <Text style={[styles.scoreValue, { color: getBadgeColor(model.executiveSummary.riskColor === 'emerald' ? 'PASS' : 'FAIL') }]}>
              {model.executiveSummary.score} / 100
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.scoreTitle}>Risk Assessment</Text>
            <Text style={[styles.scoreValue, { color: getBadgeColor(model.executiveSummary.riskColor === 'emerald' ? 'PASS' : 'FAIL'), fontSize: 18, marginTop: 10 }]}>
              {model.executiveSummary.riskLevel}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Authentication Protocols</Text>
        {model.authentication.map(section => (
          <View key={section.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={[styles.badgeContent, { color: getBadgeColor(section.statusLabel) }]}>{section.statusLabel}</Text>
            </View>
            <Text style={styles.description}>{section.description}</Text>
            <View style={styles.techRow}>
               <Text style={styles.techText}>{section.technicalDetail}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Infrastructure & Routing</Text>
        {model.infrastructure.map(section => (
          <View key={section.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={[styles.badgeContent, { color: getBadgeColor(section.statusLabel) }]}>{section.statusLabel}</Text>
            </View>
            <Text style={styles.description}>{section.description}</Text>
            <View style={styles.techRow}>
               <Text style={styles.techText}>{section.technicalDetail}</Text>
            </View>
          </View>
        ))}

        {model.recommendations.length > 0 && (
          <View>
            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>AI Remediation Plan</Text>
            {model.recommendations.map((rec, i) => (
              <View key={i} style={[styles.card, { borderColor: '#fda4af', backgroundColor: '#fff5f5' }]}>
                <Text style={[styles.cardTitle, { color: '#be123c', marginBottom: 5 }]}>Issue: {rec.issue}</Text>
                <Text style={styles.description}>Fix: {rec.recommendation}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};
