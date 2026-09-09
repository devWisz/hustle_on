"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Textarea, Badge } from "@/components/ui";
import {
  UploadIcon,
  CheckIcon,
  ShieldIcon,
  WalletIcon,
  ArrowRightIcon,
} from "@/components/icons";

type Step = 1 | 2 | 3 | 4;

interface VerificationSubmission {
  id: string;
  title: string;
  category: string;
  realWorkHours: number;
  timelapseMinutes: number;
  speedRatio: number;
  gitRepoUrl: string;
  gitCommit: string;
  deliverableUrl: string;
  tags: string[];
  payoutWallet: string;
  estimatedBountySol: number;
  submittedAt: string;
}

const CATEGORIES = [
  "Software & Systems Engineering",
  "Smart Contracts & Solana / Anchor",
  "Fullstack Web & APIs",
  "UI/UX Product Design & Figma",
  "3D Modeling, Blender & Game Dev",
  "AI Pipelines & Data Engineering",
  "DevOps & Infrastructure",
  "Hardware & Electronics",
];

export function CreatorUploadStepper({ userWallet }: { userWallet?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{ duration: string; sizeMb: string } | null>(null);

  // Step 2: Proof of Work
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0] || "Software & Systems Engineering");
  const [description, setDescription] = useState("");
  const [realHours, setRealHours] = useState("5.5");
  const [speedMultiplier, setSpeedMultiplier] = useState("45");
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [gitCommit, setGitCommit] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [tags, setTags] = useState("solana, rust, nextjs");

  // Step 3: Payout & Monetization
  const [payoutWallet, setPayoutWallet] = useState(
    userWallet || "7vW8aG9Zp8x9K7M2e4qX2K8yG4pZ5Y7hN8kM9qX2K8yG"
  );
  const [applyBounty, setApplyBounty] = useState(true);
  const [enableLicensing, setEnableLicensing] = useState(true);
  const [licensePriceUsd, setLicensePriceUsd] = useState("49");

  // Step 4: Verification Checklist
  const [checkScreenActivity, setCheckScreenActivity] = useState(false);
  const [checkProofMatches, setCheckProofMatches] = useState(false);
  const [checkNoSecrets, setCheckNoSecrets] = useState(false);
  const [checkTerms, setCheckTerms] = useState(false);

  // Submission Progress
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<VerificationSubmission | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(1);
    setFileMeta({ duration: "3m 42s", sizeMb: `${sizeMb} MB` });
    if (!title) {
      const suggestedTitle = selectedFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setTitle(suggestedTitle);
    }
  };

  const calculateBountyEst = () => {
    const hrs = parseFloat(realHours) || 0;
    if (hrs >= 8) return 1.75;
    if (hrs >= 4) return 1.0;
    if (hrs >= 2) return 0.5;
    return 0.25;
  };

  const canProceedStep1 = Boolean(file);
  const canProceedStep2 = Boolean(title.trim() && description.trim() && parseFloat(realHours) > 0);
  const canProceedStep3 = Boolean(payoutWallet.trim().length >= 32);
  const canProceedStep4 = checkScreenActivity && checkProofMatches && checkNoSecrets && checkTerms;

  const handleSubmitForVerification = async () => {
    setIsSubmitting(true);
    setUploadProgress(15);

    const timer1 = setTimeout(() => setUploadProgress(50), 400);
    const timer2 = setTimeout(() => setUploadProgress(85), 900);
    const timer3 = setTimeout(() => {
      setUploadProgress(100);
      setIsSubmitting(false);
      const generatedId = `SUB-${Math.floor(100000 + Math.random() * 900000)}`;
      const result: VerificationSubmission = {
        id: generatedId,
        title,
        category: category || "Software & Systems Engineering",
        realWorkHours: parseFloat(realHours),
        timelapseMinutes: 4,
        speedRatio: parseInt(speedMultiplier, 10) || 45,
        gitRepoUrl,
        gitCommit,
        deliverableUrl,
        tags: tags.split(",").map((t) => t.trim()),
        payoutWallet,
        estimatedBountySol: calculateBountyEst(),
        submittedAt: new Date().toISOString(),
      };
      setSubmissionResult(result);
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  if (submissionResult) {
    return (
      <Card className="p-8 sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CheckIcon size={24} />
        </div>
        <div className="mt-5 text-center">
          <Badge tone="accent">Queued for Manual Review</Badge>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-fg">
            Timelapse submitted for verification
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted leading-relaxed">
            Your recording is in the admin verification queue. Once verified by a moderator against
            your proof links, it will be listed in the public catalog and your bounty will disburse.
          </p>
        </div>

        {/* Verification Tracking Card */}
        <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-surface-raised p-5 text-[13px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-fg-subtle">Tracking ID:</span>
              <p className="font-mono font-semibold text-fg">{submissionResult.id}</p>
            </div>
            <div>
              <span className="text-fg-subtle">Estimated Review Time:</span>
              <p className="font-medium text-fg">~2 to 4 hours</p>
            </div>
            <div>
              <span className="text-fg-subtle">Session Duration:</span>
              <p className="font-medium text-fg">
                {submissionResult.realWorkHours}h work · {submissionResult.speedRatio}x speed
              </p>
            </div>
            <div>
              <span className="text-fg-subtle">Verified Bounty Target:</span>
              <p className="font-mono font-semibold text-accent">
                {submissionResult.estimatedBountySol} SOL (~$
                {(submissionResult.estimatedBountySol * 150).toFixed(0)} USD)
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-fg-subtle">Payout Destination:</span>
              <p className="font-mono text-[12px] truncate text-fg-muted">
                {submissionResult.payoutWallet}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/creator/submissions"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
          >
            Track in Creator Studio
            <ArrowRightIcon size={16} />
          </Link>
          <Link
            href="/creator/how-to-earn"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-5 py-2.5 text-sm font-medium text-fg hover:bg-surface-raised"
          >
            View Bounty Structure
          </Link>
          <button
            onClick={() => {
              setSubmissionResult(null);
              setCurrentStep(1);
              setFile(null);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-medium text-fg-muted hover:text-fg"
          >
            Upload Another
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper Navigation */}
      <div className="grid grid-cols-4 gap-2 border-b border-border pb-4 text-left">
        {[
          { num: 1, label: "Timelapse File" },
          { num: 2, label: "Proof & Stack" },
          { num: 3, label: "Payout Setup" },
          { num: 4, label: "Verify & Submit" },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => {
              if (s.num < currentStep) setCurrentStep(s.num as Step);
            }}
            disabled={s.num > currentStep}
            className={`group flex flex-col transition-colors ${
              s.num === currentStep
                ? "text-accent"
                : s.num < currentStep
                ? "text-fg hover:text-accent cursor-pointer"
                : "text-fg-subtle cursor-not-allowed"
            }`}
          >
            <span className="font-mono text-[11px] font-semibold">
              STEP 0{s.num} {s.num < currentStep ? "✓" : ""}
            </span>
            <span className="text-[13px] font-medium hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: Video File Upload */}
      {currentStep === 1 && (
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">Upload Timelapse Recording</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Select your compressed work session. We accept MP4, MOV, WebM, or MKV up to 2 GB.
            </p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed border-border bg-surface-raised px-6 py-12 text-center transition-colors hover:border-accent"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border text-accent mb-3">
              <UploadIcon size={24} />
            </div>
            {file ? (
              <div>
                <p className="font-medium text-sm text-fg">{file.name}</p>
                <p className="text-[12px] text-fg-subtle mt-1">
                  {fileMeta?.sizeMb} · Ready for verification
                </p>
                <span className="mt-3 inline-block rounded border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-accent">
                  Change file
                </span>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-fg">Drop your timelapse video here, or click to browse</p>
                <p className="mt-1 text-[12px] text-fg-subtle">
                  Recommended: 1080p or 4K · 30fps to 60fps · Speed ratio 20x to 60x
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              className="sr-only"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Quick Speed Recommendation info box */}
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 text-[13px]">
            <div className="flex items-center gap-2 font-medium text-fg">
              <ShieldIcon size={16} className="text-accent" />
              <span>Timelapse Speed Standard for Verified Payouts</span>
            </div>
            <p className="mt-1 text-fg-muted text-[12px] leading-relaxed">
              To qualify for the Verified Builder bounty, sessions must reflect genuine, continuous
              keyboard & screen activity. Typical recommended ratio is 30x–60x (e.g., a 4-hour build
              compresses to 4–8 minutes).
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={!canProceedStep1}
              onClick={() => setCurrentStep(2)}
            >
              Continue to Proof & Stack
              <ArrowRightIcon size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Proof & Stack */}
      {currentStep === 2 && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">Session Details & Verifiable Proof</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Moderators review your proof artifacts (Git commits, PRs, or design files) to approve your listing.
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-fg mb-1.5">Session Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Building an On-Chain Escrow Engine in Rust"
              maxLength={120}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[13px] font-medium text-fg mb-1.5">Primary Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-fg"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[13px] font-medium text-fg mb-1.5">
                  Real Hours
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={realHours}
                  onChange={(e) => setRealHours(e.target.value)}
                  placeholder="5.5"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-fg mb-1.5">
                  Speed Ratio
                </label>
                <Input
                  type="number"
                  step="5"
                  min="10"
                  max="120"
                  value={speedMultiplier}
                  onChange={(e) => setSpeedMultiplier(e.target.value)}
                  placeholder="45"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-fg mb-1.5">
              Summary of Work Accomplished
            </label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What problem were you solving? What architecture decisions or complex bugs did you tackle?"
              required
            />
          </div>

          {/* Verifiable VCS Artifacts */}
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised p-4 space-y-3">
            <p className="text-[13px] font-semibold text-fg flex items-center gap-1.5">
              <span>Proof-of-Work Verification Links</span>
              <span className="text-[11px] text-fg-subtle font-normal">(Required for bounty approval)</span>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[12px] text-fg-muted mb-1">GitHub / GitLab Repo or PR URL</label>
                <Input
                  value={gitRepoUrl}
                  onChange={(e) => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo/pull/12"
                />
              </div>
              <div>
                <label className="block text-[12px] text-fg-muted mb-1">Git Commit SHA (Optional)</label>
                <Input
                  value={gitCommit}
                  onChange={(e) => setGitCommit(e.target.value)}
                  placeholder="e.g. 7f83b2a"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] text-fg-muted mb-1">Live Demo, Staging, or Figma URL</label>
              <Input
                value={deliverableUrl}
                onChange={(e) => setDeliverableUrl(e.target.value)}
                placeholder="https://app.preview.dev or https://figma.com/file/..."
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-fg mb-1.5">
              Tools & Stack (Comma separated)
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Rust, Solana, Anchor, TypeScript, Tailwind"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setCurrentStep(1)}>
              Back
            </Button>
            <Button disabled={!canProceedStep2} onClick={() => setCurrentStep(3)}>
              Continue to Payout Setup
              <ArrowRightIcon size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Payout Setup */}
      {currentStep === 3 && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">Monetization & Payout Preferences</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Configure how you get paid when moderators verify and approve your session.
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-semibold text-sm text-fg">Verified Builder Bounty</span>
                <p className="text-[12px] text-fg-muted mt-0.5">
                  Platform fund payout for publishing authenticated proof of work.
                </p>
              </div>
              <span className="font-mono font-bold text-sm text-accent">
                ~{calculateBountyEst()} SOL
              </span>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={applyBounty}
                onChange={(e) => setApplyBounty(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
              />
              <span>Claim verification bounty upon approval</span>
            </label>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-fg mb-1.5">
              Payout Destination Wallet (Solana Address)
            </label>
            <div className="relative">
              <Input
                value={payoutWallet}
                onChange={(e) => setPayoutWallet(e.target.value)}
                placeholder="Solana public key (e.g. 7vW8aG9Z...)"
                required
                className="font-mono text-xs pl-8"
              />
              <WalletIcon size={15} className="absolute left-2.5 top-3 text-fg-subtle" />
            </div>
            <p className="mt-1 text-[11px] text-fg-subtle">
              Funds settle directly via on-chain Anchor program. Non-custodial, no middleman fees.
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-fg">Commercial Footage Licensing</p>
                <p className="text-[12px] text-fg-muted">
                  Allow agencies & tech studios to license your high-res timelapse for marketing.
                </p>
              </div>
              <input
                type="checkbox"
                checked={enableLicensing}
                onChange={(e) => setEnableLicensing(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent"
              />
            </div>
            {enableLicensing && (
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-fg-muted">License fee:</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-fg-subtle">$</span>
                  <Input
                    type="number"
                    value={licensePriceUsd}
                    onChange={(e) => setLicensePriceUsd(e.target.value)}
                    className="w-24 h-8 text-xs"
                  />
                  <span className="text-xs text-fg-subtle">USD (paid in SOL equivalent)</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setCurrentStep(2)}>
              Back
            </Button>
            <Button disabled={!canProceedStep3} onClick={() => setCurrentStep(4)}>
              Review & Verification Checklist
              <ArrowRightIcon size={16} />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Compliance & Submission */}
      {currentStep === 4 && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">Verification Declarations & Submit</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Confirm that your submission complies with platform quality and authenticity standards.
            </p>
          </div>

          {/* Summary Preview */}
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised p-4 text-[13px] space-y-2">
            <div className="flex justify-between">
              <span className="text-fg-subtle">Session:</span>
              <span className="font-medium text-fg">{title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-subtle">Category & Hours:</span>
              <span className="font-medium text-fg">
                {category} · {realHours}h real work
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-subtle">Proof Link:</span>
              <span className="font-mono text-xs text-accent truncate max-w-xs">
                {gitRepoUrl || deliverableUrl || "Attached during review"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-subtle">Target Payout:</span>
              <span className="font-mono font-semibold text-accent">
                {calculateBountyEst()} SOL + Sponsorships
              </span>
            </div>
          </div>

          {/* Strict Checklist */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-2.5 text-[13px] text-fg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={checkScreenActivity}
                onChange={(e) => setCheckScreenActivity(e.target.checked)}
                className="mt-0.5 rounded border-border text-accent focus:ring-accent"
              />
              <span>
                <strong>Authentic Continuous Recording:</strong> This timelapse captures actual
                work produced without artificial pauses, simulated loops, or pre-recorded repeats.
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-[13px] text-fg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={checkProofMatches}
                onChange={(e) => setCheckProofMatches(e.target.checked)}
                className="mt-0.5 rounded border-border text-accent focus:ring-accent"
              />
              <span>
                <strong>Proof Consistency:</strong> The code, diagrams, or assets shown match the
                provided Git repository, PR, or deliverable URLs.
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-[13px] text-fg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={checkNoSecrets}
                onChange={(e) => setCheckNoSecrets(e.target.checked)}
                className="mt-0.5 rounded border-border text-accent focus:ring-accent"
              />
              <span>
                <strong>Credential Sanitization:</strong> I have confirmed that no private keys,
                seed phrases, API secrets, or proprietary confidential data are exposed.
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-[13px] text-fg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={checkTerms}
                onChange={(e) => setCheckTerms(e.target.checked)}
                className="mt-0.5 rounded border-border text-accent focus:ring-accent"
              />
              <span>
                <strong>Submission & Verification Terms:</strong> I understand moderators review
                each submission manually before public catalog listing and bounty disbursement.
              </span>
            </label>
          </div>

          {/* Progress Bar during submission */}
          {isSubmitting && (
            <div className="pt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-center text-xs text-fg-muted font-mono">
                Uploading to decentralized storage & dispatching to review queue... {uploadProgress}%
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="secondary" disabled={isSubmitting} onClick={() => setCurrentStep(3)}>
              Back
            </Button>
            <Button
              disabled={!canProceedStep4 || isSubmitting}
              loading={isSubmitting}
              onClick={handleSubmitForVerification}
            >
              Submit to Manual Verification Queue
              <ArrowRightIcon size={16} />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
