type Org = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function ReportCardOrgHeader({ organization }: { organization: Org }) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const address = organization.address?.trim() || null;
  const phone = organization.phone?.trim() || null;

  return (
    <header className="report-card-letterhead">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="report-card-letterhead-logo" />
      ) : (
        <div className="report-card-letterhead-mark" aria-hidden>
          {(orgName.slice(0, 2) || "IN").toUpperCase()}
        </div>
      )}

      <h1 className="report-card-letterhead-name">{orgName}</h1>

      {(address || phone) && (
        <div className="report-card-letterhead-meta">
          {address ? <p className="report-card-letterhead-address">{address}</p> : null}
          {phone ? <p className="report-card-letterhead-phone">{phone}</p> : null}
        </div>
      )}

      <div className="report-card-letterhead-rule" aria-hidden />
    </header>
  );
}
