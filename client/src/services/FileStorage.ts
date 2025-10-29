export type StoredFile = { buffer: Buffer; filename: string; mime: string };

export interface FileStorage {
  save(file: StoredFile): Promise<{ path: string; size: number }>;
  getUrl(path: string): string;
  delete(path: string): Promise<void>;
}
