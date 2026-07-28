/* ============================= PCF DOCUMENTS ============================= */

/* Centralized document repository for the Petty Cash Fund portal. Users can
   upload (drag & drop / multi-file), organize by category, preview, download,
   rename, replace (with version history), star, archive/restore and delete
   (permitted roles). Every document carries a reference number, is linked to a
   company / plant / transaction, and records a per-document activity log. Files
   are stored as data URLs alongside the rest of the portal state (same approach
   as liquidation attachments). */

const DOC_CATEGORIES = [
  "PCF Memorandum",
  "Petty Cash Request Forms",
  "Petty Cash Liquidation Forms",
  "Replenishment Forms",
  "Approval Forms",
  "Supporting Documents",
  "Official Receipts",
  "Sales Invoices",
  "Purchase Receipts",
  "Delivery Receipts",
  "Quotations",
  "Acknowledgement Receipts",
  "Authorization Letters",
  "Company Policies",
  "Accounting Guidelines",
  "Audit Documents",
  "Other Attachments",
];

/* Accepted upload types (extension + MIME sniffing fallback). */
const DOC_EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "zip"];
const DOC_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.zip";
const DOC_STATUSES = ["Active", "Approved", "Rejected", "Archived"];

const extOf = (name) => (String(name || "").split(".").pop() || "").toLowerCase();
const isSupportedDoc = (file) => DOC_EXTS.includes(extOf(file.name));

const formatBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
};

/* Organized storage folder derived from the document's scope:
   Company / Plant / Year / Month / Transaction No. */
const docFolderPath = (d) => {
  const dt = new Date(d.uploadDate || todayISO());
  const yr = String(dt.getFullYear());
  const mo = dt.toLocaleString("en-PH", { month: "short" });
  return [d.company || "Unassigned", d.plantLabel || d.plant || "All Plants", yr, mo, d.linkedTxn || "General"]
    .filter(Boolean).join(" / ");
};

const makeDocRef = (seq) => `PCFDOC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;

/* Icon + accent for the file type shown in list/preview tiles. */
const docTypeMeta = (name) => {
  const e = extOf(name);
  if (["png", "jpg", "jpeg"].includes(e)) return { kind: "image", tint: "#2054a3" };
  if (e === "pdf") return { kind: "pdf", tint: "#c8102e" };
  if (["xls", "xlsx", "csv"].includes(e)) return { kind: "sheet", tint: "#15803d" };
  if (["doc", "docx"].includes(e)) return { kind: "word", tint: "#2054a3" };
  if (e === "zip") return { kind: "zip", tint: "#b9790a" };
  return { kind: "file", tint: "#4b5563" };
};

/* ---- Preview modal (image + PDF inline, others prompt download) ---- */
function DocPreviewModal({ doc, onClose, onDownload }) {
  const meta = docTypeMeta(doc.name);
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 900, width: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Eye size={16} /> {doc.name}</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body" style={{ maxHeight: "70vh" }}>
          {meta.kind === "image" && doc.dataUrl ? (
            <img src={doc.dataUrl} alt={doc.name} style={{ maxWidth: "100%", borderRadius: 8, display: "block", margin: "0 auto" }} />
          ) : meta.kind === "pdf" && doc.dataUrl ? (
            <iframe title={doc.name} src={doc.dataUrl} style={{ width: "100%", height: "62vh", border: "1px solid var(--line)", borderRadius: 8 }} />
          ) : (
            <div className="pcp-empty" style={{ padding: 32, textAlign: "center" }}>
              <FileIcon size={40} color={meta.tint} style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>In-browser preview not available for {extOf(doc.name).toUpperCase()} files.</div>
              <div style={{ color: "var(--text-mut)", fontSize: 12, marginBottom: 14 }}>Download the file to open it in the appropriate application.</div>
              <button className="pcp-btn pcp-btn-primary" onClick={() => onDownload(doc)}><Download size={14} /> Download {formatBytes(doc.size)}</button>
            </div>
          )}
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn" onClick={onClose}>Close</button>
          <button className="pcp-btn pcp-btn-primary" onClick={() => onDownload(doc)}><Download size={14} /> Download</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Document details + version history + activity log ---- */
function DocDetailsModal({ doc, onClose }) {
  const rows = [
    ["Reference No.", doc.refNo],
    ["Document Name", doc.name],
    ["Document Type", extOf(doc.name).toUpperCase()],
    ["Category", doc.category],
    ["Description", doc.description || "—"],
    ["Company", doc.company || "—"],
    ["Plant", doc.plantLabel || doc.plant || "—"],
    ["Branch", doc.branch || "—"],
    ["Linked Transaction", doc.linkedTxn || "—"],
    ["Storage Folder", docFolderPath(doc)],
    ["Uploaded By", doc.uploadedBy || "—"],
    ["Upload Date", fmtDate(doc.uploadDate)],
    ["Last Modified", doc.lastModified ? fmtDate(doc.lastModified.slice(0, 10)) : "—"],
    ["File Size", formatBytes(doc.size)],
    ["Version", "v" + (doc.version || 1)],
    ["Status", doc.status],
  ];
  return (
    <div className="pcp-modal-backdrop" onClick={onClose}>
      <div className="pcp-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="pcp-modal-head">
          <h3>Document Details</h3>
          <button className="pcp-btn pcp-btn-ghost pcp-btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pcp-modal-body">
          <div className="pcp-detail-grid">
            {rows.map(([k, v]) => <div key={k}><div className="lbl">{k}</div>{v}</div>)}
          </div>
          <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--text-mut)" }}>Version History</div>
          <div className="pcp-table-wrap" style={{ marginTop: 6 }}>
            <table className="pcp-table">
              <thead><tr><th>Version</th><th>File</th><th>Size</th><th>By</th><th>Date</th></tr></thead>
              <tbody>
                {(doc.versions && doc.versions.length ? doc.versions : [{ version: doc.version || 1, name: doc.name, size: doc.size, uploadedBy: doc.uploadedBy, date: doc.uploadDate }])
                  .slice().sort((a, b) => b.version - a.version).map((v) => (
                    <tr key={v.version}><td>v{v.version}</td><td>{v.name}</td><td>{formatBytes(v.size)}</td><td>{v.uploadedBy || "—"}</td><td>{fmtDate((v.date || "").slice(0, 10))}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--text-mut)" }}>Activity Log</div>
          <div className="pcp-table-wrap" style={{ marginTop: 6 }}>
            <table className="pcp-table">
              <thead><tr><th>Action</th><th>User</th><th>Date &amp; Time</th><th>Source</th></tr></thead>
              <tbody>
                {(doc.activity && doc.activity.length ? doc.activity : []).slice().reverse().map((a, i) => (
                  <tr key={i}><td>{a.action}</td><td>{a.user || "—"}</td><td>{a.ts}</td><td>{a.ip || "Local"}</td></tr>
                ))}
                {(!doc.activity || !doc.activity.length) && <tr><td colSpan={4} className="pcp-empty">No activity recorded yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pcp-modal-foot">
          <button className="pcp-btn pcp-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function PcfDocumentsTab({ documents, funds, plantOptions, userName, role, isAdmin, onAdd, onReplace, onUpdate, onDelete, onActivity }) {
  const canUpload = isAdmin || role === "Accounting" || role === "Custodian";
  const canEdit = isAdmin || role === "Accounting";
  const canDelete = isAdmin || role === "Accounting";

  const companyOpts = useMemo(() => Array.from(new Set((funds || []).map((f) => companyOfBranch(f.branchCode)).filter(Boolean))).sort(), [funds]);
  const plantOpts = plantOptions || [];

  const [meta, setMeta] = useState({ category: DOC_CATEGORIES[0], company: "", plant: "", linkedTxn: "", description: "" });
  const setM = (k, v) => setMeta((s) => ({ ...s, [k]: v }));

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceTargetRef = useRef(null);

  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("ALL");
  const [fCompany, setFCompany] = useState("ALL");
  const [fPlant, setFPlant] = useState("ALL");
  const [fStatus, setFStatus] = useState("ALL");
  const [fType, setFType] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState("uploadDate");
  const [sortDir, setSortDir] = useState("desc");
  const [preview, setPreview] = useState(null);
  const [details, setDetails] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  const nowTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");

  const plantLabelFor = (code) => (plantOpts.find((p) => p.code === code) || {}).label || plantLabel(code) || code;

  /* Read files and hand fully-built document objects up to the parent. */
  const ingest = useCallback((fileList) => {
    if (!canUpload) { setNotice("You do not have permission to upload documents."); return; }
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const valid = files.filter(isSupportedDoc);
    const rejected = files.length - valid.length;
    if (!valid.length) { setNotice(`Unsupported file type. Allowed: ${DOC_EXTS.join(", ").toUpperCase()}.`); return; }

    setUploading(true); setProgress(0);
    const built = [];
    let done = 0;
    const baseSeq = (documents ? documents.length : 0) + 1;
    valid.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const ts = nowTs();
        built.push({
          id: uid("doc"),
          refNo: makeDocRef(baseSeq + idx),
          name: file.name,
          category: meta.category,
          description: meta.description,
          company: meta.company || "",
          plant: meta.plant || "",
          plantLabel: meta.plant ? plantLabelFor(meta.plant) : "",
          branch: meta.plant || "",
          linkedTxn: meta.linkedTxn || "",
          uploadedBy: userName || role || "User",
          uploadDate: todayISO(),
          lastModified: ts,
          size: file.size,
          type: file.type || extOf(file.name),
          dataUrl: reader.result,
          version: 1,
          status: "Active",
          starred: false,
          versions: [{ version: 1, name: file.name, size: file.size, uploadedBy: userName || role || "User", date: todayISO() }],
          activity: [{ action: "Uploaded", user: userName || role || "User", ts, ip: "Local" }],
        });
        done++; setProgress(Math.round((done / valid.length) * 100));
        if (done === valid.length) {
          onAdd(built);
          setUploading(false); setProgress(0);
          setNotice(`${built.length} document${built.length > 1 ? "s" : ""} uploaded${rejected ? ` · ${rejected} unsupported file(s) skipped` : ""}.`);
        }
      };
      reader.onerror = () => { done++; if (done === valid.length) { onAdd(built); setUploading(false); setProgress(0); } };
      reader.readAsDataURL(file);
    });
  }, [canUpload, documents, meta, userName, role, onAdd, plantOpts]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); ingest(e.dataTransfer.files); };

  const doDownload = useCallback((d) => {
    if (!d.dataUrl) { setNotice("File content unavailable for download."); return; }
    const a = document.createElement("a");
    a.href = d.dataUrl; a.download = d.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    onActivity && onActivity(d.id, "Downloaded");
  }, [onActivity]);

  const startReplace = (d) => { replaceTargetRef.current = d; if (replaceInputRef.current) replaceInputRef.current.click(); };
  const onReplaceFile = (e) => {
    const file = (e.target.files || [])[0];
    const target = replaceTargetRef.current;
    e.target.value = "";
    if (!file || !target) return;
    if (!isSupportedDoc(file)) { setNotice("Unsupported file type for replacement."); return; }
    const reader = new FileReader();
    reader.onload = () => onReplace(target.id, { name: file.name, size: file.size, type: file.type || extOf(file.name), dataUrl: reader.result }, userName || role || "User");
    reader.readAsDataURL(file);
  };

  const commitRename = () => {
    const name = renameVal.trim();
    if (renaming && name) onUpdate(renaming.id, { name }, "Renamed", `Renamed to ${name}`);
    setRenaming(null); setRenameVal("");
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (documents || []).filter((d) => {
      if (!showArchived && d.status === "Archived") return false;
      if (fCat !== "ALL" && d.category !== fCat) return false;
      if (fCompany !== "ALL" && d.company !== fCompany) return false;
      if (fPlant !== "ALL" && d.plant !== fPlant) return false;
      if (fStatus !== "ALL" && d.status !== fStatus) return false;
      if (fType !== "ALL" && extOf(d.name) !== fType) return false;
      if (needle) {
        const hay = [d.name, d.refNo, d.category, d.description, d.linkedTxn, d.company, d.plantLabel, d.branch, d.uploadedBy, d.uploadDate, d.status]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [documents, q, fCat, fCompany, fPlant, fStatus, fType, showArchived]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      // starred always float to the top
      if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "size") { va = Number(va) || 0; vb = Number(vb) || 0; return sortDir === "asc" ? va - vb : vb - va; }
      va = String(va == null ? "" : va).toLowerCase(); vb = String(vb == null ? "" : vb).toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const setSort = (key) => { if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(key); setSortDir("asc"); } };

  /* ---- Reports datasets ---- */
  const byCategory = useMemo(() => groupSum(documents || [], (d) => d.category, () => 1), [documents]);
  const byCompany = useMemo(() => groupSum((documents || []).filter((d) => d.company), (d) => d.company, () => 1), [documents]);
  const totals = useMemo(() => {
    const all = documents || [];
    return {
      count: all.length,
      size: all.reduce((s, d) => s + (Number(d.size) || 0), 0),
      starred: all.filter((d) => d.starred).length,
      archived: all.filter((d) => d.status === "Archived").length,
    };
  }, [documents]);

  const exportIndex = () => {
    const rows = sorted.map((d) => ({
      "Reference No.": d.refNo, "Document Name": d.name, "Type": extOf(d.name).toUpperCase(),
      "Category": d.category, "Company": d.company, "Plant": d.plantLabel || d.plant,
      "Linked Transaction": d.linkedTxn, "Uploaded By": d.uploadedBy, "Upload Date": d.uploadDate,
      "Size": formatBytes(d.size), "Version": "v" + (d.version || 1), "Status": d.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), "PCF Documents");
    downloadWorkbook(wb, `PCF_Documents_${todayISO()}.xlsx`);
  };

  const SortTh = ({ k, children, align }) => (
    <th className="pcp-sortable" style={{ textAlign: align || "left" }} onClick={() => setSort(k)}>
      {children}{sortKey === k ? <span className="pcp-sort-ind">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span> : null}
    </th>
  );

  return (
    <div>
      <TopBar
        title="PCF Documents"
        sub="Central repository for all petty cash documents — upload, preview, link to transactions, and audit"
        right={
          <>
            <button className="pcp-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button className="pcp-btn pcp-btn-primary" onClick={exportIndex}><Download size={14} /> Export Index</button>
          </>
        }
      />
      <div className="pcp-content">
        {/* ---- Reports summary ---- */}
        <div className="pcp-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <KpiCard label="Total Documents" value={totals.count} icon={FolderOpen} tint="#2054a3" foot="In repository" />
          <KpiCard label="Storage Used" value={formatBytes(totals.size)} icon={Database} tint="#7c3aed" foot="Across all files" />
          <KpiCard label="Starred" value={totals.starred} icon={Star} tint="#b9790a" foot="Important documents" />
          <KpiCard label="Archived" value={totals.archived} icon={Archive} tint="#4b5563" foot="Retained but hidden" />
        </div>

        {/* ---- Upload ---- */}
        {canUpload && (
          <div className="pcp-card pcp-card-pad" style={{ marginBottom: 16 }}>
            <div className="pcp-section-title"><UploadCloud size={15} color="#c8102e" /> Upload Documents</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              <div className="pcp-field" style={{ margin: 0 }}>
                <label>Category</label>
                <select className="pcp-select" value={meta.category} onChange={(e) => setM("category", e.target.value)}>
                  {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pcp-field" style={{ margin: 0 }}>
                <label>Company</label>
                <select className="pcp-select" value={meta.company} onChange={(e) => setM("company", e.target.value)}>
                  <option value="">— Select —</option>
                  {companyOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pcp-field" style={{ margin: 0 }}>
                <label>Plant</label>
                <select className="pcp-select" value={meta.plant} onChange={(e) => setM("plant", e.target.value)}>
                  <option value="">— Select —</option>
                  {plantOpts.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </div>
              <div className="pcp-field" style={{ margin: 0 }}>
                <label>Linked Transaction No.</label>
                <input className="pcp-input" placeholder="e.g. PCF-2026-00125" value={meta.linkedTxn} onChange={(e) => setM("linkedTxn", e.target.value)} />
              </div>
              <div className="pcp-field" style={{ margin: 0, gridColumn: "span 4" }}>
                <label>Description</label>
                <input className="pcp-input" placeholder="Optional notes about the document(s)" value={meta.description} onChange={(e) => setM("description", e.target.value)} />
              </div>
            </div>

            <div
              className={"pcp-dropzone" + (dragOver ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              role="button" tabIndex={0}
            >
              <Upload size={26} color="#9098b3" />
              <div style={{ fontWeight: 600, marginTop: 6 }}>Drag &amp; drop files here, or click to browse</div>
              <div style={{ color: "var(--text-mut)", fontSize: 12, marginTop: 2 }}>Multiple files supported · {DOC_EXTS.join(", ").toUpperCase()}</div>
              <input ref={fileInputRef} type="file" multiple accept={DOC_ACCEPT} style={{ display: "none" }}
                onChange={(e) => { ingest(e.target.files); e.target.value = ""; }} />
            </div>
            {uploading && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-mut)", marginBottom: 4 }}>Uploading… {progress}%</div>
                <div className="pcp-progress"><div className="pcp-progress-bar" style={{ width: progress + "%" }} /></div>
              </div>
            )}
            {notice && <div className="pcp-hint" style={{ marginTop: 10 }}>{notice}</div>}
            <input ref={replaceInputRef} type="file" accept={DOC_ACCEPT} style={{ display: "none" }} onChange={onReplaceFile} />
          </div>
        )}

        {/* ---- Reports charts ---- */}
        <div className="pcp-grid-2" style={{ marginBottom: 16 }}>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><FolderOpen size={15} color="#c8102e" /> Documents by Category</div>
            <MiniBarChart data={byCategory} />
          </div>
          <div className="pcp-card pcp-card-pad">
            <div className="pcp-section-title"><Building2 size={15} color="#c8102e" /> Documents by Company</div>
            <MiniBarChart data={byCompany} />
          </div>
        </div>

        {/* ---- Filters ---- */}
        <div className="pcp-card pcp-card-pad pcp-no-print" style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(5, 1fr) auto", gap: 10, alignItems: "end" }}>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Search</label>
              <div className="pcp-drill-search" style={{ minWidth: 0 }}>
                <Search size={14} />
                <input className="pcp-input" style={{ paddingLeft: 30 }} placeholder="Name, ref no., transaction, employee…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Category</label>
              <select className="pcp-select" value={fCat} onChange={(e) => setFCat(e.target.value)}>
                <option value="ALL">All</option>{DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Company</label>
              <select className="pcp-select" value={fCompany} onChange={(e) => setFCompany(e.target.value)}>
                <option value="ALL">All</option>{companyOpts.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Plant</label>
              <select className="pcp-select" value={fPlant} onChange={(e) => setFPlant(e.target.value)}>
                <option value="ALL">All</option>{plantOpts.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Type</label>
              <select className="pcp-select" value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="ALL">All</option>{DOC_EXTS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="pcp-field" style={{ margin: 0 }}>
              <label>Status</label>
              <select className="pcp-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="ALL">All</option>{DOC_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="pcp-check" style={{ whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived
            </label>
          </div>
        </div>

        {/* ---- Document list ---- */}
        <div className="pcp-card">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>
            Documents ({sorted.length})
          </div>
          <div className="pcp-table-wrap">
            <table className="pcp-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <SortTh k="name">Document</SortTh>
                  <SortTh k="category">Category</SortTh>
                  <SortTh k="company">Company / Plant</SortTh>
                  <SortTh k="linkedTxn">Linked Txn</SortTh>
                  <SortTh k="size" align="right">Size</SortTh>
                  <SortTh k="uploadedBy">Uploaded By</SortTh>
                  <SortTh k="uploadDate">Date</SortTh>
                  <SortTh k="status">Status</SortTh>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length ? sorted.map((d) => {
                  const tm = docTypeMeta(d.name);
                  return (
                    <tr key={d.id} style={{ opacity: d.status === "Archived" ? 0.6 : 1 }}>
                      <td>
                        <button className="pcp-iconbtn" title={d.starred ? "Unstar" : "Star"} onClick={() => onUpdate(d.id, { starred: !d.starred }, d.starred ? "Unstarred" : "Starred")}>
                          <Star size={15} color={d.starred ? "#b9790a" : "#c3c8d4"} fill={d.starred ? "#b9790a" : "none"} />
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {tm.kind === "image" && d.dataUrl
                            ? <img src={d.dataUrl} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }} />
                            : <div style={{ width: 30, height: 30, borderRadius: 6, background: tm.tint + "18", display: "flex", alignItems: "center", justifyContent: "center" }}><FileIcon size={16} color={tm.tint} /></div>}
                          <div style={{ minWidth: 0 }}>
                            {renaming && renaming.id === d.id ? (
                              <input className="pcp-input" autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                                onBlur={commitRename} style={{ height: 28 }} />
                            ) : (
                              <>
                                <div style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setPreview(d)}>{d.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-mut)" }}>{d.refNo} · v{d.version || 1}</div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{d.category}</td>
                      <td>{d.company || "—"}<div style={{ fontSize: 11, color: "var(--text-mut)" }}>{d.plantLabel || d.plant || ""}</div></td>
                      <td>{d.linkedTxn || "—"}</td>
                      <td className="pcp-num">{formatBytes(d.size)}</td>
                      <td>{d.uploadedBy || "—"}</td>
                      <td>{fmtDate(d.uploadDate)}</td>
                      <td><span className={"pcp-badge pcp-badge-" + (d.status === "Approved" ? "green" : d.status === "Rejected" ? "red" : d.status === "Archived" ? "gray" : "blue")}>{d.status}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="pcp-iconbtn" title="Preview" onClick={() => { setPreview(d); onActivity && onActivity(d.id, "Viewed"); }}><Eye size={15} /></button>
                        <button className="pcp-iconbtn" title="Details" onClick={() => setDetails(d)}><FileText size={15} /></button>
                        <button className="pcp-iconbtn" title="Download" onClick={() => doDownload(d)}><Download size={15} /></button>
                        {canEdit && <button className="pcp-iconbtn" title="Rename" onClick={() => { setRenaming(d); setRenameVal(d.name); }}><Edit3 size={15} /></button>}
                        {canEdit && <button className="pcp-iconbtn" title="Replace (new version)" onClick={() => startReplace(d)}><RefreshCw size={15} /></button>}
                        {canEdit && (d.status === "Archived"
                          ? <button className="pcp-iconbtn" title="Restore" onClick={() => onUpdate(d.id, { status: "Active" }, "Restored")}><ArchiveRestore size={15} /></button>
                          : <button className="pcp-iconbtn" title="Archive" onClick={() => onUpdate(d.id, { status: "Archived" }, "Archived")}><Archive size={15} /></button>)}
                        {canDelete && <button className="pcp-iconbtn" title="Delete" onClick={() => { if (window.confirm(`Delete "${d.name}"? This cannot be undone.`)) onDelete(d.id); }}><Trash2 size={15} color="#c8102e" /></button>}
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={10} className="pcp-empty">No documents match your search / filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} onDownload={doDownload} />}
      {details && <DocDetailsModal doc={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
