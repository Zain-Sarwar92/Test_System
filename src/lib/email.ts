export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  ok: boolean;
  mode: "smtp" | "console";
  error?: string;
};

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

/**
 * Send an email via SMTP when configured; otherwise log to console (dev-safe).
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!smtpConfigured()) {
    console.info(
      `[email:console]\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.text}\n`,
    );
    return { ok: true, mode: "console" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<pre style="font-family:sans-serif">${input.text}</pre>`,
    });

    return { ok: true, mode: "smtp" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error("[email:smtp]", message);
    return { ok: false, mode: "smtp", error: message };
  }
}

export function buildTestReminderEmail(input: {
  teacherName: string;
  testTitle: string;
  subjectName: string;
  classSection: string;
  testDateLabel: string;
  organizationName: string;
  examName?: string;
  appUrl?: string;
}) {
  return buildTestReminderDigestEmail({
    teacherName: input.teacherName,
    organizationName: input.organizationName,
    appUrl: input.appUrl,
    items: [
      {
        subjectName: input.subjectName,
        classSection: input.classSection,
        testDateLabel: input.testDateLabel,
        examName: input.examName,
      },
    ],
  });
}

/**
 * One email per teacher for all papers due tomorrow that still need creating.
 * Avoids spamming when a teacher has many section/subject assignments.
 */
export function buildTestReminderDigestEmail(input: {
  teacherName: string;
  organizationName: string;
  appUrl?: string;
  items: Array<{
    subjectName: string;
    classSection: string;
    testDateLabel: string;
    examName?: string;
  }>;
}) {
  const loginHint = input.appUrl
    ? `Please log in at ${input.appUrl} and create the missing test paper(s) before the scheduled date.`
    : "Please log in to Test Hub and create the missing test paper(s) before the scheduled date.";

  const count = input.items.length;
  const first = input.items[0];
  const subject =
    count === 1 && first
      ? `Reminder - ${input.organizationName}: ${first.subjectName} Test for ${first.classSection}`
      : `Reminder - ${input.organizationName}: ${count} tests due tomorrow`;

  const itemLines = input.items.flatMap((item, index) => [
    `${index + 1}. ${item.subjectName} — ${item.classSection}`,
    ...(item.examName ? [`   Schedule: ${item.examName}`] : []),
    `   Test Date: ${item.testDateLabel}`,
    "",
  ]);

  const text = [
    `Hello ${input.teacherName},`,
    "",
    count === 1
      ? "This is a day-before reminder. The following assigned test is still not created:"
      : `This is a day-before reminder. You still have ${count} assigned tests due tomorrow that are not created:`,
    "",
    `Organization: ${input.organizationName}`,
    "",
    ...itemLines,
    loginHint,
    "",
    "Thank you.",
  ].join("\n");

  return { subject, text };
}
