import type { CSSProperties, ReactNode } from "react";

export type ResultSheetOrg = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type ResultSheetMetaItem = {
  label: string;
  value: ReactNode;
};

export function ResultSheetChrome({
  organization,
  title,
  subtitle,
  meta,
  compact,
  continuedLabel,
  kicker = "Official academic record",
}: {
  organization: ResultSheetOrg;
  title: string;
  subtitle?: string | null;
  meta: ResultSheetMetaItem[];
  compact?: boolean;
  continuedLabel?: string | null;
  kicker?: string;
}) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const metaStyle = {
    "--result-meta-cols": String(Math.min(meta.length, 6)),
  } as CSSProperties;

  if (compact) {
    return (
      <div className="result-sheet-continued">
        <p className="result-sheet-continued-title">{title}</p>
        <p className="result-sheet-continued-ref">
          {subtitle ? `${subtitle} · ` : ""}
          {continuedLabel ?? "Continued"}
        </p>
      </div>
    );
  }

  return (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="exam-watermark" aria-hidden />
      ) : null}

      <header className="result-sheet-header">
        <div className="result-sheet-brand">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="result-sheet-logo" />
          ) : (
            <div className="result-sheet-logo-fallback" aria-hidden>
              {(orgName.slice(0, 2) || "IN").toUpperCase()}
            </div>
          )}
          <div className="result-sheet-brand-text">
            <h1>{orgName}</h1>
            {organization.address ? <p>{organization.address}</p> : null}
            {organization.phone ? <p>Ph: {organization.phone}</p> : null}
          </div>
        </div>

        <div className="result-sheet-title-block">
          <p className="result-sheet-kicker">{kicker}</p>
          <h2>{title}</h2>
          {subtitle ? <p className="result-sheet-subtitle">{subtitle}</p> : null}
        </div>
      </header>

      {meta.length > 0 ? (
        <div className="result-sheet-meta" style={metaStyle}>
          {meta.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function ResultSheetSignatures() {
  return (
    <footer className="result-sheet-sign">
      <div>
        <span />
        <p>Class Teacher</p>
      </div>
      <div>
        <span />
        <p>Checked By</p>
      </div>
      <div>
        <span />
        <p>Principal</p>
      </div>
    </footer>
  );
}
