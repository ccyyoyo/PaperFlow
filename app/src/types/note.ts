export type Note = {
  id: string;
  paperId: string;
  page: number;
  x: number;
  y: number;
  content: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewNote = {
  paperId: string;
  page: number;
  x: number;
  y: number;
  content: string;
  color?: string;
};

export type UpdateNote = {
  id: string;
  content?: string;
  color?: string;
};
