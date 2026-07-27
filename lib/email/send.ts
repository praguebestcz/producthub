import nodemailer from "nodemailer";

// Odesílání e-mailů přes SMTP (nodemailer), vzor aplikace vratky - zjednodušeno:
// ProductHub posílá z JEDNÉ PB adresy (bez multi-klient/DKIM). Konfigurace z
// prostředí (.env lokálně, Railway na produkci).
//
// Bez SMTP konfigurace se odeslání TIŠE přeskočí a zaloguje - aplikace i zvoneček
// fungují dál (stejný princip jako ANTHROPIC_API_KEY u promptů). Klíče nastavuje
// výhradně Hana.

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  testEmails: string | null;
};

function getMailSettings(): MailSettings | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user,
    pass,
    fromEmail: process.env.EMAIL_FROM ?? user,
    fromName: process.env.EMAIL_FROM_NAME ?? "ProductHub",
    testEmails: process.env.TEST_EMAILS ?? null,
  };
}

function splitEmails(s: string | null): string[] {
  return (s ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

// Pošle jeden e-mail. Vrací true při úspěchu. Nikdy nevyhazuje (volající se
// spolehne na návratovou hodnotu a případně kompenzuje `emailedAt`).
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const s = getMailSettings();
  if (!s) {
    console.warn(
      "[email] přeskočeno: SMTP není nastaven (SMTP_HOST/SMTP_USER/SMTP_PASS).",
    );
    return false;
  }
  const to = params.to.trim();
  if (!to) return false;

  // POJISTKA (vzor vratky): mimo produkci se posílá JEN na testovací adresy.
  // Brání odeslání reálnému kolegovi z lokálního/dev prostředí.
  if (process.env.NODE_ENV !== "production") {
    const allowed = splitEmails(s.testEmails).map((e) => e.toLowerCase());
    if (!allowed.includes(to.toLowerCase())) {
      console.warn(
        "[email] PŘESKOČENO (test režim): příjemce není v TEST_EMAILS.",
      );
      return false;
    }
  }

  const transport = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
  });
  const name = s.fromName.replace(/["\r\n]/g, "").trim();
  const fromEmail = s.fromEmail.replace(/[\r\n]/g, "").trim();
  const from = name ? `"${name}" <${fromEmail}>` : fromEmail;

  try {
    await transport.sendMail({
      from,
      to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (err) {
    // Logujeme jen message (bez obsahu komentáře / payloadu).
    console.error("[email] odeslání selhalo", {
      message: err instanceof Error ? err.message : "neznámá chyba",
    });
    return false;
  }
}
