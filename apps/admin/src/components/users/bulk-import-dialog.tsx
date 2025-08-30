'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,\n} from '@penny/ui';
import { Upload, Download, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportedUser {
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tenant, setTenant] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importedUsers, setImportedUsers] = useState<ImportedUser[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Parse CSV file
      parseCSV(selectedFile);
    }
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('
').filter((line) => line.trim());
    const headers = lines[0].split(',').map((h) => h.trim());

    const users: ImportedUser[] = lines
      .slice(1)
      .map((line) => {
        const values = line.split(',').map((v) => v.trim());
        return {
          email: values[headers.indexOf('email')] || '',
          name: values[headers.indexOf('name')] || '',
          role: values[headers.indexOf('role')] || 'member',
          status: 'pending',
        };
      })
      .filter((u) => u.email);

    setImportedUsers(users);
  };

  const handleImport = async () => {
    setIsLoading(true);

    // Simulate API calls for each user
    const results = await Promise.all(
      importedUsers.map(async (user, index) => {
        await new Promise((resolve) => setTimeout(resolve, 200 * index));

        // Simulate random success/failure
        const success = Math.random() > 0.1;
        return {
          ...user,
          status: success ? 'success' : 'error',
          message: success ? undefined : 'User already exists',
        } as ImportedUser;
      }),
    );

    setImportedUsers(results);
    setShowResults(true);
    setIsLoading(false);
  };

  const downloadTemplate = () => {
    const csv =
      'email,name,role
user1@example.com,John Doe,member\nuser2@example.com,Jane Smith,admin';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setImportedUsers([]);
    setShowResults(false);
    setTenant('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>Import multiple users from a CSV file</DialogDescription>
        </DialogHeader>

        {!showResults ? (\n          <div className="space-y-4">
            <div className="grid gap-2">\n              <Label htmlFor="tenant">Tenant</Label>
              <Select value={tenant} onValueChange={setTenant}>\n                <SelectTrigger id="tenant">\n                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>\n                  <SelectItem value="acme">Acme Corporation</SelectItem>\n                  <SelectItem value="techstart">TechStart Inc</SelectItem>\n                  <SelectItem value="digital">Digital Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
\n            <div className="space-y-2">
              <Label>CSV File</Label>\n              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>\n                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>\n                <span className="text-sm text-muted-foreground">
                  Use this template to format your data
                </span>
              </div>
\n              <div className="mt-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
                <input\n                  type="file"\n                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />\n                <label htmlFor="csv-upload" className="flex flex-col items-center cursor-pointer">
                  <Upload className="h-12 w-12 text-gray-400 mb-2" />\n                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </span>\n                  <span className="text-xs text-gray-500 dark:text-gray-500">CSV files only</span>
                </label>
              </div>
            </div>

            {importedUsers.length > 0 && (
              <Alert>
                <AlertDescription>
                  Found {importedUsers.length} users in the file. Review and click import to
                  proceed.
                </AlertDescription>
              </Alert>
            )}

            {importedUsers.length > 0 && (\n              <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedUsers.slice(0, 5).map((user, index) => (
                      <TableRow key={index}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.role}</TableCell>
                      </TableRow>
                    ))}
                    {importedUsers.length > 5 && (
                      <TableRow>\n                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          ... and {importedUsers.length - 5} more users
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (\n          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Import completed. {importedUsers.filter((u) => u.status === 'success').length} of{' '}
                {importedUsers.length} users imported successfully.
              </AlertDescription>
            </Alert>
\n            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedUsers.map((user, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {user.status === 'success' ? (\n                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (\n                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>\n                      <TableCell className="text-sm text-muted-foreground">
                        {user.message || 'Success'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {!showResults ? (
            <>
              <Button\n                type="button"\n                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={isLoading || !tenant || importedUsers.length === 0}
              >
                {isLoading ? (
                  <>\n                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>\n                    <Upload className="mr-2 h-4 w-4" />
                    Import {importedUsers.length} Users
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
