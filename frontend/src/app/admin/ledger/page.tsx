import { getAdmin } from "@/lib/data";
import { formatSol } from "@/lib/format";
import { Ledger } from "@/components/admin/ledger";
import { AdminHeader } from "@/components/admin/page-header";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { EmptyState } from "@/components/ui";
import { CoinsIcon } from "@/components/ui/icons";

export const metadata = { title: "Ledger" };

export default async function LedgerPage() {
  const data = await getAdmin();
  if (typeof data === "string") return null;

  const confirmed = data.ledger.filter((e) => e.status === "confirmed");
  const inFlight = data.ledger.filter((e) => e.status === "pending" || e.status === "submitted");
  const failed = data.ledger.filter((e) => e.status === "failed").length;
  const total = confirmed.reduce((n, e) => n + e.amountLamports, 0);
  const tiles = [
    { label: "Confirmed volume", value: <CountUp value={total} format="sol" /> },
    { label: "Confirmed transfers", value: <CountUp value={confirmed.length} format="plain" /> },
    { label: "Awaiting the chain", value: formatSol(inFlight.reduce((n, e) => n + e.amountLamports, 0)) },
    { label: "Failed", value: <CountUp value={failed} format="plain" /> },
  ];

  return (
    <div>
      <AdminHeader
        title="Ledger"
        description="Every sponsorship, as read back off the chain. Sardhana never holds these funds; this is the verification record."
      />
      {data.ledger.length ? (
        <>
          <Reveal as="dl" stagger={0.06} immediate className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
                <dt className="text-[12.5px] text-fg-muted">{t.label}</dt>
                <dd className="tnum mt-3 text-[clamp(1.35rem,1.1rem+0.8vw,1.85rem)] font-semibold leading-none tracking-tight">{t.value}</dd>
              </div>
            ))}
          </Reveal>
          <div className="mt-6">
            <Ledger entries={data.ledger} />
          </div>
        </>
      ) : (
        <EmptyState
          className="mt-6"
          icon={<CoinsIcon size={18} />}
          title="The ledger is not in the API yet"
          description="Sponsorships are verified per session today. A platform-wide ledger appears here once the API exposes one."
        />
      )}
    </div>
  );
}
