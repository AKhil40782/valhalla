'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
    caseId: string;
    generatedAt: Date;
    generatedBy: string;
    summary: {
        totalTransactions: number;
        uniqueAccounts: number;
        graphDensity: string;
        suspectedHacker: string;
        avgSyncScore: string;
    };
    alerts: Array<{
        title: string;
        severity: string;
        description: string;
    }>;
    transactions: Array<{
        from: string;
        to: string;
        amount: number;
        timestamp: string;
        ip?: string;
        device?: string;
    }>;
    hackerInfo?: {
        name: string;
        inDegree: number;
        severity: string;
    };
}

export function generateFraudReport(data: ReportData): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // ===== HEADER =====
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('🏦 SALAAR BANK', 14, 18);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('FRAUD INVESTIGATION REPORT', 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Case ID: ${data.caseId}`, 14, 36);
    doc.text(`Generated: ${data.generatedAt.toLocaleString()}`, pageWidth - 70, 36);

    // ===== CLASSIFICATION BANNER =====
    const severity = data.hackerInfo?.severity || 'LOW';
    const bannerColor = severity === 'CRITICAL' ? [127, 29, 29] : severity === 'MODERATE' ? [120, 53, 15] : [20, 83, 45];
    const bannerText = severity === 'CRITICAL' ? '🔴 CRITICAL THREAT DETECTED' : severity === 'MODERATE' ? '🟡 MODERATE RISK IDENTIFIED' : '🟢 LOW RISK - MONITORING';

    doc.setFillColor(bannerColor[0], bannerColor[1], bannerColor[2]);
    doc.rect(0, 45, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(bannerText, pageWidth / 2, 53, { align: 'center' });

    // ===== EXECUTIVE SUMMARY =====
    let yPos = 70;

    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', 14, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // slate-600

    const summaryLines = [
        `Total Transactions Analyzed: ${data.summary.totalTransactions}`,
        `Unique Accounts Involved: ${data.summary.uniqueAccounts}`,
        `Network Graph Density: ${data.summary.graphDensity}`,
        `Coordination Sync Score: ${data.summary.avgSyncScore}%`,
        `Threat Assessment: ${data.summary.suspectedHacker}`,
    ];

    summaryLines.forEach(line => {
        doc.text(line, 14, yPos);
        yPos += 6;
    });

    // ===== PRIMARY SUSPECT =====
    if (data.hackerInfo) {
        yPos += 8;
        doc.setFillColor(254, 242, 242); // red-50
        doc.roundedRect(14, yPos - 4, pageWidth - 28, 28, 3, 3, 'F');

        doc.setTextColor(153, 27, 27); // red-800
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('⚠️ PRIMARY SUSPECT', 20, yPos + 6);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Account: ${data.hackerInfo.name}`, 20, yPos + 14);
        doc.text(`Inbound Connections: ${data.hackerInfo.inDegree} sources (Fan-In Pattern)`, 20, yPos + 20);

        yPos += 36;
    }

    // ===== ALERTS TABLE =====
    if (data.alerts.length > 0) {
        yPos += 5;
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ACTIVE ALERTS', 14, yPos);

        yPos += 5;

        autoTable(doc, {
            startY: yPos,
            head: [['Severity', 'Alert', 'Description']],
            body: data.alerts.map(a => [a.severity, a.title, a.description]),
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 50 },
                2: { cellWidth: 'auto' }
            }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // ===== TRANSACTION LOG =====
    if (data.transactions.length > 0) {
        // Check if we need a new page
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TRANSACTION LOG', 14, yPos);

        yPos += 5;

        autoTable(doc, {
            startY: yPos,
            head: [['From', 'To', 'Amount (₹)', 'Time', 'IP Address']],
            body: data.transactions.slice(0, 20).map(tx => [
                tx.from,
                tx.to,
                tx.amount.toLocaleString('en-IN'),
                new Date(tx.timestamp).toLocaleString(),
                tx.ip || 'N/A'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 95], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 2 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // ===== FOOTER =====
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `CONFIDENTIAL - Salaar Bank Fraud Investigation Unit | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
        doc.text(
            `Generated by: ${data.generatedBy}`,
            14,
            doc.internal.pageSize.getHeight() - 10
        );
    }

    // ===== SAVE =====
    doc.save(`SALAAR_CASE_${data.caseId}_${Date.now()}.pdf`);
}

// Helper to generate case ID
export function generateCaseId(): string {
    const prefix = 'FRD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}
