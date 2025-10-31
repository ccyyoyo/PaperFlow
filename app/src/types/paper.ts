export type Paper = {
  id: string;
  workspaceId: string;
  title: string;
  doi?: string;
  path: string;
  lastSeenPath?: string;
  fileHash: string;
  filesize?: number;
  createdAt: string;
  updatedAt: string;
};

export type PaperImportRequest = {
  paths: string[];
  workspaceId: string;
};
