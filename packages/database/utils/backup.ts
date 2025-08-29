import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const execAsync = promisify(exec);

export interface BackupOptions {
  outputPath?: string;
  compress?: boolean;
  includeData?: boolean;
  schemaOnly?: boolean;
  tables?: string[];
  excludeTables?: string[];
  format?: 'custom' | 'plain' | 'directory';
}

export interface RestoreOptions {
  backupPath: string;
  dropExisting?: boolean;
  dataOnly?: boolean;
  schemaOnly?: boolean;
  tables?: string[];
  excludeTables?: string[];
}

export interface BackupInfo {
  filePath: string;
  size: number;
  createdAt: Date;
  metadata: {
    version: string;
    database: string;
    host: string;
    tables: number;
    compressed: boolean;
    format: string;
  };
}

// Create database backup
export async function createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
  const {
    outputPath,
    compress = true,
    includeData = true,
    schemaOnly = false,
    tables = [],
    excludeTables = [],
    format = 'custom'
  } = options;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const baseFileName = `backup-${timestamp}`;
  const extension = format === 'directory' ? '' : format === 'custom' ? '.dump' : '.sql';
  const fileName = compress && format !== 'directory' ? `${baseFileName}${extension}.gz` : `${baseFileName}${extension}`;
  const filePath = outputPath || path.join(backupDir, fileName);

  // Ensure backup directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Build pg_dump command
  const pgDumpArgs = [
    `--dbname=${databaseUrl}`,
    `--format=${format}`,
    '--verbose',
    '--no-password'
  ];

  if (schemaOnly) {
    pgDumpArgs.push('--schema-only');
  } else if (!includeData) {
    pgDumpArgs.push('--no-data');
  }

  // Add table filters
  if (tables.length > 0) {
    tables.forEach(table => {
      pgDumpArgs.push(`--table=${table}`);
    });
  }

  if (excludeTables.length > 0) {
    excludeTables.forEach(table => {
      pgDumpArgs.push(`--exclude-table=${table}`);
    });
  }

  if (format === 'directory') {
    pgDumpArgs.push(`--file=${filePath}`);
  }

  const command = `pg_dump ${pgDumpArgs.join(' ')}`;

  try {
    if (format === 'directory') {
      await execAsync(command);
    } else if (compress && format !== 'custom') {
      // For plain format with compression
      const { stdout } = await execAsync(`${command} | gzip`);
      await fs.writeFile(filePath, stdout);
    } else {
      // For custom format or uncompressed
      const { stdout } = await execAsync(command);
      if (compress && format === 'custom') {
        // Compress custom format
        const tempPath = filePath.replace('.gz', '');
        await fs.writeFile(tempPath, stdout);
        
        const source = createReadStream(tempPath);
        const destination = createWriteStream(filePath);
        const gzip = createGzip();
        
        await pipeline(source, gzip, destination);
        await fs.unlink(tempPath);
      } else {
        await fs.writeFile(filePath, stdout);
      }
    }

    // Get backup info
    const stats = await fs.stat(filePath);
    const metadata = await getBackupMetadata(databaseUrl);

    const backupInfo: BackupInfo = {
      filePath,
      size: stats.size,
      createdAt: new Date(),
      metadata: {
        ...metadata,
        compressed: compress,
        format
      }
    };

    console.log(`✅ Backup created successfully: ${filePath}`);
    console.log(`📊 Size: ${formatBytes(stats.size)}`);
    
    return backupInfo;

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Restore database from backup
export async function restoreBackup(options: RestoreOptions): Promise<void> {
  const {
    backupPath,
    dropExisting = false,
    dataOnly = false,
    schemaOnly = false,
    tables = [],
    excludeTables = []
  } = options;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Check if backup file exists
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  // Determine if backup is compressed
  const isCompressed = backupPath.endsWith('.gz');
  const isCustomFormat = backupPath.includes('.dump');
  
  // Build pg_restore command
  const pgRestoreArgs = [
    `--dbname=${databaseUrl}`,
    '--verbose',
    '--no-password'
  ];

  if (dropExisting) {
    pgRestoreArgs.push('--clean', '--if-exists');
  }

  if (dataOnly) {
    pgRestoreArgs.push('--data-only');
  } else if (schemaOnly) {
    pgRestoreArgs.push('--schema-only');
  }

  // Add table filters
  if (tables.length > 0) {
    tables.forEach(table => {
      pgRestoreArgs.push(`--table=${table}`);
    });
  }

  if (excludeTables.length > 0) {
    excludeTables.forEach(table => {
      pgRestoreArgs.push(`--exclude-table=${table}`);
    });
  }

  try {
    let command: string;

    if (isCustomFormat) {
      // Use pg_restore for custom format
      pgRestoreArgs.push(isCompressed ? '--file=-' : backupPath);
      command = isCompressed 
        ? `gunzip -c ${backupPath} | pg_restore ${pgRestoreArgs.join(' ')}`
        : `pg_restore ${pgRestoreArgs.join(' ')}`;
    } else {
      // Use psql for plain format
      const psqlArgs = [
        `--dbname=${databaseUrl}`,
        '--no-password'
      ];
      
      command = isCompressed
        ? `gunzip -c ${backupPath} | psql ${psqlArgs.join(' ')}`
        : `psql ${psqlArgs.join(' ')} < ${backupPath}`;
    }

    await execAsync(command);
    console.log(`✅ Database restored successfully from: ${backupPath}`);

  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  }
}

// List available backups
export async function listBackups(backupDir?: string): Promise<BackupInfo[]> {
  const searchDir = backupDir || path.join(process.cwd(), 'backups');
  
  try {
    const files = await fs.readdir(searchDir);
    const backupFiles = files.filter(file => 
      file.startsWith('backup-') && 
      (file.endsWith('.sql') || file.endsWith('.dump') || file.endsWith('.gz'))
    );

    const backups: BackupInfo[] = [];

    for (const file of backupFiles) {
      const filePath = path.join(searchDir, file);
      const stats = await fs.stat(filePath);
      
      // Try to parse metadata from filename
      const compressed = file.endsWith('.gz');
      const format = file.includes('.dump') ? 'custom' : 'plain';
      
      backups.push({
        filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        metadata: {
          version: 'unknown',
          database: 'unknown', 
          host: 'unknown',
          tables: 0,
          compressed,
          format
        }
      });
    }

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Delete old backups based on retention policy
export async function cleanupBackups(options: {
  backupDir?: string;
  keepDays?: number;
  keepCount?: number;
} = {}): Promise<number> {
  const { backupDir, keepDays = 30, keepCount } = options;
  const backups = await listBackups(backupDir);
  
  let toDelete: BackupInfo[] = [];

  if (keepCount && backups.length > keepCount) {
    toDelete = backups.slice(keepCount);
  }

  if (keepDays) {
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
    const expiredBackups = backups.filter(backup => backup.createdAt < cutoffDate);
    
    // Merge with count-based deletions, avoiding duplicates
    for (const expired of expiredBackups) {
      if (!toDelete.find(b => b.filePath === expired.filePath)) {
        toDelete.push(expired);
      }
    }
  }

  // Delete files
  for (const backup of toDelete) {
    try {
      await fs.unlink(backup.filePath);
      console.log(`🗑️ Deleted old backup: ${path.basename(backup.filePath)}`);
    } catch (error) {
      console.error(`Failed to delete backup: ${backup.filePath}`, error);
    }
  }

  return toDelete.length;
}

// Verify backup integrity
export async function verifyBackup(backupPath: string): Promise<{
  valid: boolean;
  size: number;
  format: string;
  compressed: boolean;
  error?: string;
}> {
  try {
    await fs.access(backupPath);
    const stats = await fs.stat(backupPath);
    
    const compressed = backupPath.endsWith('.gz');
    const format = backupPath.includes('.dump') ? 'custom' : 'plain';
    
    // Basic validation - check if file is not empty and readable
    if (stats.size === 0) {
      return {
        valid: false,
        size: stats.size,
        format,
        compressed,
        error: 'Backup file is empty'
      };
    }

    // For compressed files, try to read header
    if (compressed) {
      try {
        const command = `gunzip -t ${backupPath}`;
        await execAsync(command);
      } catch (error) {
        return {
          valid: false,
          size: stats.size,
          format,
          compressed,
          error: 'Compressed file is corrupted'
        };
      }
    }

    return {
      valid: true,
      size: stats.size,
      format,
      compressed
    };

  } catch (error) {
    return {
      valid: false,
      size: 0,
      format: 'unknown',
      compressed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper functions
async function getBackupMetadata(databaseUrl: string) {
  try {
    const { stdout: version } = await execAsync(`psql "${databaseUrl}" -t -c "SELECT version()"`);
    const { stdout: database } = await execAsync(`psql "${databaseUrl}" -t -c "SELECT current_database()"`);
    const { stdout: host } = await execAsync(`psql "${databaseUrl}" -t -c "SELECT inet_server_addr()"`);
    const { stdout: tableCount } = await execAsync(`psql "${databaseUrl}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"`);

    return {
      version: version.trim(),
      database: database.trim(),
      host: host.trim() || 'localhost',
      tables: parseInt(tableCount.trim()) || 0
    };
  } catch (error) {
    return {
      version: 'unknown',
      database: 'unknown',
      host: 'unknown',
      tables: 0
    };
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}