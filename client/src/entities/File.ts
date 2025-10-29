import { FileKind } from './enums';

export class File {
  id!: string;
  filePath!: string;
  kind!: FileKind;
  mime!: string;
  size!: number;
  hash?: string;
  createdAt!: Date;

  constructor(init?: Partial<File>) {
    Object.assign(this, init);
    if (typeof this.createdAt === 'string') {
      this.createdAt = new Date(this.createdAt);
    }
    if (typeof this.kind === 'string') {
      this.kind = this.kind as FileKind;
    }
  }
}
