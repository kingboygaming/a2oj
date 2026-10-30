import nodemailer from "nodemailer";

export async function sendEmailVerification(email: string, token: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, APP_URL } = process.env;
  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST ||
    !SMTP_USER ||
    !SMTP_PASS ||
    !EMAIL_FROM ||
    !APP_URL ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("SMTP and email sender settings are incomplete.");
  }

  const baseUrl = new URL(APP_URL);
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }
  const verificationUrl = new URL("/account/verify-email", baseUrl);
  verificationUrl.searchParams.set("token", token);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Xác minh email A2OJ",
      text: `Mở liên kết sau để xác minh email cho tài khoản A2OJ của bạn (hết hạn sau 30 phút): ${verificationUrl.toString()}`,
      html: `<p>Mở liên kết bên dưới để xác minh email cho tài khoản A2OJ của bạn. Liên kết hết hạn sau 30 phút.</p><p><a href="${verificationUrl.toString()}">Xác minh email</a></p>`,
    });
  } finally {
    transporter.close();
  }
}
