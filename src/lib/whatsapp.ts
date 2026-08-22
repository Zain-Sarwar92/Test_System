/** Free WhatsApp click-to-chat helpers (text only — no PDF attach via wa.me). */

export function toWhatsAppDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Pakistan local 03XXXXXXXXX → 923XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `92${digits.slice(1)}`;
  }
  // Already country code without +
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export function whatsAppClickUrl(digits: string, text: string) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type WhatsAppResultLine = {
  label: string;
  value: string;
};

export function buildResultWhatsAppMessage(input: {
  orgName: string;
  title: string;
  className: string;
  sectionName: string;
  session: string;
  rollNumber: string;
  studentName: string;
  fatherName: string;
  lines: WhatsAppResultLine[];
  total?: string | null;
  percent?: string | number | null;
  grade?: string | null;
  position?: string | number | null;
}) {
  const parts = [
    `*${input.orgName.trim() || "Institute"}*`,
    input.title.trim(),
    `${input.className} · ${input.sectionName} · ${input.session}`,
    "",
    `Roll: ${input.rollNumber}`,
    `Student: ${input.studentName}`,
    `Father: ${input.fatherName}`,
    "",
    ...input.lines.map((line) => `${line.label}: ${line.value}`),
  ];

  if (input.total) parts.push("", `Total: ${input.total}`);
  if (input.percent != null && input.percent !== "") {
    parts.push(`Percentage: ${input.percent}%`);
  }
  if (input.grade) parts.push(`Grade: ${input.grade}`);
  if (input.position != null && input.position !== "") {
    parts.push(`Position: ${input.position}`);
  }

  parts.push("", "_Sent via Green Book (free WhatsApp share)_");
  return parts.join("\n");
}
