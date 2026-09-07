"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Comment } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Avatar, Button, Textarea } from "./ui";
import { MessageIcon } from "./icons";

/**
 * Comments on a session.
 *
 * Bodies are rendered as plain text — React escapes them — and nothing here
 * interprets markup, so a comment cannot inject anything into the page.
 */
export function CommentThread({
  slug,
  initialComments,
  signedIn,
  currentUserId,
}: {
  slug: string;
  initialComments: Comment[];
  signedIn: boolean;
  currentUserId?: string;
}) {
  const [comments, setComments] = useState(initialComments);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  function addComment(comment: Comment) {
    setComments((current) => {
      if (!comment.parentId) return [comment, ...current];
      return current.map((parent) =>
        parent.id === comment.parentId
          ? { ...parent, replies: [...(parent.replies ?? []), comment], replyCount: parent.replyCount + 1 }
          : parent,
      );
    });
    setReplyTo(null);
  }

  async function remove(id: string, parentId?: string) {
    await api(`/v1/comments/${id}`, { method: "DELETE" });
    setComments((current) =>
      parentId
        ? current.map((parent) =>
            parent.id === parentId
              ? { ...parent, replies: (parent.replies ?? []).filter((r) => r.id !== id) }
              : parent,
          )
        : current.filter((comment) => comment.id !== id),
    );
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-10">
      <h2 id="comments-heading" className="text-[17px] font-semibold">
        {comments.length > 0 ? `${comments.length} comments` : "Comments"}
      </h2>

      {signedIn ? (
        <CommentForm slug={slug} onPosted={addComment} className="mt-5" />
      ) : (
        <p className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-sm text-fg-muted">
          <Link href="/login" className="font-medium text-fg underline underline-offset-4">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-fg-subtle">
          <MessageIcon size={16} />
          No comments yet. Be the first to say something useful.
        </p>
      ) : (
        <ul className="mt-8 space-y-7">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                canDelete={comment.author.id === currentUserId}
                onDelete={() => remove(comment.id)}
                onReply={signedIn ? () => setReplyTo(replyTo === comment.id ? null : comment.id) : undefined}
              />

              {replyTo === comment.id ? (
                <CommentForm
                  slug={slug}
                  parentId={comment.id}
                  className="ml-11 mt-3"
                  autoFocus
                  onPosted={addComment}
                  onCancel={() => setReplyTo(null)}
                />
              ) : null}

              {comment.replies && comment.replies.length > 0 ? (
                <ul className="ml-11 mt-5 space-y-5 border-l border-border pl-5">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        canDelete={reply.author.id === currentUserId}
                        onDelete={() => remove(reply.id, comment.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  onReply,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
}) {
  return (
    <article className="flex gap-3">
      <Link href={`/creator/${comment.author.handle}`} className="shrink-0">
        <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <Link href={`/creator/${comment.author.handle}`} className="font-medium hover:text-accent">
            {comment.author.displayName}
          </Link>
          <span className="text-fg-subtle">{timeAgo(comment.createdAt)}</span>
          {comment.editedAt ? <span className="text-fg-subtle">edited</span> : null}
        </p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-fg">{comment.body}</p>
        <div className="mt-2 flex items-center gap-4 text-[12px] text-fg-subtle">
          {onReply ? (
            <button type="button" onClick={onReply} className="hover:text-fg">
              Reply
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" onClick={onDelete} className="hover:text-danger">
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CommentForm({
  slug,
  parentId,
  onPosted,
  onCancel,
  className,
  autoFocus,
}: {
  slug: string;
  parentId?: string;
  onPosted: (comment: Comment) => void;
  onCancel?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await api<Comment>(`/v1/videos/${slug}/comments`, {
        body: { body: body.trim(), parentId: parentId ?? "" },
      });
      setBody("");
      onPosted(comment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That comment could not be posted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className}>
      <Textarea
        value={body}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        autoFocus={autoFocus}
        onChange={(event) => setBody(event.target.value)}
        placeholder={parentId ? "Write a reply" : "Add a comment"}
        aria-label={parentId ? "Write a reply" : "Add a comment"}
      />
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
          {parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
