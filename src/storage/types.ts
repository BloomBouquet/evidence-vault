export type PutEvidenceObjectInput = {
  storageKey: string;
  bytes: Uint8Array;
  mimeType: string;
};

export type EvidenceDownloadTarget =
  | {
      kind: "bytes";
      bytes: Uint8Array;
    }
  | {
      kind: "redirect";
      url: string;
      expiresAt: Date;
    };

export type DownloadTargetInput = {
  storageKey: string;
  expiresInSeconds: number;
};

export interface EvidenceStorage {
  putObject(input: PutEvidenceObjectInput): Promise<void>;
  deleteObject(storageKey: string): Promise<void>;
  getDownloadTarget(input: DownloadTargetInput): Promise<EvidenceDownloadTarget>;
}
