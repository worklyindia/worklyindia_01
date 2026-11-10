import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sortNewestFirst } from "@/lib/storageSort";
import { useNavigate, useSearchParams } from "react-router-dom";
import { goBack } from "@/lib/goBack";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { supabasePublishableKey, supabaseUrl } from "@/constants/supabase";
import { toast } from "sonner";
import { forceDownloadFile } from "@/utils/forceDownload";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckSquare,
  ChevronRight,
  Copy,
  Database,
  Download,
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Folder,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";

interface BucketInfo {
  id: string;
  name: string;
  public: boolean;
  fileSizeLimit: number | null;
  fileCount?: number;
  totalSize?: number;
  counted?: boolean;
}

interface StorageFile {
  name: string;
  path: string;
  size: number | null;
  contentType: string | null;
  updatedAt: string | null;
  publicUrl: string | null;
}

interface FolderEntry {
  name: string;
  prefix: string;
}

interface FolderStat {
  folder: string;
  fileCount: number;
  totalSize: number;
  /** Newest upload inside the folder (used to show newest folders first). */
  latestAt?: string | null;
}

const PAGE_SIZE = 100;
// Cloudflare lists in name order, so fetch a bigger page and sort it by date.
const R2_PAGE_SIZE = 1000;

// Size presets (MB) shown on one horizontally scrolling row.
const LIMIT_PRESETS = [1, 5, 10, 50, 100, 500, 1024, 5120, 10240];
const presetLabel = (mb: number) => (mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`);
const R2_PARALLEL_PARTS = 4;

/** PUTs one part straight to Cloudflare and returns its ETag, reporting byte progress. */
const putPart = (url: string, blob: Blob, onProgress: (loaded: number) => void) =>
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else reject(new Error(xhr.status ? `Cloudflare upload failed (${xhr.status})` : "Upload blocked — check bucket CORS"));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });

const formatBytes = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
};

// 20/09/2026 01:27:13 PM — day/month/year with a 12-hour clock.
const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${date} ${time}`;
};

const isImage = (file: StorageFile) =>
  /^image\//i.test(file.contentType || "") || /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(file.name);

const isVideo = (file: StorageFile) =>
  /^video\//i.test(file.contentType || "") || /\.(mp4|webm|mov)$/i.test(file.name);

const isAudio = (file: StorageFile) =>
  /^audio\//i.test(file.contentType || "") || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);

const fileIcon = (file: StorageFile) => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (isImage(file)) return <ImageIcon className="h-5 w-5 text-primary" />;
  if (ext === "pdf") return <FileText className="h-5 w-5 text-destructive" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-primary" />;
  if (["zip", "rar", "7z"].includes(ext)) return <FileArchive className="h-5 w-5 text-muted-foreground" />;
  return <FileIcon className="h-5 w-5 text-muted-foreground" />;
};

const StorageManager = ({ provider = "supabase" }: { provider?: "supabase" | "r2" }) => {
  const isR2 = provider === "r2";
  const navigate = useNavigate();
  const [nextCursor, setNextCursor] = useState("");
  const [pendingUploads, setPendingUploads] = useState<FileList | null>(null);
  // Bucket + folder live in the URL so a refresh (or a shared link) reopens
  // exactly the same page instead of bouncing back to the bucket list.
  const [searchParams, setSearchParams] = useSearchParams();
  const bucketParam = searchParams.get("bucket") || "";
  const prefix = searchParams.get("path") || "";

  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [confirmSettings, setConfirmSettings] = useState(false);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "file" | "folder"; label: string; value: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number } | null>(null);
  const [recounting, setRecounting] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Bucket create / settings + folder create
  const [folderStats, setFolderStats] = useState<Record<string, FolderStat>>({});
  const [newBucketOpen, setNewBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketPublic, setNewBucketPublic] = useState(!isR2);
  const [newBucketLimit, setNewBucketLimit] = useState("5");
  const [settingsBucket, setSettingsBucket] = useState<BucketInfo | null>(null);
  const [settingsPublic, setSettingsPublic] = useState(false);
  const [settingsLimit, setSettingsLimit] = useState("");
  const [deleteBucketName, setDeleteBucketName] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const navigateTo = useCallback(
    (bucket: string, path: string, replace = false) => {
      const next = new URLSearchParams();
      if (bucket) next.set("bucket", bucket);
      if (path) next.set("path", path);
      setSearchParams(next, { replace });
    },
    [setSearchParams],
  );

  const setPrefix = useCallback((path: string, replace = false) => navigateTo(bucketParam, path, replace), [navigateTo, bucketParam]);

  const activeBucket: BucketInfo | null = useMemo(() => {
    if (!bucketParam) return null;
    return (
      buckets.find((b) => b.name === bucketParam) || {
        id: bucketParam,
        name: bucketParam,
        public: false,
        fileSizeLimit: null,
      }
    );
  }, [bucketParam, buckets]);

  // One toast id for every storage error, so a failing request cannot stack up
  // a wall of identical banners on each refresh.
  const showError = useCallback((message: string) => {
    toast.error(message, { id: "storage-error" });
  }, []);

  const call = useCallback(
    async <T,>(body: Record<string, unknown>, options?: { silent?: boolean }): Promise<T | null> => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          showError("Session expired — please sign in again");
          return null;
        }
        const res = await fetch(
          `${supabaseUrl()}/functions/v1/egress-optimizer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabasePublishableKey(),
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(isR2 ? { ...body, action: `r2-${body.action}` } : body),
          },
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          if (!options?.silent) {
            const message = isR2 && data?.error === "Unknown action" ? "Cloudflare storage update is not live yet. Deploy the updated egress-optimizer through GitHub Actions." : data?.error || `Storage request failed (${res.status})`;
            setStorageError(message); showError(message);
          }
          return null;
        }
        if (!options?.silent) setStorageError(null);
        return data as T;
      } catch (e) {
        if (!options?.silent) { const message = e instanceof Error ? e.message : "Storage request failed"; setStorageError(message); showError(message); }
        return null;
      }
    },
    [showError, isR2],
  );


  // Last good bucket list is kept on this device so counts never flash to 0 while reloading or after an error.
  const cacheKey = `storage-buckets-${provider}`;
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (Array.isArray(cached)) setBuckets(cached);
    } catch { /* ignore */ }
  }, [cacheKey]);

  const loadBuckets = useCallback(async (refresh = false) => {
    setLoadingBuckets(true);
    const res = await call<{ buckets: BucketInfo[] }>({ action: "sa-list-buckets", ...(refresh && !isR2 ? { refresh: true } : {}) });
    if (res) {
      setBuckets(res.buckets || []);
      try { localStorage.setItem(cacheKey, JSON.stringify(res.buckets || [])); } catch { /* ignore */ }
    }
    setLoadingBuckets(false);
  }, [call, cacheKey, isR2]);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  // Rebuilds a Cloudflare bucket's saved counts in resumable steps (20k files per step).
  const recountBucket = useCallback(async (name: string, silent = false) => {
    setRecounting(name);
    let cursor = "";
    let total = 0;
    let ok = true;
    do {
      const res = await call<{ scanned: number; nextCursor: string }>({ action: "sa-recount", bucket: name, cursor }, { silent });
      if (!res) { ok = false; break; }
      total += res.scanned;
      cursor = res.nextCursor;
    } while (cursor);
    setRecounting(null);
    if (ok && !silent) toast.success(`Counted ${total.toLocaleString()} files`);
    if (ok) loadBuckets();
  }, [call, loadBuckets]);

  // First visit for an R2 bucket that was never counted: count it once, then counters stay saved.
  const autoCounted = useRef(new Set<string>());
  useEffect(() => {
    if (!isR2 || recounting) return;
    const next = buckets.find((b) => b.counted === false && !autoCounted.current.has(b.name));
    if (next) { autoCounted.current.add(next.name); recountBucket(next.name, true); }
  }, [buckets, isR2, recounting, recountBucket]);

  const loadFiles = useCallback(
    async (bucket: string, path: string, searchTerm: string, offset = 0, cursor = "") => {
      if (offset === 0) setLoadingFiles(true);
      else setLoadingMore(true);
      const res = await call<{ folders: FolderEntry[]; files: StorageFile[]; hasMore: boolean; nextCursor?: string }>({
        action: "sa-list-objects",
        bucket,
        prefix: path,
        search: searchTerm,
        limit: isR2 ? R2_PAGE_SIZE : PAGE_SIZE,
        offset,
        cursor,
      });
      if (res) {
        // `.keep` is the invisible placeholder that keeps an empty folder alive.
        const incoming = (res.files || []).filter((f) => f.name !== ".keep");
        setFolders((prev) => offset === 0 ? res.folders || [] : [...prev, ...(res.folders || [])].filter((f, i, all) => all.findIndex((x) => x.prefix === f.prefix) === i));
        setFiles((prev) => (offset === 0 ? incoming : [...prev, ...incoming]));
        setHasMore(!!res.hasMore);
        setNextCursor(res.nextCursor || "");
      }
      setLoadingFiles(false);
      setLoadingMore(false);
    },
    [call, isR2],
  );

  // Folder aur file dono: naya upload upar, purana niche (same date ho to time se).
  const sortedFolders = useMemo(
    () => sortNewestFirst(folders, (f) => folderStats[f.name]?.latestAt, (f) => f.name),
    [folders, folderStats],
  );
  const sortedFiles = useMemo(() => sortNewestFirst(files, (f) => f.updatedAt, (f) => f.name), [files]);

  const loadFolderStats = useCallback(
    async (bucket: string, path: string) => {
      const res = await call<{ stats: FolderStat[] }>(
        { action: "sa-folder-stats", bucket, prefix: path },
        { silent: true },
      );
      if (!res) {
        setFolderStats({});
        return;
      }
      const map: Record<string, FolderStat> = {};
      for (const s of res.stats || []) map[s.folder] = s;
      setFolderStats(map);
      // Purane Cloudflare folders ki date abhi saved nahi — ek baar chupchap recount karke date bhar do.
      const dateKey = `r2-folder-dates-${bucket}`;
      if (isR2 && (res.stats || []).some((st) => !st.latestAt) && !localStorage.getItem(dateKey)) {
        localStorage.setItem(dateKey, "1");
        // Recount ke baad folders list ko refresh karke nayi dates load karo.
        void recountBucket(bucket, true).then(() => setFolders((f) => [...f]));
      }
    },
    [call, isR2, recountBucket],
  );

  useEffect(() => {
    if (!bucketParam) return;
    const timer = setTimeout(() => loadFiles(bucketParam, prefix, search), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [bucketParam, prefix, search, loadFiles]);

  // Folder sizes are only worth fetching once we know the folder has children.
  useEffect(() => {
    if (!bucketParam || folders.length === 0) {
      setFolderStats({});
      return;
    }
    loadFolderStats(bucketParam, prefix);
  }, [bucketParam, prefix, folders, loadFolderStats]);

  const createBucket = async () => {
    setBusy(true);
    const res = await call({
      action: "sa-create-bucket",
      name: newBucketName.trim().toLowerCase(),
      public: newBucketPublic,
      fileSizeLimitMb: Number(newBucketLimit) || 0,
    });
    setBusy(false);
    if (res) {
      toast.success("Bucket created");
      setNewBucketOpen(false);
      setNewBucketName("");
      loadBuckets();
    }
  };

  const saveBucketSettings = async () => {
    if (!settingsBucket) return;
    setBusy(true);
    const res = await call({
      action: "sa-update-bucket",
      name: settingsBucket.name,
      ...(isR2 && settingsPublic === settingsBucket.public ? {} : { public: settingsPublic }),
      fileSizeLimitMb: settingsLimit === "" ? 0 : Number(settingsLimit),
    });
    setBusy(false);
    if (res) {
      toast.success("Bucket updated");
      setSettingsBucket(null);
      loadBuckets();
    }
  };

  const removeBucket = async () => {
    if (!deleteBucketName) return;
    setBusy(true);
    const res = await call({ action: "sa-delete-bucket", name: deleteBucketName });
    setBusy(false);
    setDeleteBucketName(null);
    if (res) {
      toast.success("Bucket deleted");
      setSettingsBucket(null);
      loadBuckets();
    }
  };

  const createFolder = async () => {
    if (!bucketParam || !newFolderName.trim()) return;
    setBusy(true);
    const res = await call({
      action: "sa-create-folder",
      bucket: bucketParam,
      prefix,
      name: newFolderName.trim(),
    });
    setBusy(false);
    if (res) {
      toast.success("Folder created");
      setNewFolderOpen(false);
      setNewFolderName("");
      loadFiles(bucketParam, prefix, search);
      loadFolderStats(bucketParam, prefix);
    }
  };


  // Leaving a folder/bucket clears any pending multi-selection.
  useEffect(() => {
    setSelected([]);
    setSelectedFolders([]);
    setSelectMode(false);
  }, [bucketParam, prefix]);

  const openBucket = (bucket: BucketInfo) => {
    setSearch("");
    setFiles([]);
    setFolders([]);
    navigateTo(bucket.name, "");
  };

  // Cloudflare deletes a folder 1,000 files per request; keep going until it is empty.
  const deleteFolderFully = async (bucket: string, folderPrefix: string) => {
    let deleted = 0;
    for (;;) {
      const res = await call<{ deleted: number; more?: boolean }>({ action: "sa-delete-folder", bucket, prefix: folderPrefix });
      if (!res) return null;
      deleted += res.deleted;
      if (!res.more) return { deleted };
    }
  };

  const toggleSelect = (path: string) =>
    setSelected((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));

  const toggleSelectFolder = (p: string) =>
    setSelectedFolders((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const totalSelected = selected.length + selectedFolders.length;
  const totalItems = files.length + folders.length;
  const allSelected = totalItems > 0 && selected.length === files.length && selectedFolders.length === folders.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected([]);
      setSelectedFolders([]);
    } else {
      setSelected(files.map((f) => f.path));
      setSelectedFolders(folders.map((f) => f.prefix));
    }
  };

  const confirmBulkDelete = async () => {
    if (!activeBucket || totalSelected === 0) return;
    setBusy(true);
    let deleted = 0;
    let ok = true;
    if (selected.length > 0) {
      const res = await call<{ deleted: number }>({
        action: "sa-delete",
        bucket: activeBucket.name,
        paths: selected,
      });
      if (res) deleted += res.deleted;
      else ok = false;
    }
    for (const folderPrefix of selectedFolders) {
      const res = await deleteFolderFully(activeBucket.name, folderPrefix);
      if (res) deleted += res.deleted;
      else ok = false;
    }
    setBusy(false);
    setBulkOpen(false);
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} item${deleted === 1 ? "" : "s"}`);
      setSelected([]);
      setSelectedFolders([]);
      setSelectMode(false);
      loadFiles(activeBucket.name, prefix, search);
      loadFolderStats(activeBucket.name, prefix);
      loadBuckets();
    } else if (!ok) {
      toast.error("Delete failed");
    }
  };

  const breadcrumbs = useMemo(() => {
    if (!prefix) return [];
    const parts = prefix.split("/").filter(Boolean);
    return parts.map((part, index) => ({ name: part, prefix: parts.slice(0, index + 1).join("/") }));
  }, [prefix]);

  const openPreview = async (file: StorageFile) => {
    if (!activeBucket) return;
    setPreviewFile(file);
    setPreviewUrl(null);
    if (activeBucket?.public && file.publicUrl) {
      setPreviewUrl(file.publicUrl);
      return;
    }
    const res = await call<{ url: string }>({ action: "sa-signed-url", bucket: activeBucket.name, path: file.path });
    if (res?.url) setPreviewUrl(res.url);
  };

  const copyLink = async (file: StorageFile) => {
    if (!activeBucket) return;
    let url = activeBucket?.public ? file.publicUrl : null;
    if (!url) {
      const res = await call<{ url: string }>({ action: "sa-signed-url", bucket: activeBucket.name, path: file.path });
      url = res?.url || null;
    }
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — please try again");
    }
  };

  const downloadFile = async (file: StorageFile) => {
    if (!activeBucket) return;
    const res = await call<{ url: string }>({
      action: "sa-signed-url",
      bucket: activeBucket.name,
      path: file.path,
      download: true,
    });
    if (!res?.url) return;
    const ok = await forceDownloadFile(res.url, file.name);
    if (!ok) toast.error("Download failed");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !activeBucket) return;
    setBusy(true);
    const res =
      deleteTarget.kind === "file"
        ? await call<{ deleted: number }>({ action: "sa-delete", bucket: activeBucket.name, paths: [deleteTarget.value] })
        : await deleteFolderFully(activeBucket.name, deleteTarget.value);
    setBusy(false);
    setDeleteTarget(null);
    if (res) {
      toast.success(`Deleted ${res.deleted} file${res.deleted === 1 ? "" : "s"}`);
      setPreviewFile(null);
      loadFiles(activeBucket.name, prefix, search);
      loadFolderStats(activeBucket.name, prefix);
      loadBuckets();
    }
  };

  const uploadR2 = async (bucket: string, path: string, file: File) => {
    const init = await call<{ uploadId: string; partSize: number }>({ action: "sa-upload-init", bucket, path, size: file.size, contentType: file.type || "application/octet-stream" });
    if (!init) return false;
    const partCount = Math.max(1, Math.ceil(file.size / init.partSize));
    const loaded = new Array(partCount).fill(0);
    const parts: { partNumber: number; etag: string }[] = [];
    try {
      for (let start = 1; start <= partCount; start += 50) {
        const numbers = Array.from({ length: Math.min(50, partCount - start + 1) }, (_, i) => start + i);
        const signed = await call<{ urls: Record<number, string> }>({ action: "sa-upload-sign", bucket, path, uploadId: init.uploadId, partNumbers: numbers });
        if (!signed) throw new Error("Could not prepare upload");
        let next = 0;
        const worker = async () => {
          while (next < numbers.length) {
            const n = numbers[next++];
            const blob = file.slice((n - 1) * init.partSize, Math.min(n * init.partSize, file.size));
            let etag = "";
            for (let attempt = 1; ; attempt++) {
              try {
                etag = await putPart(signed.urls[n], blob, (b) => {
                  loaded[n - 1] = b;
                  setUploadProgress({ name: file.name, percent: Math.round((loaded.reduce((x, y) => x + y, 0) / Math.max(file.size, 1)) * 100) });
                });
                break;
              } catch (e) { if (attempt >= 3) throw e; }
            }
            loaded[n - 1] = blob.size;
            parts.push({ partNumber: n, etag });
          }
        };
        await Promise.all(Array.from({ length: Math.min(R2_PARALLEL_PARTS, numbers.length) }, worker));
      }
    } catch (e) {
      await call({ action: "sa-upload-abort", bucket, path, uploadId: init.uploadId }, { silent: true });
      showError(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      return false;
    }
    return !!(await call({ action: "sa-upload-complete", bucket, path, uploadId: init.uploadId, parts }));
  };

  const uploadSupabase = async (bucket: string, path: string, file: File) => {
    const signed = await call<{ token: string; previousSize: number | null }>({ action: "sa-upload-url", bucket, path, size: file.size });
    if (!signed?.token) return false;
    setUploadProgress({ name: file.name, percent: 0 });
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, signed.token, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) { showError(`${file.name}: ${error.message}`); return false; }
    setUploadProgress({ name: file.name, percent: 100 });
    await call({ action: "sa-upload-done", bucket, path, previousSize: signed.previousSize }, { silent: true });
    return true;
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length || !activeBucket) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      if (activeBucket.fileSizeLimit && file.size > activeBucket.fileSizeLimit) {
        showError(`${file.name}: larger than this bucket's ${formatBytes(activeBucket.fileSizeLimit)} limit`);
        continue;
      }
      const path = prefix ? `${prefix.replace(/\/+$/, "")}/${file.name}` : file.name;
      setUploadProgress({ name: file.name, percent: 0 });
      const ok = isR2 ? await uploadR2(activeBucket.name, path, file) : await uploadSupabase(activeBucket.name, path, file);
      if (ok) toast.success(`Uploaded ${file.name}`);
    }
    setUploading(false);
    setUploadProgress(null);
    if (uploadRef.current) uploadRef.current.value = "";
    loadFiles(activeBucket.name, prefix, search);
    loadFolderStats(activeBucket.name, prefix);
    loadBuckets();
  };

  const limitPresets = (value: string, onPick: (v: string) => void) => (
    <div className="flex flex-nowrap gap-1.5 pt-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
      {LIMIT_PRESETS.map((mb) => (
        <Button key={mb} type="button" size="sm" variant={String(mb) === value ? "default" : "outline"} className="h-7 px-2.5 text-xs shrink-0 whitespace-nowrap" onClick={() => onPick(String(mb))}>{presetLabel(mb)}</Button>
      ))}
      <Button type="button" size="sm" variant={value === "" ? "default" : "outline"} className="h-7 px-2.5 text-xs shrink-0 whitespace-nowrap" onClick={() => onPick("")}>No limit</Button>
    </div>
  );

  // ---------- Bucket list ----------
  if (!activeBucket) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate, "/owner-portal")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold">{isR2 ? "Cloudflare CDN Storage & Files" : "Storage"}</h1>
              <p className="text-xs text-muted-foreground">
                {buckets.length} buckets •{" "}
                {formatBytes(buckets.reduce((sum, b) => sum + (b.totalSize || 0), 0))} •{" "}
                {buckets.reduce((sum, b) => sum + (b.fileCount || 0), 0).toLocaleString()} files
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Refresh buckets" className="shrink-0" onClick={() => loadBuckets(true)} disabled={loadingBuckets}>
              <RefreshCw className={`h-5 w-5 ${loadingBuckets ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="px-4 pb-3">
            <Button className="w-full" onClick={() => setNewBucketOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New bucket
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {storageError && <div role="alert" className="border border-destructive rounded-lg p-3 text-sm text-destructive break-words">{storageError}</div>}
          {loadingBuckets && buckets.length === 0 && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingBuckets && !storageError && buckets.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-16">No buckets found.</p>
          )}
          {buckets.map((bucket) => (
            <Card key={bucket.id} className="active:scale-[0.99] transition-transform">
              <CardContent className="flex items-center gap-3 p-4">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => openBucket(bucket)}>
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    {isR2 ? <HardDrive className="h-5 w-5 text-primary" /> : <Database className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{bucket.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={bucket.public ? "default" : "secondary"} className="text-[10px]">
                        {bucket.public ? "Public" : "Private"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {recounting === bucket.name ? "Counting files…" : `${(bucket.fileCount ?? 0).toLocaleString()} files • ${formatBytes(bucket.totalSize ?? 0)}`}
                      </span>
                      {bucket.fileSizeLimit ? (
                        <span className="text-[11px] text-muted-foreground">Max {formatBytes(bucket.fileSizeLimit)}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
                <Button
                  aria-label={`Settings for ${bucket.name}`}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSettingsBucket(bucket);
                    setSettingsPublic(bucket.public);
                    setSettingsLimit(bucket.fileSizeLimit ? String(Math.round(bucket.fileSizeLimit / 1048576)) : "");
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-5 w-5 text-muted-foreground" onClick={() => openBucket(bucket)} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create bucket */}
        <Sheet open={newBucketOpen} onOpenChange={setNewBucketOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">New bucket</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4 pb-8">
              <div className="space-y-1.5">
                <Label>Bucket name</Label>
                <Input
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="my-bucket"
                />
                <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers and hyphens only.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Public bucket</p>
                  <p className="text-[11px] text-muted-foreground">{isR2 ? "Anyone with the r2.dev link can view files" : "Anyone with the link can view files"}</p>
                </div>
                <Switch checked={newBucketPublic} onCheckedChange={setNewBucketPublic} />
              </div>
              <div className="space-y-1.5">
                <Label>Max file size (MB)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={newBucketLimit}
                  onChange={(e) => setNewBucketLimit(e.target.value)}
                  placeholder="5"
                />
                {limitPresets(newBucketLimit, setNewBucketLimit)}
              </div>
              <Button className="w-full" onClick={createBucket} disabled={busy || !newBucketName.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create bucket
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Bucket settings */}
        <Sheet open={!!settingsBucket} onOpenChange={(open) => !open && setSettingsBucket(null)}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base truncate">{settingsBucket?.name}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4 pb-8">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Public bucket</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isR2 ? "r2.dev public access; custom domains are unchanged" : settingsPublic ? "Files open with a normal link" : "Files need a signed link"}
                  </p>
                </div>
                <Switch checked={settingsPublic} onCheckedChange={setSettingsPublic} />
              </div>
              <div className="space-y-1.5">
                <Label>Max file size (MB)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={settingsLimit}
                  onChange={(e) => setSettingsLimit(e.target.value)}
                  placeholder="No limit"
                />
                {limitPresets(settingsLimit, setSettingsLimit)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {`${(settingsBucket?.fileCount ?? 0).toLocaleString()} files • ${formatBytes(settingsBucket?.totalSize ?? 0)}`}{isR2 ? " • Only an empty bucket can be deleted." : null}
              </p>
              {isR2 && settingsBucket && (
                <Button variant="outline" className="w-full" onClick={() => recountBucket(settingsBucket.name)} disabled={!!recounting}>
                  {recounting === settingsBucket.name ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Recount files
                </Button>
              )}
              <Button className="w-full" onClick={() => isR2 && settingsBucket && settingsPublic !== settingsBucket.public ? setConfirmSettings(true) : saveBucketSettings()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save changes
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setDeleteBucketName(settingsBucket?.name || null)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete bucket
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <AlertDialog open={!!deleteBucketName} onOpenChange={(open) => !open && setDeleteBucketName(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete bucket {deleteBucketName}?</AlertDialogTitle>
              <AlertDialogDescription>
                {isR2 ? "Only an empty bucket can be deleted. Website links to it will stop working. This cannot be undone." : "Every file inside this bucket will be permanently removed. This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={removeBucket} disabled={busy} className="bg-destructive text-destructive-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={confirmSettings} onOpenChange={setConfirmSettings}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change public access for {settingsBucket?.name}?</AlertDialogTitle>
              <AlertDialogDescription>{settingsPublic ? "Anyone with an r2.dev link can read this bucket’s files." : "Existing r2.dev links will stop working. Signed links remain available."} Custom domains are unchanged.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmSettings(false); saveBucketSettings(); }}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ---------- File browser ----------
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => {
              // Replace (not push) so Back never loops between a folder and its parent.
              if (prefix) {
                const parts = prefix.split("/").filter(Boolean);
                parts.pop();
                setPrefix(parts.join("/"), true);
              } else {
                navigateTo("", "", true);
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{activeBucket.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{prefix ? `/${prefix}` : "Root folder"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => loadFiles(activeBucket.name, prefix, search)}>
            <RefreshCw className={`h-5 w-5 ${loadingFiles ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files"
              className="pl-9 h-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="New folder" onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Upload files" onClick={() => uploadRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <input
            ref={uploadRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => isR2 ? setPendingUploads(e.target.files) : handleUpload(e.target.files)}
          />
        </div>

        <div className="px-4 pb-3 flex items-center gap-2">
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            className="h-10 flex-1 w-full"
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected([]);
              setSelectedFolders([]);
            }}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            {selectMode ? "Cancel" : "Select"}
          </Button>
          {selectMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-10 flex-1 w-full"
                onClick={toggleSelectAll}
                disabled={totalItems === 0}
              >
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </>
          )}
        </div>

        {uploadProgress && (
          <div className="px-4 pb-3">
            <p className="text-[11px] text-muted-foreground truncate">Uploading {uploadProgress.name} • {uploadProgress.percent}%</p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
              <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress.percent}%` }} />
            </div>
          </div>
        )}

        {breadcrumbs.length > 0 && (
          <div className="px-4 pb-3 flex items-center gap-1 overflow-x-auto text-xs text-muted-foreground">
            <button className="underline" onClick={() => setPrefix("")}>root</button>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.prefix} className="flex items-center gap-1 whitespace-nowrap">
                <ChevronRight className="h-3 w-3" />
                <button className="underline" onClick={() => setPrefix(crumb.prefix)}>{crumb.name}</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        {loadingFiles && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingFiles && folders.length === 0 && files.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-16">This folder is empty.</p>
        )}

        {!loadingFiles &&
          sortedFolders.map((folder) => (
            <Card key={folder.prefix} className={selectedFolders.includes(folder.prefix) ? "ring-2 ring-primary" : ""}>
              <CardContent className="flex items-center gap-3 p-3">
                {selectMode && (
                  <Checkbox
                    checked={selectedFolders.includes(folder.prefix)}
                    onCheckedChange={() => toggleSelectFolder(folder.prefix)}
                    className="flex-shrink-0"
                  />
                )}
                <button
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  onClick={() => (selectMode ? toggleSelectFolder(folder.prefix) : setPrefix(folder.prefix))}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Folder className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{folder.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {folderStats[folder.name]
                        ? `${folderStats[folder.name].fileCount} files • ${formatBytes(folderStats[folder.name].totalSize)}${formatDateTime(folderStats[folder.name].latestAt) ? ` • ${formatDateTime(folderStats[folder.name].latestAt)}` : ""}`
                        : "—"}
                    </p>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget({ kind: "folder", label: folder.name, value: folder.prefix })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}

        {!loadingFiles &&
          sortedFiles.map((file) => (
            <Card key={file.path} className={selected.includes(file.path) ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {selectMode && (
                    <Checkbox
                      checked={selected.includes(file.path)}
                      onCheckedChange={() => toggleSelect(file.path)}
                      className="flex-shrink-0"
                    />
                  )}
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => (selectMode ? toggleSelect(file.path) : openPreview(file))}
                  >
                    <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                      {isImage(file) && file.publicUrl && activeBucket.public ? (
                        <img src={file.publicUrl} alt={file.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        fileIcon(file)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatBytes(file.size)}
                        {formatDateTime(file.updatedAt) ? ` • ${formatDateTime(file.updatedAt)}` : ""}
                      </p>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => copyLink(file)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Link
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadFile(file)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget({ kind: "file", label: file.name, value: file.path })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

        {hasMore && !loadingFiles && (
          <Button
            variant="outline"
            className="w-full"
            disabled={loadingMore}
            onClick={() => loadFiles(activeBucket.name, prefix, search, isR2 ? 1 : files.length, nextCursor)}
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HardDrive className="h-4 w-4 mr-2" />}
            Load more
          </Button>
        )}
      </div>

      <AlertDialog open={!!pendingUploads} onOpenChange={(open) => { if (!open) { setPendingUploads(null); if (uploadRef.current) uploadRef.current.value = ""; } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload to Cloudflare CDN?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              {pendingUploads ? Array.from(pendingUploads).map((f) => f.name).join(", ") : ""} will be uploaded to {activeBucket.name}/{prefix}. Existing files with these names will be replaced and cannot be recovered. Cloudflare storage charges may apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const list = pendingUploads; setPendingUploads(null); handleUpload(list); }}>Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Bulk delete bar */}
      {selectMode && totalSelected > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
          <span className="text-sm flex-1">{totalSelected} item{totalSelected === 1 ? "" : "s"} selected</span>
          <Button variant="destructive" onClick={() => setBulkOpen(true)} disabled={busy}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete selected
          </Button>
        </div>
      )}

      <AlertDialog open={bulkOpen} onOpenChange={(open) => !open && setBulkOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {totalSelected} items?</AlertDialogTitle>
            <AlertDialogDescription>
              All selected files and folders (including everything inside them) will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} disabled={busy} className="bg-destructive text-destructive-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Preview sheet */}
      <Sheet open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="truncate text-base">{previewFile?.name}</SheetTitle>
          </SheetHeader>
          {previewFile && (
            <div className="space-y-4 pb-6">
              <div className="rounded-xl bg-muted overflow-hidden flex items-center justify-center min-h-[160px]">
                {!previewUrl ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : isImage(previewFile) ? (
                  <img src={previewUrl} alt={previewFile.name} className="max-h-[50vh] w-auto object-contain" />
                ) : isVideo(previewFile) ? (
                  <video src={previewUrl} controls className="w-full max-h-[50vh]" />
                ) : isAudio(previewFile) ? (
                  <audio src={previewUrl} controls className="w-full p-4" />
                ) : (
                  <div className="p-8 text-center">
                    {fileIcon(previewFile)}
                    <p className="text-xs text-muted-foreground mt-2">Preview not available</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="break-all">Path: {previewFile.path}</p>
                <p>Size: {formatBytes(previewFile.size)}</p>
                {formatDateTime(previewFile.updatedAt) ? (
                  <p>Modified: {formatDateTime(previewFile.updatedAt)}</p>
                ) : null}
                <p>Type: {previewFile.contentType || "unknown"}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => copyLink(previewFile)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy link
                </Button>
                <Button variant="outline" onClick={() => downloadFile(previewFile)}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
                {previewUrl && (
                  <Button variant="outline" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}>
                    Open
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget({ kind: "file", label: previewFile.name, value: previewFile.path })}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.kind === "folder" ? "folder" : "file"}?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              {deleteTarget?.label}
              {deleteTarget?.kind === "folder" ? " and everything inside it" : ""} will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy} className="bg-destructive text-destructive-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>

      {/* Create folder */}
      <Sheet open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <SheetContent side="bottom" keyboardAware className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">New folder</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4 pb-8">
            <div className="space-y-1.5">
              <Label>Folder name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="banners"
              />
              <p className="text-[11px] text-muted-foreground break-all">
                Will be created in {activeBucket.name}/{prefix || ""}
              </p>
            </div>
            <Button className="w-full" onClick={createFolder} disabled={busy || !newFolderName.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create folder
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default StorageManager;
