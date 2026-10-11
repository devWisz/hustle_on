import { getAdmin } from "@/lib/data";
import { apiServer } from "@/lib/api/server";
import { formatSol } from "@/lib/format";
import type { ChainStatus } from "@/lib/types";
import { AdminPage, Panel, StatCard } from "@/components/admin/console";
import { Ledger } from "@/components/admin/ledger";
import { CountUp } from "@/components/motion/count-up";
import { Badge, EmptyState } from "@/components/ui";
import { CoinsIcon } from "@/components/ui/icons";

export const metadata = { title: "Ledger" };
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const [data, chain] = await Promise.all([
    getAdmin(),
    // Asked for here rather than in the shared admin loader: it is a live call to
    // a third party, and it belongs on the page whose subject is the chain.
    apiServer<ChainStatus>("/v1/admin/chain", 0),
  ]);
  if (typeof data === "string") return null;

  const confirmed = data.ledger.filter((e) => e.status === "confirmed");
  const inFlight = data.ledger.filter((e) => e.status === "pending" || e.status === "submitted");
  const failed = data.ledger.filter((e) => e.status === "failed");
  const total = confirmed.reduce((n, e) => n + e.amountLamports, 0);

  return (
    <AdminPage
      title="Ledger"
      description="Every sponsorship, as read back off the chain. Hustle On never holds these funds; this is the verification record."
    >
      {chain ? (
        <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[13px]">
          <Badge tone={chain.reachable ? "success" : "danger"} dot>
            {chain.reachable ? "RPC reachable" : "RPC unreachable"}
          </Badge>
          <span className="text-fg-muted">
            Verifying against <span className="font-mono text-fg">{chain.cluster}</span>
          </span>
          <span className="text-fg-subtle">
            {chain.reachable
              ? "Donations confirm on their own; Re-check asks the chain about one now."
              : chain.detail}
          </span>
        </Panel>
      ) : null}

      {data.ledger.length ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Confirmed volume"
              value={<CountUp value={total} format="sol" />}
              hint={`${confirmed.length} transfer${confirmed.length === 1 ? "" : "s"} verified`}
            />
            <StatCard
              label="Awaiting the chain"
              value={
                inFlight.length
                  ? formatSol(inFlight.reduce((n, e) => n + e.amountLamports, 0))
                  : "0 SOL"
              }
              hint={
                inFlight.length
                  ? `${inFlight.length} still to confirm`
                  : "Nothing is in flight right now"
              }
            />
            <StatCard
              label="Failed"
              value={<CountUp value={failed.length} format="plain" />}
              hint={
                failed.length
                  ? `${formatSol(failed.reduce((n, e) => n + e.amountLamports, 0))} not credited`
                  : "No transfer has failed"
              }
            />
            <StatCard
              label="All transfers"
              value={<CountUp value={data.ledger.length} format="plain" />}
              hint="Every row below, any status"
            />
          </div>
          <Ledger entries={data.ledger} />
        </div>
      ) : (
        <EmptyState
          icon={<CoinsIcon size={18} />}
          title="No sponsorships yet"
          description="Every sponsorship appears here once a viewer starts one, with its on-chain status."
        />
      )}
    </AdminPage>
  );
}
