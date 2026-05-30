"use client";

import Image from "next/image";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Activity, ArrowDown, ArrowUp, Copy, Crown, Database, FilePenLine, ImagePlus, ListChecks, Plus, RadioTower, Save, Trash2, Upload, Users, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContestEntryView, ContestView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDateUTC } from "@/lib/utils";

type ActivityLogView = { id: string; action: string; entity: string; entityId: string | null; createdAt: string };
type CoordinatorDraft = { name: string; role: string; email: string; phone: string; discord: string };
type ProblemDraft = { code: string; title: string; points: number; firstSolveUsernames: string[] };
type ContestCoordinatorView = ContestView["coordinators"][number];
type ContestMutationResponse = { contest: { id: string } };
type StandingsDraftResponse = { saved: number };
type CodeforcesSyncResponse = { imported: number };
type FinalizeStandingsResponse = { finalized?: boolean; rows?: number };
type SubmitJson = <TResponse = unknown>(endpoint: string, body: Record<string, unknown>, method?: string) => Promise<TResponse>;

const emptyCoordinator: CoordinatorDraft = { name: "", role: "", email: "", phone: "", discord: "" };
function defaultProblems(count = 5): ProblemDraft[] {
  return Array.from({ length: count }, (_, index) => ({
    code: nextProblemCode(index),
    title: "",
    points: (index + 1) * 100,
    firstSolveUsernames: [],
  }));
}

function coordinatorDrafts(contest?: ContestView): CoordinatorDraft[] {
  return contest?.coordinators.length
    ? contest.coordinators.map((coordinator) => ({
        name: coordinator.name,
        role: coordinator.role,
        email: coordinator.email ?? "",
        phone: coordinator.phone,
        discord: coordinator.discord ?? "",
      }))
    : [{ ...emptyCoordinator }];
}

function problemDrafts(contest?: ContestView): ProblemDraft[] {
  return contest?.problems.length
    ? contest.problems.map((problem) => ({
        code: problem.code,
        title: problem.title ?? "",
        points: problem.points,
        firstSolveUsernames: problem.firstSolves.map((firstSolve) => firstSolve.player.username),
      }))
    : defaultProblems();
}

export function AdminWorkbench({ contests, activityLogs }: { contests: ContestView[]; activityLogs: ActivityLogView[] }) {
  const [contestList, setContestList] = useState(contests);
  const [message, setMessage] = useState("");
  const [selectedContest, setSelectedContest] = useState(contests[0]?.id ?? "");
  const [isEditingContest, setIsEditingContest] = useState(false);
  const [coordinators, setCoordinators] = useState<CoordinatorDraft[]>(() => coordinatorDrafts(contests[0]));
  const [problems, setProblems] = useState<ProblemDraft[]>(() => problemDrafts(contests[0]));
  const [isPending, startTransition] = useTransition();
  const activeContest = useMemo(() => contestList.find((contest) => contest.id === selectedContest), [contestList, selectedContest]);

  const submitJson: SubmitJson = async <TResponse,>(endpoint: string, body: Record<string, unknown>, method = "POST"): Promise<TResponse> => {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Request failed.");
    return payload as TResponse;
  };

  async function refreshContests(nextSelectedId?: string) {
    const response = await fetch("/api/admin/contests", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to refresh contests.");
    setContestList(payload.contests);
    const nextId = nextSelectedId !== undefined ? nextSelectedId : selectedContest;
    if (nextSelectedId !== undefined) setSelectedContest(nextSelectedId);
    if (nextSelectedId !== undefined) setIsEditingContest(!nextSelectedId);
    const nextContest = payload.contests.find((contest: ContestView) => contest.id === nextId);
    setCoordinators(coordinatorDrafts(nextContest));
    setProblems(problemDrafts(nextContest));
  }

  function selectContest(id: string) {
    setSelectedContest(id);
    setIsEditingContest(!id);
    const contest = contestList.find((item) => item.id === id);
    setCoordinators(coordinatorDrafts(contest));
    setProblems(problemDrafts(contest));
  }

  function persistContest(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
        body.coordinators = coordinators.filter((coordinator) => coordinator.name && coordinator.phone && coordinator.role);
        if (!activeContest?.standingsFinalizedAt) body.problems = problems;
        const payload = await submitJson<ContestMutationResponse>(id ? `/api/admin/contests/${id}` : "/api/admin/contests", body, id ? "PATCH" : "POST");
        await refreshContests(payload.contest.id);
        setMessage(id ? "Contest updated. Refresh after final review to confirm public surfaces." : "Contest created. Upload assets or add standings next.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Contest save failed.");
      }
    });
  }

  function clearContestForm() {
    setSelectedContest("");
    setIsEditingContest(true);
    setCoordinators([{ ...emptyCoordinator }]);
    setProblems(defaultProblems());
  }

  function cancelContestEdit() {
    if (!activeContest) {
      clearContestForm();
      return;
    }
    setIsEditingContest(false);
    setCoordinators(coordinatorDrafts(activeContest));
    setProblems(problemDrafts(activeContest));
  }

  function duplicateContest(contest: ContestView | undefined) {
    if (!contest) return;
    startTransition(async () => {
      try {
        const payload = await submitJson<ContestMutationResponse>("/api/admin/contests", {
          title: `${contest.title} Copy`,
          description: contest.description,
          invitePoster: contest.invitePoster ?? "",
          bannerPoster: contest.bannerPoster ?? "",
          contestBanner: contest.contestBanner ?? "",
          platform: contest.platform,
          contestLink: contest.contestLink ?? "",
          startTime: contest.startTime,
          duration: contest.duration,
          visibility: contest.visibility,
          scoringSystem: contest.scoringSystem,
          prizePool: contest.prizePool ?? "",
          coordinators: contest.coordinators.map(({ name, role, email, phone, discord }: ContestCoordinatorView) => ({ name, role, email, phone, discord })),
          problems: contest.problems.map((problem) => ({
            code: problem.code,
            title: problem.title ?? "",
            points: problem.points,
            firstSolveUsernames: [],
          })),
        });
        await refreshContests(payload.contest.id);
        setMessage("Contest duplicated. Review dates, posters, standings, and first solves before publishing.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Duplicate failed.");
      }
    });
  }

  return (
    <div className="admin-shell grid gap-5">
      {message && <div className="empty-plaque clip-arena p-4 font-[family-name:var(--font-mono)] text-[#9AFF00]">{message}</div>}
      <div className="control-room-shell">
        <aside className="control-room-sidebar section-band p-4">
          <div className="mb-5">
            <p className="engraved text-[10px]">Admin Matrix</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-lg uppercase text-white">Control Room</p>
          </div>
          <nav className="grid gap-2 text-sm">
            {[
              ["Contest", Plus],
              ["Standings", Upload],
              ["Problems", ListChecks],
              ["Overview", Database],
              ["Actions", Zap],
              ["Activity", Activity],
            ].map(([label, Icon]) => (
              <a key={String(label)} href={`#${String(label).toLowerCase()}`} className="control-room-nav-item">
                <Icon className="size-4" />
                <span>{String(label)}</span>
              </a>
            ))}
          </nav>
        </aside>

        <div className="control-room-dashboard">
          <Panel id="contest" className="control-room-setup-card" icon={<Plus className="size-6" />} title={activeContest ? "Contest Editor" : "Create Contest"}>
            <form key={`${activeContest?.id ?? "new"}-${isEditingContest ? "edit" : "view"}`} className="admin-contest-form" onSubmit={(event) => persistContest(event, activeContest?.id)}>
              {activeContest && !isEditingContest && (
                <div className="empty-plaque clip-arena p-3 font-[family-name:var(--font-mono)] text-sm text-zinc-300">
                  Existing contest selected. Use Edit Contest to change fields, replace posters, or save updates.
                </div>
              )}
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Select Contest</p>
                <ContestSelect contests={contestList} selectedContest={selectedContest} setSelectedContest={(id) => startTransition(async () => {
                  selectContest(id);
                  if (id) await refreshContests(id);
                })} compact />
              </div>

              <div className="admin-field-grid">
                <Field name="title" placeholder="Contest title" defaultValue={activeContest?.title} disabled={Boolean(activeContest && !isEditingContest)} required />
                <Field name="platform" placeholder="Organizer / group" defaultValue={activeContest?.platform ?? "Codeforces"} disabled={Boolean(activeContest && !isEditingContest)} />
                <Field name="startTime" type="datetime-local" defaultValue={toLocalInput(activeContest?.startTime)} disabled={Boolean(activeContest && !isEditingContest)} required />
                <Field name="duration" type="number" min={1} placeholder="Duration" defaultValue={activeContest?.duration ?? 120} disabled={Boolean(activeContest && !isEditingContest)} />
                <Field type="number" min={1} max={26} placeholder="Number of problems" value={problems.length} disabled={Boolean(activeContest && (!isEditingContest || activeContest.standingsFinalizedAt))} onChange={(event) => setProblemCount(Number(event.target.value), problems, setProblems)} />
                <select name="visibility" className="terminal-field clip-arena min-w-0 px-4 py-3 font-[family-name:var(--font-mono)] text-sm" defaultValue={activeContest?.visibility ?? "PUBLIC"} disabled={Boolean(activeContest && !isEditingContest)}>
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
                <Field name="contestLink" placeholder="Official contest link" defaultValue={activeContest?.contestLink ?? ""} disabled={Boolean(activeContest && !isEditingContest)} />
                <Field name="prizePool" placeholder="Prize title" defaultValue={activeContest?.prizePool ?? ""} disabled={Boolean(activeContest && !isEditingContest)} />
              </div>

              <ContestProblemSetup problems={problems} setProblems={setProblems} disabled={Boolean(activeContest && (!isEditingContest || activeContest.standingsFinalizedAt))} />

              <textarea name="description" placeholder="Contest description" rows={4} defaultValue={activeContest?.description} disabled={Boolean(activeContest && !isEditingContest)} className="terminal-field clip-arena min-w-0 resize-y px-4 py-3 font-[family-name:var(--font-mono)] text-sm" />

              <CoordinatorEditor coordinators={coordinators} setCoordinators={setCoordinators} disabled={Boolean(activeContest && !isEditingContest)} />

              <div className="admin-upload-grid">
                <CloudinaryUploader key={`invite-${activeContest?.id ?? "new"}`} name="invitePoster" title="Invite Poster Upload" kind="INVITE_POSTER" ratio="Portrait poster artwork" contestId={activeContest?.id} initialUrl={activeContest?.invitePoster} disabled={Boolean(activeContest && !isEditingContest)} onMessage={setMessage} />
                <CloudinaryUploader key={`banner-${activeContest?.id ?? "new"}`} name="bannerPoster" title="Contest Banner Upload" kind="BANNER" ratio="Wide cinematic hero" contestId={activeContest?.id} initialUrl={activeContest?.bannerPoster ?? activeContest?.contestBanner} disabled={Boolean(activeContest && !isEditingContest)} onMessage={setMessage} />
              </div>

              <div className="admin-form-actions">
                {activeContest ? (
                  <>
                    {!isEditingContest && <Button type="button" disabled={isPending} onClick={() => setIsEditingContest(true)}><FilePenLine className="size-4" /> Edit Contest</Button>}
                    {isEditingContest && <Button type="submit" disabled={isPending}><Save className="size-4" /> Save Changes</Button>}
                    {isEditingContest && <Button type="button" variant="ghost" disabled={isPending} onClick={cancelContestEdit}><X className="size-4" /> Cancel Edit</Button>}
                    <Button type="button" variant="ghost" disabled={isPending} onClick={() => duplicateContest(activeContest)}><Copy className="size-4" /> Duplicate</Button>
                    <Button type="button" variant="danger" disabled={isPending} onClick={() => deleteContest(activeContest.id, submitJson, setMessage, startTransition, refreshContests)}><Trash2 className="size-4" /> Delete Contest</Button>
                    <Button type="button" variant="ghost" disabled={isPending} onClick={clearContestForm}><Plus className="size-4" /> New Contest</Button>
                  </>
                ) : (
                  <Button type="submit" disabled={isPending}><Save className="size-4" /> Create Contest</Button>
                )}
              </div>
            </form>
          </Panel>

          <div className="control-room-row-two">
            <Panel id="standings" className="control-room-standings-card" icon={<Upload className="size-6" />} title="Standings Draft Manager">
              <ContestSelect contests={contestList} selectedContest={selectedContest} setSelectedContest={(id) => startTransition(async () => {
                selectContest(id);
                await refreshContests(id);
              })} />
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  startTransition(async () => {
                    try {
                      const body = Object.fromEntries(new FormData(form).entries());
                      const payload = await submitJson<StandingsDraftResponse>(`/api/admin/contests/${body.contestId}/entries`, body);
                      await refreshContests(String(body.contestId));
                      setMessage(`Saved ${payload.saved} standings rows and refreshed derived ledgers.`);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Upload failed.");
                    }
                  });
                }}
              >
                <input type="hidden" name="contestId" value={selectedContest} />
                <textarea name="standingsText" rows={8} placeholder={"Full Name, username, penalty, solve vector\nAda Lovelace, ada_01, 120, [1,1,0,1,0]"} className="terminal-field clip-arena min-w-0 resize-y px-4 py-3 font-[family-name:var(--font-mono)] text-sm" />
                <Button type="submit" disabled={!selectedContest || isPending || Boolean(activeContest?.standingsFinalizedAt)}>{isPending ? "Processing..." : "Save Draft Standings"}</Button>
              </form>
              <form
                className="mt-4 grid gap-3 border-t border-white/10 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = Object.fromEntries(new FormData(event.currentTarget).entries());
                  startTransition(async () => {
                    try {
                      const response = await submitJson<CodeforcesSyncResponse>(`/api/admin/contests/${body.contestId}/sync-codeforces`, body);
                      setMessage(`Imported ${response.imported} Codeforces rows.`);
                    } catch (error) {
                      setMessage(error instanceof Error ? `${error.message} Use private upload for mashups.` : "Sync failed.");
                    }
                  });
                }}
              >
                <input type="hidden" name="contestId" value={selectedContest} />
                <Field name="standingsUrl" placeholder="https://codeforces.com/contest/1234/standings" />
                <Button type="submit" disabled={!selectedContest || isPending}><RadioTower className="size-4" /> Sync Public Contest</Button>
              </form>

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex items-center gap-3 text-[#9AFF00]">
                  <Users className="size-5" />
                  <h3 className="font-[family-name:var(--font-display)] text-sm uppercase tracking-[0.18em] text-white">Participant Standings</h3>
                </div>
                {activeContest ? <EntryEditor contestId={activeContest.id} finalized={Boolean(activeContest.standingsFinalizedAt)} entries={activeContest.entries} submitJson={submitJson} setMessage={setMessage} startTransition={startTransition} refreshContests={refreshContests} isPending={isPending} /> : <div className="mt-4"><Empty>No active contest selected.</Empty></div>}
                {activeContest && (
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    disabled={isPending || Boolean(activeContest.standingsFinalizedAt) || !activeContest.entries.length}
                    onClick={() => finalizeStandings(activeContest.id, problems, submitJson, setMessage, startTransition, refreshContests)}
                  >
                    <Save className="size-4" /> {activeContest.standingsFinalizedAt ? "Standings Finalized" : "Finalize Standings"}
                  </Button>
                )}
              </div>
            </Panel>

            <Panel id="overview" className="control-room-equal-card" icon={<Database className="size-6" />} title="Contest Overview">
              <ContestSelect contests={contestList} selectedContest={selectedContest} setSelectedContest={selectContest} />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Operation label="Entries" value={activeContest?.entries.length ?? 0} />
                <Operation label="Status" value={activeContest?.status ?? "N/A"} />
                <Operation label="Starts" value={activeContest ? formatDateUTC(activeContest.startTime) : "N/A"} />
                <Operation label="Total contest points" value={activeContest?.totalPoints ?? "N/A"} />
                <Operation label="Finalized" value={activeContest?.standingsFinalizedAt ? "YES" : "NO"} />
                <Operation label="Last updated" value={activeContest ? formatDateUTC(activeContest.updatedAt) : "N/A"} />
              </div>
            </Panel>

            <Panel id="problems" className="control-room-equal-card" icon={<ListChecks className="size-6" />} title="Problems & First Solves">
              {activeContest ? (
                <div className="mt-4 grid gap-4">
                  <ProblemEditor problems={problems} entries={activeContest.entries} setProblems={setProblems} finalized={Boolean(activeContest.standingsFinalizedAt)} />
                  <Button
                    type="button"
                    disabled={isPending || Boolean(activeContest.standingsFinalizedAt)}
                    onClick={() => saveProblems(activeContest.id, problems, submitJson, setMessage, startTransition, refreshContests)}
                  >
                    <Save className="size-4" /> Save Problems & First Solves
                  </Button>
                </div>
              ) : <Empty>Select a contest to manage first solves.</Empty>}
            </Panel>
          </div>

          <div className="control-room-row-three">
            <Panel id="actions" className="control-room-equal-card" icon={<Zap className="size-6" />} title="Quick Actions">
              <div className="mt-4 grid gap-3">
                <Button type="button" disabled={!activeContest || isPending} onClick={() => updateContestVisibility(activeContest, "PUBLIC", submitJson, setMessage, startTransition, refreshContests)}><Upload className="size-4" /> Publish Contest</Button>
                <Button type="button" variant="ghost" disabled={!activeContest || isPending} onClick={() => updateContestVisibility(activeContest, "PRIVATE", submitJson, setMessage, startTransition, refreshContests)}><X className="size-4" /> Unpublish Contest</Button>
                <Button type="button" variant="ghost" disabled={!activeContest || isPending} onClick={() => recalculateContest(activeContest?.id, submitJson, setMessage, startTransition, refreshContests)}><Database className="size-4" /> Recalculate Standings</Button>
                <Button type="button" variant="danger" disabled={!activeContest || isPending} onClick={() => deleteContest(activeContest?.id, submitJson, setMessage, startTransition, refreshContests)}><Trash2 className="size-4" /> Delete Contest</Button>
              </div>
            </Panel>

            <Panel className="control-room-equal-card" icon={<Crown className="size-6" />} title="Prize Distribution">
              <div className="mt-4 grid gap-2">
                {[["1st", 500], ["2nd", 250], ["3rd", 125], ["4th", 50], ["5th", 25]].map(([place, points]) => (
                  <div key={String(place)} className="ledger-row text-sm">
                    <span className="font-[family-name:var(--font-display)] text-[#F3C55B]">{place}</span>
                    <span className="ml-auto text-[#9AFF00]">+{points} pts</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel id="activity" className="control-room-equal-card" icon={<Activity className="size-6" />} title="Recent Activity Logs">
              <div className="mt-4 grid max-h-80 gap-2 overflow-auto pr-1">
                {activityLogs.length ? activityLogs.map((log) => (
                  <div key={log.id} className="ledger-row text-sm">
                    <span className="text-[#9AFF00]">{log.action}</span>
                    <span className="text-zinc-400">{log.entity}</span>
                    <span className="ml-auto text-xs text-zinc-500">{formatDateUTC(log.createdAt)}</span>
                  </div>
                )) : <Empty>No activity recorded.</Empty>}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudinaryUploader({ name, title, kind, ratio, contestId, initialUrl, disabled = false, onMessage }: { name: string; title: string; kind: "INVITE_POSTER" | "BANNER"; ratio: string; contestId?: string; initialUrl?: string | null; disabled?: boolean; onMessage: (message: string) => void }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const displayUrl = previewUrl || url;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function upload(file?: File) {
    setError("");
    if (disabled) return;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG, and WEBP images are allowed.");
      return onMessage("Only JPG, PNG, and WEBP images are allowed.");
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be 8MB or smaller.");
      return onMessage("Image must be 8MB or smaller.");
    }
    setLastFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (contestId) form.append("contestId", contestId);
    const request = new XMLHttpRequest();
    setUploading(true);
    setProgress(4);
    request.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => {
      setUploading(false);
      let payload: { url?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = { error: "Upload returned an unreadable response." };
      }
      if (request.status >= 200 && request.status < 300) {
        setUrl(payload.url ?? "");
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return "";
        });
        setProgress(100);
        onMessage(contestId ? `${title} uploaded and attached.` : `${title} uploaded. Save contest to persist it.`);
      } else {
        const message = payload.error ?? "Upload failed.";
        setError(message);
        onMessage(message);
      }
    };
    request.onerror = () => {
      setUploading(false);
      setError("Upload failed. Check your connection and retry.");
      onMessage("Upload failed. Check your connection and retry.");
    };
    request.open("POST", "/api/admin/uploads");
    request.send(form);
  }

  async function remove() {
    if (disabled) return;
    setUrl("");
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setProgress(0);
    setError("");
    if (!contestId) {
      onMessage(`${title} removed.`);
      return;
    }
    try {
      const response = await fetch("/api/admin/uploads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", contestId, kind }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to remove upload.");
      onMessage(`${title} removed.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to remove upload.");
      onMessage(error instanceof Error ? error.message : "Unable to remove upload.");
    }
  }

  return (
    <div className="clip-arena border border-[#9AFF00]/20 bg-black/45 p-4">
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm uppercase text-white">{title}</p>
          <p className="text-xs text-zinc-500">{ratio} / JPG, PNG, WEBP / 8MB max</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`upload-action-button cursor-pointer ${uploading || disabled ? "pointer-events-none opacity-50" : ""}`} title={`${url ? "Replace" : "Upload"} ${title}`}>
            <ImagePlus className="size-4" />
            <span>{url ? "Replace" : "Upload"}</span>
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={(event: ChangeEvent<HTMLInputElement>) => upload(event.target.files?.[0])} />
          </label>
          {error && lastFile && <button type="button" className="upload-action-button" disabled={uploading || disabled} onClick={() => upload(lastFile)}><Upload className="size-4" /><span>Retry</span></button>}
          {url && <button type="button" className="upload-action-button" disabled={uploading || disabled} onClick={remove}><X className="size-4" /><span>Remove</span></button>}
        </div>
      </div>
      <div
        className={`mt-4 flex min-h-48 items-center justify-center border border-dashed bg-black/50 p-3 text-center text-sm transition ${error ? "border-red-400/60 text-red-100" : "border-[#8E2BFF]/40 text-zinc-500"}`}
        onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          if (disabled || uploading) return;
          upload(event.dataTransfer.files?.[0]);
        }}
      >
        {displayUrl ? (
          previewUrl ? (
            <div role="img" aria-label={title} className="h-56 w-full bg-cover bg-center" style={{ backgroundImage: `url("${displayUrl}")` }} />
          ) : (
            <Image src={displayUrl} alt={title} width={640} height={420} className="max-h-56 w-full object-cover" />
          )
        ) : error || (disabled ? "Click Edit Contest to replace artwork" : "Drop artwork here or use upload")}
      </div>
      {uploading && <div className="mt-3 h-2 overflow-hidden bg-zinc-900"><div className="h-full bg-[#9AFF00]" style={{ width: `${progress}%` }} /></div>}
      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
    </div>
  );
}

function CoordinatorEditor({ coordinators, setCoordinators, disabled = false }: { coordinators: CoordinatorDraft[]; setCoordinators: (coordinators: CoordinatorDraft[]) => void; disabled?: boolean }) {
  function update(index: number, field: keyof CoordinatorDraft, value: string) {
    if (disabled) return;
    setCoordinators(coordinators.map((coordinator, itemIndex) => itemIndex === index ? { ...coordinator, [field]: value } : coordinator));
  }

  return (
    <div className="grid gap-3 border border-[#9AFF00]/15 bg-black/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-[family-name:var(--font-display)] text-sm uppercase text-white">Coordinator Editor</p>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => setCoordinators([...coordinators, { name: "", role: "", email: "", phone: "", discord: "" }])}><Plus className="size-4" /> Add</Button>
      </div>
      {coordinators.map((coordinator, index) => (
        <div key={index} className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
          <Field placeholder="Name" value={coordinator.name} disabled={disabled} onChange={(event) => update(index, "name", event.target.value)} />
          <Field placeholder="Role" value={coordinator.role} disabled={disabled} onChange={(event) => update(index, "role", event.target.value)} />
          <Field type="email" placeholder="Email (optional)" value={coordinator.email} disabled={disabled} onChange={(event) => update(index, "email", event.target.value)} />
          <Field placeholder="Phone" value={coordinator.phone} disabled={disabled} onChange={(event) => update(index, "phone", event.target.value)} />
          <Field placeholder="Discord" value={coordinator.discord} disabled={disabled} onChange={(event) => update(index, "discord", event.target.value)} />
          <Button type="button" variant="ghost" disabled={disabled} className="h-10 px-3" onClick={() => setCoordinators(coordinators.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button>
        </div>
      ))}
    </div>
  );
}

function ContestProblemSetup({ problems, setProblems, disabled }: { problems: ProblemDraft[]; setProblems: (problems: ProblemDraft[]) => void; disabled: boolean }) {
  const totalPoints = problems.reduce((sum, problem) => sum + problem.points, 0);

  return (
    <div className="grid gap-3 border border-[#9AFF00]/15 bg-black/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-[family-name:var(--font-display)] text-sm uppercase text-white">Contest Problems</p>
        <p className="font-[family-name:var(--font-display)] text-[#9AFF00]">Total Contest Points: {totalPoints}</p>
      </div>
      <div className="grid gap-2">
        {problems.map((problem, index) => (
          <div key={`${problem.code}-${index}`} className="grid gap-2 sm:grid-cols-[100px_1fr]">
            <Field value={`Problem ${problem.code}`} disabled />
            <Field
              type="number"
              min={1}
              value={problem.points}
              disabled={disabled}
              onChange={(event) => setProblems(problems.map((item, itemIndex) => itemIndex === index ? { ...item, points: Number(event.target.value) } : item))}
              placeholder="Problem points"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemEditor({ problems, entries, setProblems, finalized }: { problems: ProblemDraft[]; entries: ContestEntryView[]; setProblems: (problems: ProblemDraft[]) => void; finalized: boolean }) {
  const [solverSearch, setSolverSearch] = useState<Record<number, string>>({});

  function update(index: number, field: "code" | "title" | "points", value: string) {
    setProblems(problems.map((problem, itemIndex) => itemIndex === index ? { ...problem, [field]: field === "points" ? Number(value) : value } : problem));
  }

  function addFirstSolver(index: number, value: string) {
    const username = value.replace(/^@/, "").trim();
    if (!username) return;
    const participant = entries.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (!participant) return;
    setProblems(problems.map((problem, itemIndex) => {
      if (itemIndex !== index) return problem;
      const selected = new Set(problem.firstSolveUsernames);
      selected.add(participant.username);
      return { ...problem, firstSolveUsernames: [...selected] };
    }));
    setSolverSearch((current) => ({ ...current, [index]: "" }));
  }

  function removeFirstSolver(index: number, username: string) {
    setProblems(problems.map((problem, itemIndex) => itemIndex === index ? { ...problem, firstSolveUsernames: problem.firstSolveUsernames.filter((item) => item !== username) } : problem));
  }

  function moveProblem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= problems.length) return;
    const next = [...problems];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setProblems(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-[family-name:var(--font-display)] text-sm uppercase text-white">Problem List & First Solves</p>
        <Button type="button" variant="ghost" disabled={finalized || problems.length >= 26} onClick={() => setProblems([...problems, { code: nextProblemCode(problems.length), title: "", points: (problems.length + 1) * 100, firstSolveUsernames: [] }])}><Plus className="size-4" /> Add Problem</Button>
      </div>
      {problems.map((problem, index) => (
        <div key={index} className="grid gap-3 border border-white/10 bg-black/35 p-3">
          <div className="grid gap-2 sm:grid-cols-[80px_120px_1fr_auto]">
            <Field placeholder="A" value={problem.code} disabled={finalized} onChange={(event) => update(index, "code", event.target.value)} />
            <Field type="number" min={1} placeholder="Points" value={problem.points} disabled={finalized} onChange={(event) => update(index, "points", event.target.value)} />
            <Field placeholder="Problem title" value={problem.title} disabled={finalized} onChange={(event) => update(index, "title", event.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={finalized || index === 0} className="h-10 px-3" onClick={() => moveProblem(index, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" disabled={finalized || index === problems.length - 1} className="h-10 px-3" onClick={() => moveProblem(index, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" disabled={finalized || problems.length === 1} className="h-10 px-3" onClick={() => setProblems(problems.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button>
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">First solver(s)</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Field
                list={`first-solver-options-${index}`}
                placeholder={entries.length ? "Search contest username" : "Add participants first"}
                disabled={finalized || !entries.length}
                value={solverSearch[index] ?? ""}
                onChange={(event) => setSolverSearch((current) => ({ ...current, [index]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addFirstSolver(index, solverSearch[index] ?? "");
                  }
                }}
              />
              <datalist id={`first-solver-options-${index}`}>
                {entries
                  .filter((entry) => !problem.firstSolveUsernames.includes(entry.username))
                  .map((entry) => <option key={entry.username} value={`@${entry.username}`} />)}
              </datalist>
              <Button type="button" variant="ghost" disabled={finalized || !entries.length} onClick={() => addFirstSolver(index, solverSearch[index] ?? "")}>Assign</Button>
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-auto pr-1">
              {problem.firstSolveUsernames.length ? problem.firstSolveUsernames.map((username) => (
                <button
                  key={username}
                  type="button"
                  disabled={finalized}
                  onClick={() => removeFirstSolver(index, username)}
                  className="clip-arena border border-[#9AFF00] bg-[#9AFF00]/15 px-3 py-2 text-xs text-[#9AFF00] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  @{username}
                </button>
              )) : <p className="text-sm text-zinc-500">No first solver selected.</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EntryEditor({ contestId, finalized, entries, submitJson, setMessage, startTransition, refreshContests, isPending }: { contestId: string; finalized: boolean; entries: ContestEntryView[]; submitJson: SubmitJson; setMessage: (message: string) => void; startTransition: (callback: () => void) => void; refreshContests: (id?: string) => Promise<void>; isPending: boolean }) {
  return (
    <div className="mt-4 grid gap-3">
      <form
        className="standings-entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const body = Object.fromEntries(new FormData(event.currentTarget).entries());
          startTransition(async () => {
            try {
              await submitJson(`/api/admin/contests/${contestId}/entries`, { entries: [{ fullName: body.fullName, username: body.username, penalty: body.penalty, solveVector: body.solveVector }] });
              await refreshContests(contestId);
              form.reset();
              setMessage("Participant added and ledgers recalculated.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Unable to add participant.");
            }
          });
        }}
      >
        <Field name="fullName" placeholder="Full name" required />
        <Field name="username" placeholder="Username" required />
        <Field name="penalty" type="number" min={0} placeholder="Penalty" required />
        <Field name="solveVector" placeholder="Solve vector: [1,1,0,1]" required />
        <Button type="submit" disabled={isPending || finalized}><Plus className="size-4" /> Add Participant</Button>
      </form>
      <div className="standings-table-wrap">
        {entries.length ? (
          <table className="standings-edit-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Solve Vector</th>
                <th>Solved</th>
                <th>Solved Problems</th>
                <th>Penalty</th>
                <th>Raw Score</th>
                <th>Contest Score</th>
                <th>Prize Bonus</th>
                <th>Final Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => <EntryRow key={entry.id} contestId={contestId} finalized={finalized} entry={entry} submitJson={submitJson} setMessage={setMessage} startTransition={startTransition} refreshContests={refreshContests} isPending={isPending} />)}
            </tbody>
          </table>
        ) : <Empty>No standings rows yet.</Empty>}
      </div>
    </div>
  );
}

function EntryRow({ contestId, finalized, entry, submitJson, setMessage, startTransition, refreshContests, isPending }: { contestId: string; finalized: boolean; entry: ContestEntryView; submitJson: SubmitJson; setMessage: (message: string) => void; startTransition: (callback: () => void) => void; refreshContests: (id?: string) => Promise<void>; isPending: boolean }) {
  const [fullName, setFullName] = useState(entry.fullName);
  const [username, setUsername] = useState(entry.username);
  const [solveVector, setSolveVector] = useState(JSON.stringify(entry.solveVector));
  const [penalty, setPenalty] = useState(String(entry.penalty));

  function saveRow() {
    startTransition(async () => {
      try {
        await submitJson(`/api/admin/contests/${contestId}/entries`, { standingId: entry.id, fullName, username, solveVector, penalty }, "PATCH");
        await refreshContests(contestId);
        setMessage("Participant updated. Ranks and scores recalculated.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update participant.");
      }
    });
  }

  return (
    <tr>
      <td className="font-[family-name:var(--font-display)] text-[#9AFF00]">#{entry.rank}</td>
      <td><Field value={fullName} disabled={finalized} onChange={(event) => setFullName(event.target.value)} /></td>
      <td><Field value={username} disabled={finalized} onChange={(event) => setUsername(event.target.value)} /></td>
      <td><Field value={solveVector} disabled={finalized} onChange={(event) => setSolveVector(event.target.value)} /></td>
      <td>{entry.solved}</td>
      <td>{entry.solvedProblems.join(", ") || "None"}</td>
      <td><Field type="number" min={0} value={penalty} disabled={finalized} onChange={(event) => setPenalty(event.target.value)} /></td>
      <td>{entry.rawScore}</td>
      <td>{entry.contestScore}</td>
      <td className="text-[#F3C55B]">+{entry.bonusPoints}</td>
      <td className="font-[family-name:var(--font-display)] text-[#9AFF00]">{entry.finalScore}</td>
      <td>
        <div className="flex gap-2">
          <Button type="button" disabled={isPending || finalized} className="h-10 px-3" onClick={saveRow}><FilePenLine className="size-4" /></Button>
          <Button type="button" className="h-10 px-3" variant="ghost" onClick={() => startTransition(async () => {
          try {
            await submitJson(`/api/admin/contests/${contestId}/entries`, { standingId: entry.id }, "DELETE");
            await refreshContests(contestId);
            setMessage("Participant deleted. Ranks and scores recalculated.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to delete participant.");
          }
          })} disabled={isPending || finalized}><Trash2 className="size-4" /></Button>
        </div>
      </td>
    </tr>
  );
}

function Panel({ icon, title, children, className, id }: { icon: ReactNode; title: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("certificate-frame clip-arena p-5", className)}>
      <div className="flex items-center gap-3 text-[#9AFF00]">{icon}<h2 className="section-rune font-[family-name:var(--font-display)] text-lg uppercase text-white">{title}</h2></div>
      {children}
    </section>
  );
}

function Field({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} autoComplete="off" className={cn("terminal-field clip-arena min-w-0 px-4 py-3 font-[family-name:var(--font-mono)] text-sm", className)} />;
}

function ContestSelect({ contests, selectedContest, setSelectedContest, compact = false }: { contests: ContestView[]; selectedContest: string; setSelectedContest: (id: string) => void; compact?: boolean }) {
  return (
    <select value={selectedContest} onChange={(event) => setSelectedContest(event.target.value)} className={cn("terminal-field clip-arena w-full px-4 py-3 font-[family-name:var(--font-mono)] text-sm", !compact && "mt-5")}>
      <option value="">Create a new contest</option>
      {contests.map((contest) => <option key={contest.id} value={contest.id}>{contest.title}</option>)}
    </select>
  );
}

function Operation({ label, value }: { label: string; value: ReactNode }) {
  return <div className="clip-arena border border-[#c0c0c0]/15 bg-black/50 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p><p className="font-[family-name:var(--font-display)] text-xl text-white">{value}</p></div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-plaque clip-arena p-5 text-center text-zinc-400">{children}</div>;
}

function toLocalInput(value?: string) {
  if (!value) return "";
  return value.slice(0, 16);
}

function deleteContest(id: string | undefined, submitJson: SubmitJson, setMessage: (message: string) => void, startTransition: (callback: () => void) => void, refreshContests: (id?: string) => Promise<void>) {
  if (!id || !window.confirm("Delete this contest and its standings?")) return;
  startTransition(async () => {
    try {
      await submitJson(`/api/admin/contests/${id}`, {}, "DELETE");
      await refreshContests("");
      setMessage("Contest deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  });
}

function finalizeStandings(id: string, problems: ProblemDraft[], submitJson: SubmitJson, setMessage: (message: string) => void, startTransition: (callback: () => void) => void, refreshContests: (id?: string) => Promise<void>) {
  if (!window.confirm("Have all participants been entered?")) return;
  startTransition(async () => {
    try {
      const payloadProblems = problems
        .filter((problem) => problem.code.trim())
        .map((problem) => ({
          code: problem.code.trim(),
          title: problem.title.trim(),
          points: problem.points,
          firstSolveUsernames: problem.firstSolveUsernames,
        }));
      const response = await submitJson<FinalizeStandingsResponse>(`/api/admin/contests/${id}/entries`, { action: "finalize", problems: payloadProblems }, "PATCH");
      await refreshContests(id);
      setMessage(response.finalized ? `Finalized ${response.rows ?? 0} standings rows and rebuilt all ledgers.` : "Standings were already finalized. Ledgers are protected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Finalization failed.");
    }
  });
}

function saveProblems(id: string, problems: ProblemDraft[], submitJson: SubmitJson, setMessage: (message: string) => void, startTransition: (callback: () => void) => void, refreshContests: (id?: string) => Promise<void>) {
  startTransition(async () => {
    try {
      const payloadProblems = problems
        .filter((problem) => problem.code.trim())
        .map((problem) => ({
          code: problem.code.trim(),
          title: problem.title.trim(),
          points: problem.points,
          firstSolveUsernames: problem.firstSolveUsernames,
        }));
      await submitJson(`/api/admin/contests/${id}/entries`, { action: "saveProblems", problems: payloadProblems }, "PATCH");
      await refreshContests(id);
      setMessage("Problem points and first solves saved. Contest scores were recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save first solves.");
    }
  });
}

function contestPayload(contest: ContestView, overrides: Partial<ContestView> = {}) {
  const next = { ...contest, ...overrides };
  return {
    title: next.title,
    description: next.description,
    invitePoster: next.invitePoster ?? "",
    bannerPoster: next.bannerPoster ?? "",
    contestBanner: next.contestBanner ?? "",
    platform: next.platform,
    contestLink: next.contestLink ?? "",
    startTime: next.startTime,
    duration: next.duration,
    visibility: next.visibility,
    scoringSystem: next.scoringSystem,
    prizePool: next.prizePool ?? "",
    coordinators: next.coordinators.map(({ name, role, email, phone, discord }: ContestCoordinatorView) => ({ name, role, email, phone, discord })),
  };
}

function updateContestVisibility(contest: ContestView | undefined, visibility: ContestView["visibility"], submitJson: SubmitJson, setMessage: (message: string) => void, startTransition: (callback: () => void) => void, refreshContests: (id?: string) => Promise<void>) {
  if (!contest) return;
  startTransition(async () => {
    try {
      await submitJson(`/api/admin/contests/${contest.id}`, contestPayload(contest, { visibility }), "PATCH");
      await refreshContests(contest.id);
      setMessage(visibility === "PUBLIC" ? "Contest published." : "Contest unpublished and hidden from public lists.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update contest visibility.");
    }
  });
}

function recalculateContest(id: string | undefined, submitJson: SubmitJson, setMessage: (message: string) => void, startTransition: (callback: () => void) => void, refreshContests: (id?: string) => Promise<void>) {
  if (!id) return;
  startTransition(async () => {
    try {
      await submitJson(`/api/admin/contests/${id}/entries`, { action: "recalculate" }, "PATCH");
      await refreshContests(id);
      setMessage("Standings, player stats, and leaderboard ledgers recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to recalculate standings.");
    }
  });
}

function nextProblemCode(index: number) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function setProblemCount(count: number, problems: ProblemDraft[], setProblems: (problems: ProblemDraft[]) => void) {
  const nextCount = Math.min(26, Math.max(1, count || 1));
  if (nextCount <= problems.length) {
    setProblems(problems.slice(0, nextCount));
    return;
  }
  setProblems([
    ...problems,
    ...Array.from({ length: nextCount - problems.length }, (_, index) => {
      const problemIndex = problems.length + index;
      return { code: nextProblemCode(problemIndex), title: "", points: (problemIndex + 1) * 100, firstSolveUsernames: [] };
    }),
  ]);
}
