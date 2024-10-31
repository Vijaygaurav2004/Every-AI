export interface BlogPost {
  content: string;
  metadata: {
    topic: string;
    keywords: string[];
    wordCount: number;
    generatedDate: string;
  };
}
