export enum ContentType {
  TEXT = 'TEXT',
  COMIC = 'COMIC',
  NEWS = 'NEWS',
}

export enum Visibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum StoryStatus {
  DRAFT = 'DRAFT',
  OCR_IN_PROGRESS = 'OCR_IN_PROGRESS',
  READY = 'READY',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum FileKind {
  CONTENT = 'CONTENT',
  THUMBNAIL = 'THUMBNAIL',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
}
