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

  const cashFlowBody: any[][] = []

  // AKTIVITI OPERASI
  cashFlowBody.push([{ content: 'ALIRAN TUNAI DARI AKTIVITI OPERASI', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  cashFlowBody.push([{ content: '  Untung sebelum cukai', styles: { fontStyle: 'bold', textColor: data.netProfit >= 0 ? emerald : red } }, { content: data.netProfit < 0 ? fmtBracket(Math.abs(data.netProfit)) : fmt(data.netProfit), styles: { halign: 'right', fontStyle: 'bold', textColor: data.netProfit >= 0 ? emerald : red } }])
  cashFlowBody.push([{ content: '  Susut nilai (pelarasan bukan tunai)', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  cashFlowBody.push([{ content: 'Untung operasi sebelum perubahan modal kerja', styles: { fontStyle: 'bold' } }, { content: data.netProfit < 0 ? fmtBracket(Math.abs(data.netProfit)) : fmt(data.netProfit), styles: { halign: 'right', fontStyle: 'bold' } }])
  cashFlowBody.push([{ content: '  Perubahan modal kerja:', colSpan: 2, styles: { fontSize: 8, textColor: [80, 80, 80] } }])
  cashFlowBody.push([{ content: '    (Naik)/Turun penghutang perdagangan', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  cashFlowBody.push([{ content: '    (Naik)/Turun bayaran pendahuluan & deposit', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  cashFlowBody.push([{ content: '    (Naik)/Turun stok', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  cashFlowBody.push(['    Naik/(Turun) liabiliti semasa', { content: fmt(data.totalLiabilities), styles: { halign: 'right', textColor: [194, 65, 12] } }])

  // Butiran pendapatan & perbelanjaan
  cashFlowBody.push([{ content: '  Butiran Pendapatan Operasi', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  cashFlowBody.push([{ content: '    Jumlah Jualan & Operasi', styles: { fontStyle: 'bold', textColor: emerald } }, { content: fmt(data.operatingRevenue), styles: { halign: 'right', fontStyle: 'bold', textColor: emerald } }])
  for (const [cat, amount] of Object.entries(data.cashInByCategory)) {
    if (cat === 'Modal') continue
    cashFlowBody.push([{ content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } }, { content: (amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontSize: 8, textColor: gray } }])
  }
  cashFlowBody.push([{ content: '  Butiran Perbelanjaan Operasi', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  cashFlowBody.push([{ content: '    Jumlah Perbelanjaan', styles: { fontStyle: 'bold', textColor: red } }, { content: fmtBracket(data.totalExpenses), styles: { halign: 'right', fontStyle: 'bold', textColor: red } }])
  for (const [cat, amount] of Object.entries(data.cashOutByCategory)) {
    cashFlowBody.push([{ content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } }, { content: `(${(amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 })})`, styles: { halign: 'right', fontSize: 8, textColor: gray } }])
  }

  // AKTIVITI PELABURAN
  cashFlowBody.push([{ content: 'ALIRAN TUNAI DARI AKTIVITI PELABURAN', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  cashFlowBody.push(['  Perbelanjaan modal (Capital Expenditure)', { content: data.fixedAssets > 0 ? fmtBracket(data.fixedAssets) : fmt(0), styles: { halign: 'right', textColor: data.fixedAssets > 0 ? red : gray } }])
  cashFlowBody.push([{ content: '  Hasil jualan aset tetap', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])

  // AKTIVITI PEMBIAYAAN
  cashFlowBody.push([{ content: 'ALIRAN TUNAI DARI AKTIVITI PEMBIAYAAN', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  cashFlowBody.push(['  Modal Saham (Share Capital)', { content: fmt(data.totalCapital), styles: { halign: 'right', textColor: emerald } }])
  cashFlowBody.push([{ content: '  Pinjaman (Loan)', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  cashFlowBody.push([{ content: '  Pengeluaran (Withdrawal)', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])

  // Net + awal/akhir
  cashFlowBody.push([{ content: 'KENAIKAN/(PENURUNAN) BERSIH TUNAI DAN SETARA TUNAI', styles: { fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } }, { content: fmt(data.cashBalance), styles: { halign: 'right', fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } }])
  cashFlowBody.push([{ content: 'Tunai & setara tunai awal tempoh', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  cashFlowBody.push([{ content: 'Tunai & setara tunai akhir tempoh', styles: { fontStyle: 'bold' } }, { content: fmt(data.cashBalance), styles: { halign: 'right', fontStyle: 'bold', textColor: data.cashBalance >= 0 ? emerald : red } }])

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

  // ASET
  balanceBody.push([{ content: 'ASET (ASSETS)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  balanceBody.push([{ content: '  Aset Tetap Operasi', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } }])
  balanceBody.push(['    Harta, Loji & Peralatan', { content: fmt(data.fixedAssets), styles: { halign: 'right' } }])
  balanceBody.push([{ content: '    (-) Nilai aset lepas', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '  Aset Semasa', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } }])
  balanceBody.push(['    Tunai & baki bank', { content: fmt(data.cashBalance), styles: { halign: 'right', textColor: emerald } }])
  balanceBody.push([{ content: '    Penghutang perdagangan', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '    Bayaran pendahuluan, deposit & prabayar', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '    Inventori', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '    (-) Inventori & tunai lepas', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: 'Jumlah Aset', styles: { fontStyle: 'bold', fillColor: blueLight, textColor: blue } }, { content: fmt(data.totalAssets), styles: { halign: 'right', fontStyle: 'bold', fillColor: blueLight, textColor: blue } }])

  // EKUITI DAN LIABILITI
  balanceBody.push([{ content: 'EKUITI DAN LIABILITI', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  balanceBody.push([{ content: "  Ekuiti Pemegang Saham (Shareholder's Equity)", colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } }])
  balanceBody.push(["    Modal Rakan Kongsi (Partner's Capital)", { content: fmt(data.totalCapital), styles: { halign: 'right' } }])
  balanceBody.push([{ content: '    (-) Pengeluaran (Withdrawal)', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  const retainedEarnings = data.calculatedEquity - data.totalCapital
  balanceBody.push(['    Untung/Rugi Terkumpul (Accumulated P&L)', { content: retainedEarnings < 0 ? fmtBracket(Math.abs(retainedEarnings)) : fmt(retainedEarnings), styles: { halign: 'right', textColor: retainedEarnings < 0 ? red : emerald } }])
  balanceBody.push([{ content: '    (+) Untung/Rugi lepas', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '  Liabiliti', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } }])
  balanceBody.push([{ content: '    Liabiliti Bukan Semasa (Non-Current)', colSpan: 2, styles: { fontSize: 8, textColor: gray } }])
  balanceBody.push([{ content: '      Pinjaman jangka panjang', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '      Liabiliti jangka panjang lain', styles: { textColor: gray } }, { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  balanceBody.push([{ content: '    Liabiliti Semasa (Current)', colSpan: 2, styles: { fontSize: 8, textColor: gray } }])
  balanceBody.push(['      Pemiutang, akruan & liabiliti lain (Cukai & Zakat)', { content: fmt(data.totalLiabilities), styles: { halign: 'right', textColor: [194, 65, 12] } }])
  balanceBody.push([{ content: 'Jumlah Ekuiti & Liabiliti', styles: { fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } }, { content: fmt(data.totalLiabilities + data.calculatedEquity), styles: { halign: 'right', fontStyle: 'bold', fillColor: darkBg, textColor: [255, 255, 255], fontSize: 11 } }])

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

  // JUALAN
  plBody.push([{ content: 'JUALAN (SALES)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  plBody.push([{ content: '  Jumlah Jualan', styles: { fontStyle: 'bold' } }, { content: fmt(data.operatingRevenue), styles: { halign: 'right', textColor: emerald } }])
  for (const [cat, amount] of Object.entries(data.cashInByCategory)) {
    if (cat === 'Modal') continue
    plBody.push([{ content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } }, { content: (amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontSize: 8, textColor: gray } }])
  }

  // KOS LANGSUNG
  plBody.push([{ content: 'KOS LANGSUNG (DIRECT COST)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  plBody.push(['  Stok Awal (Opening Stock)', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  plBody.push(['  Belian (Purchase)', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  plBody.push(['  Kos Jualan (Cost of Sales)', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  plBody.push(['  Stok Akhir (Closing Stock)', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  plBody.push([{ content: 'KOS BARANGAN DIJUAL (COGS)', styles: { fontStyle: 'bold' } }, { content: fmt(0), styles: { halign: 'right', fontStyle: 'bold' } }])

  // UNTUNG KASAR
  plBody.push([{ content: 'UNTUNG KASAR (GROSS PROFIT)', styles: { fontStyle: 'bold', fillColor: emeraldLight, textColor: emerald } }, { content: fmt(data.operatingRevenue), styles: { halign: 'right', fontStyle: 'bold', fillColor: emeraldLight, textColor: emerald } }])

  // BELANJA OPERASI
  plBody.push([{ content: 'BELANJA OPERASI (OPERATING EXPENSES)', colSpan: 2, styles: { fillColor: sectionBg, fontStyle: 'bold', fontSize: 8, textColor: [80, 80, 80] } }])
  plBody.push([{ content: '  Belanja Pentadbiran (Administrative Expenses)', styles: { textColor: red } }, { content: data.totalExpenses > 0 ? fmtBracket(data.totalExpenses) : fmt(0), styles: { halign: 'right', textColor: red } }])
  for (const [cat, amount] of Object.entries(data.cashOutByCategory)) {
    plBody.push([{ content: `      • ${cat}`, styles: { fontSize: 8, textColor: gray } }, { content: `(${(amount as number).toLocaleString('en-MY', { minimumFractionDigits: 2 })})`, styles: { halign: 'right', fontSize: 8, textColor: gray } }])
  }
  plBody.push(['  Belanja Jualan & Penghantaran', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  plBody.push(['  Caj Kewangan (Financial Charges)', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])

  // UNTUNG OPERASI
  const opProfit = data.netProfit
  const opBg2 = opProfit >= 0 ? blueLight : [255, 235, 235] as [number, number, number]
  const opColor2 = opProfit >= 0 ? blue : red
  plBody.push([{ content: 'UNTUNG OPERASI (OPERATING PROFIT)', styles: { fontStyle: 'bold', fillColor: opBg2, textColor: opColor2 } }, { content: opProfit < 0 ? fmtBracket(Math.abs(opProfit)) : fmt(opProfit), styles: { halign: 'right', fontStyle: 'bold', fillColor: opBg2, textColor: opColor2 } }])
  plBody.push(['PENDAPATAN LAIN-LAIN (MISCELLANEOUS INCOME)', { content: fmt(0), styles: { halign: 'right', textColor: gray } }])
  plBody.push([{ content: 'UNTUNG/(RUGI) BERSIH SEBELUM CUKAI & ZAKAT', styles: { fontStyle: 'bold' } }, { content: opProfit < 0 ? fmtBracket(Math.abs(opProfit)) : fmt(opProfit), styles: { halign: 'right', fontStyle: 'bold' } }])

  // UNTUNG/(RUGI) BERSIH
  const netBg = data.netProfit >= 0 ? [146, 64, 14] as [number, number, number] : red
  plBody.push([{ content: 'UNTUNG / (RUGI) BERSIH', styles: { fontStyle: 'bold', fillColor: netBg, textColor: [255, 255, 255], fontSize: 11 } }, { content: data.netProfit < 0 ? fmtBracket(Math.abs(data.netProfit)) : fmt(data.netProfit), styles: { halign: 'right', fontStyle: 'bold', fillColor: netBg, textColor: [255, 255, 255], fontSize: 11 } }])

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
