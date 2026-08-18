"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  listCommentsForSlug,
  postComment,
  reportComment,
} from "@/app/actions/comments";
import { getStoredSession, UserSession, slugify } from "@/app/data";

type CommentRow = Awaited<ReturnType<typeof listCommentsForSlug>>[number];

export default function ProductComments({
  productSlug,
  productName,
  makerName,
  makerHandle,
  initialComments,
}: {
  productSlug: string;
  productName: string;
  makerName?: string;
  makerHandle?: string;
  initialComments?: CommentRow[];
}) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [comments, setComments] = useState<CommentRow[]>(initialComments || []);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = React.useCallback(async () => {
    try {
      setComments(await listCommentsForSlug(productSlug));
    } catch {
      // product not in DB yet (dev seed) — keep the empty state
    }
  }, [productSlug]);

  useEffect(() => {
    setSession(getStoredSession());
    if (!initialComments) {
      void refresh();
    }
    const onAuth = () => setSession(getStoredSession());
    window.addEventListener("authChanged", onAuth);
    return () => window.removeEventListener("authChanged", onAuth);
  }, [refresh]);

  const cleanMakerHandle = makerHandle?.replace(/^@/, "").toLowerCase();
  const isFounder =
    !!session &&
    !!cleanMakerHandle &&
    session.handle.replace(/^@/, "").toLowerCase() === cleanMakerHandle;

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  const post = (parentId?: string) => {
    if (!session) return;
    const text = (parentId ? replyBody : body).trim();
    if (!text) return;
    startTransition(async () => {
      try {
        await postComment({ productSlug, body: text, parentId });
        if (parentId) {
          setReplyBody("");
          setReplyTo(null);
        } else {
          setBody("");
        }
        await refresh();
      } catch (e) {
        setFlash(String((e as Error).message));
        setTimeout(() => setFlash(null), 3000);
      }
    });
  };

  const flag = (c: CommentRow) => {
    if (!session) return;
    startTransition(async () => {
      await reportComment(c.id, "reported");
      setFlash(`Reported comment by ${c.userName}. Moderators will review.`);
      setTimeout(() => setFlash(null), 3000);
      await refresh();
    });
  };

  return (
    <section className="border border-hairline bg-surface/30 mt-8 font-mono" id="comments">
      <div className="border-b border-hairline px-4 py-3 sm:px-6 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs uppercase font-bold text-ink flex items-center gap-2">
          <span>Community Discussion</span>
          <span className="px-2 py-0.5 text-[10px] bg-void border border-hairline text-ink-dim">
            {comments.length}
          </span>
        </div>
        <div className="text-[10px] uppercase text-ink-dim font-bold flex items-center gap-1.5">
          {isFounder ? (
            <span className="text-signal border border-signal/40 bg-void px-2 py-0.5 inline-flex items-center gap-1.5 font-bold">
              <svg
                className="w-3 h-3 text-signal shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>Founder View</span>
            </span>
          ) : session ? (
            <span>Signed in as @{session.handle.replace(/^@/, "")}</span>
          ) : (
            <span>Read-only</span>
          )}
        </div>
      </div>

      {flash && (
        <div className="border-b border-hairline px-4 py-2 text-xs text-signal bg-void">
          {flash}
        </div>
      )}

      <ul className="divide-y divide-hairline">
        {roots.map((c) => {
          const replies = repliesOf(c.id);
          const isOwn = !!session && c.userEmail === session.email;
          return (
            <li key={c.id} className="p-4 sm:p-5 space-y-3">
              <CommentRow
                c={c}
                makerHandle={makerHandle}
                canFlag={!!session && !isOwn && !c.isFlagged}
                onFlag={() => flag(c)}
                flagged={c.isFlagged}
              />
              {isFounder && !isOwn && (
                <div className="mt-2 pl-4 sm:pl-6">
                  {replyTo === c.id ? (
                    <div className="space-y-2 border border-hairline bg-void p-3">
                      <div className="text-[10px] uppercase text-signal font-bold flex items-center gap-1">
                        <span>Replying as Founder</span>
                      </div>
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={2}
                        placeholder="Reply as founder…"
                        className="w-full p-2 text-xs font-mono bg-surface border border-hairline focus:outline-none focus:border-signal text-ink"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(null);
                            setReplyBody("");
                          }}
                          className="text-[10px] uppercase font-bold px-2.5 py-1 border border-hairline text-ink-dim hover:text-ink cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => post(c.id)}
                          disabled={!replyBody.trim() || pending}
                          className="text-[10px] uppercase font-bold px-3 py-1 bg-signal text-void hover:bg-signal/90 disabled:opacity-30 cursor-pointer"
                        >
                          Post Reply →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(c.id);
                        setReplyBody("");
                      }}
                      className="text-[10px] uppercase font-bold text-ink-dim hover:text-signal cursor-pointer flex items-center gap-1"
                    >
                      <span>↩ Reply as founder</span>
                    </button>
                  )}
                </div>
              )}
              {replies.length > 0 && (
                <ul className="mt-3 pl-3 sm:pl-6 border-l-2 border-hairline space-y-3">
                  {replies.map((r) => {
                    const rIsOwn = !!session && r.userEmail === session.email;
                    return (
                      <li key={r.id} className="pl-2 sm:pl-3">
                        <CommentRow
                          c={r}
                          makerHandle={makerHandle}
                          reply
                          canFlag={!!session && !rIsOwn && !r.isFlagged}
                          onFlag={() => flag(r)}
                          flagged={r.isFlagged}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
        {roots.length === 0 && (
          <li className="px-4 py-8 text-center text-xs text-ink-dim">
            No comments yet on {productName}. Be the first to share your thoughts.
          </li>
        )}
      </ul>

      {/* Post Comment Box */}
      <div className="border-t border-hairline p-4 sm:p-6 bg-surface/50">
        {session ? (
          <div className="space-y-3">
            <div className="text-[11px] uppercase text-ink-dim flex items-center gap-2 flex-wrap">
              <span>Posting as <strong className="text-ink">{session.name}</strong> ({session.handle})</span>
              {isFounder && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase bg-signal text-void rounded-xs">
                  <svg
                    className="w-2.5 h-2.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <span>Founder</span>
                </span>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={`Ask a question or leave feedback for ${productName}…`}
              className="w-full p-3 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal text-ink leading-relaxed placeholder:text-ink-faint"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] text-ink-faint">
                Markdown styling supported. Keep discussion respectful.
              </span>
              <button
                type="button"
                onClick={() => post()}
                disabled={!body.trim() || pending}
                className="text-xs uppercase font-bold px-4 py-2 bg-ink text-void hover:bg-ink-dim transition-colors disabled:opacity-30 cursor-pointer"
              >
                Post Comment →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-ink-dim">
            <Link
              href={`/handler/sign-in?after_auth_return_to=/product/${slugify(productName)}`}
              className="text-ink font-bold underline underline-offset-2 hover:text-signal"
            >
              Sign in
            </Link>{" "}
            to join the discussion and ask the founder questions.
          </div>
        )}
      </div>
    </section>
  );
}

function CommentRow({
  c,
  reply,
  canFlag,
  onFlag,
  flagged,
  makerHandle,
}: {
  c: CommentRow;
  reply?: boolean;
  canFlag: boolean;
  onFlag: () => void;
  flagged: boolean;
  makerHandle?: string;
}) {
  const cleanMaker = makerHandle?.replace(/^@/, "").toLowerCase();
  const isCommentFounder =
    c.isFounder ||
    (Boolean(cleanMaker) &&
      (c.userHandle?.toLowerCase().replace(/^@/, "") === cleanMaker ||
       c.userName?.toLowerCase() === cleanMaker));

  return (
    <div className={`font-mono space-y-1.5 ${isCommentFounder ? "border-l-2 border-signal pl-3 sm:pl-4 py-1 bg-signal/[0.03]" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Link
            href={`/founder/${slugify(c.userHandle?.replace(/^@/, "") || c.userName)}`}
            className="font-bold text-ink hover:underline hover:text-signal transition-colors flex items-center gap-1.5"
          >
            {c.userImage ? (
              <img width="64" height="64"
                src={c.userImage}
                alt={c.userName}
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-surface border border-hairline flex items-center justify-center text-[9px] font-bold shrink-0">
                {c.userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{c.userName}</span>
          </Link>
          <span className="text-[11px] text-ink-dim">{c.userHandle}</span>

          {/* Distinctive Founder Tag */}
          {isCommentFounder && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-signal text-void rounded-xs shadow-xs">
              <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <span>Founder</span>
            </span>
          )}

          {reply && (
            <span className="text-[9px] font-mono uppercase text-ink-dim px-1.5 py-0.2 border border-hairline">
              reply
            </span>
          )}

          {flagged && (
            <span className="text-[9px] uppercase font-bold text-signal border border-signal px-1 py-0.5">
              REPORTED
            </span>
          )}
        </div>
        <div className="text-[10px] text-ink-faint tabular-nums">
          {c.createdAt.toString().replace("T", " ").slice(0, 16)}
        </div>
      </div>
      <div className="text-xs text-ink whitespace-pre-wrap leading-relaxed">
        {c.body}
      </div>
      {canFlag && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={onFlag}
            className="text-[10px] uppercase text-ink-faint hover:text-signal cursor-pointer transition-colors"
          >
            ⚑ Report
          </button>
        </div>
      )}
    </div>
  );
}
