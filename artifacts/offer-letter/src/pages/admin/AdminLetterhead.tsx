import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/hooks/use-auth';
import { Upload, Download, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface LetterheadStatus { present: boolean; updatedAt: string | null; }

export default function AdminLetterhead() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<LetterheadStatus | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadStatus() {
    const r = await fetch(`${apiBase()}/admin/letterhead/status`, { credentials: 'include' });
    if (r.ok) setStatus(await r.json());
  }

  useEffect(() => { loadStatus(); }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      toast({ title: 'Invalid file', description: 'Please upload a .docx file.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const r = await fetch(`${apiBase()}/admin/letterhead`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buf,
      });
      if (r.ok) {
        const data = await r.json();
        await loadStatus();
        toast({ title: 'Letterhead Updated', description: `Template uploaded (${(data.bytes / 1024).toFixed(1)} KB).` });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'Upload Failed', description: err.error ?? 'Failed to upload letterhead.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Upload Failed', description: 'Network error.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload() {
    const r = await fetch(`${apiBase()}/admin/letterhead`, { credentials: 'include' });
    if (r.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Letterhead_Template.docx';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast({ title: 'Error', description: 'No letterhead template found.', variant: 'destructive' });
    }
  }

  const updatedAt = status?.updatedAt ? new Date(status.updatedAt).toLocaleString() : null;

  return (
    <AdminLayout>
      <div className="max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-serif font-bold">Letterhead Template</h1>
            <p className="text-sm text-muted-foreground">
              Upload the .docx file that serves as the letterhead for all exported offer letters.
              The offer letter content will be inserted into this document's body.
            </p>
          </div>
        </div>

        {/* Status card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status === null ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : status.present ? (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Letterhead template is configured.</p>
                  {updatedAt && <p className="text-xs text-muted-foreground mt-1">Last updated: {updatedAt}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No letterhead template uploaded yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Offer letter exports will fall back to HTML format until a template is configured.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{status?.present ? 'Replace Template' : 'Upload Template'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The .docx file should contain your Kinross letterhead (logo, header, footer).
              The body content will be replaced with the generated offer letter text on export.
            </p>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select a .docx file</p>
              <p className="text-xs text-muted-foreground mt-1">Only .docx files are accepted</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploading && <p className="text-sm text-primary animate-pulse">Uploading…</p>}
          </CardContent>
        </Card>

        {/* Download current template */}
        {status?.present && (
          <Button variant="outline" onClick={handleDownload} className="w-full">
            <Download className="w-4 h-4 mr-2" /> Download Current Template
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}
