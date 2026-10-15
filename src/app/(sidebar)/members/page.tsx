"use client";
import { updateReviewStatus } from "@/action/member.action";
import { GetMemberList, MemberListRow } from "@/action/profile.action";
import { AddMemberToMachines } from "@/action/biometric.action";
import { BatchRow, GetBatches } from "@/action/batch.action";
import { call } from "@/lib/action-result";
import { DORMANT_AFTER_DAYS } from "@/lib/membership";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { IconFingerprint, IconPhone } from "@tabler/icons-react";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect } from "react";
import { toast } from "sonner";

const columns = [
  { accessorKey: "memberCode", header: "Member Id" },
  { accessorKey: "name", header: "Member Name" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "plan", header: "Package", cellClassName: "capitalize" },
  { accessorKey: "status", header: "Membership" },
  { accessorKey: "lastVisitLabel", header: "Last visit" },
  { accessorKey: "dueLabel", header: "Due" },
  { accessorKey: "batch", header: "Batch" },
];

// The member lists other gym software calls View Member, InActive Member,
// Dormant Member, BlackList Member and View Pending Renewal, as one page.
const VIEWS: { value: string; label: string; title: string; help: string; match: (r: MemberListRow) => boolean }[] = [
  { value: "all", label: "All", title: "View Member", help: "Everyone who has ever joined.", match: () => true },
  { value: "active", label: "Active", title: "Active Member", help: "Membership running today.", match: (r) => !r.blacklisted && (r.state === "active" || r.state === "expiring") },
  { value: "renewal", label: "Pending Renewal", title: "View Pending Renewal", help: "Ending within 7 days, or ended in the last 30 days. Call them to renew.", match: (r) => !r.blacklisted && (r.state === "expiring" || (r.state === "expired" && (r.daysLeft ?? -999) >= -30)) },
  { value: "inactive", label: "InActive", title: "InActive Member", help: "No running membership: expired, or never bought a package.", match: (r) => r.state === "expired" || r.state === "none" },
  { value: "dormant", label: "Dormant", title: "Dormant Member", help: `Membership running, but not seen for ${DORMANT_AFTER_DAYS}+ days. A quick call keeps them coming.`, match: (r) => !r.blacklisted && r.dormant },
  { value: "blacklist", label: "BlackList", title: "BlackList Member", help: "Not allowed to check in and removed from the biometric machine.", match: (r) => r.blacklisted },
  { value: "dues", label: "With dues", title: "Members with dues", help: "Money still owed.", match: (r) => r.due > 0 },
];

function MemberList() {
  const router = useRouter();
  const params = useSearchParams();
  const view = VIEWS.find((v) => v.value === params.get("view")) ?? VIEWS[0];
  const [rows, setRows] = React.useState<MemberListRow[]>([]);
  const [batches, setBatches] = React.useState<BatchRow[]>([]);
  const [batch, setBatch] = React.useState(params.get("batch") ?? "all");
  const [loading, setLoading] = React.useState(true);

  const load = async () => {
    setRows(await GetMemberList());
    setLoading(false);
  };
  useEffect(() => {
    load();
    GetBatches().then(setBatches);
  }, []);

  const enroll = async (row: MemberListRow) => {
    try {
      const pin = await call(AddMemberToMachines(row.id));
      toast.success(`${row.name} sent to the machine as ID ${pin}`, {
        description: `On the machine open User Management, find ID ${pin} and enroll the fingerprint.`,
        duration: 10000,
      });
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const setView = (value: string) => router.replace(value === "all" ? "/members" : `/members?view=${value}`);
  const shown = rows
    .filter(view.match)
    .filter((r) => batch === "all" || r.batch_id === batch)
    .map((r) => ({
      ...r,
      lastVisitLabel: r.lastVisit ? (r.daysAway === 0 ? "Today" : `${r.daysAway}d ago`) : "Never",
    }));

  const actionColumns = [
    {
      accessorKey: "id",
      header: "Call",
      cellContentGetRow: (row: MemberListRow) => (
        <a href={`tel:+91${row.phone}`} onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="outline" className="size-8"><IconPhone size={16} /></Button>
        </a>
      ),
    },
    {
      accessorKey: "id",
      header: "Biometric",
      cellContentGetRow: (row: MemberListRow) =>
        row.blacklisted ? (
          <Badge variant="destructive">BlackList</Badge>
        ) : row.biometricId && !row.machineBlocked ? (
          <Badge variant="secondary">ID {row.biometricId}</Badge>
        ) : (
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => enroll(row)}>
            <IconFingerprint size={14} /> Enroll
          </Button>
        ),
    },
    {
      accessorKey: "id",
      header: "Review",
      cellContentGetRow: (row: any) => <ReviewButton id={row.id} isDone={row.reviewDone} />,
    },
  ];

  return (
    <div className="max-w-6xl w-full mx-auto space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{view.title}</h1>
          <p className="text-muted-foreground text-sm">{view.help}</p>
        </div>
        <Link href="/members/new"><Button>Add Member</Button></Link>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Button key={v.value} size="sm" variant={v.value === view.value ? "default" : "outline"} onClick={() => setView(v.value)}>
            {v.label} <span className="opacity-70">{rows.filter(v.match).length}</span>
          </Button>
        ))}
        {batches.length > 0 && (
          <Select value={batch} onValueChange={setBatch}>
            <SelectTrigger className="ml-auto w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name} ({b.startTime}–{b.endTime})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <DataTable
        dataRows={shown}
        isLoading={loading}
        columns={columns}
        onItemClick={(row) => router.push(`/members/${row.id}`)}
        actionColumns={actionColumns}
      />
    </div>
  );
}

// useSearchParams needs a Suspense boundary.
export default function MemberPage() {
  return (
    <Suspense>
      <MemberList />
    </Suspense>
  );
}

const ReviewButton = ({ id, isDone }: { id: string; isDone: boolean }) => {
  const [isTick, setIsTick] = React.useState(isDone);
  const [loading, setLoading] = React.useState(false);
  const updateReview = async (status: boolean) => {
    setLoading(true);
    const res = await updateReviewStatus(id, status);
    if (res.success) setIsTick(status);
    else toast.error("Failed to update review");
    setLoading(false);
  };
  return (
    <Button
      size="icon"
      variant={isTick ? "default" : "destructive"}
      className="size-8 cursor-pointer"
      title={isTick ? "Google review done" : "Google review not done"}
      onClick={() => updateReview(!isTick)}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-l-2 border-b-2 border-white"></div>
      ) : isTick ? <Check size={16} /> : <X size={16} />}
    </Button>
  );
};
