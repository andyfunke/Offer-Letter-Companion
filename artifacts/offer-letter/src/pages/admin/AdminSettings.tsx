import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/hooks/use-auth';
import { Settings, ExternalLink, Save, Link2 } from 'lucide-react';

export default function AdminSettings() {
  const { toast } = useToast();
  const [folderUrl, setFolderUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentPageUrl = window.location.href;

  useEffect(() => {
    fetch(`${apiBase()}/admin/settings/template-folder-url`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { value: '' })
      .then(d => { setFolderUrl(d.value ?? ''); setSaved(d.value ?? ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`${apiBase()}/admin/settings/template-folder-url`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: folderUrl.trim() }),
      });
      if (r.ok) {
        setSaved(folderUrl.trim());
        toast({ title: 'Saved', description: 'Template folder URL updated.' });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'Error', description: err.error ?? 'Failed to save.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach server.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">App Settings</h1>
            <p className="text-sm text-muted-foreground">Global configuration for the Offer Letter Companion.</p>
          </div>
        </div>

        {/* Current page URL reference */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />This Settings Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">Bookmark or share this direct link to return to Settings.</p>
            <a
              href={currentPageUrl}
              className="block font-mono text-xs text-primary break-all hover:underline"
            >
              {currentPageUrl}
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Template Folder Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The shared folder where offer letter template files (.docx) are stored.
              Paste a SharePoint, OneDrive, or any URL. Recruiters will see an
              &ldquo;Open Folder&rdquo; link on the main screen pointing here.
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="folder-url">Folder URL</Label>
                <Input
                  id="folder-url"
                  type="url"
                  placeholder="https://your-org.sharepoint.com/..."
                  value={folderUrl}
                  onChange={e => setFolderUrl(e.target.value)}
                  className="font-mono text-xs"
                />
                {saved && (
                  <a
                    href={saved}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {saved}
                  </a>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || folderUrl.trim() === saved || loading} className="gap-2">
                <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
              </Button>
              {saved && (
                <a href={saved} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />Open folder
                </a>
              )}
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 text-xs text-muted-foreground">
          Templates are scoped per-user in the database. This URL is a navigation reference only.
        </p>
      </div>
    </AdminLayout>
  );
}
