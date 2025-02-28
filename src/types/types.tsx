export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }
  
  export interface Document {
    id: string;
    name: string;
    content: string;
  }
  
  export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    documents: Document[];
  }

  