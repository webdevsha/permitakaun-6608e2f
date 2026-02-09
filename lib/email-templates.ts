
export const emailStyles = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff; }
  .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; margin-bottom: 20px; }
  .logo { font-size: 24px; font-weight: bold; color: #0f172a; text-decoration: none; }
  .logo span { color: #2563eb; }
  .content { padding: 0 10px; }
  .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
  .footer { margin-top: 30px; pt: 20px; border-top: 1px solid #f0f0f0; text-align: center; font-size: 12px; color: #888; }
`

export const getBaseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Permit Akaun</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://permitakaun.kumim.my/logo.png" alt="Permit Akaun" style="max-height: 60px; width: auto;" />
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Permit Akaun. All rights reserved.</p>
      <p>This is an automated message from Permit Akaun System.</p>
    </div>
  </div>
</body>
</html>
`

export const welcomeEmail = (name: string) => getBaseTemplate(`
  <h2>Selamat Datang, ${name}!</h2>
  <p>Terima kasih kerana mendaftar dengan **Permit Akaun**.</p>
  <p>Akaun anda telah berjaya dicipta. Anda kini boleh mula menguruskan kewangan karnival dan sewaan tapak anda dengan lebih mudah dan sistematik.</p>
  <p>Sila log masuk untuk melengkapkan profil perniagaan anda.</p>
  <center><a href="https://permitakaun.kumim.my/login" class="button">Log Masuk Sekarang</a></center>
`)

export const paymentReceiptEmail = (
  name: string,
  amount: string,
  date: string,
  description: string,
  extra?: { organizerName?: string, locationName?: string }
) => getBaseTemplate(`
  <h2>Resit Pembayaran Rasmi</h2>
  <p>Hai ${name},</p>
  <p>Terima kasih. Kami telah menerima pembayaran anda.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Jumlah:</strong> RM ${amount}</p>
    <p style="margin: 5px 0;"><strong>Tarikh:</strong> ${date}</p>
    <p style="margin: 5px 0;"><strong>Keterangan:</strong> ${description}</p>
    ${extra?.organizerName ? `<p style="margin: 5px 0;"><strong>Penganjur:</strong> ${extra.organizerName}</p>` : ''}
    ${extra?.locationName ? `<p style="margin: 5px 0;"><strong>Lokasi:</strong> ${extra.locationName}</p>` : ''}
    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: green; font-weight: bold;">BERJAYA</span></p>
  </div>
  <p>Simpan rekod ini untuk rujukan anda.</p>
`)

export const accountActivatedEmail = (name: string) => getBaseTemplate(`
  <h2>Tahniah! Akaun Diaktifkan</h2>
  <p>Hai ${name},</p>
  <p>Permohonan anda telah diluluskan dan fitur **Akaun** anda kini telah **DIAKTIFKAN** sepenuhnya.</p>
  <p>Anda kini boleh mengakses modul perakaunan untuk merekod transaksi dan melihat prestasi kewangan perniagaan anda.</p>
  <center><a href="https://permitakaun.kumim.my/dashboard/accounting" class="button">Buka Akaun Saya</a></center>
`)

// Admin notification email for new payments
export const adminPaymentNotificationEmail = (
  payerName: string,
  payerEmail: string,
  amount: string,
  date: string,
  description: string,
  paymentType: string
) => getBaseTemplate(`
  <h2>Pemberitahuan Pembayaran Baharu</h2>
  <p>Hai Hazman,</p>
  <p>Terdapat pembayaran baharu yang telah diterima melalui <strong>Permit Akaun</strong>.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
    <h3 style="margin-top: 0; color: #2563eb;">${paymentType}</h3>
    <p style="margin: 8px 0;"><strong>Nama Pembayar:</strong> ${payerName}</p>
    <p style="margin: 8px 0;"><strong>Email:</strong> ${payerEmail}</p>
    <p style="margin: 8px 0;"><strong>Jumlah:</strong> <span style="font-size: 1.2em; color: #059669;">RM ${amount}</span></p>
    <p style="margin: 8px 0;"><strong>Tarikh:</strong> ${date}</p>
    <p style="margin: 8px 0;"><strong>Keterangan:</strong> ${description}</p>
    <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: green; font-weight: bold;">BERJAYA</span></p>
  </div>
  <p>Sila log masuk ke dashboard untuk melihat maklumat lanjut.</p>
  <center><a href="https://permitakaun.kumim.my/dashboard" class="button">Ke Dashboard</a></center>
`)
