
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
      <Image
                  src="https://permitakaun.kumim.my/logo.png"
                  alt="Permit Akaun"
                  fill
                  className="object-contain"
                  priority
                />
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Dyad Apps. All rights reserved.</p>
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

export const paymentReceiptEmail = (name: string, amount: string, date: string, description: string) => getBaseTemplate(`
  <h2>Resit Pembayaran Rasmi</h2>
  <p>Hai ${name},</p>
  <p>Terima kasih. Kami telah menerima pembayaran anda.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Jumlah:</strong> RM ${amount}</p>
    <p style="margin: 5px 0;"><strong>Tarikh:</strong> ${date}</p>
    <p style="margin: 5px 0;"><strong>Keterangan:</strong> ${description}</p>
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
