import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ReportData {
  businessName: string
  reportPeriod: string
  // Cash Flow
  operatingRevenue: number
  totalCapital: number
  totalExpenses: number
  cashBalance: number
  cashInByCategory: Record<string, number>
  cashOutByCategory: Record<string, number>
  // Balance Sheet
  currentAssets: number
  fixedAssets: number
  totalAssets: number
  taxPayable: number
  zakatPayable: number
  totalLiabilities: number
  calculatedEquity: number
  // P&L
  netProfit: number
}

const fmt = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtBracket = (n: number) => `(RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`

export function generateFinancialReport(data: ReportData) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  // Colors
  const emerald = [16, 120, 80] as [number, number, number]
  const emeraldLight = [236, 253, 245] as [number, number, number]
  const blue = [30, 64, 175] as [number, number, number]
  const blueLight = [239, 246, 255] as [number, number, number]
  const amber = [146, 64, 14] as [number, number, number]
  const amberLight = [255, 251, 235] as [number, number, number]
  const red = [185, 28, 28] as [number, number, number]
  const gray = [107, 114, 128] as [number, number, number]
  const sectionBg = [245, 245, 245] as [number, number, number]
  const darkBg = [15, 23, 42] as [number, number, number]

  // =============================================
  // HELPER: Draw report header on current page
  // =============================================
  const drawHeader = (title: string, subtitle: string) => {
    doc.setFontSize(10)
    doc.setTextColor(...gray)
    doc.text('LAPORAN KEWANGAN', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.text(data.businessName, pageWidth / 2, 28, { align: 'center' })

    doc.setFontSize(9)
    doc.setTextColor(...gray)
    doc.text(data.reportPeriod, pageWidth / 2, 34, { align: 'center' })

    // Divider line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, 38, pageWidth - margin, 38)

    // Report title
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text(title, pageWidth / 2, 46, { align: 'center' })

    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.text(subtitle, pageWidth / 2, 52, { align: 'center' })

    return 58 // Y position after header
  }

  // =============================================
  // HELPER: Add footer to all pages
  // =============================================
  const addFooters = () => {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFontSize(7)
      doc.setTextColor(...gray)
      doc.text(
        `Dijana secara automatik oleh PermitAkaun pada ${new Date().toLocaleString('ms-MY')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
      doc.text(
        `Halaman ${i} / ${totalPages}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: 'right' }
      )
    }
  }

  // =============================================
  // PAGE 1: PENYATA ALIRAN TUNAI (Cash Flow)
  // =============================================
  let startY = drawHeader('Penyata Aliran Tunai', 'Ringkasan kemasukan dan perbelanjaan tunai')

  // Build cash flow table data
  const cashFlowBody: any[][] = []

  // Section: Cash Inflow
  cashFlowBody.push([
    { content: 'ALIRAN MASUK (CASH IN)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])

  cashFlowBody.push([
    { content: '  Jumlah Jualan & Operasi', styles: { fontStyle: 'bold', textColor: emerald } },
    { content: fmt(data.operatingRevenue), styles: { halign: 'right', fontStyle: 'bold', textColor: emerald } }
  ])

  // Category breakdown for income (exclude Modal)
  for (const [cat, amount] of Object.entries(data.cashInByCategory)) {
    if (cat === 'Modal') continue
    cashFlowBody.push([
      { content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } },
      { content: (amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontSize: 8, textColor: gray } }
    ])
  }

  cashFlowBody.push([
    { content: '  Modal & Pembiayaan', styles: {} },
    { content: fmt(data.totalCapital), styles: { halign: 'right' } }
  ])

  cashFlowBody.push([
    { content: 'Jumlah Tunai Masuk', styles: { fontStyle: 'bold' } },
    { content: fmt(data.operatingRevenue + data.totalCapital), styles: { halign: 'right', fontStyle: 'bold', textColor: emerald } }
  ])

  // Section: Cash Outflow
  cashFlowBody.push([
    { content: 'ALIRAN KELUAR (CASH OUT)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])

  cashFlowBody.push([
    { content: '  Jumlah Perbelanjaan', styles: { fontStyle: 'bold', textColor: red } },
    { content: fmtBracket(data.totalExpenses), styles: { halign: 'right', fontStyle: 'bold', textColor: red } }
  ])

  // Category breakdown for expenses
  for (const [cat, amount] of Object.entries(data.cashOutByCategory)) {
    cashFlowBody.push([
      { content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } },
      { content: `(${(amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 })})`, styles: { halign: 'right', fontSize: 8, textColor: gray } }
    ])
  }

  // Net flow (dark background row)
  cashFlowBody.push([
    { content: 'Lebihan / (Kurangan) Tunai', styles: { fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } },
    { content: fmt(data.cashBalance), styles: { halign: 'right', fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } }
  ])

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [],
    body: cashFlowBody,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 6, right: 6 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.65 },
      1: { cellWidth: contentWidth * 0.35 }
    },
    didParseCell: (hookData) => {
      // Add top border for summary rows
      if (hookData.row.index === cashFlowBody.length - 1) {
        hookData.cell.styles.minCellHeight = 14
      }
    }
  })

  // =============================================
  // PAGE 2: KUNCI KIRA-KIRA (Balance Sheet)
  // =============================================
  doc.addPage()
  startY = drawHeader('Kunci Kira-Kira', 'Kedudukan kewangan semasa (Aset = Liabiliti + Ekuiti)')

  const balanceBody: any[][] = []

  // Assets
  balanceBody.push([
    { content: 'ASET (ASSETS)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])
  balanceBody.push([
    '  Aset Semasa (Tunai di Tangan/Bank)',
    { content: fmt(data.currentAssets), styles: { halign: 'right' } }
  ])
  balanceBody.push([
    '  Aset Tetap (Fixed Assets)',
    { content: fmt(data.fixedAssets), styles: { halign: 'right' } }
  ])
  balanceBody.push([
    { content: 'Jumlah Aset', styles: { fontStyle: 'bold', fillColor: blueLight, textColor: blue } },
    { content: fmt(data.totalAssets), styles: { halign: 'right', fontStyle: 'bold', fillColor: blueLight, textColor: blue } }
  ])

  // Liabilities
  balanceBody.push([
    { content: 'LIABILITI (LIABILITIES)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])
  balanceBody.push([
    '  Cukai Belum Bayar (Accrued Tax)',
    { content: fmt(data.taxPayable), styles: { halign: 'right', textColor: [194, 65, 12] } }
  ])
  balanceBody.push([
    '  Zakat Belum Bayar (Accrued Zakat)',
    { content: fmt(data.zakatPayable), styles: { halign: 'right', textColor: [194, 65, 12] } }
  ])
  balanceBody.push([
    { content: 'Jumlah Liabiliti', styles: { fontStyle: 'bold', fillColor: [255, 247, 237], textColor: [124, 45, 18] } },
    { content: fmt(data.totalLiabilities), styles: { halign: 'right', fontStyle: 'bold', fillColor: [255, 247, 237], textColor: [124, 45, 18] } }
  ])

  // Equity
  balanceBody.push([
    { content: "EKUITI PEMILIK (OWNER'S EQUITY)", colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])
  balanceBody.push([
    '  Modal Pusingan',
    { content: fmt(data.totalCapital), styles: { halign: 'right' } }
  ])
  const retainedEarnings = data.calculatedEquity - data.totalCapital
  balanceBody.push([
    '  Untung Bersih Terkumpul (Retained Earnings)',
    { content: fmt(retainedEarnings), styles: { halign: 'right', textColor: retainedEarnings < 0 ? red : emerald } }
  ])

  // Total Equity + Liabilities
  balanceBody.push([
    { content: 'Jumlah Ekuiti & Liabiliti', styles: { fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } },
    { content: fmt(data.totalLiabilities + data.calculatedEquity), styles: { halign: 'right', fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } }
  ])

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [],
    body: balanceBody,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 6, right: 6 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.65 },
      1: { cellWidth: contentWidth * 0.35 }
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === balanceBody.length - 1) {
        hookData.cell.styles.minCellHeight = 14
      }
    }
  })

  // =============================================
  // PAGE 3: ANALISIS UNTUNG RUGI (P&L)
  // =============================================
  doc.addPage()
  startY = drawHeader('Analisis Untung Rugi Ringkas', 'Ringkasan pendapatan dan perbelanjaan operasi')

  const plBody: any[][] = []

  // Revenue
  plBody.push([
    { content: 'PENDAPATAN (REVENUE)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])
  plBody.push([
    { content: '  Jumlah Pendapatan Operasi', styles: { fontStyle: 'bold' } },
    { content: fmt(data.operatingRevenue), styles: { halign: 'right', textColor: emerald } }
  ])

  // Revenue breakdown by category
  for (const [cat, amount] of Object.entries(data.cashInByCategory)) {
    if (cat === 'Modal') continue
    plBody.push([
      { content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } },
      { content: (amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontSize: 8, textColor: gray } }
    ])
  }

  // Expenses
  plBody.push([
    { content: 'PERBELANJAAN (EXPENSES)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }
  ])
  plBody.push([
    { content: '  Jumlah Kos Operasi & Lain-lain', styles: { fontStyle: 'bold', textColor: red } },
    { content: fmtBracket(data.totalExpenses), styles: { halign: 'right', textColor: red } }
  ])

  // Expense breakdown by category
  for (const [cat, amount] of Object.entries(data.cashOutByCategory)) {
    plBody.push([
      { content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } },
      { content: `(${(amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 })})`, styles: { halign: 'right', fontSize: 8, textColor: gray } }
    ])
  }

  // Net Profit/Loss
  const netColor = data.netProfit >= 0 ? [146, 64, 14] as [number, number, number] : red
  const netBg = data.netProfit >= 0 ? [146, 64, 14] as [number, number, number] : red
  plBody.push([
    { content: 'Untung / (Rugi) Bersih', styles: { fontStyle: 'bold', fillColor: netBg, textColor: [255, 255, 255], fontSize: 11 } },
    { content: fmt(data.netProfit), styles: { halign: 'right', fontStyle: 'bold', fillColor: netBg, textColor: [255, 255, 255], fontSize: 11 } }
  ])

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [],
    body: plBody,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 6, right: 6 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.65 },
      1: { cellWidth: contentWidth * 0.35 }
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === plBody.length - 1) {
        hookData.cell.styles.minCellHeight = 14
      }
    }
  })

  // Add footers to all pages
  addFooters()

  // Download
  const filename = `Laporan_Kewangan_${data.businessName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
