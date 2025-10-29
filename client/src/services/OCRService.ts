export type OCRClient = {
  extractText(filePath: string): Promise<string>;
};

export class OCRService {
  constructor(private readonly ocrClient: OCRClient) {}

  async extractText(filePath: string): Promise<string> {
    return this.ocrClient.extractText(filePath);
  }
}
