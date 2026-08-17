"use client";

import React, { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  getAdminDirectoryEmbeds,
  saveDirectoryEmbed,
  deleteDirectoryEmbed,
  toggleDirectoryEmbed,
  reorderDirectoryEmbeds,
  type DirectoryEmbedItem,
} from "@/app/actions/directoryEmbeds";

const PRESETS = [
  {
    name: "Product Hunt",
    embedHtml: `<a href="https://www.producthunt.com/products/the-launch-feed" target="_blank" rel="noopener noreferrer"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=the-launch-feed&theme=dark" alt="The Launch Feed on Product Hunt" style="height:36px;width:auto;" /></a>`,
    targetUrl: "https://www.producthunt.com/products/the-launch-feed",
  },
  {
    name: "Peerlist",
    embedHtml: `<a href="https://peerlist.io/company/thelaunchfeed" target="_blank" rel="noopener noreferrer"><img src="https://peerlist.io/images/badge.svg" alt="The Launch Feed on Peerlist" style="height:36px;width:auto;" /></a>`,
    targetUrl: "https://peerlist.io/company/thelaunchfeed",
  },
  {
    name: "Uneed Best Web Tools",
    embedHtml: `<a href="https://www.uneed.best/tool/the-launch-feed" target="_blank" rel="noopener noreferrer"><img src="https://www.uneed.best/EMBED2.png" alt="Uneed Embed Badge" style="height:36px;width:auto;" /></a>`,
    targetUrl: "https://www.uneed.best/tool/the-launch-feed",
  },
  {
    name: "Toolify.ai",
    embedHtml: `<a href="https://www.toolify.ai" target="_blank" rel="noopener noreferrer"><img src="https://www.toolify.ai/badge.svg" alt="Listed on Toolify" style="height:36px;width:auto;" /></a>`,
    targetUrl: "https://www.toolify.ai",
  },
  {
    name: "TinyLaunch",
    embedHtml: `<a href="https://tinylaunch.com" target="_blank" rel="noopener noreferrer"><img src="https://tinylaunch.com/badge.svg" alt="Featured on TinyLaunch" style="height:36px;width:auto;" /></a>`,
    targetUrl: "https://tinylaunch.com",
  },
];

export default function DirectoryEmbedsTab() {
  const [embeds, setEmbeds] = useState<DirectoryEmbedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmbedHtml, setFormEmbedHtml] = useState("");
  const [formTargetUrl, setFormTargetUrl] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  const fetchEmbeds = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminDirectoryEmbeds();
      setEmbeds(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load directory embeds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmbeds();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormName("");
    setFormEmbedHtml("");
    setFormTargetUrl("");
    setFormEnabled(true);
    setShowModal(true);
    setError(null);
  };

  const openEditModal = (item: DirectoryEmbedItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormEmbedHtml(item.embedHtml);
    setFormTargetUrl(item.targetUrl || "");
    setFormEnabled(item.enabled);
    setShowModal(true);
    setError(null);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setFormName(preset.name);
    setFormEmbedHtml(preset.embedHtml);
    setFormTargetUrl(preset.targetUrl || "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmbedHtml.trim()) {
      setError("Please provide a name and embed code");
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await saveDirectoryEmbed({
        id: editingId || undefined,
        name: formName,
        embedHtml: formEmbedHtml,
        targetUrl: formTargetUrl || undefined,
        enabled: formEnabled,
      });

      if (!res.success) {
        setError(res.error || "Failed to save directory embed");
        return;
      }

      setSuccessMsg(editingId ? "Directory embed updated!" : "New directory embed added!");
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowModal(false);
      await fetchEmbeds();
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the embed code for "${name}"?`)) return;

    startTransition(async () => {
      const res = await deleteDirectoryEmbed(id);
      if (res.success) {
        setSuccessMsg("Embed deleted successfully");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchEmbeds();
      } else {
        setError(res.error || "Failed to delete");
      }
    });
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleDirectoryEmbed(id, !currentStatus);
      if (res.success) {
        setEmbeds((prev) =>
          prev.map((item) => (item.id === id ? { ...item, enabled: !currentStatus } : item))
        );
      } else {
        setError(res.error || "Failed to toggle status");
      }
    });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= embeds.length) return;

    const newEmbeds = [...embeds];
    const temp = newEmbeds[index];
    newEmbeds[index] = newEmbeds[targetIndex];
    newEmbeds[targetIndex] = temp;

    setEmbeds(newEmbeds);

    startTransition(async () => {
      await reorderDirectoryEmbeds(newEmbeds.map((i) => i.id));
    });
  };

  return (
    <div className="space-y-6 font-mono text-ink">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider flex items-center gap-2">
            <span>Online Directory Embed Codes</span>
            <span className="text-[10px] font-bold px-2 py-0.5 border border-signal text-signal bg-signal/10">
              Footer Marquee
            </span>
          </h2>
          <p className="text-xs text-ink-dim mt-1 max-w-2xl">
            Manage embeddable badges and backlink widgets from directories where <strong>thelaunchfeed.com</strong> is listed (e.g. Product Hunt, Uneed, Peerlist, Toolify). Active badges automatically flow in the site footer bar with a &quot;FEATURED ON&quot; label.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2 bg-ink text-void hover:bg-signal font-bold text-xs uppercase flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <span>+ Add Directory Embed</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 border border-signal/50 bg-signal/10 text-signal text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 border border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Embeds List / Table */}
      {loading ? (
        <div className="p-8 border border-hairline text-center text-xs text-ink-dim">
          Loading directory embeds...
        </div>
      ) : embeds.length === 0 ? (
        <div className="p-8 border border-dashed border-hairline text-center space-y-3">
          <div className="text-sm font-bold text-ink">No Directory Embed Codes Added Yet</div>
          <p className="text-xs text-ink-dim max-w-md mx-auto">
            Add your first directory badge from Product Hunt, Peerlist, Uneed, or another software directory to showcase social proof in the site footer.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 border border-signal text-signal hover:bg-signal hover:text-void font-bold text-xs uppercase transition-colors cursor-pointer"
          >
            + Add First Directory Badge
          </button>
        </div>
      ) : (
        <div className="border border-hairline bg-surface/20 divide-y divide-hairline overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[650px]">
            <thead className="bg-surface/60 text-[10px] uppercase font-bold text-ink-dim tracking-wider border-b border-hairline">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">Order</th>
                <th className="py-2.5 px-4">Directory / Name</th>
                <th className="py-2.5 px-4">Live Preview</th>
                <th className="py-2.5 px-4 text-center w-28">Status</th>
                <th className="py-2.5 px-4 text-right w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {embeds.map((item, idx) => (
                <tr key={item.id} className="hover:bg-surface/40 transition-colors">
                  {/* Order Controls */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0 || isPending}
                        onClick={() => handleMove(idx, "up")}
                        title="Move Up"
                        className="p-1 border border-hairline hover:border-ink disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-[10px]"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === embeds.length - 1 || isPending}
                        onClick={() => handleMove(idx, "down")}
                        title="Move Down"
                        className="p-1 border border-hairline hover:border-ink disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-[10px]"
                      >
                        ▼
                      </button>
                    </div>
                  </td>

                  {/* Directory Name & Details */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-ink flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.targetUrl && (
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-ink-faint hover:text-signal"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    <div className="text-[10px] text-ink-faint mt-0.5 truncate max-w-xs font-mono">
                      ID: {item.id}
                    </div>
                  </td>

                  {/* Live Rendered Preview */}
                  <td className="py-3 px-4">
                    <div className="p-2 border border-hairline bg-void inline-flex items-center justify-center max-h-12 overflow-hidden max-w-[200px]">
                      <div
                        className="scale-90 origin-left"
                        dangerouslySetInnerHTML={{ __html: item.embedHtml }}
                      />
                    </div>
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggle(item.id, item.enabled)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase border transition-colors cursor-pointer ${
                        item.enabled
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-hairline text-ink-faint bg-surface"
                      }`}
                    >
                      {item.enabled ? "● Active" : "○ Disabled"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-2.5 py-1 border border-hairline hover:border-ink text-ink text-[10px] uppercase font-bold transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(item.id, item.name)}
                        className="px-2.5 py-1 border border-signal/40 text-signal hover:bg-signal hover:text-void text-[10px] uppercase font-bold transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Preview Callout */}
      <div className="p-4 border border-hairline bg-surface/30 space-y-2">
        <div className="text-xs font-bold uppercase text-ink flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          <span>Footer Display Behavior</span>
        </div>
        <p className="text-xs text-ink-dim leading-relaxed">
          Active badges appear seamlessly across all public pages in the bottom footer section. When multiple directory badges are active, they automatically flow continuously from right to left in a smooth, responsive marquee that pauses on hover.
        </p>
      </div>

      {/* Add / Edit Modal */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-canvas border border-hairline w-full max-w-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="text-sm font-bold text-ink uppercase">
                {editingId ? "Edit Directory Embed" : "Add Directory Embed Code"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-ink-dim hover:text-ink font-bold text-base cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Presets Row */}
            {!editingId && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-ink-dim">
                  Quick Presets (Click to fill sample format):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="px-2 py-1 text-[10px] border border-hairline hover:border-signal bg-surface/40 hover:text-signal transition-colors cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-ink">
                  Directory Name:
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Product Hunt, Uneed, Peerlist, Toolify"
                  className="w-full px-3 py-2 border border-hairline bg-void text-ink text-xs focus:border-signal outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-ink">
                  Embed HTML Snippet:
                </label>
                <textarea
                  required
                  rows={4}
                  value={formEmbedHtml}
                  onChange={(e) => setFormEmbedHtml(e.target.value)}
                  placeholder='<a href="https://..." target="_blank"><img src="https://..." alt="..." /></a>'
                  className="w-full px-3 py-2 border border-hairline bg-void text-signal font-mono text-xs focus:border-signal outline-none resize-none leading-relaxed"
                />
                <p className="text-[10px] text-ink-dim">
                  Paste the exact HTML embed snippet provided by the directory.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-ink">
                  Target Website URL (Optional override):
                </label>
                <input
                  type="url"
                  value={formTargetUrl}
                  onChange={(e) => setFormTargetUrl(e.target.value)}
                  placeholder="https://directory.com/products/the-launch-feed"
                  className="w-full px-3 py-2 border border-hairline bg-void text-ink text-xs focus:border-signal outline-none"
                />
              </div>

              {/* Real-Time Live Preview */}
              {formEmbedHtml.trim() && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold uppercase text-ink-dim">
                    Live Preview in Modal:
                  </div>
                  <div className="p-4 border border-hairline bg-void flex items-center justify-center min-h-[50px] overflow-hidden">
                    <div dangerouslySetInnerHTML={{ __html: formEmbedHtml }} />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold uppercase text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="accent-signal cursor-pointer"
                  />
                  <span>Enable immediately in footer</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-hairline text-ink-dim hover:text-ink text-xs uppercase font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-signal text-void hover:opacity-90 disabled:opacity-50 text-xs uppercase font-bold cursor-pointer shadow-sm"
                >
                  {isPending ? "Saving..." : editingId ? "Update Embed" : "Save Embed"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
